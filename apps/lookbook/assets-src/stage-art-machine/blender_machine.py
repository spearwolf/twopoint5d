"""Runs inside Blender: builds "the listening machine" — a brass contraption on a foggy pier that
listens to the fog through two horns — and renders it part by part, each part alone through one
orthographic camera, so that the renders lie on one canvas as the layers of a painting:

    blender -b --factory-startup --python blender_machine.py -- <out-dir> [--draft] [--cpu] [--only=<part>,…]

`--draft` renders with an eighth of the samples, `--cpu` on the CPU even where Cycles finds a GPU,
`--only` the parts named (`fog`, `body`, `strip`, `flywheel`, `needle`, `glass`, `lever`, `lamp`,
`lamp-on`, `glow`, `steam`).

Writes into `<out-dir>`: `fog.png` (the pier, the water and the fog behind the machine, opaque),
`body.png` (the cabinet, the horns, the legs and its shadow on the deck), `strip.png` (the punched
paper strip), `flywheel.png`, `needle.png`, `glass.png` (the reflections of the glass of the dial),
`lever.png`, `lamp.png` and `lamp-on.png`, `glow.png` (the light of the lamp in the fog, on black:
the light alone), `steam-<n>.png` (a loop of `STEAM_FRAMES` frames of steam), each 1280 × 800 and
transparent around its part, and `layout.json` — the canvas and the pivots of the parts that turn,
in canvas pixels.

The canvas is laid out in pixels: one pixel is `S` metres on the plane of the camera, and the
helper `at(px, py, y)` answers the point of the world that the camera sees at the canvas pixel
`(px, py)` on the vertical plane at depth `y`. The camera looks at the machine from the front and a
little from above (`PITCH`), so the deck and the top of the cabinet show; the parts that turn turn
in vertical planes, which the pitch foreshortens by under 2 %.
"""

import json
import math
import os
import random
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS and not ARGS[0].startswith('--') else '/tmp/stage-art-machine'
DRAFT = '--draft' in ARGS
CPU = '--cpu' in ARGS
ONLY = next((a[len('--only=') :].split(',') for a in ARGS if a.startswith('--only=')), None)

WIDTH, HEIGHT = 1280, 800
S = 0.005  # metres per canvas pixel
PITCH = math.radians(10)
ZC = 1.52  # the height of the point of the world in the middle of the canvas, at depth 0
STEAM_FRAMES = 12

X = Vector((1, 0, 0))
U = Vector((0, math.sin(PITCH), math.cos(PITCH)))  # up on the canvas
D = Vector((0, math.cos(PITCH), -math.sin(PITCH)))  # the view direction
C0 = Vector((0, 0, ZC))

rng = random.Random(1907)


def at(px, py, y):
    """The point of the world at depth `y` that the camera sees at canvas pixel `(px, py)`."""
    up = (HEIGHT / 2 - py) * S
    t = (y - C0.y - up * U.y) / D.y
    return C0 + (px - WIDTH / 2) * S * X + up * U + t * D


def pixel(p):
    """The canvas pixel the camera sees the point `p` at."""
    v = Vector(p) - C0
    return (WIDTH / 2 + v.dot(X) / S, HEIGHT / 2 - v.dot(U) / S)


# --- scene ------------------------------------------------------------------------------------


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.render.resolution_x = WIDTH
    scene.render.resolution_y = HEIGHT
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.filter_size = 1.2
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = -0.4
    scene.cycles.seed = 7
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.max_bounces = 8
    scene.cycles.glossy_bounces = 4
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.volume_bounces = 1
    scene.cycles.sample_clamp_indirect = 6
    scene.cycles.film_transparent_glass = True
    try:
        if CPU:
            raise RuntimeError('--cpu asked for')
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
    except Exception as error:  # noqa: BLE001 - a missing GPU renders on the CPU
        print('no GPU for Cycles, rendering on the CPU:', error)

    cam = bpy.data.objects.new('camera', bpy.data.cameras.new('camera'))
    cam.data.type = 'ORTHO'
    cam.data.ortho_scale = WIDTH * S
    cam.data.clip_start = 0.1
    cam.data.clip_end = 200
    cam.rotation_euler = (math.pi / 2 - PITCH, 0, 0)
    cam.location = C0 - 60 * D
    scene.collection.objects.link(cam)
    scene.camera = cam
    return scene


def collection(name):
    col = bpy.data.collections.new(name)
    bpy.context.scene.collection.children.link(col)
    return col


CURRENT = {'col': None}


def link(obj):
    (CURRENT['col'] or bpy.context.scene.collection).objects.link(obj)
    return obj


def activate(obj):
    for o in bpy.context.view_layer.objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def into_current(obj):
    for col in list(obj.users_collection):
        col.objects.unlink(obj)
    link(obj)
    return obj


def finish(obj, material, bevel=0.0, segments=2, smooth=None):
    into_current(obj)
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
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = s
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, material, bevel, segments)


def span(name, x0, x1, y0, y1, z0, z1, material=None, bevel=0.0):
    return box(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), material, bevel)


def cylinder(name, c, r, depth, material=None, rot=(0, 0, 0), verts=48, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=c, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=c, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, bevel, smooth=35)


def facing(name, c, r, depth, material=None, verts=48, bevel=0.0, r2=None):
    """A cylinder whose axis points at the camera side, -y; its front face at `c.y - depth / 2`."""
    return cylinder(name, c, r, depth, material, rot=(math.pi / 2, 0, 0), verts=verts, bevel=bevel, r2=r2)


def rod(name, a, b, r, material=None, verts=16):
    a, b = Vector(a), Vector(b)
    v = b - a
    obj = cylinder(name, (a + b) / 2, r, v.length, material, verts=verts)
    obj.rotation_euler = v.to_track_quat('Z', 'Y').to_euler()
    return obj


def torus(name, c, major, minor, material=None, rot=(0, 0, 0), major_seg=72, minor_seg=14):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=major_seg, minor_segments=minor_seg, location=c, rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, smooth=60)


def sphere(name, c, r, material=None, scale=(1, 1, 1), segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=r, location=c)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, material, smooth=80)


def tube(name, points, r, material, resolution=16):
    """A round tube along a smooth curve through `points`."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = r
    curve.bevel_resolution = 6
    curve.use_fill_caps = True
    curve.resolution_u = resolution
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for bp, p in zip(spline.bezier_points, points):
        bp.co = p
        bp.handle_left_type = 'AUTO'
        bp.handle_right_type = 'AUTO'
    obj = link(bpy.data.objects.new(name, curve))
    obj.data.materials.append(material)
    return obj


def mesh_from_bmesh(name, bm, material=None, smooth=None):
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    if material:
        obj.data.materials.append(material)
    if smooth is not None:
        activate(obj)
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(smooth))
    return obj


def text(name, body, c, size, material, extrude=0.0015, align='CENTER'):
    """Text on a vertical plane facing the camera."""
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.align_x = align
    curve.align_y = 'CENTER'
    curve.extrude = extrude
    obj = link(bpy.data.objects.new(name, curve))
    obj.location = c
    obj.rotation_euler = (math.pi / 2, 0, 0)
    obj.data.materials.append(material)
    return obj


def rivets(name, points, r, material):
    bm = bmesh.new()
    for p in points:
        bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=6, radius=r, matrix=Matrix.Translation(p))
    return mesh_from_bmesh(name, bm, material, smooth=80)


def horn_bell(name, throat, direction, length, r0, r1, material, lip_material):
    """An exponential horn from `throat` along `direction`, `r0` at the throat to `r1` at the mouth,
    with a rolled lip; the solid of revolution of its profile."""
    bm = bmesh.new()
    steps, segments = 40, 64
    k = math.log(r1 / r0) / length
    rings = []
    for i in range(steps + 1):
        s = length * (i / steps) ** 0.8
        r = r0 * math.exp(k * s)
        ring = []
        for j in range(segments):
            a = 2 * math.pi * j / segments
            ring.append(bm.verts.new((s, r * math.cos(a), r * math.sin(a))))
        rings.append(ring)
    for i in range(steps):
        for j in range(segments):
            bm.faces.new((rings[i][j], rings[i][(j + 1) % segments], rings[i + 1][(j + 1) % segments], rings[i + 1][j]))
    obj = mesh_from_bmesh(name, bm, material, smooth=70)
    solid = obj.modifiers.new('solid', 'SOLIDIFY')
    solid.thickness = 0.012
    d = Vector(direction).normalized()
    obj.matrix_world = Matrix.Translation(throat) @ d.to_track_quat('X', 'Z').to_matrix().to_4x4()
    lip = torus(name + '_lip', (0, 0, 0), r1 + 0.004, 0.022, lip_material, minor_seg=12, major_seg=96)
    lip.matrix_world = Matrix.Translation(Vector(throat) + d * length) @ d.to_track_quat('Z', 'X').to_matrix().to_4x4()
    return obj


# --- materials --------------------------------------------------------------------------------


class Mat:
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

    def feed(self, sock, v):
        if isinstance(v, (int, float, tuple)):
            sock.default_value = v
        else:
            self.link(v, sock)

    def math(self, op, a, b=None, clamp=False):
        n = self.node('ShaderNodeMath', operation=op, use_clamp=clamp)
        for i, v in enumerate((a, b)):
            if v is not None:
                self.feed(n.inputs[i], v)
        return n.outputs[0]

    def mix(self, fac, a, b, blend='MIX'):
        n = self.node('ShaderNodeMix', data_type='RGBA', blend_type=blend)
        for sock, v in ((n.inputs[0], fac), (n.inputs[6], a), (n.inputs[7], b)):
            self.feed(sock, v)
        return n.outputs[2]

    def noise(self, scale, detail=4.0, rough=0.55, vec=None):
        n = self.node('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        if vec is not None:
            self.link(vec, n.inputs['Vector'])
        return n.outputs['Fac']

    def coords(self, kind='Object'):
        return self.node('ShaderNodeTexCoord').outputs[kind]

    def ao(self, distance=0.08):
        n = self.node('ShaderNodeAmbientOcclusion', samples=8)
        n.inputs['Distance'].default_value = distance
        return n.outputs['AO']

    def edges(self, radius=0.012):
        """Wear on the edges: where the bevelled normal leaves the normal of the face."""
        bevel = self.node('ShaderNodeBevel', samples=8)
        bevel.inputs['Radius'].default_value = radius
        g = self.node('ShaderNodeNewGeometry')
        dot = self.node('ShaderNodeVectorMath', operation='DOT_PRODUCT')
        self.link(bevel.outputs['Normal'], dot.inputs[0])
        self.link(g.outputs['Normal'], dot.inputs[1])
        return self.math('MULTIPLY', self.math('SUBTRACT', 1.0, dot.outputs['Value']), 12.0, clamp=True)

    def bump(self, height, strength=0.2, distance=0.01):
        n = self.node('ShaderNodeBump')
        n.inputs['Strength'].default_value = strength
        n.inputs['Distance'].default_value = distance
        self.link(height, n.inputs['Height'])
        self.link(n.outputs['Normal'], self.bsdf.inputs['Normal'])


def mat_brass(name='brass', base=(0.70, 0.44, 0.15), rough=0.3):
    m = Mat(name)
    grime = m.noise(18, 6, 0.6)
    occluded = m.math('SUBTRACT', 1.0, m.ao(0.06))
    tarnish = m.math('ADD', m.math('MULTIPLY', m.math('SUBTRACT', grime, 0.3), 0.8), m.math('MULTIPLY', occluded, 1.4), clamp=True)
    color = m.mix(tarnish, base + (1,), (0.20, 0.12, 0.05, 1))
    color = m.mix(m.math('MULTIPLY', occluded, 0.8, clamp=True), color, (0.08, 0.12, 0.08, 1))  # verdigris
    m.link(color, m.bsdf.inputs['Base Color'])
    m.link(m.math('ADD', rough, m.math('MULTIPLY', tarnish, 0.35)), m.bsdf.inputs['Roughness'])
    m.set(Metallic=1.0)
    m.bump(m.noise(60, 3, 0.5), 0.05)
    return m.m


def mat_enamel(name, base, rough=0.42):
    """Paint over iron, worn through to dark metal on the edges."""
    m = Mat(name)
    wear = m.math('MULTIPLY', m.edges(), m.math('ADD', m.noise(30, 4, 0.6), 0.2))
    wear = m.math('GREATER_THAN', wear, 0.45)
    grime = m.math('SUBTRACT', 1.0, m.ao(0.12))
    paint = m.mix(m.math('MULTIPLY', grime, 0.9, clamp=True), base + (1,), (0.012, 0.016, 0.016, 1))
    paint = m.mix(m.math('MULTIPLY', m.noise(4, 5, 0.6), 0.25), paint, tuple(c * 0.75 for c in base) + (1,))
    m.link(m.mix(wear, paint, (0.30, 0.28, 0.25, 1)), m.bsdf.inputs['Base Color'])
    m.link(wear, m.bsdf.inputs['Metallic'])
    m.link(m.math('ADD', rough, m.math('MULTIPLY', m.noise(12, 3), 0.2)), m.bsdf.inputs['Roughness'])
    m.bump(m.noise(80, 2, 0.5), 0.03)
    return m.m


def mat_plain(name, base, rough=0.5, metallic=0.0, emission=None, strength=0.0):
    m = Mat(name)
    m.set(Base_Color=base + (1,), Roughness=rough, Metallic=metallic)
    if emission is not None:
        m.set(Emission_Color=emission + (1,), Emission_Strength=strength)
    return m.m


def mat_iron(name='iron'):
    m = Mat(name)
    rust = m.math('MULTIPLY', m.math('SUBTRACT', 1.0, m.ao(0.1)), m.noise(9, 6, 0.65))
    m.link(m.mix(m.math('MULTIPLY', rust, 2.0, clamp=True), (0.035, 0.035, 0.038, 1), (0.16, 0.07, 0.03, 1)), m.bsdf.inputs['Base Color'])
    m.set(Metallic=0.45, Roughness=0.62)
    m.bump(m.noise(50, 4), 0.08)
    return m.m


def mat_glass_bulb(name, strength):
    """The glass of the lamp: dark smoked amber when cold, glowing from its core when lit."""
    m = Mat(name)
    m.set(Base_Color=(0.10, 0.05, 0.02, 1), Roughness=0.06, Coat_Weight=1.0, Coat_Roughness=0.02)
    if strength:
        z = m.node('ShaderNodeSeparateXYZ')
        m.link(m.coords('Object'), z.inputs[0])
        core = m.math('SUBTRACT', 1.0, m.math('MULTIPLY', m.math('ABSOLUTE', z.outputs['Z']), 4.0), clamp=True)
        m.link(m.mix(core, (1.0, 0.36, 0.08, 1), (1.0, 0.68, 0.3, 1)), m.bsdf.inputs['Emission Color'])
        m.link(m.math('ADD', strength * 0.4, m.math('MULTIPLY', core, strength)), m.bsdf.inputs['Emission Strength'])
    return m.m


def mat_paper(image):
    m = Mat('paper')
    tex = m.node('ShaderNodeTexImage', image=image, interpolation='Linear')
    m.link(m.coords('UV'), tex.inputs['Vector'])
    grime = m.math('MULTIPLY', m.noise(7, 5, 0.6), 0.3)
    m.link(m.mix(grime, (0.34, 0.3, 0.22, 1), (0.2, 0.16, 0.1, 1)), m.bsdf.inputs['Base Color'])
    m.link(tex.outputs['Alpha'], m.bsdf.inputs['Alpha'])
    m.set(Roughness=0.8)
    m.bsdf.inputs['Subsurface Weight'].default_value = 0.0
    return m.m


def mat_dial_face():
    m = Mat('dial_face')
    g = m.math('SUBTRACT', 1.0, m.ao(0.05))
    m.link(m.mix(m.math('ADD', m.math('MULTIPLY', g, 1.2), m.math('MULTIPLY', m.noise(14, 5, 0.6), 0.3), clamp=True), (0.86, 0.80, 0.64, 1), (0.42, 0.36, 0.25, 1)), m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.55)
    return m.m


def mat_wood(name='deck'):
    m = Mat(name)
    vec = m.node('ShaderNodeMapping')
    vec.inputs['Scale'].default_value = (0.25, 4.0, 4.0)
    m.link(m.coords('Object'), vec.inputs['Vector'])
    grain = m.noise(6, 8, 0.7, vec.outputs[0])
    m.link(m.mix(grain, (0.07, 0.055, 0.045, 1), (0.16, 0.12, 0.085, 1)), m.bsdf.inputs['Base Color'])
    m.link(m.math('ADD', 0.22, m.math('MULTIPLY', m.noise(3, 3), 0.3)), m.bsdf.inputs['Roughness'])  # wet
    m.bump(grain, 0.25)
    return m.m


def mat_water():
    m = Mat('water')
    m.set(Base_Color=(0.01, 0.015, 0.02, 1), Roughness=0.06, IOR=1.33)
    w = m.node('ShaderNodeTexWave', wave_type='BANDS', bands_direction='X')
    w.inputs['Scale'].default_value = 0.8
    w.inputs['Distortion'].default_value = 9.0
    w.inputs['Detail'].default_value = 4.0
    m.link(m.coords('Object'), w.inputs['Vector'])
    m.bump(w.outputs['Fac'], 0.12, 0.05)
    return m.m


# --- the machine ------------------------------------------------------------------------------

# the canvas places of the parts, in pixels; the depth (world y) of each is given where it is built
DIAL = (580, 420)
FLYWHEEL = (985, 430)
LEVER = (790, 470)
LAMP_PX = (835, 178)

CAB = dict(x0=-1.30, x1=1.10, y0=-0.45, y1=0.45, z0=0.80, z1=2.10)
PIVOTS = {}


def build_body(m):
    """The cabinet on its legs, the horns, the pipes, the bearing of the flywheel, the quadrant of the
    lever, the bezel and the face of the dial: everything that does not move."""
    c = CAB
    cab = span('cabinet', c['x0'], c['x1'], c['y0'], c['y1'], c['z0'], c['z1'], m['enamel'], bevel=0.02)
    # a frame of brass round the front and a moulded top
    fy = c['y0'] - 0.012
    for name, z in (('trim_top', c['z1'] - 0.05), ('trim_bottom', c['z0'] + 0.05), ('trim_mid', 1.18)):
        span(name, c['x0'] - 0.01, c['x1'] + 0.01, fy - 0.012, fy + 0.02, z - 0.035, z + 0.035, m['brass'], bevel=0.008)
    for name, x in (('trim_left', c['x0'] + 0.04), ('trim_right', c['x1'] - 0.04)):
        span(name, x - 0.035, x + 0.035, fy - 0.012, fy + 0.02, c['z0'], c['z1'], m['brass'], bevel=0.008)
    for name, z0, z1 in (('panel_upper', 1.24, c['z1'] - 0.11), ('panel_lower', c['z0'] + 0.11, 1.12)):
        span(name, c['x0'] + 0.1, c['x1'] - 0.1, c['y0'] - 0.014, c['y0'] + 0.01, z0, z1, m['enamel'], bevel=0.018)
    span('lid', c['x0'] - 0.06, c['x1'] + 0.06, c['y0'] - 0.06, c['y1'] + 0.06, c['z1'], c['z1'] + 0.07, m['iron'], bevel=0.025)
    span('lid_brass', c['x0'] - 0.03, c['x1'] + 0.03, c['y0'] - 0.03, c['y1'] + 0.03, c['z1'] + 0.07, c['z1'] + 0.1, m['brass'], bevel=0.012)
    span('plinth', c['x0'] - 0.05, c['x1'] + 0.05, c['y0'] - 0.05, c['y1'] + 0.05, c['z0'] - 0.07, c['z0'], m['iron'], bevel=0.02)
    pts = []
    for z in (c['z1'] - 0.05, c['z0'] + 0.05, 1.18):
        n = 22
        for i in range(n):
            x = c['x0'] + 0.1 + (c['x1'] - c['x0'] - 0.2) * i / (n - 1)
            pts.append(Vector((x, fy - 0.014, z)))
    for x in (c['x0'] + 0.04, c['x1'] - 0.04):
        for i in range(12):
            pts.append(Vector((x, fy - 0.014, c['z0'] + 0.12 + (c['z1'] - c['z0'] - 0.24) * i / 11)))
    rivets('rivets', pts, 0.011, m['brass'])

    # louvres in the lower panel
    for i in range(7):
        z = 0.94 + i * 0.034
        box(f'louvre_{i}', (-0.62, fy - 0.012, z), (0.9, 0.025, 0.012), m['iron'], rot=(math.radians(-35), 0, 0), bevel=0.003)
    span('louvre_frame', -1.1, -0.14, fy - 0.004, fy + 0.01, 0.9, 1.17, m['brass'], bevel=0.006)

    # legs: cast iron, splayed, with brass shoes
    for sx in (c['x0'] + 0.12, c['x1'] - 0.12):
        for sy in (c['y0'] + 0.1, c['y1'] - 0.1):
            out = Vector((math.copysign(0.14, sx + 0.1), math.copysign(0.1, sy), 0))
            top = Vector((sx, sy, c['z0'] - 0.07))
            foot = top + out + Vector((0, 0, -(c['z0'] - 0.07) + 0.06))
            rod(f'leg_{sx:.1f}_{sy:.1f}', top, foot, 0.045, m['iron'])
            cylinder(f'shoe_{sx:.1f}_{sy:.1f}', foot + Vector((0, 0, -0.03)), 0.075, 0.06, m['brass'], bevel=0.01)

    # the dial: a brass drum on the front with a cream face; the needle and the glass are their own parts
    ny = c['y0'] - 0.13  # the plane of the needle
    centre = at(*DIAL, ny)
    face_y = ny + 0.018
    r = 90 * S
    facing('dial_drum', (centre.x, (face_y + c['y0']) / 2, centre.z), r + 0.035, c['y0'] - face_y, m['brass'], verts=96, bevel=0.01)
    torus('dial_bezel', (centre.x, face_y - 0.012, centre.z), r + 0.02, 0.026, m['brass'], rot=(math.pi / 2, 0, 0), major_seg=128)
    facing('dial_face', (centre.x, face_y + 0.001, centre.z), r, 0.004, m['face'], verts=128)
    tick_bm = bmesh.new()
    for i in range(41):
        a = math.radians(-120 + 240 * i / 40)
        major = i % 5 == 0
        length = 0.06 if major else 0.032
        w = 0.008 if major else 0.004
        mid = r - 0.025 - length / 2
        mat = Matrix.Translation((centre.x + math.sin(a) * mid, face_y - 0.002, centre.z + math.cos(a) * mid)) @ Matrix.Rotation(-a, 4, 'Y')
        bmesh.ops.create_cube(tick_bm, size=1, matrix=mat @ Matrix.Diagonal((w, 0.002, length, 1)))
    mesh_from_bmesh('dial_ticks', tick_bm, m['ink'])
    # the red band of the far end of the scale
    red = bmesh.new()
    verts = []
    for i in range(25):
        a = math.radians(60 + 60 * i / 24)
        for rr in (r - 0.022, r - 0.04):
            verts.append(red.verts.new((centre.x + math.sin(a) * rr, face_y - 0.0025, centre.z + math.cos(a) * rr)))
    for i in range(24):
        red.faces.new((verts[2 * i], verts[2 * i + 1], verts[2 * i + 3], verts[2 * i + 2]))
    mesh_from_bmesh('dial_red', red, m['red'])
    for i, label in enumerate(('0', '2', '4', '6', '8', '10', '12', '14', '16')):
        a = math.radians(-120 + 240 * i / 8)
        rr = r - 0.125
        text(f'dial_num_{i}', label, (centre.x + math.sin(a) * rr, face_y - 0.003, centre.z + math.cos(a) * rr), 0.05, m['ink'])
    text('dial_label', 'ECHO', (centre.x, face_y - 0.003, centre.z - 0.2), 0.055, m['ink'])
    text('dial_unit', 'fathoms of fog', (centre.x, face_y - 0.003, centre.z - 0.26), 0.03, m['ink'])

    # a small gauge and a name plate
    g = at(445, 345, c['y0'] - 0.06)
    facing('gauge_drum', (g.x, c['y0'] - 0.03, g.z), 0.16, 0.06, m['brass'], bevel=0.008)
    facing('gauge_face', (g.x, c['y0'] - 0.061, g.z), 0.13, 0.004, m['face'])
    rod('gauge_needle', (g.x, c['y0'] - 0.066, g.z), (g.x + 0.08, c['y0'] - 0.066, g.z + 0.07), 0.005, m['ink'])
    text('gauge_label', 'HUMIDITY', (g.x, c['y0'] - 0.065, g.z - 0.06), 0.022, m['ink'])
    p = at(640, 535, c['y0'] - 0.02)
    span('plate', p.x - 0.42, p.x + 0.42, c['y0'] - 0.025, c['y0'] - 0.005, p.z - 0.05, p.z + 0.05, m['brass'], bevel=0.006)
    text('plate_text', 'FOG LISTENING APPARATUS  ·  No. 7', (p.x, c['y0'] - 0.027, p.z), 0.045, m['ink_engraved'])

    # three knobs under the gauge
    for i in range(3):
        k = at(395 + i * 40, 420, c['y0'] - 0.04)
        facing(f'knob_{i}', (k.x, c['y0'] - 0.03, k.z), 0.035, 0.06, m['bakelite'], bevel=0.008)

    # the quadrant of the lever: a notched brass sector behind its pivot
    lp = at(*LEVER, c['y0'] - 0.25)
    sector = bmesh.new()
    outer, inner = [], []
    for i in range(33):
        a = math.radians(-35 + 115 * i / 32)
        notch = 0.014 if i % 4 == 0 else 0.0
        outer.append(sector.verts.new((lp.x + math.sin(a) * (0.29 - notch), c['y0'] - 0.03, lp.z + math.cos(a) * (0.29 - notch))))
        inner.append(sector.verts.new((lp.x + math.sin(a) * 0.21, c['y0'] - 0.03, lp.z + math.cos(a) * 0.21)))
    for i in range(32):
        sector.faces.new((inner[i], inner[i + 1], outer[i + 1], outer[i]))
    q = mesh_from_bmesh('quadrant', sector, m['brass'])
    q.modifiers.new('solid', 'SOLIDIFY').thickness = 0.02
    facing('lever_boss', (lp.x, c['y0'] - 0.07, lp.z), 0.075, 0.08, m['iron'], bevel=0.012)

    # the bearing of the flywheel: a cast pedestal beside the cabinet, a shaft into its side
    fc = at(*FLYWHEEL, c['y0'] - 0.17)
    rod('shaft', (c['x1'], fc.y + 0.05, fc.z), (fc.x, fc.y + 0.05, fc.z), 0.045, m['steel'])
    span('pedestal', fc.x - 0.12, fc.x + 0.12, fc.y + 0.12, fc.y + 0.32, 0.0, fc.z - 0.05, m['iron'], bevel=0.02)
    facing('bearing', (fc.x, fc.y + 0.2, fc.z), 0.11, 0.22, m['brass'], bevel=0.015)
    span('pedestal_foot', fc.x - 0.24, fc.x + 0.24, fc.y + 0.06, fc.y + 0.38, 0.0, 0.07, m['iron'], bevel=0.02)

    # the chimney the steam leaves by, and the arm of the lamp
    ch = Vector((0.30, 0.12, c['z1'] + 0.1))
    cylinder('chimney', ch + Vector((0, 0, 0.17)), 0.06, 0.34, m['brass'], bevel=0.008)
    cylinder('chimney_cap', ch + Vector((0, 0, 0.36)), 0.085, 0.05, m['brass'], bevel=0.01)
    cylinder('chimney_valve', ch + Vector((0.09, 0, 0.12)), 0.04, 0.12, m['iron'], rot=(0, math.pi / 2, 0))
    lamp = at(*LAMP_PX, 0.0)
    rod('lamp_arm', (lamp.x, 0.0, c['z1'] + 0.1), (lamp.x, 0.0, lamp.z - 0.17), 0.022, m['brass'])
    cylinder('lamp_foot', (lamp.x, 0.0, c['z1'] + 0.13), 0.07, 0.06, m['brass'], bevel=0.01)

    # the horns: a big one at the top, a small one at the side, both turned to the fog on the left
    d = Vector((-math.cos(math.radians(32)), -math.sin(math.radians(32)), 0.0))
    big_throat = Vector((-1.45, 0.38, 2.78))
    tube('horn_pipe', [Vector((-0.75, 0.05, c['z1'] + 0.05)), Vector((-0.8, 0.12, 2.55)), Vector((-1.1, 0.3, 2.76)), big_throat + d * 0.02], 0.085, m['brass'])
    horn_bell('horn_big', big_throat, d, 0.92, 0.09, 0.56, m['brass_horn'], m['brass'])
    torus('horn_big_collar', (0, 0, 0), 0.1, 0.02, m['brass']).matrix_world = Matrix.Translation(big_throat) @ d.to_track_quat('Z', 'X').to_matrix().to_4x4()
    small_throat = Vector((-1.52, -0.02, 1.62))
    tube('horn_small_pipe', [Vector((c['x0'] + 0.02, 0.02, 1.58)), Vector((-1.42, 0.0, 1.61)), small_throat + d * 0.02], 0.06, m['brass'])
    horn_bell('horn_small', small_throat, d, 0.55, 0.065, 0.31, m['brass_horn'], m['brass'])
    # a stay between the horns and a cable down into the cabinet
    rod('horn_stay', (-1.62, 0.2, 1.68), (-1.66, 0.4, 2.62), 0.016, m['iron'])
    tube('cable', [Vector((-1.25, 0.32, 2.7)), Vector((-1.18, 0.0, 2.35)), Vector((-0.95, -0.2, c['z1'] + 0.08)), Vector((-0.6, -0.36, c['z1'] + 0.09))], 0.016, m['rubber'])
    return cab


def build_flywheel(m):
    """A spoked flywheel facing the camera, centred on its pivot."""
    y = CAB['y0'] - 0.17
    centre = at(*FLYWHEEL, y)
    PIVOTS['flywheel'] = centre
    R = 150 * S
    band = facing('fly_rim_band', centre, R - 0.012, 0.13, m['iron'], verts=180, bevel=0.012)
    inner = facing('fly_rim_inner', centre, R - 0.125, 0.2, None, verts=180)
    # hollow the band: a difference with the inner disc leaves a heavy ring
    mod = band.modifiers.new('ring', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.object = inner
    band.modifiers.move(1, 0)
    inner.hide_render = True
    torus('fly_rim_brass', (centre.x, centre.y - 0.066, centre.z), R - 0.04, 0.016, m['brass'], rot=(math.pi / 2, 0, 0), major_seg=180)
    torus('fly_rim_brass_inner', (centre.x, centre.y - 0.066, centre.z), R - 0.11, 0.01, m['brass'], rot=(math.pi / 2, 0, 0), major_seg=180)
    for i in range(6):
        a = 2 * math.pi * i / 6 + math.radians(15)
        d = Vector((math.sin(a), 0, math.cos(a)))
        spoke = cylinder(f'fly_spoke_{i}', centre + d * (R / 2), 0.05, R - 0.06, m['iron'], verts=20, r2=0.03)
        spoke.rotation_euler = d.to_track_quat('Z', 'Y').to_euler()
        spoke.scale = (1.0, 0.55, 1.0)
    facing('fly_hub', centre, 0.15, 0.17, m['brass'], bevel=0.025)
    facing('fly_hub_ring', (centre.x, centre.y - 0.07, centre.z), 0.1, 0.06, m['iron'], bevel=0.012)
    facing('fly_cap', (centre.x, centre.y - 0.1, centre.z), 0.05, 0.04, m['steel'], bevel=0.01)
    bolts = []
    for i in range(6):
        a = 2 * math.pi * i / 6
        bolts.append(centre + Vector((math.sin(a) * 0.125, -0.09, math.cos(a) * 0.125)))
    rivets('fly_bolts', bolts, 0.016, m['steel'])
    # a painted mark on the rim, so the turn reads at any speed
    a = math.radians(15 + 30)
    span('fly_mark', -0.05, 0.05, -0.006, 0.006, -0.045, 0.045, m['red'])
    mark = bpy.data.objects['fly_mark']
    mark.location = centre + Vector((math.sin(a) * (R - 0.075), -0.07, math.cos(a) * (R - 0.075)))
    mark.rotation_euler = (0, -a, 0)


def build_lever(m):
    y = CAB['y0'] - 0.25
    p = at(*LEVER, y)
    PIVOTS['lever'] = p
    a = math.radians(-18)
    tip = p + Vector((math.sin(a), 0, math.cos(a))) * 0.82
    rod('lever_bar', p, tip, 0.024, m['steel'])
    facing('lever_hub', p, 0.05, 0.06, m['brass'], bevel=0.01)
    rod('lever_grip', p + Vector((math.sin(a), 0, math.cos(a))) * 0.62, tip + Vector((math.sin(a), 0, math.cos(a))) * 0.02, 0.04, m['bakelite'])
    sphere('lever_knob', tip + Vector((math.sin(a), 0, math.cos(a))) * 0.05, 0.065, m['bakelite'])


def build_needle(m):
    y = CAB['y0'] - 0.13
    p = at(*DIAL, y)
    PIVOTS['needle'] = p
    bm = bmesh.new()
    pts = [(-0.004, -0.06), (0.004, -0.06), (0.0065, 0.0), (0.002, 0.36), (-0.002, 0.36), (-0.0065, 0.0)]
    verts = [bm.verts.new((p.x + x, y, p.z + z)) for x, z in pts]
    bm.faces.new(verts)
    needle = mesh_from_bmesh('needle_blade', bm, m['blued'])
    needle.modifiers.new('solid', 'SOLIDIFY').thickness = 0.004
    tip = bmesh.new()
    tv = [tip.verts.new((p.x + x, y - 0.002, p.z + z)) for x, z in ((-0.0035, 0.26), (0.0035, 0.26), (0.002, 0.36), (-0.002, 0.36))]
    tip.faces.new(tv)
    mesh_from_bmesh('needle_tip', tip, m['red'])
    facing('needle_weight', (p.x, y, p.z - 0.055), 0.022, 0.008, m['blued'])
    facing('needle_cap', (p.x, y - 0.008, p.z), 0.024, 0.014, m['brass'], bevel=0.005)


def build_glass(m):
    y = CAB['y0'] - 0.13
    p = at(*DIAL, y)
    r = 90 * S + 0.012
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=96, v_segments=24, radius=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * r, min(v.co.y, 0.0) * 0.22 - 0.02, v.co.z * r))
    obj = mesh_from_bmesh('glass', bm, m['glass'], smooth=80)
    obj.location = (p.x, y + 0.02, p.z)


def build_strip(m):
    """A punched paper strip hanging out from under the cabinet, curling forward at its end."""
    rows, cols = 96, 8
    img = bpy.data.images.new('holes', 64, 512, alpha=True)
    px = [1.0] * (64 * 512 * 4)
    for row in range(rows):
        for col in range(cols):
            if rng.random() < 0.45 and not (col == 3):
                cx, cy = 6 + col * 7.3 + (1.5 if col > 3 else 0), 2.6 + row * 5.3
                for yy in range(int(cy - 3), int(cy + 3)):
                    for xx in range(int(cx - 3), int(cx + 3)):
                        if 0 <= xx < 64 and 0 <= yy < 512 and (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 < 4.4:
                            px[(yy * 64 + xx) * 4 + 3] = 0.0
        cx, cy = 6 + 3 * 7.3 + 0.75, 2.6 + row * 5.3  # the small feed holes
        for yy in range(int(cy - 2), int(cy + 2)):
            for xx in range(int(cx - 2), int(cx + 2)):
                if 0 <= xx < 64 and 0 <= yy < 512 and (xx + 0.5 - cx) ** 2 + (yy + 0.5 - cy) ** 2 < 1.6:
                    px[(yy * 64 + xx) * 4 + 3] = 0.0
    img.pixels = px
    img.pack()
    paper = mat_paper(img)
    width, top, bottom = 0.26, 1.02, 0.1
    x = (715 - WIDTH / 2) * S
    y0 = -0.24
    bm = bmesh.new()
    uv = bm.loops.layers.uv.new()
    n = 48
    rows_v = []
    for i in range(n + 1):
        t = i / n
        z = top + (bottom - top) * t
        curl = max(0.0, (t - 0.72) / 0.28)
        y = y0 - 0.22 * curl * curl
        z += 0.06 * curl * curl
        rows_v.append((bm.verts.new((x - width / 2, y, z)), bm.verts.new((x + width / 2, y, z)), t))
    for (a0, b0, t0), (a1, b1, t1) in zip(rows_v, rows_v[1:]):
        f = bm.faces.new((a0, b0, b1, a1))
        for loop, (u, v) in zip(f.loops, ((0, 1 - t0), (1, 1 - t0), (1, 1 - t1), (0, 1 - t1))):
            loop[uv].uv = (u, v)
    obj = mesh_from_bmesh('strip', bm, paper, smooth=60)
    obj.modifiers.new('solid', 'SOLIDIFY').thickness = 0.002


def build_lamp(m, lit):
    p = at(*LAMP_PX, 0.0)
    PIVOTS['lamp'] = p
    sphere('lamp_glass_on' if lit else 'lamp_glass', p, 0.13, m['bulb_on' if lit else 'bulb_off'], scale=(1, 1, 1.15))
    cylinder('lamp_cap', p + Vector((0, 0, 0.17)), 0.1, 0.07, m['brass'], bevel=0.015)
    cylinder('lamp_collar', p + Vector((0, 0, -0.165)), 0.085, 0.05, m['brass'], bevel=0.01)
    sphere('lamp_finial', p + Vector((0, 0, 0.225)), 0.03, m['brass'])
    for i in range(6):
        a = 2 * math.pi * i / 6 + 0.3
        pts = []
        for j in range(9):
            t = j / 8
            z = -0.16 + 0.32 * t
            r = 0.145 + 0.02 * math.sin(math.pi * t)
            pts.append(p + Vector((math.cos(a) * r, math.sin(a) * r, z)))
        tube(f'lamp_wire_{i}', pts, 0.008, m['brass'], resolution=6)
    torus('lamp_ring', p, 0.158, 0.009, m['brass'])


def build_glow_lights(lit_strength):
    """The light inside the lit lamp, for the render of its glow in the fog."""
    p = at(*LAMP_PX, 0.0)
    light = bpy.data.lights.new('lamp_light', 'POINT')
    light.energy = lit_strength
    light.color = (1.0, 0.62, 0.28)
    light.shadow_soft_size = 0.05
    obj = link(bpy.data.objects.new('lamp_light', light))
    obj.location = p
    return obj


def build_steam_domain(m):
    ch = Vector((0.30, 0.12, CAB['z1'] + 0.1 + 0.39))
    dom = box('steam', ch + Vector((0, 0, 0.5)), (1.4, 0.7, 1.0), None)
    dom.data.materials.append(m)
    return dom


def mat_steam():
    """A rising plume as a loop: two drifting noises crossfaded, so frame STEAM_FRAMES is frame 0."""
    m = bpy.data.materials.new('steam')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    out = nt.nodes['Material Output']
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.82, 0.86, 0.9, 1)
    vol.inputs['Anisotropy'].default_value = 0.35
    nt.links.new(vol.outputs[0], out.inputs['Volume'])
    W = Mat.__new__(Mat)
    W.m, W.nt = m, nt
    co = W.node('ShaderNodeMapping', vector_type='POINT')  # -1 … 1 across the domain
    co.inputs['Location'].default_value = (-1, -1, -1)
    co.inputs['Scale'].default_value = (2, 2, 2)
    W.link(W.coords('Generated'), co.inputs['Vector'])
    co = co.outputs[0]
    sep = W.node('ShaderNodeSeparateXYZ')
    W.link(co, sep.inputs[0])
    x, y, z = sep.outputs['X'], sep.outputs['Y'], sep.outputs['Z']
    h = W.math('MULTIPLY', W.math('ADD', z, 1.0), 0.5)  # 0 at the chimney, 1 at the top
    # the axis of the plume leans left as it rises; its radius grows
    axis_x = W.math('MULTIPLY', W.math('POWER', h, 1.5), -0.5)
    dx = W.math('SUBTRACT', x, axis_x)
    dist = W.math('SQRT', W.math('ADD', W.math('MULTIPLY', dx, dx), W.math('MULTIPLY', y, y)))
    radius = W.math('ADD', 0.16, W.math('MULTIPLY', h, 0.95))
    body = W.math('SUBTRACT', 1.0, W.math('DIVIDE', dist, radius), clamp=True)
    fade = W.math('MULTIPLY', W.math('POWER', W.math('SUBTRACT', 1.0, h, clamp=True), 0.7), W.math('MINIMUM', W.math('MULTIPLY', h, 12.0), 1.0))
    env = W.math('MULTIPLY', body, fade)
    drift = []
    for name in ('steam_a', 'steam_b'):
        mp = W.node('ShaderNodeMapping', name=name)
        W.link(co, mp.inputs['Vector'])
        n = W.node('ShaderNodeTexNoise')
        n.noise_dimensions = '3D'
        n.inputs['Scale'].default_value = 2.8
        n.inputs['Detail'].default_value = 4.0
        n.inputs['Roughness'].default_value = 0.55
        n.inputs['Distortion'].default_value = 0.9
        W.link(mp.outputs[0], n.inputs['Vector'])
        drift.append(n.outputs['Fac'])
    phase = W.node('ShaderNodeValue', name='steam_phase')
    mixed = W.math('ADD', W.math('MULTIPLY', drift[0], W.math('SUBTRACT', 1.0, phase.outputs[0])), W.math('MULTIPLY', drift[1], phase.outputs[0]))
    # a crossfade of two noises is flatter in its middle: the contrast is put back by the phase
    flat = W.math('MULTIPLY', W.math('ABSOLUTE', W.math('SUBTRACT', W.math('MULTIPLY', phase.outputs[0], 2.0), 1.0)), -0.3)
    contrast = W.math('ADD', 2.6, W.math('MULTIPLY', flat, -1.5))
    puffs = W.math('MULTIPLY', W.math('SUBTRACT', mixed, 0.38), contrast)
    density = W.math('MULTIPLY', W.math('MAXIMUM', W.math('ADD', puffs, W.math('MULTIPLY', env, 0.18)), 0.0), env)
    W.link(W.math('MULTIPLY', density, 70.0), vol.inputs['Density'])
    return m


def set_steam_frame(mat, frame):
    nt = mat.node_tree
    phase = frame / STEAM_FRAMES
    rise = 0.9  # how far the puffs rise in a loop, in units of the domain
    nt.nodes['steam_phase'].outputs[0].default_value = phase
    nt.nodes['steam_a'].inputs['Location'].default_value = (0.08 * phase, 0, -rise * phase)
    nt.nodes['steam_b'].inputs['Location'].default_value = (0.08 * (phase - 1), 0, -rise * (phase - 1))


# --- the pier and the fog ---------------------------------------------------------------------


def build_fog(m):
    deck = []
    for i in range(int((6.0 + 3.0) / 0.26)):
        y0 = -3.0 + i * 0.26
        h = 0.012 * rng.random()
        deck.append(span(f'plank_{i}', -4.5, 4.5, y0 + 0.006, y0 + 0.254, -0.08 - h, 0.0 - h, m['deck'], bevel=0.01))
    span('pier_beam', -4.5, 4.5, 6.0, 6.25, -0.5, 0.0, m['deck'], bevel=0.02)
    for x in (-3.6, -1.2, 1.2, 3.6):
        cylinder(f'pile_{x}', (x, 6.15, -1.2), 0.14, 2.4, m['deck'])
    for x in (-2.7, 2.0):
        cylinder(f'bollard_{x}', (x, 5.75, 0.22), 0.13, 0.44, m['iron'], bevel=0.02)
        sphere(f'bollard_top_{x}', (x, 5.75, 0.46), 0.17, m['iron'], scale=(1, 1, 0.45))
    tube('rope', [Vector((2.0, 5.75, 0.35)), Vector((2.4, 5.2, 0.02)), Vector((3.2, 4.6, 0.02)), Vector((3.0, 4.0, 0.02)), Vector((2.6, 4.3, 0.03))], 0.025, m['rope'])
    span('water', -30, 30, 6.0, 80, -0.85, -0.8, m['water'])
    # lamps beyond the machine: one at the end of the pier, one on a channel marker out on the water
    for name, base, height in (('pier_lamp', Vector((2.75, 5.6, 0.0)), 1.75), ('marker', Vector((-2.9, 10.0, -0.8)), 2.0)):
        rod(f'{name}_post', base, base + Vector((0, 0, height)), 0.04, m['iron'])
        globe = sphere(f'{name}_globe', base + Vector((0, 0, height + 0.12)), 0.11, m['fog_lamp_glass'] if name == 'pier_lamp' else m['marker_glass'])
        globe.visible_shadow = False  # the light inside shines through its globe
        light = bpy.data.lights.new(f'{name}_light', 'POINT')
        light.energy = 260 if name == 'pier_lamp' else 240
        light.color = (0.55, 0.85, 0.9) if name == 'pier_lamp' else (0.95, 0.35, 0.25)
        light.shadow_soft_size = 0.1
        link(bpy.data.objects.new(f'{name}_light', light)).location = base + Vector((0, 0, height + 0.12))
    # the fog: a box of thin scattering medium over everything, denser far off
    fog = span('fog_volume', -12, 12, -6, 60, -1.2, 9, None)
    fm = bpy.data.materials.new('fog')
    fm.use_nodes = True
    nt = fm.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.62, 0.74, 0.8, 1)
    vol.inputs['Anisotropy'].default_value = 0.55
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = 0.35
    noise.inputs['Detail'].default_value = 3
    tc = nt.nodes.new('ShaderNodeTexCoord')
    nt.links.new(tc.outputs['Generated'], noise.inputs['Vector'])
    mul = nt.nodes.new('ShaderNodeMath')
    mul.operation = 'MULTIPLY'
    mul.inputs[1].default_value = 0.3
    nt.links.new(noise.outputs['Fac'], mul.inputs[0])
    nt.links.new(mul.outputs[0], vol.inputs['Density'])
    nt.links.new(vol.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    fog.data.materials.append(fm)
    # moonlight from far behind, low and to the left: it lights the fog from within
    moon = bpy.data.lights.new('moon', 'SUN')
    moon.energy = 2.5
    moon.color = (0.7, 0.82, 1.0)
    moon.angle = math.radians(2)
    sun = link(bpy.data.objects.new('moon', moon))
    sun.rotation_euler = (math.radians(-70), math.radians(-25), 0)


def build_rig():
    """The light on the machine: a cold key from the upper left, a teal rim from behind on the right
    that cuts the parts out of the fog, a low warm fill — the lamp's — from the right."""
    def area(name, loc, target, size, energy, color, shadow=False):
        light = bpy.data.lights.new(name, 'AREA')
        light.use_shadow = shadow  # only the key throws the shadow of the machine onto the deck
        light.shape = 'DISK'
        light.size = size
        light.energy = energy
        light.color = color
        obj = link(bpy.data.objects.new(name, light))
        obj.location = loc
        obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        return obj

    area('key', (-7.0, -3.5, 4.5), (0, 0, 1.4), 3.0, 2200, (0.72, 0.84, 1.0), shadow=True)
    area('rim', (3.5, 5.0, 4.0), (0, 0, 1.6), 3.0, 3200, (0.45, 0.85, 1.0))
    area('rim_left', (-5.0, 4.0, 2.5), (-1.5, 0, 2.0), 2.5, 1800, (0.5, 0.8, 0.95))
    area('fill', (4.0, -5.0, 1.0), (0.5, 0, 1.2), 3.0, 260, (1.0, 0.66, 0.38))
    world = bpy.data.worlds.new('night')
    world.use_nodes = True
    nt = world.node_tree
    bg = nt.nodes['Background']
    tc = nt.nodes.new('ShaderNodeTexCoord')
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(tc.outputs['Generated'], sep.inputs[0])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.0
    ramp.color_ramp.elements[0].color = (0.006, 0.008, 0.012, 1)
    ramp.color_ramp.elements[1].position = 0.6
    ramp.color_ramp.elements[1].color = (0.16, 0.24, 0.3, 1)
    nt.links.new(sep.outputs['Z'], ramp.inputs[0])
    nt.links.new(ramp.outputs[0], bg.inputs['Color'])
    bg.inputs['Strength'].default_value = 0.45
    bpy.context.scene.world = world


def shadow_catcher():
    deck = span('deck_catcher', -6, 6, -3, 6, -0.02, 0.0, None)
    deck.is_shadow_catcher = True
    return deck


# --- rendering --------------------------------------------------------------------------------


def materials():
    return {
        'brass': mat_brass(),
        'brass_horn': mat_brass('brass_horn', (0.66, 0.42, 0.16), 0.34),
        'enamel': mat_enamel('enamel', (0.010, 0.032, 0.030)),
        'iron': mat_iron(),
        'steel': mat_plain('steel', (0.5, 0.52, 0.55), 0.32, 1.0),
        'blued': mat_plain('blued', (0.05, 0.07, 0.12), 0.25, 1.0),
        'ink': mat_plain('ink', (0.02, 0.018, 0.016), 0.6),
        'ink_engraved': mat_plain('ink_engraved', (0.035, 0.025, 0.012), 0.7),
        'red': mat_plain('red', (0.42, 0.04, 0.03), 0.45),
        'face': mat_dial_face(),
        'bakelite': mat_plain('bakelite', (0.045, 0.02, 0.012), 0.22),
        'rubber': mat_plain('rubber', (0.02, 0.02, 0.022), 0.6),
        'glass': mat_plain('dial_glass', (1, 1, 1), 0.02),
        'bulb_off': mat_glass_bulb('bulb_off', 0.0),
        'bulb_on': mat_glass_bulb('bulb_on', 16.0),
        'deck': mat_wood(),
        'rope': mat_plain('rope', (0.22, 0.17, 0.11), 0.85),
        'water': mat_water(),
        'fog_lamp_glass': mat_plain('fog_lamp_glass', (0.9, 0.95, 1), 0.2, emission=(0.7, 0.92, 1.0), strength=6.0),
        'marker_glass': mat_plain('marker_glass', (1, 0.4, 0.3), 0.2, emission=(1.0, 0.3, 0.2), strength=6.0),
    }


def finish_glass(m):
    glass = bpy.data.materials['dial_glass']
    bsdf = glass.node_tree.nodes['Principled BSDF']
    bsdf.inputs['Transmission Weight'].default_value = 1.0
    bsdf.inputs['IOR'].default_value = 1.5


def main():
    os.makedirs(OUT, exist_ok=True)
    scene = reset()
    m = materials()
    finish_glass(m)
    cols = {}
    for part in ('fog', 'body', 'strip', 'flywheel', 'needle', 'glass', 'lever', 'lamp', 'lamp-on', 'glow', 'steam', 'rig', 'catcher'):
        cols[part] = collection(part)
    CURRENT['col'] = cols['rig']
    build_rig()
    CURRENT['col'] = cols['catcher']
    shadow_catcher()
    CURRENT['col'] = cols['fog']
    build_fog(m)
    CURRENT['col'] = cols['body']
    build_body(m)
    CURRENT['col'] = cols['strip']
    build_strip(m)
    CURRENT['col'] = cols['flywheel']
    build_flywheel(m)
    CURRENT['col'] = cols['needle']
    build_needle(m)
    CURRENT['col'] = cols['glass']
    build_glass(m)
    CURRENT['col'] = cols['lever']
    build_lever(m)
    CURRENT['col'] = cols['lamp']
    build_lamp(m, lit=False)
    CURRENT['col'] = cols['lamp-on']
    build_lamp(m, lit=True)
    CURRENT['col'] = cols['glow']
    build_glow_lights(90.0)
    CURRENT['col'] = cols['steam']
    steam = mat_steam()
    build_steam_domain(steam)
    CURRENT['col'] = None

    layout = {'canvas': [WIDTH, HEIGHT], 'pivots': {}}
    for name in ('flywheel', 'lever', 'needle'):
        px, py = pixel(PIVOTS[name])
        layout['pivots'][name] = [round(px, 4), round(py, 4)]
    layout['lamp'] = [round(c, 4) for c in pixel(PIVOTS['lamp'])]
    with open(os.path.join(OUT, 'layout.json'), 'w') as f:
        json.dump(layout, f, indent=2)

    def show(*names):
        for name, col in cols.items():
            col.hide_render = name not in names

    def render(file, samples):
        scene.cycles.samples = max(16, samples // 8) if DRAFT else samples
        scene.render.filepath = os.path.join(OUT, file)
        bpy.ops.render.render(write_still=True)
        print('rendered', file, flush=True)

    def wanted(part):
        return ONLY is None or part in ONLY

    world = scene.world
    if wanted('fog'):
        scene.render.film_transparent = False
        scene.world = bpy.data.worlds.new('fog_world')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.03, 0.045, 0.06, 1)
        show('fog', 'body')
        for o in cols['body'].objects:
            o.visible_camera = False
        render('fog.png', 512)
        for o in cols['body'].objects:
            o.visible_camera = True
        scene.world = world
        scene.render.film_transparent = True
    if wanted('body'):
        show('body', 'rig', 'catcher')
        render('body.png', 256)
    for part in ('strip', 'flywheel', 'needle', 'glass', 'lever', 'lamp', 'lamp-on'):
        if wanted(part):
            show(part, 'rig')
            render(f'{part}.png', 256)
    if wanted('glow'):
        # the light of the lit lamp in the fog, on black: the cage casts its shadows into it
        scene.render.film_transparent = False
        scene.world = bpy.data.worlds.new('black')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
        fog_obj = bpy.data.objects['fog_volume']
        for o in bpy.data.collections['lamp-on'].objects:
            o.visible_camera = False
        # the glass lets the light of the bulb out; the brass of the cage casts its shadows
        bpy.data.collections['lamp-on'].objects['lamp_glass_on'].visible_shadow = False
        show('glow', 'lamp-on')
        cols['fog'].hide_render = False
        for o in cols['fog'].objects:
            o.hide_render = o is not fog_obj
        moon = bpy.data.objects['moon']
        moon.hide_render = True
        render('glow.png', 512)
        for o in cols['fog'].objects:
            o.hide_render = False
        for o in bpy.data.collections['lamp-on'].objects:
            o.visible_camera = True
        bpy.data.collections['lamp-on'].objects['lamp_glass_on'].visible_shadow = True
        scene.world = world
        scene.render.film_transparent = True
    if wanted('steam'):
        show('steam', 'rig')
        for frame in range(STEAM_FRAMES):
            set_steam_frame(steam, frame)
            render(f'steam-{frame}.png', 512)


main()
