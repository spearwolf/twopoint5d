"""Runs inside Blender: builds "The Night Shift" — two rooms of an abandoned observatory joined by
one door — bakes its light into one texture and exports it as a `.glb` with three cameras:

- the control room: a long desk under the north wall with two beige terminals glowing green, a
  desk lamp in a pool of amber, a swivel chair pushed back, a filing cabinet, a star chart and a
  stopped clock on the west wall, a radiator under a window whose venetian blinds slice the
  moonlight into stripes across the linoleum;
- the dome: a refractor on a fork mount on a concrete pier, aimed out of the open slit, a shaft of
  moonlight through the slit, a red safelight beside the door, a stepladder, a stool and a small
  table with the open logbook;
- the door between them: a steel door swung wide into the control room, a frame of its own through
  both walls, a plate above it.

    blender -b --factory-startup --python blender_observatory.py -- <out-dir> [--views] [--draft]

Writes `<out-dir>/two-rooms.glb`. `--views` renders the three cameras with Cycles instead (and the
flight at a few frames) into `<out-dir>/view-*.png`, for tuning the composition; `--draft` bakes
small and quick.

Everything is lit by Cycles once and baked — direct and indirect diffuse light and emission — into
one texture over one UV atlas of the whole scene; the exported meshes carry an unlit material
(`KHR_materials_unlit`) with that texture, so the picture is the same under any renderer and needs
no light in the scene of three.js. Units are metres, Blender's z up becomes glTF's y up.
"""

import math
import os
import random
import sys

import bpy
import bmesh
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS else '/tmp/observatory'
VIEWS = '--views' in ARGS
DRAFT = '--draft' in ARGS

TEXTURE_SIZE = 1024 if DRAFT else 4096
BAKE_SAMPLES = 32 if DRAFT else 384
FPS = 24
FLIGHT_FRAMES = 168  # 7 seconds

# the control room: x from -5 to 0, y from -2.1 to 2.1, 2.7 high
A = dict(x0=-5.0, x1=0.0, y0=-2.1, y1=2.1, h=2.7)
# the dome: a drum of radius R and height H under a half sphere, its axis at (CX, 0)
CX, R, H = 4.0, 3.6, 2.3
WALL = 0.2
DOOR = dict(w=1.0, h=2.1)  # in the east wall of the control room, centred on y = 0
SLIT = 0.62  # half the width of the slit in the dome

rng = random.Random(1957)


# --- scene ------------------------------------------------------------------------------------


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.render.fps = FPS
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.render.resolution_percentage = 100
    scene.frame_start = 0
    scene.frame_end = FLIGHT_FRAMES
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 0.8
    scene.cycles.seed = 11
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 2
    scene.cycles.sample_clamp_indirect = 4
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
                break
    except Exception as error:  # noqa: BLE001 - a missing GPU bakes on the CPU
        print('no GPU for Cycles, baking on the CPU:', error)
    world = bpy.data.worlds.new('night')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.006, 0.009, 0.022, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    scene.world = world
    return scene


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def finish(obj, material, bevel=0.0, segments=2, smooth=None):
    if bevel:
        mod = obj.modifiers.new('bevel', 'BEVEL')
        mod.width = bevel
        mod.segments = segments
        mod.limit_method = 'ANGLE'
    if smooth is not None:
        activate(obj)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    if material:
        obj.data.materials.append(material)
    return obj


def box(name, c, s, material=None, bevel=0.0, rot=(0, 0, 0), segments=2):
    """A box centred at `c` with the size `s`, turned by `rot` (radians, xyz)."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = s
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, material, bevel, segments)


def span(name, x0, x1, y0, y1, z0, z1, material=None, bevel=0.0):
    """A box from its bounds."""
    return box(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), material, bevel)


def rod(name, a, b, size, material=None):
    """A square bar `size` thick from `a` to `b`."""
    a, b = Vector(a), Vector(b)
    v = b - a
    return box(name, (a + b) / 2, (size, size, v.length), material, rot=v.to_track_quat('Z', 'Y').to_euler(), bevel=size * 0.12)


def cylinder(name, c, r, depth, material=None, rot=(0, 0, 0), verts=32, bevel=0.0, r2=None, caps=True):
    fill = 'NGON' if caps else 'NOTHING'
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=c, rotation=rot, end_fill_type=fill)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=c, rotation=rot, end_fill_type=fill)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, bevel, smooth=35)


def torus(name, c, major, minor, material=None, rot=(0, 0, 0), major_seg=64, minor_seg=12):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=major_seg, minor_segments=minor_seg, location=c, rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, smooth=60)


def sphere(name, c, r, material=None, scale=(1, 1, 1)):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=24, ring_count=12, radius=r, location=c)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, material, smooth=80)


def mesh_from_bmesh(name, bm):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    return link(bpy.data.objects.new(name, me))


def apply_modifiers(obj):
    activate(obj)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def cut(obj, cutter):
    """Boolean difference with `cutter`, applied; the cutter is removed."""
    mod = obj.modifiers.new('cut', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = cutter
    apply_modifiers(obj)
    bpy.data.objects.remove(cutter)


def text_mesh(name, body, c, size, material, rot=(math.pi / 2, 0, 0), extrude=0.002):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.extrude = extrude
    obj = link(bpy.data.objects.new(name, curve))
    obj.location = c
    obj.rotation_euler = rot
    activate(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.active_object
    obj.data.materials.append(material)
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

    def color(self, sock):
        self.link(sock, self.bsdf.inputs['Base Color'])
        return self

    def value(self, v):
        if isinstance(v, (int, float)):
            n = self.node('ShaderNodeValue')
            n.outputs[0].default_value = v
            return n.outputs[0]
        return v

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
            if isinstance(v, (int, float, tuple)):
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

    def white(self, vec):
        n = self.node('ShaderNodeTexWhiteNoise', noise_dimensions='3D')
        self.link(vec, n.inputs['Vector'])
        return n.outputs['Value']

    def pos(self):
        """World position, split into its axes: (vector, x, y, z)."""
        geo = self.node('ShaderNodeNewGeometry')
        sep = self.node('ShaderNodeSeparateXYZ')
        self.link(geo.outputs['Position'], sep.inputs[0])
        return geo.outputs['Position'], sep.outputs[0], sep.outputs[1], sep.outputs[2]

    def scaled(self, vec, sx, sy, sz):
        n = self.node('ShaderNodeVectorMath', operation='MULTIPLY')
        n.inputs[1].default_value = (sx, sy, sz)
        self.link(vec, n.inputs[0])
        return n.outputs[0]

    def combine(self, x, y, z):
        n = self.node('ShaderNodeCombineXYZ')
        for i, v in enumerate((x, y, z)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                self.link(v, n.inputs[i])
        return n.outputs[0]

    def grid_line(self, coord, period, width):
        """1 on a line every `period` along `coord`, `width` wide, 0 elsewhere."""
        m = self.math('MODULO', self.math('ADD', coord, 1000.0 * period), period)
        dist = self.math('MINIMUM', m, self.math('SUBTRACT', period, m))
        return self.math('LESS_THAN', dist, width / 2)


def simple(name, color, rough=0.6, metal=0.0):
    return Mat(name).set(Base_Color=(*color, 1), Roughness=rough, Metallic=metal).m


def grimy(name, color, dirt, scale=3.0, amount=0.55, rough=0.7):
    """A colour with blotches of a darker one, by world position."""
    mt = Mat(name)
    vec, _, _, _ = mt.pos()
    n = mt.noise(vec, scale, detail=6.0, rough=0.62)
    fac = mt.ramp(n, [(0.38, (0, 0, 0, 1)), (0.75, (amount, amount, amount, 1))])
    mt.color(mt.mix(fac, (*color, 1), (*dirt, 1)))
    mt.set(Roughness=rough)
    return mt.m


def emission(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = (*color, 1)
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    return m


def linoleum():
    """Faded mint and cream tiles of 30 cm, scuffed, darker along the walls."""
    mt = Mat('linoleum')
    vec, x, y, _ = mt.pos()
    checker = mt.node('ShaderNodeTexChecker')
    checker.inputs['Scale'].default_value = 1.0
    checker.inputs['Color1'].default_value = (0.30, 0.37, 0.32, 1)
    checker.inputs['Color2'].default_value = (0.52, 0.49, 0.40, 1)
    mt.link(mt.scaled(vec, 1 / 0.6, 1 / 0.6, 0.0), checker.inputs['Vector'])
    scuff = mt.ramp(mt.noise(vec, 2.2, detail=8.0, rough=0.65), [(0.42, (1, 1, 1, 1)), (0.72, (0.55, 0.52, 0.45, 1))])
    col = mt.mix(1.0, checker.outputs['Color'], scuff, blend='MULTIPLY')
    seam = mt.math('MAXIMUM', mt.grid_line(x, 0.3, 0.004), mt.grid_line(y, 0.3, 0.004))
    col = mt.mix(mt.math('MULTIPLY', seam, 0.5), col, (0.05, 0.05, 0.04, 1))
    mt.color(col).set(Roughness=0.45)
    return mt.m


def wall_paint():
    """Institutional green below a dark band at 1.05 m, a sick cream above, stained by damp from
    the floor and streaked down from the ceiling."""
    mt = Mat('wall_paint')
    vec, _, _, z = mt.pos()
    below = mt.math('LESS_THAN', z, 1.05)
    band = mt.math('MULTIPLY', mt.math('GREATER_THAN', z, 1.05), mt.math('LESS_THAN', z, 1.11))
    col = mt.mix(below, (0.52, 0.50, 0.41, 1), (0.12, 0.20, 0.16, 1))
    col = mt.mix(band, col, (0.06, 0.09, 0.07, 1))
    streaks = mt.noise(mt.scaled(vec, 6.0, 6.0, 0.35), 2.0, detail=6.0, rough=0.6)
    damp = mt.math('MULTIPLY', mt.ramp(streaks, [(0.5, (0, 0, 0, 1)), (0.8, (1, 1, 1, 1))]), 0.45)
    col = mt.mix(damp, col, (0.20, 0.17, 0.11, 1), blend='MULTIPLY')
    low = mt.math('MULTIPLY', mt.math('LESS_THAN', z, 0.12), 0.6)
    col = mt.mix(low, col, (0.04, 0.05, 0.04, 1))
    mt.color(col).set(Roughness=0.8)
    return mt.m


def ceiling_tiles():
    """Acoustic tiles of 60 cm in a grey grid, yellowed."""
    mt = Mat('ceiling_tiles')
    vec, x, y, _ = mt.pos()
    grid = mt.math('MAXIMUM', mt.grid_line(x, 0.6, 0.025), mt.grid_line(y, 0.6, 0.025))
    stain = mt.ramp(mt.noise(vec, 1.6, detail=5.0), [(0.45, (0.62, 0.60, 0.52, 1)), (0.75, (0.40, 0.34, 0.22, 1))])
    mt.color(mt.mix(grid, stain, (0.22, 0.22, 0.21, 1))).set(Roughness=0.9)
    return mt.m


def planks(name, base, along='x', width=0.14):
    """Floorboards `width` wide, each a little darker or lighter, with a grain along `along`."""
    mt = Mat(name)
    vec, x, y, _ = mt.pos()
    across = y if along == 'x' else x
    idx = mt.math('FLOOR', mt.math('DIVIDE', across, width))
    shade = mt.white(mt.combine(idx, 0.0, 0.0))
    grain_vec = mt.scaled(vec, 1.0, 14.0, 14.0) if along == 'x' else mt.scaled(vec, 14.0, 1.0, 14.0)
    offset = mt.node('ShaderNodeVectorMath', operation='ADD')
    mt.link(grain_vec, offset.inputs[0])
    mt.link(mt.combine(0.0, 0.0, mt.math('MULTIPLY', idx, 7.31)), offset.inputs[1])
    grain = mt.noise(offset.outputs[0], 3.0, detail=6.0, rough=0.7, distortion=0.4)
    col = mt.ramp(grain, [(0.3, (base[0] * 0.55, base[1] * 0.55, base[2] * 0.55, 1)), (0.7, (*base, 1))])
    col = mt.mix(mt.math('MULTIPLY', shade, 0.5), col, (base[0] * 0.5, base[1] * 0.45, base[2] * 0.4, 1))
    gap = mt.grid_line(across, width, 0.006)
    col = mt.mix(gap, col, (0.02, 0.015, 0.01, 1))
    mt.color(col).set(Roughness=0.6)
    return mt.m


def dome_panels():
    """Painted steel panels of the drum and the dome: seams along the meridians and in rings,
    grey-white gone to rust where the slit lets the rain in."""
    mt = Mat('dome_panels')
    vec, x, y, z = mt.pos()
    dx = mt.math('SUBTRACT', x, CX)
    angle = mt.math('ARCTAN2', y, dx)
    meridian = mt.grid_line(mt.math('MULTIPLY', angle, 24 / (2 * math.pi)), 1.0, 0.012)
    ring = mt.grid_line(z, 0.9, 0.012)
    seam = mt.math('MAXIMUM', meridian, ring)
    rust = mt.noise(mt.scaled(vec, 3.0, 3.0, 0.7), 1.8, detail=7.0, rough=0.65)
    near_slit = mt.math('LESS_THAN', mt.math('ABSOLUTE', dx), SLIT + 0.9)
    rust_fac = mt.math('MULTIPLY', mt.ramp(rust, [(0.48, (0, 0, 0, 1)), (0.78, (1, 1, 1, 1))]), mt.math('ADD', 0.35, mt.math('MULTIPLY', near_slit, 0.5)))
    col = mt.mix(rust_fac, (0.50, 0.50, 0.47, 1), (0.26, 0.12, 0.05, 1))
    col = mt.mix(mt.math('MULTIPLY', seam, 0.7), col, (0.08, 0.08, 0.08, 1))
    lower = mt.math('LESS_THAN', z, 0.9)
    col = mt.mix(mt.math('MULTIPLY', lower, 0.75), col, (0.16, 0.19, 0.20, 1))
    mt.color(col).set(Roughness=0.55, Metallic=0.2)
    return mt.m


def crt_screen(name, seed):
    """A green phosphor terminal: rows of text, a brighter cursor row, scanlines, a darker rim."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    mt = Mat.__new__(Mat)
    mt.m, mt.nt = m, nt
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    out = nt.nodes['Material Output']
    # the screen's own UVs: generated coordinates would span the whole scene once it is joined
    tc = mt.node('ShaderNodeUVMap', uv_map='UVMap')
    sep = mt.node('ShaderNodeSeparateXYZ')
    mt.link(tc.outputs['UV'], sep.inputs[0])
    u, v = sep.outputs[0], sep.outputs[1]
    row = mt.math('FLOOR', mt.math('MULTIPLY', v, 18.0))
    col_ = mt.math('FLOOR', mt.math('MULTIPLY', u, 40.0))
    glyph = mt.white(mt.combine(col_, row, float(seed)))
    line_len = mt.math('MULTIPLY', mt.white(mt.combine(row, float(seed), 3.0)), 1.1)
    on_line = mt.math('LESS_THAN', u, line_len)
    lit = mt.math('MULTIPLY', mt.math('GREATER_THAN', glyph, 0.35), on_line)
    in_row = mt.math('LESS_THAN', mt.math('FRACT', mt.math('MULTIPLY', v, 18.0)), 0.62)
    lit = mt.math('MULTIPLY', lit, in_row)
    margin = mt.math(
        'MULTIPLY',
        mt.math('MULTIPLY', mt.math('GREATER_THAN', u, 0.08), mt.math('LESS_THAN', u, 0.92)),
        mt.math('MULTIPLY', mt.math('GREATER_THAN', v, 0.1), mt.math('LESS_THAN', v, 0.9)),
    )
    lit = mt.math('MULTIPLY', lit, margin)
    glow = mt.math('ADD', 0.12, mt.math('MULTIPLY', lit, 1.6))
    em = mt.node('ShaderNodeEmission')
    em.inputs['Color'].default_value = (0.25, 1.0, 0.45, 1)
    mt.link(glow, em.inputs['Strength'])
    mt.link(em.outputs[0], out.inputs['Surface'])
    return m


def star_chart():
    """A chart of the night sky on navy paper: stars of a few sizes, a grid of declination
    circles, gone pale at the edges."""
    mt = Mat('star_chart')
    vec, x, y, z = mt.pos()
    vor = mt.node('ShaderNodeTexVoronoi', feature='F1')
    vor.inputs['Scale'].default_value = 22.0
    vor.inputs['Randomness'].default_value = 1.0
    mt.link(vec, vor.inputs['Vector'])
    star = mt.math('LESS_THAN', vor.outputs['Distance'], 0.06)
    big = mt.math('GREATER_THAN', mt.white(vor.outputs['Position']), 0.85)
    star = mt.math('MULTIPLY', star, mt.math('ADD', 0.5, mt.math('MULTIPLY', big, 0.5)))
    grid = mt.math('MAXIMUM', mt.grid_line(y, 0.25, 0.004), mt.grid_line(z, 0.25, 0.004))
    col = mt.mix(mt.math('MULTIPLY', grid, 0.6), (0.04, 0.07, 0.16, 1), (0.30, 0.34, 0.42, 1))
    col = mt.mix(star, col, (0.85, 0.83, 0.70, 1))
    fade = mt.ramp(mt.noise(vec, 3.0, detail=4.0), [(0.4, (0, 0, 0, 1)), (0.8, (0.4, 0.4, 0.4, 1))])
    col = mt.mix(fade, col, (0.42, 0.40, 0.33, 1))
    mt.color(col).set(Roughness=0.8)
    return mt.m


# --- the control room -------------------------------------------------------------------------


def shell_faces_material(obj, floor, walls, ceiling, z_floor, z_ceiling):
    """Floor, ceiling and walls by the normal and height of each face."""
    me = obj.data
    me.materials.clear()
    for m in (floor, walls, ceiling):
        me.materials.append(m)
    for poly in me.polygons:
        n = poly.normal
        c = poly.center
        if n.z > 0.7 and c.z < z_floor + 0.01:
            poly.material_index = 0
        elif n.z < -0.7 and c.z > z_ceiling - 0.01:
            poly.material_index = 2
        else:
            poly.material_index = 1


def drop_faces(obj, outside):
    """Removes the faces whose centre `outside(center)` names as the outer skin of a shell."""
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    gone = [f for f in bm.faces if outside(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=gone, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


def solidify_out(obj, thickness):
    mod = obj.modifiers.new('wall', 'SOLIDIFY')
    mod.thickness = thickness
    mod.offset = -1.0  # the normals point into the room: the wall grows outwards
    mod.use_even_offset = True
    apply_modifiers(obj)


def door_cutter():
    w, h = DOOR['w'] / 2 + 0.02, DOOR['h'] + 0.02
    return span('door_cut', -0.4, 1.2, -w, w, -0.2, h)


def build_control_room(mats):
    x0, x1, y0, y1, h = A['x0'], A['x1'], A['y0'], A['y1'], A['h']
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    bmesh.ops.scale(bm, vec=(x1 - x0, y1 - y0, h), verts=bm.verts)
    bmesh.ops.translate(bm, vec=((x0 + x1) / 2, (y0 + y1) / 2, h / 2), verts=bm.verts)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    room = mesh_from_bmesh('control_room', bm)
    solidify_out(room, WALL)
    cut(room, door_cutter())
    cut(room, span('window_cut', -3.8, -1.8, y0 - 0.6, y0 + 0.4, 0.95, 2.2))
    eps = WALL * 0.6
    drop_faces(
        room,
        lambda c: c.x < x0 - eps or c.x > x1 + eps or c.y < y0 - eps or c.y > y1 + eps or c.z < -eps or c.z > h + eps,
    )
    shell_faces_material(room, mats['linoleum'], mats['wall_paint'], mats['ceiling'], 0.0, h)

    # skirting board
    for name, b in (
        ('skirting_w', (x0, x0 + 0.02, y0, y1)),
        ('skirting_n', (x0, x1, y1 - 0.02, y1)),
        ('skirting_s1', (x0, x1, y0, y0 + 0.02)),
    ):
        span(name, b[0], b[1], b[2], b[3], 0.0, 0.1, mats['dark_wood'])
    span('skirting_e1', x1 - 0.02, x1, y0, -0.6, 0.0, 0.1, mats['dark_wood'])
    span('skirting_e2', x1 - 0.02, x1, 0.6, y1, 0.0, 0.1, mats['dark_wood'])

    build_window(mats)
    build_desk(mats)
    build_chair(mats, (-3.05, 0.95), math.radians(-28))
    build_filing_cabinet(mats, (-0.62, -1.72))
    build_west_wall(mats)
    build_ceiling_light(mats)


def build_window(mats):
    y0 = A['y0']
    # the frame, flush with the inner face of the wall
    for name, b in (
        ('window_sill', (-3.86, -1.74, y0 - 0.2, y0 + 0.06, 0.9, 0.95)),
        ('window_head', (-3.86, -1.74, y0 - 0.2, y0 + 0.02, 2.2, 2.26)),
        ('window_left', (-3.86, -3.8, y0 - 0.2, y0 + 0.02, 0.95, 2.2)),
        ('window_right', (-1.8, -1.74, y0 - 0.2, y0 + 0.02, 0.95, 2.2)),
        ('window_mullion', (-2.83, -2.77, y0 - 0.16, y0 - 0.12, 0.95, 2.2)),
    ):
        span(name, *b, mats['white_paint'], bevel=0.006)
    # venetian blinds, the slats tilted so the moon comes through in stripes; a few hang crooked
    slat_mat = mats['blinds']
    z = 2.16
    i = 0
    while z > 0.98:
        # tilted down into the room, close to the angle of the moonlight
        tilt = math.radians(-36 + (rng.random() - 0.5) * 6)
        if i in (9, 10):
            tilt = math.radians(-8)
        box(f'slat_{i:02d}', (-2.8, y0 + 0.06, z), (1.98, 0.034, 0.003), slat_mat, rot=(tilt, 0, 0))
        z -= 0.038
        i += 1
    span('blind_rail', -3.8, -1.8, y0 + 0.02, y0 + 0.1, 2.17, 2.2, slat_mat)
    for x in (-3.5, -2.1):
        cylinder(f'blind_cord_{x}', (x, y0 + 0.085, 1.58), 0.002, 1.2, mats['cord'], verts=6)
    # the radiator under the window
    for k in range(16):
        x = -3.5 + k * 0.09
        span(f'radiator_{k:02d}', x, x + 0.06, y0 + 0.05, y0 + 0.14, 0.14, 0.76, mats['cream_paint'], bevel=0.01)
    for zz in (0.18, 0.72):
        cylinder(f'radiator_pipe_{zz}', (-2.82, y0 + 0.095, zz), 0.022, 1.46, mats['cream_paint'], rot=(0, math.pi / 2, 0), verts=12)
    cylinder('radiator_valve', (-1.97, y0 + 0.095, 0.1), 0.02, 0.2, mats['brass'], verts=12)


def build_desk(mats):
    y1 = A['y1']
    top = 0.76
    span('desk_top', -4.7, -1.75, y1 - 0.72, y1 - 0.02, top - 0.04, top, mats['desk_wood'], bevel=0.008)
    # a pedestal of drawers on the left, two legs on the right
    span('desk_pedestal', -4.66, -4.12, y1 - 0.68, y1 - 0.06, 0.0, top - 0.04, mats['olive_metal'], bevel=0.006)
    for k, (z0, z1) in enumerate(((0.05, 0.27), (0.29, 0.5), (0.52, 0.7))):
        span(f'desk_drawer_{k}', -4.64, -4.14, y1 - 0.70, y1 - 0.68, z0, z1, mats['olive_metal'], bevel=0.004)
        span(f'desk_handle_{k}', -4.47, -4.31, y1 - 0.725, y1 - 0.70, z1 - 0.05, z1 - 0.035, mats['brass'], bevel=0.003)
    for x in (-1.83, -2.3):
        span(f'desk_leg_{x}', x - 0.03, x + 0.03, y1 - 0.66, y1 - 0.06, 0.0, top - 0.04, mats['olive_metal'])
    span('desk_modesty', -2.33, -1.8, y1 - 0.08, y1 - 0.06, 0.2, top - 0.04, mats['olive_metal'])

    for k, (x, rot, seed) in enumerate(((-3.85, 0.18, 3), (-2.75, -0.12, 8))):
        build_terminal(mats, (x, y1 - 0.4, top), rot, seed, k)

    # keyboard in front of the left terminal, papers, a mug, the lamp
    box('keyboard', (-3.78, y1 - 0.62, top + 0.015), (0.46, 0.17, 0.03), mats['beige_plastic'], bevel=0.008, rot=(0.06, 0, 0.18))
    box('keyboard_keys', (-3.78, y1 - 0.62, top + 0.032), (0.42, 0.13, 0.008), mats['key_caps'], rot=(0.06, 0, 0.18))
    for k in range(6):
        x = -3.2 + rng.uniform(-0.25, 0.3)
        y = y1 - 0.42 + rng.uniform(-0.2, 0.15)
        box(f'paper_{k}', (x, y, top + 0.001 + k * 0.0012), (0.21, 0.297, 0.001), mats['paper'], rot=(0, 0, rng.uniform(-0.6, 0.6)))
    for k in range(4):
        x = rng.uniform(-3.6, -2.0)
        y = rng.uniform(-0.6, 0.9)
        box(f'floor_paper_{k}', (x, y, 0.001 + k * 0.0012), (0.21, 0.297, 0.001), mats['paper'], rot=(0, 0, rng.uniform(0, math.pi)))
    cylinder('mug', (-2.15, y1 - 0.5, top + 0.05), 0.04, 0.1, mats['mug'], verts=24)
    cylinder('mug_coffee', (-2.15, y1 - 0.5, top + 0.092), 0.036, 0.004, mats['coffee'], verts=24)
    torus('mug_handle', (-2.1, y1 - 0.5, top + 0.05), 0.028, 0.007, mats['mug'], rot=(math.pi / 2, 0, 0), major_seg=16, minor_seg=6)

    # the desk lamp: a heavy base, two arms, a conical shade aimed at the papers
    lx, ly = -2.3, y1 - 0.18
    cylinder('lamp_base', (lx, ly, top + 0.02), 0.085, 0.04, mats['lamp_black'], verts=24, bevel=0.006)
    p0 = Vector((lx, ly, top + 0.04))
    p1 = Vector((lx - 0.12, ly - 0.08, top + 0.44))
    p2 = Vector((lx - 0.42, ly - 0.32, top + 0.5))
    for name, a, b in (('lamp_arm_lower', p0, p1), ('lamp_arm_upper', p1, p2)):
        d = b - a
        rot = d.to_track_quat('Z', 'Y').to_euler()
        cylinder(name, (a + b) / 2, 0.009, d.length, mats['lamp_black'], rot=rot, verts=10)
    sphere('lamp_joint', p1, 0.018, mats['brass'])
    aim = Vector((-3.1, y1 - 0.45, top))
    d = (aim - p2).normalized()
    shade_c = p2 + d * 0.08
    cylinder('lamp_shade', shade_c, 0.12, 0.16, mats['lamp_shade'], rot=(-d).to_track_quat('Z', 'Y').to_euler(), verts=32, r2=0.035, caps=False)
    sphere('lamp_bulb', p2 + d * 0.13, 0.03, mats['bulb_warm'])
    light = bpy.data.lights.new('desk_lamp', 'SPOT')
    light.energy = 60.0
    light.color = (1.0, 0.58, 0.26)
    light.spot_size = math.radians(115)
    light.spot_blend = 0.7
    light.shadow_soft_size = 0.03
    obj = link(bpy.data.objects.new('desk_lamp', light))
    obj.location = p2 + d * 0.13
    obj.rotation_euler = d.to_track_quat('-Z', 'Y').to_euler()


def build_terminal(mats, base, rot, seed, k):
    """A beige terminal with a deep tapered back and a curved-looking green screen."""
    x, y, z = base
    body = box(f'terminal_{k}_body', (0, 0, 0.2), (0.42, 0.34, 0.36), mats['beige_plastic'], bevel=0.02)
    # the tube's housing, a square frustum narrowing to the back
    back = cylinder(f'terminal_{k}_back', (0, 0.3, 0.21), 0.22, 0.26, mats['beige_plastic'], rot=(-math.pi / 2, math.pi / 4, 0), verts=4, r2=0.1)
    stand = box(f'terminal_{k}_stand', (0, 0.05, 0.01), (0.3, 0.3, 0.02), mats['beige_plastic'], bevel=0.006)
    bezel = box(f'terminal_{k}_bezel', (0, -0.172, 0.215), (0.34, 0.01, 0.27), mats['dark_plastic'], bevel=0.008)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -0.178, 0.215), rotation=(math.pi / 2, 0, 0))
    screen = bpy.context.active_object
    screen.name = f'terminal_{k}_screen'
    screen.scale = (0.3, 0.23, 1)
    bpy.ops.object.transform_apply(scale=True)
    screen.data.materials.append(crt_screen(f'crt_{k}', seed))
    led = box(f'terminal_{k}_led', (0.17, -0.172, 0.06), (0.012, 0.006, 0.006), mats['led_red'])
    group = [body, back, stand, bezel, screen, led]
    m = Matrix.Translation((x, y, z)) @ Matrix.Rotation(rot, 4, 'Z')
    for obj in group:
        obj.matrix_world = m @ obj.matrix_world


def build_chair(mats, at, yaw):
    """A swivel chair, pushed back from the desk and turned away."""
    x, y = at
    parts = []
    for k in range(5):
        a = k * 2 * math.pi / 5
        parts.append(box(f'chair_leg_{k}', (math.cos(a) * 0.17, math.sin(a) * 0.17, 0.06), (0.34, 0.04, 0.03), mats['lamp_black'], rot=(0, 0, a), bevel=0.008))
        parts.append(sphere(f'chair_wheel_{k}', (math.cos(a) * 0.32, math.sin(a) * 0.32, 0.03), 0.028, mats['dark_plastic']))
    parts.append(cylinder('chair_post', (0, 0, 0.27), 0.025, 0.4, mats['chrome'], verts=16))
    parts.append(box('chair_seat', (0, 0, 0.48), (0.46, 0.44, 0.08), mats['upholstery'], bevel=0.03, segments=3))
    parts.append(box('chair_back_bar', (0, -0.24, 0.62), (0.05, 0.03, 0.3), mats['lamp_black']))
    parts.append(box('chair_back', (0, -0.25, 0.86), (0.42, 0.06, 0.34), mats['upholstery'], bevel=0.03, segments=3, rot=(-0.12, 0, 0)))
    m = Matrix.Translation((x, y, 0)) @ Matrix.Rotation(yaw, 4, 'Z')
    for obj in parts:
        obj.matrix_world = m @ obj.matrix_world


def build_filing_cabinet(mats, at):
    x, y = at
    span('cabinet_body', x - 0.25, x + 0.25, y - 0.3, y + 0.3, 0.0, 1.32, mats['olive_metal'], bevel=0.008)
    for k in range(4):
        z0 = 0.04 + k * 0.32
        # the second drawer stands open a hand's width
        dy = 0.0 if k != 1 else 0.14
        span(f'cabinet_drawer_{k}', x - 0.23, x + 0.23, y + 0.3 + dy, y + 0.32 + dy, z0, z0 + 0.29, mats['olive_metal'], bevel=0.005)
        span(f'cabinet_handle_{k}', x - 0.08, x + 0.08, y + 0.32 + dy, y + 0.345 + dy, z0 + 0.2, z0 + 0.22, mats['chrome'], bevel=0.004)
        span(f'cabinet_label_{k}', x - 0.05, x + 0.05, y + 0.32 + dy, y + 0.322 + dy, z0 + 0.235, z0 + 0.27, mats['paper'])
        if k == 1:
            span('cabinet_drawer_1_side_l', x - 0.23, x - 0.22, y + 0.16, y + 0.3 + dy, z0 + 0.02, z0 + 0.24, mats['olive_metal'])
            span('cabinet_drawer_1_side_r', x + 0.22, x + 0.23, y + 0.16, y + 0.3 + dy, z0 + 0.02, z0 + 0.24, mats['olive_metal'])
            for f in range(7):
                yy = y + 0.2 + f * 0.035
                box(f'cabinet_folder_{f}', (x, yy, z0 + 0.2), (0.4, 0.004, 0.2), mats['manila'], rot=(rng.uniform(-0.2, 0.2), 0, 0))
    # a dead plant on top
    cylinder('plant_pot', (x, y, 1.40), 0.09, 0.16, mats['terracotta'], verts=20, r2=0.07)
    for k in range(7):
        a = k * 2 * math.pi / 7 + rng.uniform(-0.2, 0.2)
        lean = rng.uniform(0.3, 0.9)
        d = Vector((math.cos(a) * math.sin(lean), math.sin(a) * math.sin(lean), math.cos(lean)))
        length = rng.uniform(0.18, 0.32)
        c = Vector((x, y, 1.47)) + d * (length / 2)
        cylinder(f'plant_stem_{k}', c, 0.004, length, mats['dead_plant'], rot=d.to_track_quat('Z', 'Y').to_euler(), verts=5)


def build_west_wall(mats):
    x0 = A['x0']
    # the star chart in a black frame
    span('chart_frame', x0, x0 + 0.03, -1.7, 0.2, 0.92, 2.08, mats['lamp_black'], bevel=0.005)
    bpy.ops.mesh.primitive_plane_add(size=1, location=(x0 + 0.031, -0.75, 1.5), rotation=(math.pi / 2, 0, math.pi / 2))
    chart = bpy.context.active_object
    chart.name = 'chart'
    chart.scale = (1.8, 1.06, 1)
    bpy.ops.object.transform_apply(scale=True)
    chart.data.materials.append(star_chart())
    # the clock, stopped at 3:17
    cy, cz = 0.95, 2.05
    cylinder('clock_rim', (x0 + 0.03, cy, cz), 0.18, 0.05, mats['lamp_black'], rot=(0, math.pi / 2, 0), verts=40, bevel=0.01)
    cylinder('clock_face', (x0 + 0.056, cy, cz), 0.16, 0.002, mats['clock_face'], rot=(0, math.pi / 2, 0), verts=40)
    for k in range(12):
        a = k * math.pi / 6
        box(f'clock_tick_{k}', (x0 + 0.059, cy + math.sin(a) * 0.14, cz + math.cos(a) * 0.14), (0.002, 0.008, 0.025 if k % 3 == 0 else 0.015), mats['lamp_black'], rot=(-a, 0, 0))
    for name, angle, length, width in (('clock_hour', (3 + 17 / 60) / 12, 0.08, 0.012), ('clock_minute', 17 / 60, 0.125, 0.008)):
        a = angle * 2 * math.pi
        c = (x0 + 0.062, cy + math.sin(a) * length / 2, cz + math.cos(a) * length / 2)
        box(name, c, (0.002, width, length), mats['lamp_black'], rot=(-a, 0, 0))
    # an empty coat hook by the door
    cylinder('hook', (-0.3, A['y1'] - 0.04, 1.75), 0.012, 0.08, mats['brass'], rot=(math.pi / 2, 0, 0), verts=8)


def build_ceiling_light(mats):
    h = A['h']
    span('fixture', -3.2, -1.9, -0.14, 0.14, h - 0.09, h, mats['white_paint'], bevel=0.01)
    # one tube still burns, dim and cold; the other is dead but for a glow at one end
    cylinder('tube_lit', (-2.55, -0.06, h - 0.11), 0.016, 1.2, mats['tube_lit'], rot=(0, math.pi / 2, 0), verts=12)
    cylinder('tube_dead', (-2.55, 0.06, h - 0.11), 0.016, 1.2, mats['dead_tube'], rot=(0, math.pi / 2, 0), verts=12)
    sphere('tube_glow', (-1.98, 0.06, h - 0.11), 0.017, mats['tube_glow'])
    light = bpy.data.lights.new('fluorescent', 'AREA')
    light.shape = 'RECTANGLE'
    light.size = 1.2
    light.size_y = 0.05
    light.energy = 7.0
    light.color = (0.72, 0.92, 0.84)
    link(bpy.data.objects.new('fluorescent', light)).location = (-2.55, -0.06, h - 0.14)


# --- the door ---------------------------------------------------------------------------------


def build_door(mats):
    w, h = DOOR['w'] / 2, DOOR['h']
    xa, xb = -0.04, 0.64  # through both walls
    # the tunnel through the two walls: jambs, lintel and a steel threshold
    span('door_jamb_s', xa, xb, -w - 0.05, -w, 0.0, h, mats['olive_metal'])
    span('door_jamb_n', xa, xb, w, w + 0.05, 0.0, h, mats['olive_metal'])
    span('door_lintel', xa, xb, -w - 0.05, w + 0.05, h, h + 0.05, mats['olive_metal'])
    span('door_threshold', xa, xb, -w, w, 0.0, 0.015, mats['chrome'])
    # casings round the opening on both faces
    for side, x in (('a', -0.02), ('b', 0.66)):
        span(f'casing_{side}_s', x - 0.02, x + 0.02, -w - 0.13, -w - 0.03, 0.0, h + 0.1, mats['olive_metal'], bevel=0.004)
        span(f'casing_{side}_n', x - 0.02, x + 0.02, w + 0.03, w + 0.13, 0.0, h + 0.1, mats['olive_metal'], bevel=0.004)
        span(f'casing_{side}_top', x - 0.02, x + 0.02, -w - 0.13, w + 0.13, h + 0.02, h + 0.12, mats['olive_metal'], bevel=0.004)
    # the plate above the door, in the control room
    span('plate', -0.03, -0.015, -0.32, 0.32, h + 0.2, h + 0.4, mats['enamel_plate'], bevel=0.004)
    text_mesh('plate_text', 'DOME  ·  KEEP DARK', (-0.036, 0.0, h + 0.3), 0.075, mats['plate_ink'], rot=(math.pi / 2, 0, -math.pi / 2))
    # the leaf, hinged on the north jamb, swung 112° into the control room
    t = 0.05
    box('door_leaf', (0, -DOOR['w'] / 2 + 0.01, h / 2 - 0.005), (t, DOOR['w'] - 0.02, h - 0.03), mats['door_steel'], bevel=0.006)
    # a round porthole with a dark glass
    torus('door_porthole', (0, -0.5, 1.55), 0.12, 0.022, mats['chrome'], rot=(0, math.pi / 2, 0), major_seg=32, minor_seg=8)
    cylinder('door_glass', (0, -0.5, 1.55), 0.12, t + 0.004, mats['dark_glass'], rot=(0, math.pi / 2, 0), verts=32)
    for side in (-1, 1):
        cylinder(f'door_handle_{side}', (side * 0.07, -0.88, 1.0), 0.016, 0.14, mats['chrome'], rot=(0, math.pi / 2, 0), verts=12)
        box(f'door_lever_{side}', (side * 0.14, -0.82, 1.0), (0.025, 0.14, 0.025), mats['chrome'], bevel=0.008)
        span(f'door_kick_{side}', side * (t / 2) - 0.002, side * (t / 2) + 0.002, -0.95, -0.05, 0.03, 0.3, mats['chrome'])
    for z in (0.3, 1.8):
        cylinder(f'door_hinge_{z}', (0, 0.0, z), 0.018, 0.14, mats['chrome'], verts=12)
    m = Matrix.Translation((-0.06, w, 0)) @ Matrix.Rotation(math.radians(-112), 4, 'Z')
    for obj in bpy.context.scene.objects:
        if obj.name.startswith('door_') and obj.name not in {
            'door_jamb_s',
            'door_jamb_n',
            'door_lintel',
            'door_threshold',
        }:
            obj.matrix_world = m @ obj.matrix_world


# --- the dome ---------------------------------------------------------------------------------


def build_dome(mats):
    # the profile from the middle of the floor out to the drum, up the drum, over the dome to the
    # zenith, spun round the axis
    bm = bmesh.new()
    pts = [(0.0, 0.0)]
    for k in range(1, 10):
        pts.append((R * k / 9, 0.0))
    for k in range(1, 6):
        pts.append((R, H * k / 5))
    for k in range(1, 25):
        a = (math.pi / 2) * k / 24
        pts.append((R * math.cos(a), H + R * math.sin(a)))
    verts = [bm.verts.new((r, 0.0, z)) for r, z in pts]
    edges = [bm.edges.new((verts[i], verts[i + 1])) for i in range(len(verts) - 1)]
    bmesh.ops.spin(bm, geom=verts + edges, cent=(0, 0, 0), axis=(0, 0, 1), angle=2 * math.pi, steps=72, use_merge=True)
    bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=1e-5)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bmesh.ops.reverse_faces(bm, faces=bm.faces)
    bmesh.ops.translate(bm, vec=(CX, 0, 0), verts=bm.verts)
    dome = mesh_from_bmesh('dome', bm)
    solidify_out(dome, WALL)
    cut(dome, door_cutter())
    # the slit opens to the south, from above the drum up over the zenith
    cut(dome, span('slit_cut', CX - SLIT, CX + SLIT, -R - 1.0, 0.5, H + 0.5, H + R + 1.0))

    def outside(c):
        if c.z < -WALL * 0.6:
            return True
        dx, dy = c.x - CX, c.y
        if c.z <= H:
            return math.hypot(dx, dy) > R + WALL * 0.6
        return math.sqrt(dx * dx + dy * dy + (c.z - H) ** 2) > R + WALL * 0.6

    drop_faces(dome, outside)
    me = dome.data
    me.materials.clear()
    me.materials.append(mats['dome_floor'])
    me.materials.append(mats['dome_panels'])
    for poly in me.polygons:
        poly.material_index = 0 if poly.normal.z > 0.7 and poly.center.z < 0.01 else 1
    activate(dome)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(30))

    # the rail the dome turns on, ribs up the dome, stopping short of the slit
    torus('dome_rail', (CX, 0, H), R - 0.06, 0.06, mats['rail'], major_seg=96, minor_seg=10)
    torus('drum_rail', (CX, 0, 0.9), R - 0.03, 0.03, mats['rail'], major_seg=96, minor_seg=8)
    for k in range(6):
        az = math.radians(k * 60)
        rib = torus(f'rib_{k}', (CX, 0, H), R - 0.07, 0.045, mats['rail'], rot=(math.pi / 2, 0, az), major_seg=96, minor_seg=8)
        activate(rib)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.bisect(plane_co=(CX, 0, H + 0.08), plane_no=(0, 0, 1), clear_inner=True)
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.bisect(plane_co=(CX, 0, H + R * 0.82), plane_no=(0, 0, 1), clear_outer=True)
        # one half of the great circle only: the other half belongs to the rib across the dome
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.bisect(plane_co=(CX, 0, 0), plane_no=(math.cos(az), math.sin(az), 0), clear_inner=True)
        bpy.ops.object.mode_set(mode='OBJECT')
    # the slit's own frame: two rails along its edges
    for side in (-1, 1):
        off = SLIT + 0.06
        rail = torus(f'slit_rail_{side}', (CX + side * off, 0, H), math.sqrt(R * R - off * off) - 0.05, 0.05, mats['rail'], rot=(math.pi / 2, 0, math.pi / 2), major_seg=96, minor_seg=8)
        activate(rail)
        bpy.ops.object.mode_set(mode='EDIT')
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.bisect(plane_co=(CX, 0, H + 0.45), plane_no=(0, 0, 1), clear_inner=True)
        bpy.ops.mesh.select_all(action='SELECT')
        bpy.ops.mesh.bisect(plane_co=(CX, 0.55, 0), plane_no=(0, -1, 0), clear_inner=True)
        bpy.ops.object.mode_set(mode='OBJECT')

    build_telescope(mats)
    build_dome_props(mats)


def build_telescope(mats):
    px, py = CX, 0.0
    cylinder('pier', (px, py, 0.65), 0.42, 1.3, mats['concrete'], verts=40, bevel=0.01)
    cylinder('pier_cap', (px, py, 1.33), 0.48, 0.06, mats['telescope_iron'], verts=40, bevel=0.01)
    # the polar axis tilted to the north at the latitude, the fork on it, the tube between the tines
    lat = math.radians(52)
    axis = Vector((0, math.cos(lat), math.sin(lat)))
    base = Vector((px, py, 1.36))
    head = base + axis * 0.45
    cylinder('polar_axis', (base + head) / 2, 0.16, 0.45, mats['telescope_iron'], rot=axis.to_track_quat('Z', 'Y').to_euler(), verts=32, bevel=0.01)
    cylinder('declination_disc', head, 0.26, 0.06, mats['brass'], rot=axis.to_track_quat('Z', 'Y').to_euler(), verts=48, bevel=0.006)
    # the tube aims south and up, out of the slit
    elev = math.radians(46)
    d = Vector((0.0, -math.cos(elev), math.sin(elev)))
    pivot = head + axis * 0.42
    side = Vector((1, 0, 0))
    for s in (-1, 1):
        a = head + side * s * 0.36 + axis * 0.03
        b = pivot + side * s * 0.36
        v = b - a
        box(f'fork_{s}', (a + b) / 2, (0.07, 0.07, v.length + 0.08), mats['telescope_iron'], rot=v.to_track_quat('Z', 'Y').to_euler(), bevel=0.01)
    box('fork_base', head + axis * 0.03, (0.8, 0.14, 0.1), mats['telescope_iron'], rot=axis.to_track_quat('Z', 'Y').to_euler(), bevel=0.01)
    rot = d.to_track_quat('Z', 'Y').to_euler()
    cylinder('tube', pivot + d * 0.45, 0.3, 2.9, mats['telescope_white'], rot=rot, verts=48)
    cylinder('tube_dew_shield', pivot + d * 2.05, 0.33, 0.4, mats['telescope_white'], rot=rot, verts=48)
    cylinder('tube_mouth', pivot + d * 2.255, 0.31, 0.01, mats['lens_black'], rot=rot, verts=48)
    cylinder('tube_cell', pivot - d * 1.0, 0.32, 0.12, mats['telescope_iron'], rot=rot, verts=48, bevel=0.01)
    cylinder('focuser', pivot - d * 1.16, 0.07, 0.2, mats['brass'], rot=rot, verts=24)
    cylinder('eyepiece', pivot - d * 1.3, 0.035, 0.1, mats['lens_black'], rot=rot, verts=16)
    for s in (-1, 1):
        cylinder(f'trunnion_{s}', pivot + side * s * 0.33, 0.06, 0.08, mats['brass'], rot=(0, math.pi / 2, 0), verts=20)
    for t in (-0.6, 0.3, 1.2):
        torus(f'tube_ring_{t}', pivot + d * t, 0.305, 0.015, mats['telescope_iron'], rot=rot, major_seg=48, minor_seg=6)
    # the finder on the tube
    up = Vector((0, math.sin(elev), math.cos(elev)))
    fc = pivot + d * 0.6 + up * 0.38 + side * 0.12
    cylinder('finder', fc, 0.045, 0.6, mats['telescope_white'], rot=rot, verts=20)
    for t in (-0.15, 0.15):
        box(f'finder_bracket_{t}', pivot + d * (0.6 + t) + up * 0.33 + side * 0.08, (0.03, 0.05, 0.1), mats['telescope_iron'], rot=rot)


def build_dome_props(mats):
    # the red safelight beside the door, in a wire cage on a bracket
    lamp = Vector((0.82, -0.98, 2.05))
    box('safelight_bracket', lamp + Vector((-0.08, 0, 0)), (0.12, 0.04, 0.04), mats['lamp_black'])
    sphere('safelight_bulb', lamp, 0.055, mats['bulb_red'])
    for k in range(4):
        torus(f'safelight_cage_{k}', lamp, 0.075, 0.004, mats['lamp_black'], rot=(math.pi / 2, 0, k * math.pi / 4), major_seg=24, minor_seg=4)
    torus('safelight_cage_ring', lamp, 0.075, 0.004, mats['lamp_black'], major_seg=24, minor_seg=4)
    light = bpy.data.lights.new('safelight', 'POINT')
    light.energy = 7.0
    light.color = (1.0, 0.06, 0.03)
    light.shadow_soft_size = 0.05
    link(bpy.data.objects.new('safelight', light)).location = lamp + Vector((0.09, 0, 0))

    # a stepladder at the eyepiece, a stool, a table with the open logbook
    lx, ly = CX + 0.8, 1.0
    for s_ in (-1, 1):
        y = ly + s_ * 0.22
        rod(f'ladder_front_{s_}', (lx - 0.28, y, 0.0), (lx, y, 1.47), 0.045, mats['ladder_wood'])
        rod(f'ladder_back_{s_}', (lx + 0.42, y, 0.0), (lx + 0.08, y, 1.47), 0.04, mats['ladder_wood'])
    for k in range(4):
        z = 0.32 + k * 0.32
        x = lx - 0.28 * (1 - z / 1.47)
        box(f'ladder_step_{k}', (x + 0.04, ly, z), (0.13, 0.44, 0.025), mats['ladder_wood'], bevel=0.003)
    box('ladder_top', (lx + 0.04, ly, 1.485), (0.26, 0.5, 0.03), mats['ladder_wood'], bevel=0.005)

    tx, ty = CX + 2.2, -1.9
    span('table_top', tx - 0.45, tx + 0.45, ty - 0.3, ty + 0.3, 0.72, 0.75, mats['desk_wood'], bevel=0.006)
    for sx in (-1, 1):
        for sy in (-1, 1):
            span(f'table_leg_{sx}_{sy}', tx + sx * 0.4 - 0.025, tx + sx * 0.4 + 0.025, ty + sy * 0.25 - 0.025, ty + sy * 0.25 + 0.025, 0.0, 0.72, mats['desk_wood'])
    box('logbook_cover', (tx, ty, 0.755), (0.5, 0.34, 0.01), mats['logbook'], rot=(0, 0, 0.25))
    for s in (-1, 1):
        box(f'logbook_page_{s}', (tx + s * 0.118 * math.cos(0.25), ty + s * 0.118 * math.sin(0.25), 0.762), (0.23, 0.32, 0.006), mats['paper_lined'], rot=(0, s * -0.05, 0.25))
    cylinder('flashlight', (tx - 0.25, ty - 0.12, 0.775), 0.02, 0.2, mats['lamp_black'], rot=(0, math.pi / 2, 0.9), verts=16)
    cylinder('flashlight_lens', (tx - 0.25 + 0.1 * math.cos(0.9), ty - 0.12 + 0.1 * math.sin(0.9), 0.775), 0.024, 0.02, mats['bulb_red_dim'], rot=(0, math.pi / 2, 0.9), verts=16)

    sx, sy = CX - 0.4, -1.6
    cylinder('stool_seat', (sx, sy, 0.62), 0.17, 0.04, mats['ladder_wood'], verts=28, bevel=0.008)
    for k in range(3):
        a = k * 2 * math.pi / 3
        top = Vector((sx + math.cos(a) * 0.1, sy + math.sin(a) * 0.1, 0.6))
        foot = Vector((sx + math.cos(a) * 0.2, sy + math.sin(a) * 0.2, 0.0))
        v = top - foot
        cylinder(f'stool_leg_{k}', (top + foot) / 2, 0.016, v.length, mats['ladder_wood'], rot=v.to_track_quat('Z', 'Y').to_euler(), verts=10)
    torus('stool_ring', (sx, sy, 0.25), 0.16, 0.008, mats['lamp_black'], major_seg=24, minor_seg=6)
    # a chart rolled up on the floor, a cable from the pier to the wall
    cylinder('rolled_chart', (CX + 1.0, -1.2, 0.04), 0.04, 0.9, mats['paper'], rot=(math.pi / 2, 0, 0.4), verts=16)
    curve = bpy.data.curves.new('cable', 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 0.012
    curve.bevel_resolution = 2
    spline = curve.splines.new('BEZIER')
    pts = [(CX + 0.3, -0.3, 0.2), (CX + 0.9, -0.9, 0.012), (CX + 1.6, -1.8, 0.012), (CX + 2.0, -2.9, 0.4)]
    spline.bezier_points.add(len(pts) - 1)
    for bp, p in zip(spline.bezier_points, pts):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    cable = link(bpy.data.objects.new('cable', curve))
    activate(cable)
    bpy.ops.object.convert(target='MESH')
    bpy.context.active_object.data.materials.append(mats['lamp_black'])


# --- the moon ---------------------------------------------------------------------------------


def build_moon():
    sun = bpy.data.lights.new('moon', 'SUN')
    sun.energy = 5.0
    sun.color = (0.62, 0.74, 1.0)
    sun.angle = math.radians(0.6)
    obj = link(bpy.data.objects.new('moon', sun))
    direction = Vector((-0.2, 0.7, -0.69)).normalized()
    obj.rotation_euler = direction.to_track_quat('-Z', 'Y').to_euler()


# --- cameras ----------------------------------------------------------------------------------


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = d.to_track_quat('-Z', 'Y')


def camera(name, loc, target, lens):
    cam = bpy.data.cameras.new(name)
    cam.lens = lens
    cam.sensor_fit = 'HORIZONTAL'
    cam.sensor_width = 36
    cam.clip_start = 0.05
    cam.clip_end = 40.0
    obj = link(bpy.data.objects.new(name, cam))
    obj.location = loc
    look_at(obj, target)
    return obj


# the flight from the control room through the door into the dome: (frame, position, look-at)
FLIGHT = [
    (0, (-4.5, -1.6, 1.68), (-1.2, 0.9, 0.95)),
    (24, (-3.5, -0.95, 1.45), (-2.6, 1.7, 0.9)),
    (54, (-2.2, -0.4, 1.5), (0.4, 0.1, 1.35)),
    (84, (-0.7, 0.0, 1.55), (2.0, 0.0, 1.6)),
    (104, (0.7, 0.0, 1.6), (3.4, 0.4, 1.9)),
    (122, (2.0, 1.4, 1.7), (4.0, 0.3, 2.2)),
    (140, (3.5, 2.5, 1.8), (4.0, -1.6, 4.2)),
    (156, (5.7, 1.4, 1.75), (4.0, -0.2, 2.3)),
    (168, (6.2, -1.7, 1.7), (2.9, 0.6, 1.5)),
]


def build_cameras():
    a = camera('camera_control_room', (-4.72, -1.88, 1.72), (-1.4, 0.75, 0.82), 18)
    b = camera('camera_dome', (6.35, -1.95, 1.62), (2.8, 0.55, 1.6), 16)
    f = camera('camera_flight', FLIGHT[0][1], FLIGHT[0][2], 22)
    f.animation_data_create()
    action = bpy.data.actions.new('through_the_door')
    f.animation_data.action = action
    prev = None
    for frame, loc, target in FLIGHT:
        f.location = loc
        look_at(f, target)
        q = f.rotation_quaternion.copy()
        if prev is not None and prev.dot(q) < 0:
            q.negate()
        f.rotation_quaternion = q
        prev = q
        f.keyframe_insert('location', frame=frame)
        f.keyframe_insert('rotation_quaternion', frame=frame)
    for fc in _fcurves(f):
        for kp in fc.keyframe_points:
            kp.interpolation = 'BEZIER'
            kp.handle_left_type = kp.handle_right_type = 'AUTO_CLAMPED'
        fc.update()
    return a, b, f


def _fcurves(obj):
    action = obj.animation_data.action
    if hasattr(action, 'fcurves'):
        return list(action.fcurves)
    # Blender 5: layered actions keep their curves in the channelbag of a slot
    out = []
    for layer in action.layers:
        for strip in layer.strips:
            for bag in strip.channelbags:
                out.extend(bag.fcurves)
    return out


# --- materials of the scene --------------------------------------------------------------------


def materials():
    return {
        'linoleum': linoleum(),
        'wall_paint': wall_paint(),
        'ceiling': ceiling_tiles(),
        'dark_wood': simple('dark_wood', (0.08, 0.05, 0.03)),
        'white_paint': grimy('white_paint', (0.62, 0.61, 0.55), (0.3, 0.27, 0.2), scale=6.0, amount=0.5),
        'cream_paint': grimy('cream_paint', (0.55, 0.50, 0.38), (0.22, 0.14, 0.08), scale=5.0, amount=0.6),
        'blinds': grimy('blinds', (0.66, 0.64, 0.56), (0.35, 0.3, 0.22), scale=8.0, amount=0.4),
        'cord': simple('cord', (0.5, 0.48, 0.42)),
        'brass': simple('brass', (0.55, 0.40, 0.16), rough=0.35, metal=0.6),
        'chrome': simple('chrome', (0.45, 0.45, 0.45), rough=0.3, metal=0.7),
        'desk_wood': planks('desk_wood', (0.34, 0.20, 0.11), along='x', width=0.7),
        'olive_metal': grimy('olive_metal', (0.20, 0.23, 0.18), (0.11, 0.09, 0.06), scale=7.0, amount=0.6, rough=0.5),
        'beige_plastic': grimy('beige_plastic', (0.56, 0.51, 0.40), (0.38, 0.32, 0.22), scale=9.0, amount=0.5, rough=0.5),
        'dark_plastic': simple('dark_plastic', (0.035, 0.035, 0.03), rough=0.4),
        'key_caps': grimy('key_caps', (0.44, 0.40, 0.32), (0.18, 0.15, 0.1), scale=30.0, amount=0.4),
        'paper': grimy('paper', (0.74, 0.72, 0.64), (0.55, 0.48, 0.33), scale=10.0, amount=0.5),
        'paper_lined': grimy('paper_lined', (0.70, 0.68, 0.58), (0.35, 0.36, 0.5), scale=40.0, amount=0.3),
        'manila': simple('manila', (0.62, 0.50, 0.28)),
        'mug': simple('mug', (0.55, 0.12, 0.08), rough=0.3),
        'coffee': simple('coffee', (0.02, 0.01, 0.005), rough=0.1),
        'lamp_black': simple('lamp_black', (0.02, 0.02, 0.02), rough=0.4),
        'lamp_shade': simple('lamp_shade', (0.05, 0.12, 0.08), rough=0.35),
        'bulb_warm': emission('bulb_warm', (1.0, 0.7, 0.4), 40.0),
        'bulb_red': emission('bulb_red', (1.0, 0.05, 0.02), 35.0),
        'bulb_red_dim': emission('bulb_red_dim', (1.0, 0.05, 0.02), 4.0),
        'led_red': emission('led_red', (1.0, 0.08, 0.02), 6.0),
        'tube_glow': emission('tube_glow', (0.75, 0.55, 1.0), 6.0),
        'tube_lit': emission('tube_lit', (0.72, 0.92, 0.84), 3.0),
        'dead_tube': simple('dead_tube', (0.35, 0.36, 0.36), rough=0.4),
        'upholstery': grimy('upholstery', (0.16, 0.07, 0.05), (0.06, 0.04, 0.03), scale=12.0, amount=0.5, rough=0.9),
        'terracotta': simple('terracotta', (0.38, 0.14, 0.07)),
        'dead_plant': simple('dead_plant', (0.18, 0.13, 0.06)),
        'clock_face': simple('clock_face', (0.7, 0.68, 0.6)),
        'door_steel': grimy('door_steel', (0.18, 0.21, 0.19), (0.24, 0.12, 0.05), scale=5.0, amount=0.7, rough=0.5),
        'dark_glass': simple('dark_glass', (0.01, 0.012, 0.015), rough=0.1),
        'enamel_plate': simple('enamel_plate', (0.62, 0.6, 0.52), rough=0.3),
        'plate_ink': simple('plate_ink', (0.45, 0.03, 0.02), rough=0.3),
        'dome_floor': planks('dome_floor', (0.25, 0.16, 0.10), along='x', width=0.12),
        'dome_panels': dome_panels(),
        'rail': grimy('rail', (0.16, 0.16, 0.15), (0.2, 0.09, 0.04), scale=6.0, amount=0.7, rough=0.5),
        'concrete': grimy('concrete', (0.36, 0.35, 0.33), (0.18, 0.17, 0.15), scale=4.0, amount=0.6, rough=0.9),
        'telescope_white': grimy('telescope_white', (0.66, 0.66, 0.62), (0.3, 0.28, 0.24), scale=6.0, amount=0.35, rough=0.35),
        'telescope_iron': grimy('telescope_iron', (0.07, 0.10, 0.12), (0.04, 0.04, 0.04), scale=8.0, amount=0.5, rough=0.4),
        'lens_black': simple('lens_black', (0.01, 0.01, 0.012), rough=0.2),
        'ladder_wood': planks('ladder_wood', (0.42, 0.28, 0.15), along='x', width=0.5),
        'logbook': simple('logbook', (0.12, 0.05, 0.04)),
    }


# --- bake and export --------------------------------------------------------------------------


def all_meshes():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']


def join_static():
    """Applies every modifier and joins every mesh into one object, `observatory`."""
    for obj in list(bpy.context.scene.objects):
        if obj.type in {'CURVE', 'FONT'}:
            activate(obj)
            bpy.ops.object.convert(target='MESH')
    meshes = all_meshes()
    for obj in meshes:
        if obj.modifiers:
            apply_modifiers(obj)
    for o in bpy.context.selected_objects:
        o.select_set(False)
    for obj in meshes:
        obj.select_set(True)
    bpy.context.view_layer.objects.active = meshes[0]
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    bpy.ops.object.join()
    obj = bpy.context.active_object
    obj.name = 'observatory'
    obj.data.name = 'observatory'
    return obj


# texels per metre relative to the rest, by material: the dome is large and mostly in the dark, its
# rails and ribs are many thin islands; the screens, the chart and the plate carry fine detail
DENSITY = {
    'dome_panels': 0.55,
    'rail': 0.5,
    'dome_floor': 0.85,
    'ceiling_tiles': 0.7,
    'blinds': 0.6,
    'crt_0': 4.0,
    'crt_1': 4.0,
    'star_chart': 2.0,
    'enamel_plate': 3.0,
    'plate_ink': 3.0,
}


def unwrap(obj):
    """One UV atlas over the whole scene, its islands at an even density but for `DENSITY`."""
    me = obj.data
    # the UVs of the primitives stay for the bake, where the screens read theirs
    for layer in [layer for layer in me.uv_layers if layer.name != 'UVMap']:
        me.uv_layers.remove(layer)
    me.uv_layers.active = me.uv_layers.new(name='bake')
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
    # an island is scaled about the origin as a whole: the packer moves it anyway, and an island
    # never spans two materials, which meet at an edge sharper than the angle limit
    scale = [DENSITY.get(slot.material.name, 1.0) for slot in obj.material_slots]
    bm = bmesh.new()
    bm.from_mesh(me)
    uv = bm.loops.layers.uv['bake']
    for face in bm.faces:
        k = scale[face.material_index]
        if k != 1.0:
            for loop in face.loops:
                loop[uv].uv *= k
    bm.to_mesh(me)
    bm.free()
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.select_all(action='SELECT')
    bpy.ops.uv.pack_islands(rotate=True, scale=True, margin_method='FRACTION', margin=0.002, shape_method='CONCAVE')
    bpy.ops.object.mode_set(mode='OBJECT')


def bake_target(obj, name):
    """A float image of the size of the texture, the active image node of every material."""
    image = bpy.data.images.new(name, TEXTURE_SIZE, TEXTURE_SIZE, float_buffer=True, alpha=False)
    for slot in obj.material_slots:
        nt = slot.material.node_tree
        node = nt.nodes.get('bake_target') or nt.nodes.new('ShaderNodeTexImage')
        node.name = 'bake_target'
        node.image = image
        for n in nt.nodes:
            n.select = False
        node.select = True
        nt.nodes.active = node
    return image


def bake(scene, obj):
    """The light of the scene, direct and indirect, diffuse and emitted, and the albedo beside it
    for the denoiser. Glossy light is left out: it depends on the view and has no place in a
    texture."""
    bake_settings = scene.render.bake
    bake_settings.margin = 8
    bake_settings.margin_type = 'EXTEND'
    activate(obj)

    lit = bake_target(obj, 'lit')
    scene.cycles.samples = BAKE_SAMPLES
    bake_settings.use_pass_direct = True
    bake_settings.use_pass_indirect = True
    bake_settings.use_pass_diffuse = True
    bake_settings.use_pass_glossy = False
    bake_settings.use_pass_transmission = True
    bake_settings.use_pass_emit = True
    bpy.ops.object.bake(type='COMBINED')

    albedo = bake_target(obj, 'albedo')
    scene.cycles.samples = 16
    bake_settings.use_pass_direct = False
    bake_settings.use_pass_indirect = False
    bake_settings.use_pass_color = True
    bpy.ops.object.bake(type='DIFFUSE')
    return lit, albedo


def denoise(main, lit, albedo, path):
    """Runs the baked light through OpenImageDenoise, guided by the albedo, in a scene of its own
    whose compositor reads the two images and renders nothing else, and writes it tone-mapped by
    the view transform of the main scene (AgX) as an 8-bit PNG."""
    scene = bpy.data.scenes.new('denoise')
    scene.render.engine = 'BLENDER_WORKBENCH'
    scene.render.resolution_x = scene.render.resolution_y = TEXTURE_SIZE
    scene.render.resolution_percentage = 100
    scene.view_settings.view_transform = main.view_settings.view_transform
    scene.view_settings.look = main.view_settings.look
    scene.view_settings.exposure = main.view_settings.exposure
    cam = bpy.data.objects.new('denoise_camera', bpy.data.cameras.new('denoise_camera'))
    scene.collection.objects.link(cam)
    scene.camera = cam
    tree = bpy.data.node_groups.new('denoise', 'CompositorNodeTree')
    tree.interface.new_socket('Image', in_out='OUTPUT', socket_type='NodeSocketColor')
    scene.compositing_node_group = tree
    src = tree.nodes.new('CompositorNodeImage')
    src.image = lit
    alb = tree.nodes.new('CompositorNodeImage')
    alb.image = albedo
    dn = tree.nodes.new('CompositorNodeDenoise')
    dn.inputs['HDR'].default_value = True
    out = tree.nodes.new('NodeGroupOutput')
    tree.links.new(src.outputs['Image'], dn.inputs['Image'])
    tree.links.new(alb.outputs['Image'], dn.inputs['Albedo'])
    tree.links.new(dn.outputs['Image'], out.inputs[0])
    settings = scene.render.image_settings
    settings.file_format = 'PNG'
    settings.color_mode = 'RGB'
    settings.color_depth = '8'
    settings.compression = 100
    scene.render.filepath = path
    bpy.ops.render.render(write_still=True, scene=scene.name)
    # nothing of the denoise goes into the export: its scene, its camera, its node tree
    bpy.data.scenes.remove(scene)
    bpy.data.objects.remove(cam)
    bpy.data.cameras.remove(bpy.data.cameras['denoise_camera'])
    bpy.data.node_groups.remove(tree)
    return path


def unlit(obj, png):
    """One material for all of it: the baked texture straight into the output, which the glTF
    exporter writes as `KHR_materials_unlit`."""
    image = bpy.data.images.load(png)
    image.name = 'observatory'
    mat = bpy.data.materials.new('observatory')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    nt.links.new(tex.outputs['Color'], nt.nodes['Material Output'].inputs['Surface'])
    obj.data.materials.clear()
    obj.data.materials.append(mat)
    # the bake read the UVs of the primitives; the export carries the atlas alone
    uv_layers = obj.data.uv_layers
    if 'UVMap' in uv_layers:
        uv_layers.remove(uv_layers['UVMap'])


def export(path):
    bpy.ops.export_scene.gltf(
        filepath=path,
        export_format='GLB',
        export_texcoords=True,
        export_normals=False,
        export_tangents=False,
        export_materials='EXPORT',
        export_image_format='WEBP',
        export_image_quality=90,
        export_cameras=True,
        export_lights=False,
        export_extras=False,
        export_yup=True,
        export_apply=True,
        export_animations=True,
        export_animation_mode='ACTIONS',
        export_frame_range=True,
        export_force_sampling=True,
        export_optimize_animation_size=True,
        export_def_bones=False,
    )


def render_views(scene, cams):
    scene.render.resolution_x, scene.render.resolution_y = 960, 540
    scene.cycles.samples = 96
    scene.cycles.use_denoising = True
    scene.render.image_settings.file_format = 'PNG'
    a, b, f = cams
    shots = [('view-a', a, 0), ('view-b', b, 0)] + [(f'view-flight-{fr:03d}', f, fr) for fr in (0, 42, 84, 104, 128, 168)]
    for name, cam, frame in shots:
        scene.frame_set(frame)
        scene.camera = cam
        scene.render.filepath = os.path.join(OUT, f'{name}.png')
        bpy.ops.render.render(write_still=True)


def main():
    os.makedirs(OUT, exist_ok=True)
    scene = reset()
    mats = materials()
    build_control_room(mats)
    build_door(mats)
    build_dome(mats)
    build_moon()
    cams = build_cameras()
    if VIEWS:
        render_views(scene, cams)
        return
    obj = join_static()
    unwrap(obj)
    lit, albedo = bake(scene, obj)
    png = denoise(scene, lit, albedo, os.path.join(OUT, 'observatory.png'))
    unlit(obj, png)
    for o in list(scene.objects):
        if o.type == 'LIGHT':
            bpy.data.objects.remove(o)
    scene.frame_set(0)
    export(os.path.join(OUT, 'two-rooms.glb'))


main()
