"""Runs inside Blender: builds every prop of `prop_defs.py` and renders one G-buffer image of it.

    blender --background --factory-startup --python blender_render.py -- <out-dir> [<prop> ...]

The render is no lit picture. Every material emits an encoding of the surface instead: red and
green are the x and z of the world normal mapped to [0, 1] — the view looks along +y, so x is the
right of the image and z its top, and the y of a visible normal follows from the two — blue is the
id of the material divided by 255, alpha the coverage. One sample, a box filter of 0.01 px, no
bounces and the Raw view transform make every pixel an exact point sample of the nearest surface,
so `build_cardboard.py` decodes it without guessing, and the render is the same on every run.

Next to the images it writes `frames.json`: per prop the size of its frame in output pixels.
"""

import json
import math
import os
import sys

import bmesh
import bpy

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from prop_defs import MARGIN, MATERIAL_IDS, PROPS, PX_PER_M, SUPERSAMPLE  # noqa: E402

# space beside and above the print for the cut margin and one pixel of air; below it the margin
# alone, so the margin of a standing prop reaches the bottom edge of its frame
PAD_SIDE = MARGIN + 2
PAD_TOP = MARGIN + 2
PAD_BOTTOM = MARGIN


def reset_scene():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = 1
    scene.cycles.use_adaptive_sampling = False
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 0
    scene.cycles.seed = 0
    scene.cycles.pixel_filter_type = 'BOX'
    scene.cycles.filter_width = 0.01
    scene.render.film_transparent = True
    scene.render.dither_intensity = 0
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 0
    scene.view_settings.view_transform = 'Raw'
    scene.view_settings.look = 'None'
    scene.view_settings.exposure = 0
    scene.view_settings.gamma = 1
    scene.render.resolution_percentage = 100
    scene.render.pixel_aspect_x = 1
    scene.render.pixel_aspect_y = 1
    return scene


def gbuffer_material(name):
    material = bpy.data.materials.new(f'gbuffer_{name}')
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()

    geometry = nodes.new('ShaderNodeNewGeometry')
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(geometry.outputs['Normal'], split.inputs['Vector'])

    def to_unit(output):
        node = nodes.new('ShaderNodeMath')
        node.operation = 'MULTIPLY_ADD'
        node.inputs[1].default_value = 0.5
        node.inputs[2].default_value = 0.5
        links.new(output, node.inputs[0])
        return node.outputs[0]

    combine = nodes.new('ShaderNodeCombineColor')
    links.new(to_unit(split.outputs['X']), combine.inputs[0])
    links.new(to_unit(split.outputs['Z']), combine.inputs[1])
    combine.inputs[2].default_value = MATERIAL_IDS[name] / 255

    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = 1
    links.new(combine.outputs['Color'], emission.inputs['Color'])
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    return material


def mesh_object(name, build, smooth):
    mesh = bpy.data.meshes.new(name)
    bm = bmesh.new()
    build(bm)
    bm.to_mesh(mesh)
    bm.free()
    if smooth:
        mesh.shade_smooth()
    else:
        mesh.shade_flat()
    obj = bpy.data.objects.new(name, mesh)
    bpy.context.scene.collection.objects.link(obj)
    return obj


def build_part(index, part, materials):
    shape = part['shape']
    name = f'part_{index}'
    if shape == 'box':
        obj = mesh_object(name, lambda bm: bmesh.ops.create_cube(bm, size=1), smooth=False)
        obj.scale = part['size']
        obj.rotation_euler = [math.radians(a) for a in part['rotation']]
        obj.location = part['center']
    elif shape == 'cone':
        height = part['height']

        def build(bm):
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=part['segments'],
                                  radius1=part['radius1'], radius2=part['radius2'], depth=height)

        obj = mesh_object(name, build, smooth=part['smooth'])
        x, y, z = part['base']
        obj.location = (x, y, z + height / 2)
    elif shape == 'sphere':
        obj = mesh_object(name, lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=32, v_segments=16,
                                                                       radius=part['radius']), smooth=part['smooth'])
        obj.scale = part['scale']
        obj.location = part['center']
    elif shape == 'hull':
        def build(bm):
            for point in part['points']:
                bm.verts.new(point)
            bmesh.ops.convex_hull(bm, input=bm.verts[:])

        obj = mesh_object(name, build, smooth=False)
    else:
        raise ValueError(f'unknown shape {shape}')
    obj.data.materials.append(materials[part['material']])
    # smooth parts would shade their caps as one curved surface: the edges between faces that
    # meet at an angle stay sharp
    if part.get('smooth') and shape == 'cone':
        obj.data.set_sharp_from_angle(angle=math.radians(50))
    return obj


def cut_at_ground(obj):
    """Bakes the transform into the mesh and cuts away everything below z = 0: a standing prop may
    sink into the ground, and its print ends level at its feet."""
    obj.data.transform(obj.matrix_world)
    obj.matrix_world.identity()
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    geometry = bm.verts[:] + bm.edges[:] + bm.faces[:]
    bmesh.ops.bisect_plane(bm, geom=geometry, plane_co=(0, 0, 0), plane_no=(0, 0, 1), clear_inner=True)
    bm.to_mesh(obj.data)
    bm.free()


def bounds(objects):
    bpy.context.view_layer.update()
    xs, zs = [], []
    for obj in objects:
        for vertex in obj.data.vertices:
            world = obj.matrix_world @ vertex.co
            xs.append(world.x)
            zs.append(world.z)
    return min(xs), max(xs), min(zs), max(zs)


def render_prop(prop, out_dir):
    scene = reset_scene()
    materials = {name: gbuffer_material(name) for name in MATERIAL_IDS}
    objects = [build_part(i, part, materials) for i, part in enumerate(prop['parts'])]
    if prop['standing']:
        bpy.context.view_layer.update()
        for obj in objects:
            cut_at_ground(obj)

    x_min, x_max, z_min, z_max = bounds(objects)
    if prop['standing']:
        z_min = 0.0
    width_px = math.ceil((x_max - x_min) * PX_PER_M) + 2 * PAD_SIDE
    height_px = math.ceil((z_max - z_min) * PX_PER_M) + PAD_BOTTOM + PAD_TOP
    width = width_px / PX_PER_M
    height = height_px / PX_PER_M
    left = (x_min + x_max) / 2 - width / 2
    bottom = z_min - PAD_BOTTOM / PX_PER_M

    camera_data = bpy.data.cameras.new('camera')
    camera_data.type = 'ORTHO'
    camera_data.ortho_scale = max(width, height)
    camera_data.sensor_fit = 'AUTO'
    camera_data.clip_start = 0.1
    camera_data.clip_end = 100
    camera = bpy.data.objects.new('camera', camera_data)
    scene.collection.objects.link(camera)
    camera.location = (left + width / 2, -20, bottom + height / 2)
    camera.rotation_euler = (math.pi / 2, 0, 0)
    scene.camera = camera

    scene.render.resolution_x = width_px * SUPERSAMPLE
    scene.render.resolution_y = height_px * SUPERSAMPLE
    scene.render.filepath = os.path.join(out_dir, f"{prop['name']}.png")
    bpy.ops.render.render(write_still=True)
    return {'w': width_px, 'h': height_px}


def main():
    argv = sys.argv[sys.argv.index('--') + 1:]
    out_dir = os.path.abspath(argv[0])
    only = set(argv[1:])
    os.makedirs(out_dir, exist_ok=True)
    frames = {}
    for prop in PROPS:
        if only and prop['name'] not in only:
            continue
        frames[prop['name']] = render_prop(prop, out_dir)
        print(f"rendered {prop['name']}: {frames[prop['name']]['w']} x {frames[prop['name']]['h']} px")
    with open(os.path.join(out_dir, 'frames.json'), 'w') as file:
        json.dump(frames, file, indent=2, sort_keys=True)


main()
