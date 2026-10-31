"""Runs inside Blender: builds "Mirror, Mirror" — a cramped antique bathroom at night, seen straight
on at the medicine cabinet over the sink — and renders it twice from one camera, so the two
pictures lie exactly over each other:

- `bathroom`: two frosted sconces in a dim sodium glow, cream subway tiles under a peeling
  sick-green plaster, the mirror of the cabinet reflecting the empty room behind the viewer (a
  door ajar on a dark hallway, a towel on a hook).
- `reflection`: the same room as the world inside the mirror: the sconces dying to a bruised red,
  a cold cyan light coming up from below, black water brimming in the basin and running down the
  tiles from under the cabinet, the tiles wet — and in the mirror, right behind where the viewer
  stands, a tall figure with long black hair that the camera itself never sees.

    blender -b --factory-startup --python blender_bathroom.py -- <out-dir> [--preview]

The wall of the cabinet is parallel to the image plane (the camera looks straight at it and frames
lower by a lens shift, not by a tilt), so the glass of the mirror is an exact rectangle in the
picture. Writes `<out-dir>/bathroom.png`, `<out-dir>/reflection.png` (2400 x 1280, 1200 x 640
units of the stage, 2 texels per unit) and `<out-dir>/layout.json`: the glass and the sconces in
units of the stage — origin in the middle of the picture, y up.
"""

import json
import math
import os
import random
import sys

import bpy
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else '/tmp/mirror'
PREVIEW = '--preview' in ARGS
# a full-resolution look at the middle of the picture only, for tuning the mirror
CROP = '--crop' in ARGS

IMG_W, IMG_H = 2400, 1280
UNITS_W, UNITS_H = 1200, 640

# the room, in metres: the wall of the cabinet is the plane y = 0, the viewer looks along +y
ROOM_W = 2.5  # x from -1.25 to 1.25
BACK_Y = -3.0  # the wall behind the viewer, with the door
CEIL_Z = 2.5
TILE_TOP = 1.16  # the tiles end in a cap row here, the plaster begins
CAM_Y = -2.3
CAM_Z = 1.52  # the height of the eyes, the middle of the mirror
FRAME_CENTER_Z = 1.34  # the lens shift frames the picture lower, down to the sink
FRAME_W = 3.0  # metres of the cabinet wall across the whole picture

CABINET = dict(w=0.70, h=0.88, d=0.14, z=1.52)  # outer box, centred at z
GLASS = dict(w=0.58, h=0.74)
SINK_TOP = 0.86

rng = random.Random(1931)


# --- scene ------------------------------------------------------------------------------------


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.render.resolution_x = IMG_W // (4 if PREVIEW and not CROP else 1)
    scene.render.resolution_y = IMG_H // (4 if PREVIEW and not CROP else 1)
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = False
    if CROP:
        scene.render.use_border = True
        scene.render.use_crop_to_border = True
        scene.render.border_min_x, scene.render.border_max_x = 0.36, 0.64
        scene.render.border_min_y, scene.render.border_max_y = 0.3, 0.92
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '16'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.cycles.samples = 48 if PREVIEW else 384
    scene.cycles.use_denoising = True
    scene.cycles.seed = 7
    scene.cycles.max_bounces = 8
    scene.cycles.glossy_bounces = 6
    scene.cycles.blur_glossy = 0.5
    scene.cycles.sample_clamp_indirect = 6
    try:
        prefs = bpy.context.preferences.addons['cycles'].preferences
        for kind in ('OPTIX', 'CUDA', 'HIP', 'ONEAPI', 'METAL'):
            try:
                prefs.compute_device_type = kind
            except TypeError:
                continue
            prefs.get_devices()
            gpus = [d for d in prefs.devices if d.type == kind]
            if gpus:
                for d in prefs.devices:
                    d.use = d.type == kind
                scene.cycles.device = 'GPU'
                scene.cycles.denoiser = 'OPENIMAGEDENOISE'
                break
    except Exception as error:  # noqa: BLE001 - a missing GPU renders on the CPU
        print('no GPU for Cycles, rendering on the CPU:', error)
    world = bpy.data.worlds.new('night')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.002, 0.0025, 0.004, 1)
    scene.world = world
    return scene


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def mesh_obj(name, verts, faces, material=None):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, [], faces)
    me.update()
    obj = bpy.data.objects.new(name, me)
    if material:
        obj.data.materials.append(material)
    return link(obj)


def box(name, cx, cy, cz, sx, sy, sz, material=None, bevel=0.0, segments=3):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(cx, cy, cz))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = (sx, sy, sz)
    bpy.ops.object.transform_apply(scale=True)
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'NONE'
    if material:
        obj.data.materials.append(material)
    return obj


def cylinder(name, x, y, z, r, depth, material=None, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=(x, y, z), rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    bpy.ops.object.shade_smooth()
    if material:
        obj.data.materials.append(material)
    return obj


def sphere(name, x, y, z, r, material=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=32, ring_count=16, radius=r, location=(x, y, z))
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.shade_smooth()
    if material:
        obj.data.materials.append(material)
    return obj


def wall(name, corners, material):
    """A quad from four corners, subdivided so displacement and bevels have room."""
    obj = mesh_obj(name, corners, [(0, 1, 2, 3)], material)
    return obj


# --- materials --------------------------------------------------------------------------------


class Mat:
    """A small builder over a node tree: a Principled BSDF and helpers to feed its inputs."""

    def __init__(self, name):
        self.m = bpy.data.materials.new(name)
        self.m.use_nodes = True
        self.nt = self.m.node_tree
        self.bsdf = self.nt.nodes['Principled BSDF']
        self.out = self.nt.nodes['Material Output']

    def node(self, kind, **props):
        n = self.nt.nodes.new(kind)
        for k, v in props.items():
            setattr(n, k, v)
        return n

    def link(self, a, b):
        self.nt.links.new(a, b)

    def set(self, **inputs):
        for k, v in inputs.items():
            self.bsdf.inputs[k.replace('_', ' ')].default_value = v
        return self

    def math(self, op, a, b=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                self.link(v, n.inputs[i])
        return n.outputs[0]

    def mix(self, fac, a, b, blend='MIX'):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        for sock, v in ((n.inputs[0], fac), (n.inputs[6], a), (n.inputs[7], b)):
            if isinstance(v, (int, float)):
                sock.default_value = v
            elif isinstance(v, tuple):
                sock.default_value = v
            else:
                self.link(v, sock)
        return n.outputs[2]

    def ramp(self, fac, stops):
        n = self.node('ShaderNodeValToRGB')
        cr = n.color_ramp
        while len(cr.elements) < len(stops):
            cr.elements.new(0.5)
        for el, (pos, col) in zip(cr.elements, stops):
            el.position = pos
            el.color = col
        self.link(fac, n.inputs[0])
        return n.outputs[0]

    def noise(self, vec, scale, detail=4.0, rough=0.55, distortion=0.0):
        n = self.node('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        n.inputs['Distortion'].default_value = distortion
        self.link(vec, n.inputs['Vector'])
        return n.outputs['Fac']

    def coords(self, plane):
        """Object coordinates projected onto a wall: 'xz' for walls facing y, 'yz' for side walls."""
        tc = self.node('ShaderNodeTexCoord')
        sep = self.node('ShaderNodeSeparateXYZ')
        self.link(tc.outputs['Object'], sep.inputs[0])
        comb = self.node('ShaderNodeCombineXYZ')
        a, b = (0, 2) if plane == 'xz' else (1, 2)
        self.link(sep.outputs[a], comb.inputs[0])
        self.link(sep.outputs[b], comb.inputs[1])
        return comb.outputs[0], sep

    def bump(self, height, strength, distance=0.01, normal=None):
        n = self.node('ShaderNodeBump')
        n.inputs['Strength'].default_value = strength
        n.inputs['Distance'].default_value = distance
        self.link(height, n.inputs['Height'])
        if normal is not None:
            self.link(normal, n.inputs['Normal'])
        return n.outputs['Normal']


def tiles_material(name, plane, wet):
    """Cream subway tiles 15 x 7.5 cm with grey grout, crazed and grimy towards the bottom; `wet`
    darkens them and makes them glossy."""
    mt = Mat(name)
    vec, sep = mt.coords(plane)
    brick = mt.node('ShaderNodeTexBrick', offset=0.5, offset_frequency=2)
    brick.inputs['Scale'].default_value = 1.0
    brick.inputs['Brick Width'].default_value = 0.15
    brick.inputs['Row Height'].default_value = 0.075
    brick.inputs['Mortar Size'].default_value = 0.0035
    brick.inputs['Mortar Smooth'].default_value = 0.4
    brick.inputs['Bias'].default_value = 0.0
    brick.inputs['Color1'].default_value = (0.70, 0.66, 0.55, 1)
    brick.inputs['Color2'].default_value = (0.62, 0.60, 0.50, 1)
    brick.inputs['Mortar'].default_value = (0.16, 0.15, 0.13, 1)
    mt.link(vec, brick.inputs['Vector'])
    grime = mt.noise(vec, 9.0, 8.0, 0.62)
    stain = mt.noise(vec, 2.2, 3.0, 0.5, distortion=0.6)
    height_z = sep.outputs[2]
    # darker towards the floor, and in blotches
    low = mt.math('MULTIPLY', mt.math('SUBTRACT', 1.15, height_z), 0.9, clamp=True)
    dirt = mt.math('ADD', mt.math('MULTIPLY', low, 0.55), mt.math('MULTIPLY', mt.math('SUBTRACT', stain, 0.45, clamp=True), 1.4), clamp=True)
    base = mt.mix(mt.math('MULTIPLY', dirt, 0.75, clamp=True), brick.outputs['Color'], (0.22, 0.19, 0.12, 1), 'MULTIPLY')
    base = mt.mix(mt.math('MULTIPLY', mt.math('SUBTRACT', grime, 0.5, clamp=True), 0.8), base, (0.30, 0.27, 0.2, 1), 'MULTIPLY')
    if wet:
        base = mt.mix(0.55, base, (0.10, 0.11, 0.11, 1), 'MULTIPLY')
    mt.link(base, mt.bsdf.inputs['Base Color'])
    # crazing of the glaze: a fine voronoi crack network
    vor = mt.node('ShaderNodeTexVoronoi', feature='DISTANCE_TO_EDGE')
    vor.inputs['Scale'].default_value = 38.0
    mt.link(vec, vor.inputs['Vector'])
    craze = mt.math('LESS_THAN', vor.outputs['Distance'], 0.018)
    mortar = brick.outputs['Fac']
    rough = mt.math('ADD', mt.math('MULTIPLY', mortar, 0.6), 0.04 if wet else 0.16)
    rough = mt.math('ADD', rough, mt.math('MULTIPLY', grime, 0.12 if wet else 0.2))
    mt.link(rough, mt.bsdf.inputs['Roughness'])
    height = mt.math('SUBTRACT', 1.0, mt.math('ADD', mortar, mt.math('MULTIPLY', craze, 0.08)))
    # the faces of the tiles bulge a little at the edges: the bevel of the glaze
    mt.link(mt.bump(height, 0.55, 0.004), mt.bsdf.inputs['Normal'])
    mt.set(Specular_IOR_Level=0.6 if wet else 0.5)
    if wet:
        mt.set(Coat_Weight=1.0, Coat_Roughness=0.03)
    return mt.m


def plaster_material(name, plane, wet):
    """Gloss paint gone sick green-grey over plaster, peeling in islands that show the darker,
    stained plaster beneath; water stains running down."""
    mt = Mat(name)
    vec, sep = mt.coords(plane)
    peel = mt.noise(vec, 3.2, 6.0, 0.6, distortion=0.3)
    peeled = mt.math('GREATER_THAN', peel, 0.63)
    paint = mt.mix(mt.noise(vec, 14.0, 3.0), (0.27, 0.31, 0.24, 1), (0.22, 0.26, 0.2, 1))
    plaster = mt.mix(mt.noise(vec, 30.0, 6.0), (0.33, 0.28, 0.2, 1), (0.2, 0.17, 0.12, 1))
    base = mt.mix(peeled, paint, plaster)
    # streaks of old water running down from the ceiling: noise stretched along z
    sx = mt.node('ShaderNodeCombineXYZ')
    mt.link(mt.math('MULTIPLY', sep.outputs[0 if plane == 'xz' else 1], 24.0), sx.inputs[0])
    mt.link(mt.math('MULTIPLY', sep.outputs[2], 0.8), sx.inputs[1])
    streak = mt.noise(sx.outputs[0], 1.0, 2.0)
    stains = mt.math('MULTIPLY', mt.math('SUBTRACT', streak, 0.52, clamp=True), 0.7, clamp=True)
    base = mt.mix(stains, base, (0.12, 0.10, 0.06, 1), 'MULTIPLY')
    if wet:
        base = mt.mix(0.4, base, (0.12, 0.13, 0.13, 1), 'MULTIPLY')
    mt.link(base, mt.bsdf.inputs['Base Color'])
    mt.link(mt.math('ADD', mt.math('MULTIPLY', peeled, 0.5), 0.15 if wet else 0.32), mt.bsdf.inputs['Roughness'])
    edge = mt.math('MULTIPLY', mt.math('SUBTRACT', peel, 0.6, clamp=True), 12.0, clamp=True)
    mt.link(mt.bump(mt.math('SUBTRACT', 1.0, edge), 0.35, 0.003), mt.bsdf.inputs['Normal'])
    return mt.m


def simple(name, color, rough=0.5, metal=0.0, **extra):
    mt = Mat(name)
    mt.set(Base_Color=(*color, 1), Roughness=rough, Metallic=metal, **extra)
    return mt.m


def enamel_material(name):
    """The painted steel of the cabinet: off-white enamel, chipped to rust at the edges."""
    mt = Mat(name)
    tc = mt.node('ShaderNodeTexCoord')
    chips = mt.noise(tc.outputs['Object'], 18.0, 6.0, 0.65)
    chipped = mt.math('GREATER_THAN', chips, 0.66)
    rust = mt.mix(mt.noise(tc.outputs['Object'], 60.0), (0.20, 0.08, 0.03, 1), (0.36, 0.16, 0.06, 1))
    base = mt.mix(chipped, (0.56, 0.54, 0.47, 1), rust)
    mt.link(base, mt.bsdf.inputs['Base Color'])
    mt.link(mt.math('ADD', mt.math('MULTIPLY', chipped, 0.55), 0.22), mt.bsdf.inputs['Roughness'])
    return mt.m


def mirror_material(name):
    """Old silvered glass: a perfect mirror that the silver has left at the rim — dark blooms of
    desilvering creeping in from the edges, a haze of grime over all."""
    mt = Mat(name)
    tc = mt.node('ShaderNodeTexCoord')
    sep = mt.node('ShaderNodeSeparateXYZ')
    mt.link(tc.outputs['Generated'], sep.inputs[0])
    # distance to the nearest edge in the generated 0..1 box of the glass
    ex = mt.math('MINIMUM', sep.outputs[0], mt.math('SUBTRACT', 1.0, sep.outputs[0]))
    ez = mt.math('MINIMUM', sep.outputs[2], mt.math('SUBTRACT', 1.0, sep.outputs[2]))
    edge = mt.math('MINIMUM', mt.math('MULTIPLY', ex, 0.58 / 0.74), ez)
    blot = mt.noise(tc.outputs['Object'], 7.0, 8.0, 0.68)
    loss = mt.math('MULTIPLY', mt.math('SUBTRACT', 0.075, mt.math('ADD', edge, mt.math('MULTIPLY', mt.math('SUBTRACT', blot, 0.3), 0.2))), 60.0, clamp=True)
    haze = mt.noise(tc.outputs['Object'], 3.0, 4.0)
    mt.set(Metallic=1.0)
    mt.link(mt.mix(loss, (0.9, 0.9, 0.88, 1), (0.03, 0.025, 0.02, 1)), mt.bsdf.inputs['Base Color'])
    mt.link(mt.math('ADD', mt.math('MULTIPLY', loss, 0.5), mt.math('MULTIPLY', haze, 0.025)), mt.bsdf.inputs['Roughness'])
    return mt.m


def emission(name, color, strength):
    mt = Mat(name)
    mt.set(Base_Color=(*color, 1), Emission_Color=(*color, 1), Emission_Strength=strength, Roughness=0.4)
    return mt.m


def black_water_material(name):
    """Black water: almost no albedo, a glassy coat that catches every light."""
    mt = Mat(name)
    mt.set(Base_Color=(0.004, 0.005, 0.006, 1), Roughness=0.03, Specular_IOR_Level=0.8, Coat_Weight=1.0, Coat_Roughness=0.0)
    return mt.m


# --- the room ---------------------------------------------------------------------------------


def build_room(wet):
    hw = ROOM_W / 2
    tiles_xz = tiles_material('tiles-front', 'xz', wet)
    tiles_yz = tiles_material('tiles-side', 'yz', wet)
    plaster_xz = plaster_material('plaster-front', 'xz', wet)
    plaster_yz = plaster_material('plaster-side', 'yz', wet)
    # the cabinet wall (y = 0) and the back wall (y = BACK_Y), tiles below, plaster above
    for y, flip in ((0.0, False), (BACK_Y, True)):
        for z0, z1, mat in ((0.0, TILE_TOP, tiles_xz), (TILE_TOP, CEIL_Z, plaster_xz)):
            c = [(-hw, y, z0), (hw, y, z0), (hw, y, z1), (-hw, y, z1)]
            wall('wall', c[::-1] if flip else c, mat)
    for x, flip in ((-hw, True), (hw, False)):
        for z0, z1, mat in ((0.0, TILE_TOP, tiles_yz), (TILE_TOP, CEIL_Z, plaster_yz)):
            c = [(x, BACK_Y, z0), (x, 0, z0), (x, 0, z1), (x, BACK_Y, z1)]
            wall('side', c[::-1] if flip else c, mat)
    floor = simple('floor', (0.05, 0.05, 0.05), 0.2 if wet else 0.5)
    mesh_obj('floor', [(-hw, BACK_Y, 0), (hw, BACK_Y, 0), (hw, 0, 0), (-hw, 0, 0)], [(0, 1, 2, 3)], floor)
    mesh_obj('ceiling', [(-hw, BACK_Y, CEIL_Z), (-hw, 0, CEIL_Z), (hw, 0, CEIL_Z), (hw, BACK_Y, CEIL_Z)], [(0, 1, 2, 3)], plaster_xz)
    # the cap row of the tiles: a rounded bull-nose rail on both tiled walls
    cap = simple('tile-cap', (0.42, 0.40, 0.33), 0.12 if wet else 0.25, Coat_Weight=0.6)
    cylinder('cap', 0, -0.012, TILE_TOP, 0.016, ROOM_W, cap, rot=(0, math.pi / 2, 0), verts=16)
    # the back wall has the door in it: the rail stops at the jambs (x -0.69 and 0.25)
    for x0, x1 in ((-ROOM_W / 2, -0.69), (0.25, ROOM_W / 2)):
        cylinder('cap', (x0 + x1) / 2, BACK_Y + 0.012, TILE_TOP, 0.016, x1 - x0, cap, rot=(0, math.pi / 2, 0), verts=16)
    for x in (-hw, hw):
        cylinder('cap-side', x + (0.012 if x < 0 else -0.012), BACK_Y / 2, TILE_TOP, 0.016, -BACK_Y, cap, rot=(math.pi / 2, 0, 0), verts=16)
    # the light switch on the back wall, seen only in the mirror
    bake = simple('bakelite', (0.08, 0.05, 0.03), 0.3)
    box('switch-plate', 0.62, BACK_Y + 0.006, 1.32, 0.08, 0.01, 0.12, bake, bevel=0.003)
    return dict(tiles=tiles_xz)


def build_back_wall_props():
    """The door ajar onto the dark hallway and the towel on its hook, behind the viewer."""
    wood = Mat('door-wood')
    tc = wood.node('ShaderNodeTexCoord')
    grain = wood.noise(tc.outputs['Object'], 6.0, 6.0, 0.6, distortion=2.0)
    wood.link(wood.mix(grain, (0.30, 0.27, 0.22, 1), (0.22, 0.2, 0.16, 1)), wood.bsdf.inputs['Base Color'])
    wood.set(Roughness=0.45)
    door_x0, door_x1, door_top = -0.62, 0.18, 2.05
    # the opening: a dark hollow behind the wall
    dark = simple('hall-plaster', (0.07, 0.07, 0.065), 0.9)
    # open towards the room: floor, ceiling, two walls and the far end, no face in the doorway
    hx0, hx1, hy0, hy1, hz1 = door_x0 - 0.5, door_x1 + 0.9, BACK_Y - 2.6, BACK_Y, door_top + 0.25
    v = [(hx0, hy0, 0), (hx1, hy0, 0), (hx1, hy1, 0), (hx0, hy1, 0), (hx0, hy0, hz1), (hx1, hy0, hz1), (hx1, hy1, hz1), (hx0, hy1, hz1)]
    mesh_obj('hallway', v, [(0, 1, 2, 3), (4, 7, 6, 5), (0, 4, 5, 1), (0, 3, 7, 4), (1, 5, 6, 2)], dark)
    # cut the wall: rebuild the back wall around the opening instead of a boolean
    for obj in [o for o in bpy.data.objects if o.name.startswith('wall') and abs(o.data.vertices[0].co.y - BACK_Y) < 1e-6]:
        bpy.data.objects.remove(obj)
    hw = ROOM_W / 2
    tiles = bpy.data.materials['tiles-front']
    plaster = bpy.data.materials['plaster-front']

    def part(x0, x1, z0, z1, mat):
        wall('wall-back', [(x1, BACK_Y, z0), (x0, BACK_Y, z0), (x0, BACK_Y, z1), (x1, BACK_Y, z1)], mat)

    for x0, x1 in ((-hw, door_x0), (door_x1, hw)):
        part(x0, x1, 0, TILE_TOP, tiles)
        part(x0, x1, TILE_TOP, CEIL_Z, plaster)
    part(door_x0, door_x1, door_top, CEIL_Z, plaster)
    # the frame
    trim = simple('door-trim', (0.32, 0.3, 0.26), 0.35)
    box('jamb-l', door_x0 - 0.035, BACK_Y + 0.02, door_top / 2, 0.07, 0.04, door_top, trim, bevel=0.006)
    box('jamb-r', door_x1 + 0.035, BACK_Y + 0.02, door_top / 2, 0.07, 0.04, door_top, trim, bevel=0.006)
    box('lintel', (door_x0 + door_x1) / 2, BACK_Y + 0.02, door_top + 0.035, door_x1 - door_x0 + 0.14, 0.04, 0.07, trim, bevel=0.006)
    # the door, open about 50 degrees into the hallway, hinged on the left
    w = door_x1 - door_x0 - 0.01
    door = box('door', w / 2, 0, door_top / 2 - 0.005, w, 0.04, door_top - 0.02, wood.m, bevel=0.004)
    door.location = (door_x0 + 0.005, BACK_Y - 0.02, 0)
    bpy.ops.object.select_all(action='DESELECT')
    door.rotation_euler = (0, 0, math.radians(-52))
    knob = sphere('knob', w - 0.06, -0.03, 0.98, 0.028, simple('brass', (0.55, 0.4, 0.18), 0.3, 1.0))
    knob.parent = door
    # the towel on a hook to the right of the door: a cloth sheet with folds
    hook = cylinder('hook', 0.62, BACK_Y + 0.03, 1.72, 0.008, 0.06, simple('iron', (0.1, 0.1, 0.1), 0.4, 1.0), rot=(math.pi / 2, 0, 0))
    towel_mat = Mat('towel')
    tco = towel_mat.node('ShaderNodeTexCoord')
    towel_mat.link(
        towel_mat.mix(towel_mat.noise(tco.outputs['Object'], 140.0, 2.0), (0.42, 0.38, 0.32, 1), (0.33, 0.3, 0.25, 1)),
        towel_mat.bsdf.inputs['Base Color'],
    )
    towel_mat.set(Roughness=0.95, Sheen_Weight=0.6)
    verts, faces = [], []
    nx, nz = 16, 24
    for j in range(nz + 1):
        for i in range(nx + 1):
            u, v = i / nx, j / nz
            x = 0.62 + (u - 0.5) * (0.30 + 0.06 * v)
            z = 1.72 - v * 0.62
            y = BACK_Y + 0.04 + 0.025 * math.sin(u * math.pi * 3 + v * 1.5) * (0.3 + v) + 0.02 * (1 - abs(u - 0.5) * 2) * (1 - v)
            verts.append((x, y, z))
    for j in range(nz):
        for i in range(nx):
            a = j * (nx + 1) + i
            faces.append((a, a + 1, a + nx + 2, a + nx + 1))
    towel = mesh_obj('towel', verts, faces, towel_mat.m)
    for p in towel.data.polygons:
        p.use_smooth = True
    mod = towel.modifiers.new('thick', 'SOLIDIFY')
    mod.thickness = 0.012
    del hook


def build_cabinet():
    c = CABINET
    front_y = -c['d']
    enamel = enamel_material('enamel')
    # the box of the cabinet on the wall, and the frame of its door
    box('cabinet', 0, -c['d'] / 2, c['z'], c['w'], c['d'], c['h'], enamel, bevel=0.012)
    border = (c['w'] - GLASS['w']) / 2
    bh = (c['h'] - GLASS['h']) / 2
    z0, z1 = c['z'] - c['h'] / 2, c['z'] + c['h'] / 2
    for name, x, z, sx, sz in (
        ('frame-l', -c['w'] / 2 + border / 2, c['z'], border, c['h']),
        ('frame-r', c['w'] / 2 - border / 2, c['z'], border, c['h']),
        ('frame-b', 0, z0 + bh / 2, c['w'], bh),
        ('frame-t', 0, z1 - bh / 2, c['w'], bh),
    ):
        box(name, x, front_y - 0.012, z, sx, 0.024, sz, enamel, bevel=0.008)
    # a thin chrome bead around the glass
    chrome = simple('chrome', (0.8, 0.8, 0.8), 0.12, 1.0)
    gw, gh = GLASS['w'], GLASS['h']
    for name, x, z, sx, sz in (
        ('bead-l', -gw / 2 - 0.004, c['z'], 0.008, gh + 0.016),
        ('bead-r', gw / 2 + 0.004, c['z'], 0.008, gh + 0.016),
        ('bead-b', 0, c['z'] - gh / 2 - 0.004, gw + 0.016, 0.008),
        ('bead-t', 0, c['z'] + gh / 2 + 0.004, gw + 0.016, 0.008),
    ):
        box(name, x, front_y - 0.026, z, sx, 0.01, sz, chrome, bevel=0.003)
    glass_y = front_y - 0.02
    glass = mesh_obj(
        'glass',
        [(-gw / 2, glass_y, c['z'] - gh / 2), (gw / 2, glass_y, c['z'] - gh / 2), (gw / 2, glass_y, c['z'] + gh / 2), (-gw / 2, glass_y, c['z'] + gh / 2)],
        [(0, 1, 2, 3)],
        mirror_material('mirror'),
    )
    # a little catch at the right edge of the door
    box('catch', gw / 2 + border * 0.55, front_y - 0.03, c['z'], 0.012, 0.02, 0.07, chrome, bevel=0.004)
    # the glass shelf below the cabinet, on two chrome brackets, with a tumbler and a bottle
    shelf_z = z0 - 0.12
    glass_mat = simple('shelf-glass', (0.75, 0.85, 0.82), 0.02, Transmission_Weight=1.0, IOR=1.5)
    box('shelf', 0, -0.07, shelf_z, 0.62, 0.12, 0.008, glass_mat, bevel=0.002)
    for x in (-0.27, 0.27):
        box('bracket', x, -0.05, shelf_z - 0.02, 0.01, 0.09, 0.03, chrome, bevel=0.003)
    tumbler = cylinder('tumbler', -0.17, -0.08, shelf_z + 0.05, 0.03, 0.09, glass_mat, verts=40)
    tumbler.modifiers.new('solid', 'SOLIDIFY').thickness = 0.003
    for i, (dx, tilt) in enumerate(((0.0, 0.18), (0.012, -0.12))):
        brush = cylinder(f'brush{i}', -0.17 + dx, -0.08, shelf_z + 0.1, 0.0035, 0.17, simple('bone', (0.55, 0.5, 0.4), 0.4), rot=(0, tilt, 0), verts=8)
        del brush
    amber = simple('amber-bottle', (0.35, 0.12, 0.02), 0.08, Transmission_Weight=0.85, IOR=1.5)
    cylinder('bottle', 0.14, -0.075, shelf_z + 0.055, 0.024, 0.1, amber, verts=32)
    cylinder('bottle-cap', 0.14, -0.075, shelf_z + 0.112, 0.016, 0.016, simple('cap-black', (0.02, 0.02, 0.02), 0.5), verts=24)
    razor = box('razor', 0.04, -0.06, shelf_z + 0.012, 0.08, 0.012, 0.012, chrome, bevel=0.003)
    razor.rotation_euler = (0, 0, 0.35)
    return glass, shelf_z


def build_sconces(lit_color, lit_strength, light_power):
    """Two frosted tulip shades on brass arms left and right of the cabinet, each with a lamp."""
    brass = simple('sconce-brass', (0.5, 0.36, 0.16), 0.35, 1.0)
    glass_frost = Mat('frost')
    glass_frost.set(Base_Color=(0.9, 0.85, 0.75, 1), Roughness=0.6, Transmission_Weight=0.7, Emission_Color=(*lit_color, 1), Emission_Strength=lit_strength)
    positions = []
    for side in (-1, 1):
        x = side * 0.50
        z = CABINET['z'] + 0.16
        box('backplate', x, -0.008, z - 0.06, 0.06, 0.016, 0.12, brass, bevel=0.01)
        cylinder('arm', x, -0.06, z - 0.06, 0.009, 0.11, brass, rot=(math.pi / 2, 0, 0), verts=16)
        # the tulip: a sphere cut to a cup by scaling, opening upwards
        shade = sphere('shade', x, -0.115, z + 0.02, 0.06, glass_frost.m, scale=(1, 1, 1.15))
        shade.modifiers.new('solid', 'SOLIDIFY').thickness = 0.003
        bulb = sphere('bulb', x, -0.115, z + 0.02, 0.025, emission('bulb', lit_color, lit_strength * 2.2))
        del bulb
        light = bpy.data.lights.new('sconce', 'POINT')
        light.energy = light_power
        light.color = lit_color
        light.shadow_soft_size = 0.05
        lo = bpy.data.objects.new('sconce-light', light)
        lo.location = (x, -0.115, z + 0.02)
        link(lo)
        positions.append((x, -0.115, z + 0.02))
    return positions


def build_sink(water):
    porcelain = Mat('porcelain')
    tc = porcelain.node('ShaderNodeTexCoord')
    craze = porcelain.noise(tc.outputs['Object'], 25.0, 6.0, 0.6)
    porcelain.link(porcelain.mix(porcelain.math('MULTIPLY', craze, 0.4), (0.74, 0.73, 0.68, 1), (0.4, 0.37, 0.3, 1)), porcelain.bsdf.inputs['Base Color'])
    porcelain.set(Roughness=0.08, Coat_Weight=0.8, Coat_Roughness=0.05)
    # the basin: a bevelled slab hollowed by a squashed sphere
    slab = box('sink', 0, -0.25, SINK_TOP - 0.07, 0.62, 0.48, 0.14, porcelain.m, bevel=0.035, segments=5)
    bowl = sphere('bowl-cut', 0, -0.27, SINK_TOP + 0.01, 0.2, None, scale=(1.25, 0.95, 0.65))
    mod = slab.modifiers.new('bowl', 'BOOLEAN')
    mod.object = bowl
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    bowl.hide_render = True
    bowl.hide_viewport = True
    cylinder('pedestal', 0, -0.2, 0.38, 0.09, 0.72, porcelain.m, verts=48)
    # the taps: two cross handles and a swan-neck spout
    chrome = bpy.data.materials['chrome']
    for side in (-1, 1):
        x = side * 0.16
        cylinder('tap', x, -0.08, SINK_TOP + 0.03, 0.018, 0.06, chrome)
        for a in (0, math.pi / 2):
            arm = cylinder('tap-arm', x, -0.08, SINK_TOP + 0.065, 0.006, 0.07, chrome, rot=(0, math.pi / 2, a), verts=12)
            del arm
        sphere('tap-cap', x, -0.08, SINK_TOP + 0.07, 0.012, simple('ceramic-cap', (0.8, 0.8, 0.78), 0.1))
    bpy.ops.mesh.primitive_torus_add(major_radius=0.06, minor_radius=0.011, location=(0, -0.08, SINK_TOP + 0.06), rotation=(math.pi / 2, 0, math.pi / 2))
    spout = bpy.context.active_object
    spout.data.materials.append(chrome)
    bpy.ops.object.shade_smooth()
    cylinder('spout-base', 0, -0.08, SINK_TOP + 0.03, 0.016, 0.06, chrome)
    # the plug chain draped over the rim
    if water:
        bw = black_water_material('black-water')
        # the basin brims: a flat disc of black water just below the rim
        pool = cylinder('pool', 0, -0.27, SINK_TOP - 0.006, 0.2, 0.004, bw, verts=64)
        pool.scale = (1.25, 0.95, 1)
        return bw
    return None


def build_streaks(bw, z_top, x_range, count, seed, z_min=0.0):
    """Black water running down the tiles: thin glossy strips that wander and thicken into drops."""
    r = random.Random(seed)
    for k in range(count):
        x = r.uniform(*x_range)
        z0 = z_top - r.uniform(0, 0.03)
        length = r.uniform(0.12, 0.75) * (1.6 if r.random() < 0.2 else 1.0)
        width = r.uniform(0.006, 0.022)
        n = 40
        verts, faces = [], []
        phase = r.uniform(0, 6.28)
        for i in range(n + 1):
            t = i / n
            z = z0 - t * length
            if z < z_min:
                break
            wob = 0.004 * math.sin(phase + t * 7) + 0.002 * math.sin(phase * 2 + t * 19)
            # wide where it leaves the edge, thinning to a thread, beading up again towards the drop
            w = width * (1.4 * (1 - t) ** 3 + 0.35 + 0.25 * math.sin(t * 11 + phase) ** 2 + 0.5 * t**6)
            verts += [(x + wob - w / 2, -0.0015, z), (x + wob + w / 2, -0.0015, z)]
            if i:
                a = (i - 1) * 2
                faces.append((a, a + 1, a + 3, a + 2))
        strip = mesh_obj('streak', verts, faces, bw)
        del strip
        # a drop gathering at the end
        end = verts[-1]
        sphere('drop', end[0] - width / 2, -0.004, end[2], width * 0.9, bw, scale=(1, 0.5, 1.3))


def build_figure():
    """Behind the viewer, in front of the open door: a tall, thin woman in a long grey nightgown,
    her head tilted to one shoulder, long black hair hanging over her face so only one eye shows,
    arms hanging too long at her sides. Seen only in the mirror."""
    gown = Mat('gown')
    tc = gown.node('ShaderNodeTexCoord')
    gown.link(gown.mix(gown.noise(tc.outputs['Object'], 9.0, 4.0), (0.42, 0.44, 0.42, 1), (0.22, 0.23, 0.21, 1)), gown.bsdf.inputs['Base Color'])
    gown.set(Roughness=0.92, Sheen_Weight=0.5)
    skin = simple('pale', (0.5, 0.53, 0.5), 0.55, Subsurface_Weight=0.1)
    fx, fy = -0.16, -2.72
    lift = 0.12  # taller than anyone should be

    # the body by a skin modifier over a skeleton of vertices with radii: neck, shoulders, arms
    bones = {
        'chest': ((0, 0, 1.38), 0.11),
        'neck0': ((0, 0, 1.56), 0.05),
        'neck1': ((0.012, 0, 1.68), 0.038),
        'sh_l': ((-0.16, 0, 1.52), 0.045),
        'sh_r': ((0.16, 0, 1.5), 0.045),
        'el_l': ((-0.2, 0.02, 1.16), 0.032),
        'el_r': ((0.19, 0.02, 1.14), 0.032),
        'wr_l': ((-0.215, 0.04, 0.84), 0.024),
        'wr_r': ((0.205, 0.05, 0.82), 0.024),
        'tip_l': ((-0.22, 0.05, 0.62), 0.014),
        'tip_r': ((0.215, 0.06, 0.6), 0.014),
    }
    names = list(bones)
    edges = [('chest', 'neck0'), ('neck0', 'neck1'), ('chest', 'sh_l'), ('chest', 'sh_r'), ('sh_l', 'el_l'), ('el_l', 'wr_l'), ('wr_l', 'tip_l'), ('sh_r', 'el_r'), ('el_r', 'wr_r'), ('wr_r', 'tip_r')]
    me = bpy.data.meshes.new('body')
    me.from_pydata(
        [(fx + x, fy + y, z + lift) for (x, y, z), _ in bones.values()],
        [(names.index(a), names.index(b)) for a, b in edges],
        [],
    )
    body = link(bpy.data.objects.new('body', me))
    body.modifiers.new('skin', 'SKIN')
    for i, (_, r) in enumerate(bones.values()):
        body.data.skin_vertices[0].data[i].radius = (r, r * 0.8)
    body.modifiers.new('sub', 'SUBSURF').levels = 2
    body.data.materials.append(skin)
    for poly in body.data.polygons:
        poly.use_smooth = True

    # the nightgown: a lathe of rings from the shoulders to the floor, folds running down it
    rings, seg = 40, 64
    verts, faces = [], []
    for j in range(rings + 1):
        t = j / rings  # 0 at the shoulders, 1 at the hem
        z = (1.5 - t * 1.48) + lift
        radius = 0.15 - 0.03 * math.sin(min(t / 0.35, 1) * math.pi / 2) + 0.17 * max(0.0, t - 0.3) ** 1.4
        for i in range(seg):
            a = i / seg * math.tau
            fold = (0.012 + 0.03 * t) * math.sin(a * 9 + t * 2.0) + 0.01 * math.sin(a * 23 + t * 7)
            r = radius + fold * min(1, t * 3)
            verts.append((fx + math.cos(a) * r, fy + math.sin(a) * r * 0.68, z))
    for j in range(rings):
        for i in range(seg):
            a, b = j * seg + i, j * seg + (i + 1) % seg
            faces.append((a, b, b + seg, a + seg))
    dress = mesh_obj('gown', verts, faces, gown.m)
    for poly in dress.data.polygons:
        poly.use_smooth = True
    dress.modifiers.new('solid', 'SOLIDIFY').thickness = 0.006

    # the head, tilted towards her left shoulder and a little forward
    hx, hz = fx + 0.03, 1.81 + lift
    head = sphere('head', hx, fy + 0.005, hz, 0.095, skin, scale=(0.82, 0.92, 1.16))
    head.rotation_euler = (math.radians(10), math.radians(-16), 0)

    # the hair: curves from the scalp, over the crown and straight down, a curtain over the face
    hair_mat = simple('hair', (0.004, 0.004, 0.005), 0.28, Coat_Weight=0.3)
    curve = bpy.data.curves.new('hair', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.0045
    curve.bevel_resolution = 1
    r = random.Random(77)
    for k in range(420):
        # around the scalp: the parting runs over the crown; the face (towards +y) is left only a gap
        a = r.uniform(-math.pi, math.pi)
        front = math.cos(a - math.pi / 2)  # 1 towards the mirror
        if front > 0.8 and 0.12 < math.cos(a) < 0.42 and r.random() < 0.9:
            continue  # the gap over her right eye
        # the root on the dome of the skull; the strand follows the skull out to its widest and falls
        phi0 = r.uniform(0.05, 1.0)
        fall = r.uniform(0.55, 0.95) if front < 0.5 else r.uniform(0.45, 0.8)
        sway = r.uniform(0, math.tau)
        sp = curve.splines.new('POLY')
        pts = 12
        sp.points.add(pts - 1)
        for i in range(pts):
            t = i / (pts - 1)
            if t < 0.35:
                phi = phi0 + (math.pi / 2 + 0.15 - phi0) * (t / 0.35)
                rad = 0.105
                x = hx + math.sin(phi) * math.cos(a) * rad * 0.86
                y = fy + math.sin(phi) * math.sin(a) * rad * 0.95
                z = hz + 0.01 + math.cos(phi) * rad * 1.18
            else:
                u = (t - 0.35) / 0.65
                edge_x = hx + math.sin(math.pi / 2 + 0.15) * math.cos(a) * 0.105 * 0.86
                edge_y = fy + math.sin(math.pi / 2 + 0.15) * math.sin(a) * 0.105 * 0.95
                x = edge_x + 0.015 * math.sin(sway + u * 4) * u + math.cos(a) * 0.02 * u
                y = edge_y + 0.012 * math.sin(sway * 1.3 + u * 3) * u + math.sin(a) * 0.015 * u
                z = hz + 0.01 + math.cos(math.pi / 2 + 0.15) * 0.105 * 1.18 - u * fall
            sp.points[i].co = (x, y, z, 1)
    hair = link(bpy.data.objects.new('hair', curve))
    hair.data.materials.append(hair_mat)

    # the one eye that shows through the gap, and the other behind the hair: dull glints
    eyes = emission('eye-glint', (0.75, 0.95, 0.9), 1.1)
    eye_pos = []
    for dx in (0.03, -0.03):
        p = (hx + dx, fy + 0.083, hz + 0.008 - dx * 0.25)
        sphere('eye', *p, 0.0055, eyes)
        eye_pos.append(p)
    return eye_pos


# --- lights per variant -----------------------------------------------------------------------


def area_light(name, loc, rot, size, color, power):
    light = bpy.data.lights.new(name, 'AREA')
    light.energy = power
    light.color = color
    light.size = size
    obj = bpy.data.objects.new(name, light)
    obj.location = loc
    obj.rotation_euler = rot
    obj.visible_camera = False
    obj.visible_glossy = False
    return link(obj)


def spot_light(name, loc, target, color, power, size=0.6, blend=0.6):
    """A spot at `loc` aimed at `target`."""
    light = bpy.data.lights.new(name, 'SPOT')
    light.energy = power
    light.color = color
    light.spot_size = size
    light.spot_blend = blend
    light.shadow_soft_size = 0.08
    obj = bpy.data.objects.new(name, light)
    obj.location = loc
    obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
    obj.visible_camera = False
    obj.visible_glossy = False
    return link(obj)


def build_camera():
    cam = bpy.data.cameras.new('cam')
    cam.sensor_fit = 'HORIZONTAL'
    cam.sensor_width = 36
    d = -CAM_Y + CABINET['d'] + 0.02  # to the glass; the framing is set on the wall plane y = 0
    dist_wall = -CAM_Y
    cam.lens = cam.sensor_width * dist_wall / FRAME_W
    cam.shift_y = (FRAME_CENTER_Z - CAM_Z) / FRAME_W
    cam.clip_start = 0.05
    cam.clip_end = 20
    obj = bpy.data.objects.new('cam', cam)
    obj.location = (0, CAM_Y, CAM_Z)
    obj.rotation_euler = (math.pi / 2, 0, 0)
    link(obj)
    bpy.context.scene.camera = obj
    del d
    return obj


def to_units(cam, scene, p):
    """A point of the scene in units of the stage: origin in the middle of the picture, y up."""
    from bpy_extras.object_utils import world_to_camera_view

    co = world_to_camera_view(scene, cam, Vector(p))
    return [round((co.x - 0.5) * UNITS_W, 2), round((co.y - 0.5) * UNITS_H, 2)]


def build(variant):
    scene = reset()
    wet = variant == 'reflection'
    build_room(wet)
    build_back_wall_props()
    glass, shelf_z = build_cabinet()
    if wet:
        sconces = build_sconces((1.0, 0.16, 0.12), 1.6, 0.9)
    else:
        sconces = build_sconces((1.0, 0.62, 0.28), 5.5, 12.0)
    bw = build_sink(wet)
    eye_pos = []
    if wet:
        build_streaks(bw, CABINET['z'] - CABINET['h'] / 2 - 0.005, (-0.3, 0.3), 16, 5, z_min=shelf_z + 0.01)
        build_streaks(bw, shelf_z - 0.006, (-0.3, 0.3), 10, 6, z_min=SINK_TOP + 0.005)
        build_streaks(bw, SINK_TOP - 0.13, (-0.28, 0.28), 9, 8)
        build_streaks(bw, TILE_TOP - 0.02, (-1.2, -0.5), 5, 9)
        build_streaks(bw, TILE_TOP - 0.02, (0.5, 1.2), 5, 10)
        eye_pos = build_figure()
        # the wrong light: cold cyan coming up from the floor, from in front of the sink and behind the viewer
        area_light('under', (0, -0.9, 0.05), (math.radians(160), 0, 0), 1.2, (0.3, 1.0, 0.85), 9)
        spot_light('on-the-figure', (-0.1, -2.0, 0.9), (-0.13, -2.72, 2.02), (0.3, 1.0, 0.85), 60, size=0.28)
        area_light('hall-glow', (-0.22, BACK_Y - 1.6, 1.1), (math.radians(90), 0, 0), 1.2, (0.3, 1.0, 0.8), 160)
    else:
        # a faint cold fill from the dark hallway, so the room behind the viewer is not pitch black
        area_light('hall-fill', (-0.22, BACK_Y - 0.9, 1.6), (math.radians(90), 0, 0), 0.6, (0.55, 0.65, 0.9), 3.0)
        area_light('back-fill', (0.2, BACK_Y + 0.6, CEIL_Z - 0.02), (0, 0, 0), 0.8, (1.0, 0.72, 0.45), 6.0)
        area_light('ceiling-fill', (0, -1.3, CEIL_Z - 0.02), (0, 0, 0), 1.0, (1.0, 0.75, 0.5), 3.0)
    cam = build_camera()
    os.makedirs(OUT, exist_ok=True)
    scene.render.filepath = os.path.join(OUT, f'{variant}.png')
    bpy.ops.render.render(write_still=True)
    gw, gh = GLASS['w'], GLASS['h']
    gy = -CABINET['d'] - 0.02
    z = CABINET['z']
    corners = [to_units(cam, scene, (sx * gw / 2, gy, z + sz * gh / 2)) for sx, sz in ((-1, -1), (1, -1), (1, 1), (-1, 1))]
    return dict(
        glass=dict(left=corners[0][0], bottom=corners[0][1], right=corners[2][0], top=corners[2][1]),
        sconces=[to_units(cam, scene, p) for p in sconces],
        figureEyes=[to_units(cam, scene, mirror_point(p)) for p in eye_pos],
    )


def mirror_point(p):
    """Where a point behind the viewer shows in the mirror: reflected through the plane of the glass."""
    gy = -CABINET['d'] - 0.02
    return (p[0], 2 * gy - p[1], p[2])


def main():
    layout = build('bathroom')
    reflection = build('reflection')
    layout['figureEyes'] = reflection['figureEyes']
    layout['units'] = dict(width=UNITS_W, height=UNITS_H, texelsPerUnit=IMG_W / UNITS_W)
    with open(os.path.join(OUT, 'layout.json'), 'w') as f:
        json.dump(layout, f, indent=2)


main()
