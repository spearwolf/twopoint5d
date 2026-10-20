"""Runs inside Blender: builds the stalker — a hunched cyber-mutant with a gun arm, a claw and a
fleshy growth on its left shoulder — poses it per animation frame and renders a G-buffer image of
each frame from eight directions.

    blender -b --factory-startup --python blender_render.py -- <out-dir>

The render is no lit picture. Every material emits an encoding instead: red and green are the x and
y of the camera-space normal mapped to [0, 1] (x to the right of the image, y up), blue the id of the
material divided by 255, alpha the coverage. One sample, a box filter of 0.01 px, no bounces and the
Raw view transform make every pixel an exact point sample of the nearest surface, so the generator
(`generate.mjs`) shades it without guessing, and the render is the same on every run.

The views: view k shows the stalker with the camera k * 45 degrees counter-clockwise, seen from
above, from its front. View 0 is its front, view 2 its left side (it faces screen-left), view 4 its
back, view 6 its right side (it faces screen-right, the gun arm towards the camera).

Writes `<out-dir>/stalker_<anim>_<view>_<frame>.png` and `<out-dir>/renders.json`.
"""

import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Vector

FRAME_PX = 64
SUPERSAMPLE = 4
ORTHO = 2.6  # metres across the frame
ELEVATION = 8  # degrees the camera looks down
GROUND_PX = 62  # the row the soles stand on

MATERIALS = {'armour': 1, 'frame': 2, 'flesh': 3, 'visor': 4, 'neon': 5, 'cable': 6, 'gun': 7, 'flash': 8}

ANIMATIONS = {
    'idle': [
        dict(lean=14, head=-4, l_arm=(10, 25), r_arm=(-70, 0)),
        dict(lean=17, head=0, l_arm=(12, 30), r_arm=(-66, 4), pelvis=-0.015),
    ],
    'walk': [
        dict(lean=16, l_hip=-25, r_hip=25, l_knee=10, r_knee=30, l_arm=(25, 25), r_arm=(-72, 0)),
        dict(lean=18, l_hip=0, r_hip=-5, l_knee=5, r_knee=55, l_arm=(5, 25), r_arm=(-70, 0)),
        dict(lean=16, l_hip=25, r_hip=-25, l_knee=30, r_knee=10, l_arm=(-20, 25), r_arm=(-72, 0)),
        dict(lean=18, l_hip=-5, r_hip=0, l_knee=55, r_knee=5, l_arm=(5, 25), r_arm=(-70, 0)),
    ],
    'attack': [
        dict(lean=10, head=4, l_arm=(15, 40), r_arm=(-88, 0), l_hip=-10, r_hip=12, r_knee=15),
        dict(lean=6, head=0, l_arm=(15, 40), r_arm=(-78, 0), l_hip=-10, r_hip=12, r_knee=15, flash=True),
    ],
    'hurt': [
        dict(lean=-14, head=-25, l_arm=(-40, 10), r_arm=(-30, 20), l_hip=10, r_hip=-15, l_knee=25),
    ],
    'dead': [
        dict(lean=20, head=-20, l_arm=(-30, 60), r_arm=(-40, 10), l_hip=-60, r_hip=-30, l_knee=80, r_knee=50, fallen=True),
    ],
}


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
    scene.render.resolution_x = FRAME_PX * SUPERSAMPLE
    scene.render.resolution_y = FRAME_PX * SUPERSAMPLE
    scene.render.resolution_percentage = 100
    return scene


def gbuffer_material(name):
    material = bpy.data.materials.new(f'gbuffer_{name}')
    nodes = material.node_tree.nodes
    links = material.node_tree.links
    nodes.clear()
    geometry = nodes.new('ShaderNodeNewGeometry')
    to_camera = nodes.new('ShaderNodeVectorTransform')
    to_camera.vector_type = 'NORMAL'
    to_camera.convert_from = 'WORLD'
    to_camera.convert_to = 'CAMERA'
    links.new(geometry.outputs['Normal'], to_camera.inputs['Vector'])
    split = nodes.new('ShaderNodeSeparateXYZ')
    links.new(to_camera.outputs['Vector'], split.inputs['Vector'])

    def to_unit(output):
        node = nodes.new('ShaderNodeMath')
        node.operation = 'MULTIPLY_ADD'
        node.inputs[1].default_value = 0.5
        node.inputs[2].default_value = 0.5
        links.new(output, node.inputs[0])
        return node.outputs[0]

    combine = nodes.new('ShaderNodeCombineColor')
    links.new(to_unit(split.outputs['X']), combine.inputs[0])
    links.new(to_unit(split.outputs['Y']), combine.inputs[1])
    combine.inputs[2].default_value = MATERIALS[name] / 255
    emission = nodes.new('ShaderNodeEmission')
    emission.inputs['Strength'].default_value = 1
    links.new(combine.outputs['Color'], emission.inputs['Color'])
    output = nodes.new('ShaderNodeOutputMaterial')
    links.new(emission.outputs['Emission'], output.inputs['Surface'])
    return material


class Builder:
    def __init__(self):
        self.materials = {name: gbuffer_material(name) for name in MATERIALS}
        self.meshes = []

    def joint(self, name, parent, location):
        empty = bpy.data.objects.new(name, None)
        bpy.context.scene.collection.objects.link(empty)
        empty.parent = parent
        empty.location = location
        empty.rotation_mode = 'XYZ'
        return empty

    def _object(self, name, build, material, parent, location, rotation, scale, smooth):
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
        obj.data.materials.append(self.materials[material])
        obj.parent = parent
        obj.location = location
        obj.rotation_euler = [math.radians(a) for a in rotation]
        obj.scale = scale
        self.meshes.append(obj)
        return obj

    def box(self, name, material, parent, location, size, rotation=(0, 0, 0)):
        return self._object(name, lambda bm: bmesh.ops.create_cube(bm, size=1), material, parent, location,
                            rotation, size, smooth=False)

    def cylinder(self, name, material, parent, location, radius, length, rotation=(0, 0, 0), radius2=None,
                 segments=12):
        def build(bm):
            bmesh.ops.create_cone(bm, cap_ends=True, cap_tris=False, segments=segments, radius1=radius,
                                  radius2=radius if radius2 is None else radius2, depth=length)

        obj = self._object(name, build, material, parent, location, rotation, (1, 1, 1), smooth=True)
        obj.data.set_sharp_from_angle(angle=math.radians(50))
        return obj

    def sphere(self, name, material, parent, location, radius, scale=(1, 1, 1)):
        return self._object(name, lambda bm: bmesh.ops.create_uvsphere(bm, u_segments=20, v_segments=10,
                                                                         radius=radius),
                            material, parent, location, (0, 0, 0), scale, smooth=True)


def build_stalker():
    """The rig: joints are empties, parts hang below them. It faces -y, up is +z, left is +x."""
    b = Builder()
    rig = {}
    root = b.joint('root', None, (0, 0, 0))
    # tips the body over for the dead pose, about a point that centres the corpse on the root
    fall = b.joint('fall', root, (0, 0, 0))
    pelvis = b.joint('pelvis', fall, (0, 0, 0.95))
    rig['root'], rig['fall'], rig['pelvis'] = root, fall, pelvis
    b.box('pelvis_armour', 'armour', pelvis, (0, 0, 0), (0.38, 0.26, 0.18))
    b.box('belt_neon', 'neon', pelvis, (0, -0.135, 0.02), (0.30, 0.012, 0.03))

    spine = b.joint('spine', pelvis, (0, 0, 0.08))
    rig['spine'] = spine
    b.box('torso_frame', 'frame', spine, (0, 0.02, 0.22), (0.36, 0.26, 0.40))
    b.box('chest_plate', 'armour', spine, (0, -0.06, 0.32), (0.56, 0.24, 0.30), rotation=(-6, 0, 0))
    b.box('chest_neon', 'neon', spine, (0, -0.185, 0.30), (0.40, 0.012, 0.025), rotation=(-6, 0, 0))
    b.box('backpack', 'gun', spine, (0, 0.18, 0.30), (0.34, 0.14, 0.30))
    for i, x in enumerate((-0.09, 0.09)):
        b.cylinder(f'cable_{i}', 'cable', spine, (x, 0.18, 0.55), 0.035, 0.30, rotation=(-35, 0, 0))
    b.sphere('growth', 'flesh', spine, (0.26, 0.02, 0.46), 0.17, scale=(1, 0.9, 0.85))
    b.sphere('growth_small', 'flesh', spine, (0.34, -0.06, 0.34), 0.09)

    neck = b.joint('neck', spine, (0, -0.06, 0.50))
    rig['neck'] = neck
    b.cylinder('neck_frame', 'frame', neck, (0, 0, 0.05), 0.06, 0.12)
    b.box('head', 'armour', neck, (0, -0.04, 0.17), (0.24, 0.26, 0.20))
    b.box('visor', 'visor', neck, (0, -0.172, 0.18), (0.20, 0.012, 0.05))
    b.box('jaw', 'frame', neck, (0, -0.08, 0.07), (0.18, 0.18, 0.06))
    b.cylinder('antenna', 'frame', neck, (-0.08, 0.06, 0.34), 0.01, 0.16)
    b.sphere('antenna_tip', 'neon', neck, (-0.08, 0.06, 0.42), 0.022)

    # the claw arm, on the left (+x)
    l_shoulder = b.joint('l_shoulder', spine, (0.33, -0.02, 0.38))
    b.sphere('l_shoulder_ball', 'frame', l_shoulder, (0, 0, 0), 0.08)
    b.cylinder('l_upper', 'flesh', l_shoulder, (0, 0, -0.16), 0.065, 0.30)
    l_elbow = b.joint('l_elbow', l_shoulder, (0, 0, -0.32))
    b.cylinder('l_fore', 'armour', l_elbow, (0, 0, -0.14), 0.07, 0.28, radius2=0.05)
    for i, (dx, dy) in enumerate(((-0.04, -0.03), (0.04, -0.03), (0, 0.04))):
        b.cylinder(f'claw_{i}', 'gun', l_elbow, (dx, dy, -0.34), 0.022, 0.16, radius2=0.004, rotation=(dy * 300, -dx * 300, 0))
    rig['l_shoulder'], rig['l_elbow'] = l_shoulder, l_elbow

    # the gun arm, on the right (-x); at rest it hangs, the pose raises it
    r_shoulder = b.joint('r_shoulder', spine, (-0.33, -0.02, 0.38))
    b.box('r_pauldron', 'armour', r_shoulder, (-0.02, 0, 0.04), (0.20, 0.22, 0.12))
    b.cylinder('r_upper', 'frame', r_shoulder, (0, 0, -0.15), 0.06, 0.28)
    r_elbow = b.joint('r_elbow', r_shoulder, (0, 0, -0.30))
    b.box('gun_body', 'gun', r_elbow, (0, 0, -0.14), (0.14, 0.16, 0.30))
    b.box('gun_neon', 'neon', r_elbow, (-0.072, 0, -0.14), (0.012, 0.10, 0.20))
    b.cylinder('barrel', 'gun', r_elbow, (0, 0, -0.38), 0.035, 0.22, segments=10)
    flash = b.sphere('flash', 'flash', r_elbow, (0, 0, -0.56), 0.11, scale=(1, 1, 1.6))
    rig['r_shoulder'], rig['r_elbow'], rig['flash'] = r_shoulder, r_elbow, flash

    for side, x in (('l', 0.13), ('r', -0.13)):
        hip = b.joint(f'{side}_hip', pelvis, (x, 0, -0.06))
        b.cylinder(f'{side}_thigh', 'frame', hip, (0, 0, -0.2), 0.08, 0.40, radius2=0.065)
        b.box(f'{side}_thigh_plate', 'armour', hip, (0, -0.07, -0.16), (0.14, 0.04, 0.24))
        b.box(f'{side}_thigh_neon', 'visor', hip, (0, -0.093, -0.16), (0.02, 0.008, 0.18))
        knee = b.joint(f'{side}_knee', hip, (0, 0, -0.42))
        b.sphere(f'{side}_kneecap', 'armour', knee, (0, -0.03, 0), 0.075)
        b.cylinder(f'{side}_shin', 'armour', knee, (0, 0, -0.2), 0.065, 0.40, radius2=0.05)
        ankle = b.joint(f'{side}_ankle', knee, (0, 0, -0.42))
        b.box(f'{side}_foot', 'gun', ankle, (0, -0.06, -0.02), (0.13, 0.28, 0.07))
        rig[f'{side}_hip'], rig[f'{side}_knee'] = hip, knee
    return b, rig


def pose(rig, p, view):
    rig['pelvis'].location = (0, 0, 0.95 + p.get('pelvis', 0))
    rig['spine'].rotation_euler = (math.radians(p.get('lean', 0)), 0, 0)
    rig['neck'].rotation_euler = (math.radians(p.get('head', 0) - p.get('lean', 0) * 0.6), 0, 0)
    for side in ('l', 'r'):
        rig[f'{side}_hip'].rotation_euler = (math.radians(p.get(f'{side}_hip', 0)), 0, 0)
        rig[f'{side}_knee'].rotation_euler = (math.radians(p.get(f'{side}_knee', 0)), 0, 0)
    shoulder, elbow = p.get('l_arm', (0, 0))
    rig['l_shoulder'].rotation_euler = (math.radians(shoulder), 0, math.radians(-8))
    rig['l_elbow'].rotation_euler = (math.radians(-elbow), 0, 0)
    shoulder, elbow = p.get('r_arm', (0, 0))
    rig['r_shoulder'].rotation_euler = (math.radians(shoulder), 0, 0)
    rig['r_elbow'].rotation_euler = (math.radians(-elbow), 0, 0)
    rig['flash'].hide_render = not p.get('flash', False)
    fallen = p.get('fallen', False)
    rig['fall'].rotation_euler = (math.radians(-88) if fallen else 0, 0, 0)
    rig['fall'].location = (0, -0.75 if fallen else 0, 0)
    rig['root'].rotation_euler = (0, 0, math.radians(-45 * view))
    rig['root'].location = (0, 0, 0)


def ground(builder, rig):
    """Moves the root so the lowest visible point touches z = 0."""
    bpy.context.view_layer.update()
    low = min((obj.matrix_world @ v.co).z for obj in builder.meshes if not obj.hide_render for v in obj.data.vertices)
    rig['root'].location = (0, 0, -low)
    bpy.context.view_layer.update()


def add_camera(scene):
    data = bpy.data.cameras.new('camera')
    data.type = 'ORTHO'
    data.ortho_scale = ORTHO
    data.clip_start = 0.1
    data.clip_end = 100
    camera = bpy.data.objects.new('camera', data)
    scene.collection.objects.link(camera)
    tilt = math.radians(ELEVATION)
    camera.rotation_euler = (math.pi / 2 - tilt, 0, 0)
    bpy.context.view_layer.update()
    forward = camera.matrix_world.to_quaternion() @ Vector((0, 0, -1))
    up = camera.matrix_world.to_quaternion() @ Vector((0, 1, 0))
    # the ground point under the stalker lands on row GROUND_PX: the image centre sits that far above it
    px_per_m = FRAME_PX / ORTHO
    centre = Vector((0, 0, 0)) + up * ((GROUND_PX + 0.5 - FRAME_PX / 2) / px_per_m)
    camera.location = centre - forward * 20
    scene.camera = camera


def main():
    out_dir = os.path.abspath(sys.argv[sys.argv.index('--') + 1])
    os.makedirs(out_dir, exist_ok=True)
    scene = reset_scene()
    builder, rig = build_stalker()
    add_camera(scene)
    renders = []
    for anim, frames in ANIMATIONS.items():
        for frame, p in enumerate(frames):
            for view in range(8):
                pose(rig, p, view)
                ground(builder, rig)
                name = f'stalker_{anim}_{view}_{frame}'
                scene.render.filepath = os.path.join(out_dir, f'{name}.png')
                bpy.ops.render.render(write_still=True)
                renders.append({'name': name, 'anim': anim, 'view': view, 'frame': frame})
    with open(os.path.join(out_dir, 'renders.json'), 'w') as file:
        json.dump({'framePx': FRAME_PX, 'supersample': SUPERSAMPLE, 'materials': MATERIALS, 'renders': renders}, file,
                  indent=2)
    print(f'rendered {len(renders)} images')


main()
