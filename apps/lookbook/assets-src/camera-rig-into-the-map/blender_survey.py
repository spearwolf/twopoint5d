"""Runs inside Blender: builds "Station 4" — a sheet of a field survey of a dry basin, and the place
it marks as a diorama — and writes both:

- the map: sheet 7 of a basin survey from 1974, printed on aged paper — contours every 10 m, a dry
  salt lake, a creek bed, a ridge, scrub, three trig stations, the dashed red route of the field
  party, a title block, and in red pencil the notes of a survey that went wrong: around station 4
  the contours close into perfect circles, the trees in a ring around it are dead, and the station
  has not answered since 03:12. Rendered top down with Cycles, flat ink on paper, as a PNG;
- the diorama: station 4 itself, a ten metre plug of the basin cut out with its strata — a
  prefab hut with a lit window and the door ajar, a radio mast with a red lamp, a generator and
  its cables, a floodlight aimed at a perfectly round hole whose bottom gives off a faint cold
  light, a ring of survey stakes with orange tape, a theodolite on its tripod, an empty chair
  facing the hole, dead trees. Lit by Cycles once, its light baked into one texture, exported as a
  `.glb` with one camera.

    blender -b --factory-startup --python blender_survey.py -- <out-dir> [--map] [--diorama] [--views] [--draft]

Writes `<out-dir>/survey-map.png`, `<out-dir>/survey-map.json` and `<out-dir>/station.glb`.
`--map` or `--diorama` builds one of the two only; `--views` renders the camera of the diorama and a
view from above with Cycles into `<out-dir>/view-*.png` instead of baking, for tuning the
composition; `--draft` renders and bakes small and quick.

The map is in map units, x to the right and y up, its origin in the middle of the sheet; the
diorama in metres, Blender's z up, which the glTF export turns into y up. `survey-map.json` names
where station 4 lies on the map and how many map units a metre of the diorama takes there.
"""

import json
import math
import os
import random
import sys

import bmesh
import bpy
import numpy as np
from mathutils import Vector

ARGS = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS and not ARGS[0].startswith('--') else '/tmp/station'
VIEWS = '--views' in ARGS
DRAFT = '--draft' in ARGS
ONLY_MAP = '--map' in ARGS
ONLY_DIORAMA = '--diorama' in ARGS

# --- the map ----------------------------------------------------------------------------------

# the sheet, in map units; one unit is 10 m of the basin, so the grid of 100 units is a kilometre
MAP_W, MAP_H = 1600, 900
# the picture of the map: two pixels per unit
MAP_PX = 2 if not DRAFT else 1
# station 4, the centre of the hollow, and how many map units a metre of the diorama takes there
STATION = (330.0, 40.0)
UNITS_PER_METRE = 6.0
HOLLOW_R = 150.0

# the diorama, in metres: a plug of 10 × 10 m, the hole in its middle at the origin
HALF = 5.0
DEPTH = 2.6
HOLE_R = 1.45
STAKES_R = 2.5
HUT = dict(c=(-2.9, 2.5), w=3.0, d=2.0, h=2.2)

FONT_DIR = bpy.utils.system_resource('DATAFILES', path='fonts')


def srgb(hex_color, alpha=1.0):
    """`#rrggbb` → a linear RGBA tuple, as Blender's colour sockets take it."""
    h = hex_color.lstrip('#')

    def lin(c):
        c /= 255.0
        return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4

    return (lin(int(h[0:2], 16)), lin(int(h[2:4], 16)), lin(int(h[4:6], 16)), alpha)


PAPER = '#e6dabd'
SEPIA = '#8b5a2e'
SEPIA_DARK = '#6a3f1c'
INK = '#1d1a17'
GRID = '#3d5868'
WATER = '#4f7f93'
SCRUB = '#6f7d4a'
PENCIL = '#b1281d'
ROUTE = '#c0392b'


# --- scene ------------------------------------------------------------------------------------


def gpu(scene):
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
                return
    except Exception as error:  # noqa: BLE001 - a missing GPU renders on the CPU
        print('no GPU for Cycles, rendering on the CPU:', error)


def reset():
    bpy.ops.wm.read_factory_settings(use_empty=True)
    # the fonts loaded before went with the old file
    FONTS.clear()
    scene = bpy.context.scene
    scene.render.engine = 'CYCLES'
    scene.render.resolution_percentage = 100
    scene.cycles.seed = 4
    gpu(scene)
    return scene


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def activate(obj):
    for o in bpy.context.selected_objects:
        o.select_set(False)
    bpy.context.view_layer.objects.active = obj
    obj.select_set(True)


def flat(name, color, grain=0.0, grain_scale=0.6):
    """Ink: an unlit colour, with a grain of paper showing through where `grain` is above 0."""
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb(color)
    out = nt.nodes['Material Output']
    if not grain:
        nt.links.new(em.outputs[0], out.inputs['Surface'])
        return m
    # pencil: the lead catches on the tooth of the paper, a fine noise lets the paper through
    tc = nt.nodes.new('ShaderNodeNewGeometry')
    noise = nt.nodes.new('ShaderNodeTexNoise')
    noise.inputs['Scale'].default_value = grain_scale
    noise.inputs['Detail'].default_value = 8.0
    noise.inputs['Roughness'].default_value = 0.75
    nt.links.new(tc.outputs['Position'], noise.inputs['Vector'])
    ramp = nt.nodes.new('ShaderNodeValToRGB')
    ramp.color_ramp.elements[0].position = 0.5 - grain * 0.25
    ramp.color_ramp.elements[1].position = 0.5 + grain * 0.15
    nt.links.new(noise.outputs['Fac'], ramp.inputs[0])
    clear = nt.nodes.new('ShaderNodeBsdfTransparent')
    mix = nt.nodes.new('ShaderNodeMixShader')
    nt.links.new(ramp.outputs['Color'], mix.inputs[0])
    nt.links.new(clear.outputs[0], mix.inputs[1])
    nt.links.new(em.outputs[0], mix.inputs[2])
    nt.links.new(mix.outputs[0], out.inputs['Surface'])
    return m


def mesh_object(name, verts, faces, material, z):
    me = bpy.data.meshes.new(name)
    v = np.asarray(verts, dtype=np.float64)
    if len(v) and v.shape[1] == 2:
        v = np.column_stack([v, np.full(len(v), z)])
    me.from_pydata(v.tolist(), [], np.asarray(faces, dtype=np.int64).tolist())
    me.update()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(material)
    return obj


def ribbons(segments, width):
    """Quads `width` wide along line segments [(p, q)], each grown by half its width at both ends so
    that the segments of a polyline overlap at their joints."""
    seg = np.asarray(segments, dtype=np.float64).reshape(-1, 2, 2)
    p, q = seg[:, 0], seg[:, 1]
    d = q - p
    length = np.linalg.norm(d, axis=1)
    keep = length > 1e-9
    p, q, d, length = p[keep], q[keep], d[keep], length[keep]
    u = d / length[:, None]
    n = np.column_stack([-u[:, 1], u[:, 0]]) * (width / 2)
    p = p - u * (width / 2)
    q = q + u * (width / 2)
    verts = np.stack([p - n, q - n, q + n, p + n], axis=1).reshape(-1, 2)
    faces = np.arange(len(verts)).reshape(-1, 4)
    return verts, faces


def lines(name, segments, width, material, z):
    if len(segments) == 0:
        return None
    verts, faces = ribbons(segments, width)
    return mesh_object(name, verts, faces, material, z)


def polyline_segments(points, closed=False):
    pts = np.asarray(points, dtype=np.float64)
    segs = np.stack([pts[:-1], pts[1:]], axis=1)
    if closed:
        segs = np.concatenate([segs, [[pts[-1], pts[0]]]])
    return segs


def resample(points, step, closed=False):
    """The polyline at points `step` apart along its length."""
    pts = np.asarray(points, dtype=np.float64)
    if closed:
        pts = np.concatenate([pts, pts[:1]])
    d = np.linalg.norm(np.diff(pts, axis=0), axis=1)
    s = np.concatenate([[0], np.cumsum(d)])
    t = np.arange(0, s[-1], step)
    return np.column_stack([np.interp(t, s, pts[:, 0]), np.interp(t, s, pts[:, 1])])


def dashes(points, dash, gap, closed=False, phase=0.0):
    """Segments of `dash` units with `gap` between them along a polyline."""
    fine = resample(points, 1.0, closed)
    out = []
    period = dash + gap
    for i in range(len(fine) - 1):
        if ((i + phase) % period) < dash:
            out.append((fine[i], fine[i + 1]))
    return np.asarray(out)


def catmull_rom(points, per_segment=12, closed=False):
    pts = [Vector((x, y)) for x, y in points]
    n = len(pts)
    out = []
    count = n if closed else n - 1
    for i in range(count):
        p0 = pts[(i - 1) % n] if closed or i > 0 else pts[0]
        p1 = pts[i]
        p2 = pts[(i + 1) % n]
        p3 = pts[(i + 2) % n] if closed or i + 2 < n else pts[-1]
        for k in range(per_segment):
            t = k / per_segment
            t2, t3 = t * t, t * t * t
            v = 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t2 + (-p0 + 3 * p1 - 3 * p2 + p3) * t3)
            out.append((v.x, v.y))
    if not closed:
        out.append((pts[-1].x, pts[-1].y))
    return np.asarray(out)


def ring_points(cx, cy, r, n=96, wobble=0.0, seed=0, turns=1.0, squash=1.0, tilt=0.0):
    rng = np.random.default_rng(seed)
    t = np.linspace(0, 2 * math.pi * turns, int(n * turns) + 1)
    phases = rng.uniform(0, 2 * math.pi, 3)
    rr = r * (1 + wobble * (0.5 * np.sin(2 * t + phases[0]) + 0.3 * np.sin(3 * t + phases[1]) + 0.2 * np.sin(5 * t + phases[2])))
    rr = rr * (1 + 0.04 * (t / (2 * math.pi)))  # a pencil loop does not meet itself
    x, y = rr * np.cos(t), rr * np.sin(t) * squash
    c, s = math.cos(tilt), math.sin(tilt)
    return np.column_stack([cx + x * c - y * s, cy + x * s + y * c])


FONTS = {}


def font(name):
    if name not in FONTS:
        FONTS[name] = bpy.data.fonts.load(os.path.join(FONT_DIR, name))
    return FONTS[name]


def text(body, x, y, size, material, z=0.6, rot=0.0, align='CENTER', spacing=1.0, face='DejaVuSansMono.woff2', valign='CENTER'):
    curve = bpy.data.curves.new('text', 'FONT')
    curve.body = body
    curve.font = font(face)
    curve.size = size
    curve.align_x = align
    curve.align_y = valign
    curve.space_character = spacing
    curve.space_line = 1.15
    obj = link(bpy.data.objects.new('text', curve))
    obj.location = (x, y, z)
    obj.rotation_euler = (0, 0, math.radians(rot))
    curve.materials.append(material)
    return obj


# --- the terrain of the basin -------------------------------------------------------------------


def value_noise(x, y, freq, seed):
    """Smooth value noise on a lattice of `freq` cells per unit, by numpy."""
    rng = np.random.default_rng(seed)
    lattice = rng.random((257, 257))
    fx = x * freq + 64.0
    fy = y * freq + 64.0
    ix = np.floor(fx).astype(np.int64)
    iy = np.floor(fy).astype(np.int64)
    tx = fx - ix
    ty = fy - iy
    tx = tx * tx * (3 - 2 * tx)
    ty = ty * ty * (3 - 2 * ty)
    ix %= 256
    iy %= 256
    a = lattice[iy, ix]
    b = lattice[iy, ix + 1]
    c = lattice[iy + 1, ix]
    d = lattice[iy + 1, ix + 1]
    return (a * (1 - tx) + b * tx) * (1 - ty) + (c * (1 - tx) + d * tx) * ty


def fbm(x, y, freq, seed, octaves=5):
    total = np.zeros_like(x)
    amp = 1.0
    norm = 0.0
    for o in range(octaves):
        total += amp * value_noise(x, y, freq * (2**o), seed + o * 17)
        norm += amp
        amp *= 0.5
    return total / norm


def dist_to_polyline(x, y, points):
    best = np.full(x.shape, np.inf)
    pts = np.asarray(points, dtype=np.float64)
    for (ax, ay), (bx, by) in zip(pts[:-1], pts[1:]):
        dx, dy = bx - ax, by - ay
        t = np.clip(((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy), 0, 1)
        best = np.minimum(best, np.hypot(x - (ax + t * dx), y - (ay + t * dy)))
    return best


def smoothstep(e0, e1, v):
    t = np.clip((v - e0) / (e1 - e0), 0, 1)
    return t * t * (3 - 2 * t)


RIDGE = [(-360, -470), (-250, -200), (-150, 60), (-60, 260), (40, 470)]
CREEK = catmull_rom([(-250, 470), (-300, 380), (-280, 300), (-350, 240), (-420, 210)], 10)
LAKE = dict(cx=-560, cy=150, rx=210, ry=120, rot=-0.25)
TRACK = catmull_rom([(470, -470), (440, -380), (470, -300), (410, -220), (380, -150), (350, -90)], 10)
TRIG = [
    ('ST.1', (-118, 128), '1204'),
    ('ST.2', (-430, -270), '1131'),
    ('ST.3', (600, 300), '1187'),
]
# the route of the field party, a loop the token of the demo walks
ROUTE_KEYS = [
    (460, -330),
    (250, -360),
    (40, -300),
    (-160, -330),
    (-380, -360),
    (-560, -250),
    (-650, -60),
    (-520, 0),
    (-360, 110),
    (-260, 280),
    (-120, 340),
    (80, 300),
    (230, 310),
    (440, 290),
    (590, 140),
    (600, -60),
    (560, -220),
]
CAMPS = [(1, 'CAMP 1'), (6, 'CAMP 2'), (10, 'CAMP 3'), (14, 'CAMP 4')]


def lake_field(x, y):
    c, s = math.cos(LAKE['rot']), math.sin(LAKE['rot'])
    dx, dy = x - LAKE['cx'], y - LAKE['cy']
    u = (dx * c + dy * s) / LAKE['rx']
    v = (-dx * s + dy * c) / LAKE['ry']
    return np.hypot(u, v)


def heights(x, y):
    """The height of the basin in metres at the map points (x, y)."""
    h = 1080 + 70 * fbm(x, y, 1 / 260, 3) + 25 * fbm(x, y, 1 / 70, 41, 4)
    h += 115 * np.exp(-((dist_to_polyline(x, y, RIDGE) / 150) ** 2))
    lake = lake_field(x, y)
    h -= 70 * smoothstep(1.9, 0.6, lake)
    h = np.where(lake < 1.0, np.minimum(h, 1012 + 3 * fbm(x, y, 1 / 40, 9)), h)
    h -= 30 * np.exp(-((dist_to_polyline(x, y, CREEK) / 35) ** 2))
    # the hollow: inside it the height is a function of the distance alone, so its contours are
    # circles drawn with a compass; outside the basin goes on as it was
    r = np.hypot(x - STATION[0], y - STATION[1])
    rim = 1102.0
    bowl = rim - 58 * (1 - smoothstep(0, HOLLOW_R, r)) ** 1.4
    w = smoothstep(HOLLOW_R * 1.25, HOLLOW_R * 0.92, r)
    return h * (1 - w) + bowl * w


def marching_squares(h, xs, ys, level):
    """The segments of the contour at `level` over the grid `h[j, i]` at (xs[i], ys[j])."""
    a = h[:-1, :-1]
    b = h[:-1, 1:]
    c = h[1:, 1:]
    d = h[1:, :-1]
    case = (a > level) * 1 + (b > level) * 2 + (c > level) * 4 + (d > level) * 8
    x0 = xs[None, :-1]
    x1 = xs[None, 1:]
    y0 = ys[:-1, None]
    y1 = ys[1:, None]

    def t(p, q):
        with np.errstate(divide='ignore', invalid='ignore'):
            return np.clip(np.where(q != p, (level - p) / (q - p), 0.5), 0, 1)

    shape = a.shape
    B = np.stack([np.broadcast_to(x0 + t(a, b) * (x1 - x0), shape), np.broadcast_to(y0, shape)], -1)
    R = np.stack([np.broadcast_to(x1, shape), np.broadcast_to(y0 + t(b, c) * (y1 - y0), shape)], -1)
    T = np.stack([np.broadcast_to(x0 + t(d, c) * (x1 - x0), shape), np.broadcast_to(y1, shape)], -1)
    L = np.stack([np.broadcast_to(x0, shape), np.broadcast_to(y0 + t(a, d) * (y1 - y0), shape)], -1)
    table = {1: [(L, B)], 2: [(B, R)], 3: [(L, R)], 4: [(R, T)], 5: [(L, T), (B, R)], 6: [(B, T)], 7: [(L, T)]}
    segs = []
    for k in range(1, 15):
        pairs = table[k] if k < 8 else ([(L, B), (R, T)] if k == 10 else table[15 - k])
        mask = case == k
        if not mask.any():
            continue
        for p, q in pairs:
            segs.append(np.stack([p[mask], q[mask]], axis=1))
    return np.concatenate(segs) if segs else np.zeros((0, 2, 2))


def hillshade(h, cell):
    gy, gx = np.gradient(h, cell)
    # light from the north west, 45° up, as on every printed map
    az, alt = math.radians(315), math.radians(45)
    slope = np.arctan(np.hypot(gx, gy) * 3.0)
    aspect = np.arctan2(-gx, gy)
    shade = np.sin(alt) * np.cos(slope) + np.cos(alt) * np.sin(slope) * np.cos(az - aspect)
    return np.clip(shade, 0, 1)


# --- the sheet ----------------------------------------------------------------------------------


def paper_material():
    """The paper: its colour multiplied by the colour attribute `tint` of the ground mesh — hill
    shade, scrub, the salt of the lake —, blotched, foxed toward the edges, folded in four, with a
    coffee ring."""
    m = bpy.data.materials.new('paper')
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    N = nt.nodes.new
    L = nt.links.new
    geo = N('ShaderNodeNewGeometry')
    sep = N('ShaderNodeSeparateXYZ')
    L(geo.outputs['Position'], sep.inputs[0])

    def math_node(op, a, b=None):
        n = N('ShaderNodeMath')
        n.operation = op
        for i, v in enumerate((a, b)):
            if v is None:
                continue
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            else:
                L(v, n.inputs[i])
        return n.outputs[0]

    def noise(scale, detail, seed_offset):
        mapping = N('ShaderNodeVectorMath')
        mapping.operation = 'ADD'
        mapping.inputs[1].default_value = (seed_offset, seed_offset * 0.7, 0)
        L(geo.outputs['Position'], mapping.inputs[0])
        n = N('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = 0.6
        L(mapping.outputs[0], n.inputs['Vector'])
        return n.outputs['Fac']

    def mix(fac, a, b, blend='MIX'):
        n = N('ShaderNodeMix')
        n.data_type = 'RGBA'
        n.blend_type = blend
        for sock, v in ((n.inputs[0], fac), (n.inputs[6], a), (n.inputs[7], b)):
            if isinstance(v, (int, float, tuple)):
                sock.default_value = v
            else:
                L(v, sock)
        return n.outputs[2]

    def ramp(fac, a, b):
        n = N('ShaderNodeMapRange')
        n.inputs['From Min'].default_value = a
        n.inputs['From Max'].default_value = b
        L(fac, n.inputs['Value'])
        return n.outputs[0]

    tint = N('ShaderNodeAttribute')
    tint.attribute_name = 'tint'
    color = mix(1.0, srgb(PAPER), tint.outputs['Color'], 'MULTIPLY')
    # blotches of age, and the fibres of the paper
    blot = ramp(noise(0.004, 3, 11.0), 0.45, 0.75)
    color = mix(math_node('MULTIPLY', blot, 0.5), color, srgb('#cdb98f'), 'MULTIPLY')
    fibre = ramp(noise(0.9, 6, 3.0), 0.3, 0.7)
    color = mix(math_node('MULTIPLY', fibre, 0.07), color, srgb('#9c8a68'), 'MULTIPLY')
    # foxed toward the edges
    edge = math_node(
        'MAXIMUM',
        math_node('DIVIDE', math_node('ABSOLUTE', sep.outputs[0]), MAP_W / 2),
        math_node('DIVIDE', math_node('ABSOLUTE', sep.outputs[1]), MAP_H / 2),
    )
    fox = ramp(math_node('ADD', edge, math_node('MULTIPLY', noise(0.012, 4, 7.0), 0.18)), 0.86, 1.06)
    color = mix(math_node('MULTIPLY', fox, 0.55), color, srgb('#b08a55'), 'MULTIPLY')
    # folded in four: a pale crease with a soft shadow on one side
    for coord, flip in ((sep.outputs[0], 1), (sep.outputs[1], -1)):
        crease = ramp(math_node('ABSOLUTE', coord), 1.8, 0.0)
        color = mix(math_node('MULTIPLY', crease, 0.35), color, srgb('#fbf6ea'))
        shadow = ramp(math_node('ABSOLUTE', math_node('SUBTRACT', coord, 4.0 * flip)), 6.0, 1.5)
        color = mix(math_node('MULTIPLY', shadow, 0.18), color, srgb('#8c7a5c'), 'MULTIPLY')
    # a coffee ring in the lower left, by its distance from the centre of the cup
    cx, cy, r = -600.0, -300.0, 62.0
    dx = math_node('SUBTRACT', sep.outputs[0], cx)
    dy = math_node('SUBTRACT', sep.outputs[1], cy)
    d = math_node('SQRT', math_node('ADD', math_node('MULTIPLY', dx, dx), math_node('MULTIPLY', dy, dy)))
    d = math_node('ADD', d, math_node('MULTIPLY', noise(0.05, 3, 5.0), 9.0))
    ring = ramp(math_node('ABSOLUTE', math_node('SUBTRACT', d, r)), 3.5, 0.0)
    inside = ramp(d, r, r - 8)
    stain = math_node('MAXIMUM', math_node('MULTIPLY', ring, 0.5), math_node('MULTIPLY', inside, 0.12))
    color = mix(stain, color, srgb('#9a6a35'), 'MULTIPLY')

    em = N('ShaderNodeEmission')
    L(color, em.inputs['Color'])
    L(em.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    return m


def build_map():
    scene = reset()
    scene.render.resolution_x = MAP_W * MAP_PX
    scene.render.resolution_y = MAP_H * MAP_PX
    scene.render.filter_size = 1.0
    scene.cycles.samples = 24 if DRAFT else 64
    scene.cycles.use_denoising = False
    scene.cycles.max_bounces = 0
    scene.view_settings.view_transform = 'Standard'
    scene.view_settings.look = 'None'
    world = bpy.data.worlds.new('none')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
    scene.world = world

    cam = bpy.data.cameras.new('map_camera')
    cam.type = 'ORTHO'
    cam.ortho_scale = MAP_W
    cam.sensor_fit = 'HORIZONTAL'
    cam_obj = link(bpy.data.objects.new('map_camera', cam))
    cam_obj.location = (0, 0, 50)
    scene.camera = cam_obj

    ink = flat('ink', INK)
    sepia = flat('sepia', SEPIA)
    sepia_dark = flat('sepia_dark', SEPIA_DARK)
    grid = flat('grid', GRID)
    water = flat('water', WATER)
    scrub = flat('scrub', SCRUB)
    pencil = flat('pencil', PENCIL, grain=0.3, grain_scale=1.4)
    route = flat('route', ROUTE)
    paper_white = flat('paper_white', '#efe6cf')

    # the ground: hill shade and tints in a colour attribute, at 4 units per vertex
    cell = 4.0
    xs = np.arange(-MAP_W / 2, MAP_W / 2 + cell, cell)
    ys = np.arange(-MAP_H / 2, MAP_H / 2 + cell, cell)
    gx, gy = np.meshgrid(xs, ys)
    h = heights(gx, gy)
    shade = hillshade(h, cell)
    tint = np.ones(gx.shape + (3,))
    light = 0.80 + 0.26 * shade
    tint *= light[..., None]
    # scrub on the lower slopes, as a pale green wash
    scrub_mask = smoothstep(0.52, 0.66, fbm(gx, gy, 1 / 120, 77)) * smoothstep(1150, 1060, h) * smoothstep(1.2, 1.6, lake_field(gx, gy))
    r_station = np.hypot(gx - STATION[0], gy - STATION[1])
    # none in the ring of dead trees round the hollow
    scrub_mask *= smoothstep(HOLLOW_R * 1.9, HOLLOW_R * 2.3, r_station)
    green = np.array(srgb('#c9d0a6')[:3]) / np.array(srgb(PAPER)[:3])
    tint = tint * (1 + scrub_mask[..., None] * (green - 1) * 0.8)
    # the salt of the dry lake, paler and bluer
    salt = smoothstep(1.02, 0.94, lake_field(gx, gy))
    salt_color = np.array(srgb('#dfe3d9')[:3]) / np.array(srgb(PAPER)[:3])
    tint = tint * (1 + salt[..., None] * (salt_color - 1))
    ny, nx = gx.shape
    me = bpy.data.meshes.new('ground')
    verts = np.column_stack([gx.ravel(), gy.ravel(), np.zeros(gx.size)])
    idx = np.arange(nx * ny).reshape(ny, nx)
    quads = np.stack([idx[:-1, :-1], idx[:-1, 1:], idx[1:, 1:], idx[1:, :-1]], axis=-1).reshape(-1, 4)
    me.from_pydata(verts.tolist(), [], quads.tolist())
    attr = me.color_attributes.new('tint', 'FLOAT_COLOR', 'POINT')
    rgba = np.concatenate([tint.reshape(-1, 3), np.ones((nx * ny, 1))], axis=1)
    attr.data.foreach_set('color', rgba.astype(np.float32).ravel())
    me.update()
    ground = link(bpy.data.objects.new('ground', me))
    ground.data.materials.append(paper_material())

    # contours every 10 m from a finer grid, every fifth one heavier
    fine = 2.0
    fxs = np.arange(-MAP_W / 2, MAP_W / 2 + fine, fine)
    fys = np.arange(-MAP_H / 2, MAP_H / 2 + fine, fine)
    fx, fy = np.meshgrid(fxs, fys)
    fh = heights(fx, fy)
    normal, index = [], []
    for level in range(int(fh.min() // 10 * 10) + 10, int(fh.max()) + 1, 10):
        segs = marching_squares(fh, fxs, fys, level + 0.01)
        (index if level % 50 == 0 else normal).append(segs)
    lines('contours', np.concatenate(normal), 0.9, sepia, 0.2)
    lines('index_contours', np.concatenate(index), 1.7, sepia_dark, 0.21)

    # the salt flat, hatched with broken lines
    hatch = []
    for y in np.arange(LAKE['cy'] - 160, LAKE['cy'] + 160, 7.0):
        xs_line = np.arange(LAKE['cx'] - 280, LAKE['cx'] + 280, 1.0)
        inside = lake_field(xs_line, np.full_like(xs_line, y)) < 0.93
        broken = value_noise(xs_line, np.full_like(xs_line, y), 1 / 9, int(y) & 255) > 0.35
        on = inside & broken
        for i in range(len(xs_line) - 1):
            if on[i] and on[i + 1]:
                hatch.append(((xs_line[i], y), (xs_line[i + 1], y)))
    lines('salt', np.asarray(hatch), 0.8, water, 0.15)
    shore = ring_points(LAKE['cx'], LAKE['cy'], 1.0, 160)
    c, s = math.cos(LAKE['rot']), math.sin(LAKE['rot'])
    sx = (shore[:, 0] - LAKE['cx']) * LAKE['rx']
    sy = (shore[:, 1] - LAKE['cy']) * LAKE['ry']
    shore = np.column_stack([LAKE['cx'] + sx * c - sy * s, LAKE['cy'] + sx * s + sy * c])
    lines('shore', dashes(shore, 7, 4, closed=True), 1.2, water, 0.16)
    # the creek bed: an intermittent stream, a dash and three dots
    creek = []
    fine_creek = resample(CREEK, 1.0)
    for i in range(len(fine_creek) - 1):
        k = i % 26
        if k < 12 or k in (15, 16, 19, 20, 23, 24):
            creek.append((fine_creek[i], fine_creek[i + 1]))
    lines('creek', np.asarray(creek), 1.5, water, 0.17)

    # scrub: little circles where the wash is, dead trees — small crosses — in a ring round the hollow
    rng = np.random.default_rng(23)
    trees, dead = [], []
    for _ in range(9000):
        x = rng.uniform(-MAP_W / 2 + 40, MAP_W / 2 - 40)
        y = rng.uniform(-MAP_H / 2 + 40, MAP_H / 2 - 40)
        r = math.hypot(x - STATION[0], y - STATION[1])
        if HOLLOW_R * 1.05 < r < HOLLOW_R * 1.75:
            if rng.random() < 0.10:
                dead.append((x, y))
            continue
        m = smoothstep(0.55, 0.7, fbm(np.array([x]), np.array([y]), 1 / 120, 77))[0]
        hh = heights(np.array([x]), np.array([y]))[0]
        if r > HOLLOW_R * 1.9 and hh < 1150 and lake_field(np.array([x]), np.array([y]))[0] > 1.25 and rng.random() < m * 0.5:
            trees.append((x, y))
    tree_segs = np.concatenate([polyline_segments(ring_points(x, y, 2.2, 10)) for x, y in trees]) if trees else []
    lines('scrub', tree_segs, 0.7, scrub, 0.3)
    cross = []
    for x, y in dead:
        a = rng.uniform(0, math.pi)
        dx, dy = 2.6 * math.cos(a), 2.6 * math.sin(a)
        cross.append(((x - dx, y - dy), (x + dx, y + dy)))
        cross.append(((x + dy, y - dx), (x - dy, y + dx)))
    lines('dead_trees', np.asarray(cross), 0.8, ink, 0.31)

    # the grid: a kilometre, 100 units, its numbers along the top and the left of the neat line
    margin = 26.0
    gx0, gx1 = -MAP_W / 2 + margin, MAP_W / 2 - margin
    gy0, gy1 = -MAP_H / 2 + margin, MAP_H / 2 - margin
    grid_segs = []
    for x in np.arange(-700, 701, 100):
        grid_segs.append(((x, gy0), (x, gy1)))
        text(f'{47 + int((x + 700) // 100):02d}', x + 9, gy1 - 9, 9, grid, z=0.5)
    for y in np.arange(-400, 401, 100):
        grid_segs.append(((gx0, y), (gx1, y)))
        text(f'{62 + int((y + 400) // 100):02d}', gx0 + 12, y + 7, 9, grid, z=0.5)
    lines('grid', np.asarray(grid_segs), 0.7, grid, 0.4)
    frame = [(gx0, gy0), (gx1, gy0), (gx1, gy1), (gx0, gy1)]
    lines('neat_line', polyline_segments(frame, closed=True), 2.2, ink, 0.41)
    outer = [(gx0 - 6, gy0 - 6), (gx1 + 6, gy0 - 6), (gx1 + 6, gy1 + 6), (gx0 - 6, gy1 + 6)]
    lines('frame', polyline_segments(outer, closed=True), 0.8, ink, 0.41)

    # the track to the station, a double dashed line
    for off in (-2.2, 2.2):
        pts = TRACK.copy()
        d = np.gradient(pts, axis=0)
        n = np.column_stack([-d[:, 1], d[:, 0]]) / np.linalg.norm(d, axis=1)[:, None]
        lines(f'track{off}', dashes(pts + n * off, 9, 4), 0.8, ink, 0.45)

    # the route of the field party, dashed red, its camps as small triangles
    route_pts = catmull_rom(ROUTE_KEYS, 16, closed=True)
    lines('route', dashes(route_pts, 10, 6, closed=True), 1.6, route, 0.5)
    for k, name in CAMPS:
        x, y = ROUTE_KEYS[k]
        tri = [(x, y + 7), (x - 6, y - 4), (x + 6, y - 4)]
        mesh_object(name, tri, [(0, 1, 2)], route, 0.52)
        text(name, x, y - 14, 8.5, route, z=0.55, spacing=1.1)

    # trig stations: a triangle with a dot, the name and the height
    for name, (x, y), height in TRIG:
        tri = ring_points(x, y, 7.5, 3, tilt=math.pi / 2)
        lines(f'trig_{name}', polyline_segments(tri[:3], closed=True), 1.3, ink, 0.55)
        mesh_object(f'trig_dot_{name}', ring_points(x, y, 1.3, 12)[:-1], [tuple(range(12))], ink, 0.56)
        text(f'{name}\n{height}', x + 12, y + 4, 8.5, ink, z=0.56, align='LEFT')

    # station 4 as the diorama shows it from above: the hut, the hole, the stakes round it
    sx, sy = STATION
    u = UNITS_PER_METRE
    hx, hy = HUT['c']
    hw, hd = HUT['w'] / 2 + 0.15, HUT['d'] / 2 + 0.15
    hut = [(sx + (hx + dx) * u, sy + (hy + dy) * u) for dx, dy in ((-hw, -hd), (hw, -hd), (hw, hd), (-hw, hd))]
    mesh_object('st4_hut', hut, [(0, 1, 2, 3)], ink, 0.57)
    hole = ring_points(sx, sy, HOLE_R * u, 48)[:-1]
    mesh_object('st4_hole', hole, [tuple(range(len(hole)))], ink, 0.57)
    lines('st4_stakes', dashes(ring_points(sx, sy, STAKES_R * u, 64), 3, 3, closed=True), 0.9, ink, 0.57)
    text('ST.4', sx - 34, sy - 30, 10, ink, z=0.58)

    # the labels of the basin, spaced out in the manner of the sheet
    text('DRY  LAKE', -560, 150, 15, water, z=0.6, spacing=1.6, rot=-14)
    text('(salt pan, no water seen)', -560, 128, 8, water, z=0.6, rot=-14)
    text('SHALE  CREEK  (dry)', -330, 330, 9.5, water, z=0.6, spacing=1.3, rot=-58)
    text('L O N G   R I D G E', -215, -110, 13, sepia_dark, z=0.6, spacing=1.2, rot=67)
    text('THE  HOLLOW', STATION[0], STATION[1] + HOLLOW_R + 20, 12, sepia_dark, z=0.6, spacing=1.5)
    text('track', 452, -262, 8, ink, z=0.6, rot=-70)
    for x, y, lvl in ((520, -120, '1100'), (-40, 80, '1150'), (90, -280, '1100'), (-640, 300, '1050')):
        text(lvl, x, y, 7.5, sepia_dark, z=0.6)

    # the title block, the scale bar, the north arrow
    bx0, by0, bx1, by1 = 470, -410, 760, -290
    mesh_object('title_ground', [(bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1)], [(0, 1, 2, 3)], paper_white, 0.59)
    lines('title_box', polyline_segments([(bx0, by0), (bx1, by0), (bx1, by1), (bx0, by1)], closed=True), 1.4, ink, 0.6)
    lines('title_rule', [((bx0, by1 - 34), (bx1, by1 - 34))], 0.8, ink, 0.6)
    text('BASIN SURVEY · SHEET 7', (bx0 + bx1) / 2, by1 - 16, 13, ink, z=0.61, spacing=1.15, face='Inter.woff2')
    text(
        'scale 1 : 25 000 · contours every 10 m\nfield party: Weller, Ostrowski, Hahn\nSeptember 1974 · not for navigation',
        bx0 + 12,
        by1 - 64,
        8.2,
        ink,
        z=0.61,
        align='LEFT',
    )
    for i in range(4):
        x = bx0 + 12 + i * 30
        mesh_object(f'scale_{i}', [(x, by0 + 14), (x + 30, by0 + 14), (x + 30, by0 + 20), (x, by0 + 20)], [(0, 1, 2, 3)], ink if i % 2 == 0 else paper_white, 0.61)
    lines('scale_box', polyline_segments([(bx0 + 12, by0 + 14), (bx0 + 132, by0 + 14), (bx0 + 132, by0 + 20), (bx0 + 12, by0 + 20)], closed=True), 0.6, ink, 0.62)
    text('0      1 km', bx0 + 72, by0 + 28, 7, ink, z=0.62)
    ax, ay = bx1 - 26, by0 + 30
    mesh_object('north', [(ax, ay + 28), (ax - 7, ay - 6), (ax, ay), (ax + 7, ay - 6)], [(0, 1, 2), (0, 2, 3)], ink, 0.62)
    text('N', ax, ay + 40, 9, ink, z=0.62, face='Inter.woff2')
    text('mag. N?', ax - 30, ay + 10, 6.5, pencil, z=0.7, rot=8)

    # the red pencil of the last survey: a ring round station 4, the notes
    for seed, (dr, tilt) in enumerate(((0.0, 0.2), (3.0, 0.5))):
        loop = ring_points(sx, sy, 44 + dr, 120, wobble=0.035, seed=seed + 3, turns=1.12, squash=0.86, tilt=tilt)
        lines(f'pencil_ring_{seed}', polyline_segments(loop), 1.7, pencil, 0.7 + seed * 0.001)
    notes = [
        ('ST.4 — last contact 03:12', sx + 70, sy + 72, 11.5, 6),
        ('contours close.\nre-survey? — they DO close', sx + 96, sy - 112, 10, -4),
        ('compass drifts 40° here', sx - 250, sy - 160, 10, 3),
        ('no echo from the hole', sx + 150, sy + 14, 10, -2),
    ]
    for body, x, y, size, rot in notes:
        text(body, x, y, size, pencil, z=0.71, rot=rot, align='LEFT')
    arrow = [(sx + 66, sy + 64), (sx + 46, sy + 46), (sx + 36, sy + 38)]
    lines('pencil_arrow', polyline_segments(arrow), 1.4, pencil, 0.7)
    lines('pencil_tip', [((sx + 36, sy + 38), (sx + 44, sy + 38)), ((sx + 36, sy + 38), (sx + 37, sy + 46))], 1.4, pencil, 0.7)
    # the notes of the day: the line from camp 3 crossed out, a question mark on the ridge
    lines('pencil_strike', [((-170, 372), (-58, 378))], 1.3, pencil, 0.7)
    text('?', -90, 160, 16, pencil, z=0.71, rot=10)

    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGB'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 100
    scene.render.filepath = os.path.join(OUT, 'survey-map.png')
    bpy.ops.render.render(write_still=True)

    route_out = resample(route_pts, 8.0, closed=True)
    data = {
        'width': MAP_W,
        'height': MAP_H,
        'station': {'x': STATION[0], 'y': STATION[1], 'unitsPerMetre': UNITS_PER_METRE},
        'route': [[round(float(x), 2), round(float(y), 2)] for x, y in route_out],
    }
    with open(os.path.join(OUT, 'survey-map.json'), 'w') as f:
        json.dump(data, f, indent=2)
        f.write('\n')


# --- the diorama: primitives -----------------------------------------------------------------

TEXTURE_SIZE = 1024 if DRAFT else 4096
BAKE_SAMPLES = 32 if DRAFT else 384

rng = random.Random(1974)


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


def rod(name, a, b, size, material=None, round_=False):
    """A bar `size` thick from `a` to `b`, square or round."""
    a, b = Vector(a), Vector(b)
    v = b - a
    rot = v.to_track_quat('Z', 'Y').to_euler()
    if round_:
        return cylinder(name, (a + b) / 2, size / 2, v.length, material, rot=rot, verts=8)
    return box(name, (a + b) / 2, (size, size, v.length), material, rot=rot)


def cylinder(name, c, r, depth, material=None, rot=(0, 0, 0), verts=32, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=c, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=c, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, bevel, smooth=35)


def sphere(name, c, r, material=None, scale=(1, 1, 1), subdivisions=2):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=subdivisions, radius=r, location=c)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, material, smooth=70)


def apply_modifiers(obj):
    activate(obj)
    for mod in list(obj.modifiers):
        bpy.ops.object.modifier_apply(modifier=mod.name)


def text_mesh(name, body, c, size, material, rot=(math.pi / 2, 0, 0)):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.font = font('Inter.woff2')
    curve.size = size
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.extrude = 0.001
    obj = link(bpy.data.objects.new(name, curve))
    obj.location = c
    obj.rotation_euler = rot
    activate(obj)
    bpy.ops.object.convert(target='MESH')
    obj = bpy.context.active_object
    obj.data.materials.append(material)
    return obj


def cable(name, points, radius, material):
    """A rubber cable through `points`, a smooth curve, converted to a mesh when the scene is joined."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = radius
    curve.bevel_resolution = 2
    curve.resolution_u = 8
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for bp, p in zip(spline.bezier_points, points):
        bp.co = p
        bp.handle_left_type = bp.handle_right_type = 'AUTO'
    curve.materials.append(material)
    return link(bpy.data.objects.new(name, curve))


def ground_z(x, y):
    """The height of the top of the diorama: the floor of the hollow, sinking toward the hole, with a
    small unevenness."""
    x = np.asarray(x, dtype=np.float64)
    y = np.asarray(y, dtype=np.float64)
    r = np.hypot(x, y)
    bowl = -0.3 * (1 - smoothstep(0, 6.5, r))
    bumps = (value_noise(x, y, 0.45, 61) - 0.5) * 0.22 + (value_noise(x, y, 1.6, 62) - 0.5) * 0.05
    return bowl + bumps


def gz(x, y):
    return float(ground_z(np.array([x]), np.array([y]))[0])


# --- the diorama: materials --------------------------------------------------------------------


class Mat:
    """A small builder over a node tree: a Principled BSDF and helpers to feed its inputs."""

    def __init__(self, name):
        self.m = bpy.data.materials.new(name)
        self.m.use_nodes = True
        self.nt = self.m.node_tree
        self.bsdf = self.nt.nodes['Principled BSDF']

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
        for el, (position, color) in zip(cr.elements, stops):
            el.position = position
            el.color = color
        self.link(fac, n.inputs[0])
        return n.outputs[0]

    def map_range(self, value, a, b):
        n = self.node('ShaderNodeMapRange')
        n.inputs['From Min'].default_value = a
        n.inputs['From Max'].default_value = b
        self.link(value, n.inputs['Value'])
        return n.outputs[0]

    def noise(self, vec, scale, detail=4.0, rough=0.55, distortion=0.0):
        n = self.node('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        n.inputs['Distortion'].default_value = distortion
        self.link(vec, n.inputs['Vector'])
        return n.outputs['Fac']

    def pos(self):
        """World position, split into its axes: (vector, x, y, z)."""
        geo = self.node('ShaderNodeNewGeometry')
        sep = self.node('ShaderNodeSeparateXYZ')
        self.link(geo.outputs['Position'], sep.inputs[0])
        return geo.outputs['Position'], sep.outputs[0], sep.outputs[1], sep.outputs[2]


def simple(name, color, rough=0.6, metal=0.0):
    return Mat(name).set(Base_Color=srgb(color), Roughness=rough, Metallic=metal).m


def grimy(name, color, dirt, scale=3.0, amount=0.55, rough=0.7):
    """A colour with blotches of a darker one, by world position."""
    mt = Mat(name)
    vec, _, _, _ = mt.pos()
    n = mt.noise(vec, scale, detail=6.0, rough=0.62)
    fac = mt.ramp(n, [(0.38, (0, 0, 0, 1)), (0.75, (amount, amount, amount, 1))])
    mt.color(mt.mix(fac, srgb(color), srgb(dirt)))
    mt.set(Roughness=rough)
    return mt.m


def glow(name, color, strength):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    nt = m.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    em = nt.nodes.new('ShaderNodeEmission')
    em.inputs['Color'].default_value = srgb(color)
    em.inputs['Strength'].default_value = strength
    nt.links.new(em.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    return m


def ground_material():
    """Dry grass and dust, darker in patches, and a ring of bleached, bare ground round the hole."""
    mt = Mat('ground')
    vec, x, y, _ = mt.pos()
    patches = mt.noise(vec, 0.55, detail=5.0, rough=0.6)
    grass = mt.ramp(patches, [(0.35, srgb('#3a3524')), (0.55, srgb('#5d5637')), (0.72, srgb('#7a6c4a'))])
    fine = mt.noise(vec, 9.0, detail=6.0, rough=0.7)
    grass = mt.mix(mt.ramp(fine, [(0.3, (0, 0, 0, 1)), (0.7, (0.35, 0.35, 0.35, 1))]), grass, srgb('#2a271c'))
    r = mt.math('SQRT', mt.math('ADD', mt.math('MULTIPLY', x, x), mt.math('MULTIPLY', y, y)))
    r = mt.math('ADD', r, mt.math('MULTIPLY', mt.math('SUBTRACT', mt.noise(vec, 1.3, detail=3.0), 0.5), 0.8))
    # bare and bleached within 3.2 m of the hole, the grass coming back beyond
    bleached = mt.ramp(mt.map_range(r, 2.6, 3.6), [(0.0, (1, 1, 1, 1)), (1.0, (0, 0, 0, 1))])
    mt.color(mt.mix(bleached, grass, srgb('#8a8678')))
    mt.set(Roughness=0.95)
    return mt.m


def strata_material(name, darken=False):
    """The cut through the basin: topsoil, ochre clay, a pale band of ash, grey shale, dark rock — wavy,
    by height. In the hole it goes black with depth."""
    mt = Mat(name)
    vec, _, _, z = mt.pos()
    wave = mt.math('MULTIPLY', mt.math('SUBTRACT', mt.noise(vec, 0.7, detail=3.0), 0.5), 0.3)
    depth = mt.math('DIVIDE', mt.math('ADD', z, wave), -DEPTH)
    bands = mt.ramp(
        depth,
        [
            (0.0, srgb('#2f251c')),
            (0.09, srgb('#3d2e21')),
            (0.11, srgb('#7a5a36')),
            (0.32, srgb('#8f6d44')),
            (0.34, srgb('#b9ae93')),
            (0.42, srgb('#a89c80')),
            (0.44, srgb('#5a5650')),
            (0.75, srgb('#4a4741')),
            (0.78, srgb('#2c2a27')),
        ],
    )
    grain = mt.noise(vec, 14.0, detail=6.0, rough=0.7)
    color = mt.mix(mt.ramp(grain, [(0.35, (0, 0, 0, 1)), (0.7, (0.4, 0.4, 0.4, 1))]), bands, srgb('#1c1a17'))
    # fine layering inside the shale
    layers = mt.math('SINE', mt.math('MULTIPLY', mt.math('ADD', z, mt.math('MULTIPLY', wave, 0.4)), 60.0))
    color = mt.mix(mt.ramp(layers, [(0.0, (0, 0, 0, 1)), (1.0, (0.18, 0.18, 0.18, 1))]), color, srgb('#1c1a17'))
    if darken:
        color = mt.mix(mt.map_range(z, -0.3, -0.85), color, srgb('#010102'))
    mt.color(color)
    mt.set(Roughness=0.9)
    return mt.m


def corrugated(name, color, dirt):
    """Corrugated sheet metal: ribs every 7.6 cm, faded paint, rust streaks running down."""
    mt = Mat(name)
    vec, x, y, _ = mt.pos()
    ribs = mt.math('SINE', mt.math('MULTIPLY', mt.math('ADD', x, y), 2 * math.pi / 0.076))
    base = mt.mix(mt.ramp(ribs, [(0.0, (0, 0, 0, 1)), (1.0, (0.35, 0.35, 0.35, 1))]), srgb(color), srgb('#2f3330'))
    stretched = mt.node('ShaderNodeVectorMath', operation='MULTIPLY')
    stretched.inputs[1].default_value = (6.0, 6.0, 0.6)
    mt.link(vec, stretched.inputs[0])
    streaks = mt.noise(stretched.outputs[0], 1.4, detail=5.0, rough=0.6)
    base = mt.mix(mt.ramp(streaks, [(0.48, (0, 0, 0, 1)), (0.7, (0.75, 0.75, 0.75, 1))]), base, srgb(dirt))
    mt.color(base)
    mt.set(Roughness=0.55, Metallic=0.25)
    return mt.m


def materials():
    return {
        'ground': ground_material(),
        'strata': strata_material('strata'),
        'hole_wall': strata_material('hole_wall', darken=True),
        'hut_wall': corrugated('hut_wall', '#7c8778', '#6b3f22'),
        'roof': grimy('roof', '#2b2a28', '#4a3a2c', scale=2.0),
        'concrete': grimy('concrete', '#7d7a72', '#4f4b44', scale=4.0),
        'frame': simple('frame', '#3b3f3c', 0.5, 0.3),
        'window': glow('window', '#ffb05a', 7.0),
        'doorway': glow('doorway', '#ffa24a', 5.0),
        'door': corrugated('door', '#6f7a6c', '#5a3820'),
        'steel': grimy('steel', '#5c5f60', '#3a2c22', scale=6.0, rough=0.45),
        'mast': simple('mast', '#9a9c9a', 0.5, 0.6),
        'mast_red': simple('mast_red', '#b22b20', 0.5, 0.3),
        'lamp_red': glow('lamp_red', '#ff2a14', 40.0),
        'flood_lens': glow('flood_lens', '#e4ecff', 30.0),
        'yellow': grimy('yellow', '#a68b37', '#4b3a22', scale=5.0),
        'rubber': simple('rubber', '#131313', 0.7),
        'wood': grimy('wood', '#9d8a68', '#5b4b37', scale=8.0),
        'tape': simple('tape', '#e25a1c', 0.55),
        'orange': simple('orange', '#d9541a', 0.5),
        'instrument': simple('instrument', '#c2a84a', 0.4, 0.2),
        'black_metal': simple('black_metal', '#1b1c1d', 0.45, 0.5),
        'drum_red': grimy('drum_red', '#7a2b1f', '#3b2418', scale=5.0, rough=0.6),
        'drum_olive': grimy('drum_olive', '#4f5432', '#2f2a1d', scale=5.0, rough=0.6),
        'bark': grimy('bark', '#8f8b82', '#4f4b45', scale=7.0, rough=0.9),
        'rock': grimy('rock', '#6d6a63', '#3e3b36', scale=6.0, rough=0.9),
        'canvas': grimy('canvas', '#5d5a3e', '#36331f', scale=4.0),
        'plate': simple('plate', '#e8e4d8', 0.5),
        'plate_ink': simple('plate_ink', '#b0261b', 0.5),
        'void_glow': glow('void_glow', '#86f0dc', 1.6),
    }


# --- the diorama: the scene --------------------------------------------------------------------


def build_block(mats):
    """The plug of ground: its top following `ground_z`, its four sides cut straight down, the hole
    cut out of its middle by a cylinder whose material the new faces take."""
    n = 90
    xs = np.linspace(-HALF, HALF, n + 1)
    gx, gy = np.meshgrid(xs, xs)
    gzs = ground_z(gx, gy)
    bm = bmesh.new()
    verts = [[bm.verts.new((float(gx[j, i]), float(gy[j, i]), float(gzs[j, i]))) for i in range(n + 1)] for j in range(n + 1)]
    for j in range(n):
        for i in range(n):
            bm.faces.new((verts[j][i], verts[j][i + 1], verts[j + 1][i + 1], verts[j + 1][i]))
    boundary = [e for e in bm.edges if e.is_boundary]
    ext = bmesh.ops.extrude_edge_only(bm, edges=boundary)
    for v in [g for g in ext['geom'] if isinstance(g, bmesh.types.BMVert)]:
        v.co.z = -DEPTH
    bmesh.ops.contextual_create(bm, geom=[e for e in bm.edges if e.is_boundary])
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    for f in bm.faces:
        f.material_index = 0 if f.normal.z > 0.5 and f.calc_center_median().z > -1.0 else 1
    me = bpy.data.meshes.new('block')
    bm.to_mesh(me)
    bm.free()
    block = link(bpy.data.objects.new('block', me))
    block.data.materials.append(mats['ground'])
    block.data.materials.append(mats['strata'])

    bpy.ops.mesh.primitive_cylinder_add(vertices=96, radius=HOLE_R, depth=4.0, location=(0, 0, 0.1))
    cutter = bpy.context.active_object
    cutter.data.materials.append(mats['hole_wall'])
    mod = block.modifiers.new('hole', 'BOOLEAN')
    mod.operation = 'DIFFERENCE'
    mod.solver = 'EXACT'
    mod.material_mode = 'TRANSFER'
    mod.object = cutter
    apply_modifiers(block)
    bpy.data.objects.remove(cutter)

    # the bottom of the plug is never seen: out of the atlas
    bm = bmesh.new()
    bm.from_mesh(block.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.normal.z < -0.9 and f.calc_center_median().z < -DEPTH + 0.01], context='FACES')
    bm.to_mesh(block.data)
    bm.free()

    # far below, a faint cold light
    cylinder('void_glow', (0, 0, -1.88), 0.22, 0.01, mats['void_glow'], verts=32)
    light = bpy.data.lights.new('void_light', 'POINT')
    light.color = srgb('#86f0dc')[:3]
    light.energy = 2.5
    light.shadow_soft_size = 0.2
    link(bpy.data.objects.new('void_light', light)).location = (0, 0, -1.5)


def build_hut(mats):
    cx, cy = HUT['c']
    w, d, h = HUT['w'], HUT['d'], HUT['h']
    base = max(gz(cx + sx * w / 2, cy + sy * d / 2) for sx in (-1, 1) for sy in (-1, 1))
    floor = base + 0.22
    # a plinth of concrete blocks under it, sunk into the ground
    for sx in (-1, 0, 1):
        for sy in (-1, 1):
            x, y = cx + sx * (w / 2 - 0.25), cy + sy * (d / 2 - 0.2)
            box('plinth', (x, y, (gz(x, y) - 0.2 + floor) / 2), (0.4, 0.4, floor - gz(x, y) + 0.2), mats['concrete'], bevel=0.02)
    box('hut_floor', (cx, cy, floor + 0.04), (w + 0.1, d + 0.1, 0.08), mats['frame'])
    box('hut', (cx, cy, floor + h / 2 + 0.08), (w, d, h), mats['hut_wall'])
    # a shed roof, higher at the back, with an overhang
    box('roof', (cx, cy + 0.02, floor + h + 0.2), (w + 0.5, d + 0.55, 0.08), mats['roof'], rot=(math.radians(-7), 0, 0), bevel=0.01)
    # the window in the south wall, lit from inside, its frame and its cross
    wy = cy - d / 2
    wz = floor + 1.35
    box('window_frame', (cx - 0.55, wy - 0.03, wz), (1.0, 0.06, 0.8), mats['frame'])
    box('window', (cx - 0.55, wy - 0.065, wz), (0.86, 0.01, 0.66), mats['window'])
    box('mullion_v', (cx - 0.55, wy - 0.075, wz), (0.04, 0.02, 0.66), mats['frame'])
    box('mullion_h', (cx - 0.55, wy - 0.075, wz), (0.86, 0.02, 0.04), mats['frame'])
    # the east door, open, the light of the room in the doorway
    dx = cx + w / 2
    dy = cy - 0.25
    box('doorway', (dx + 0.005, dy, floor + 0.08 + 1.0), (0.01, 0.82, 2.0), mats['doorway'])
    box('door_frame_a', (dx + 0.03, dy - 0.45, floor + 1.1), (0.06, 0.08, 2.1), mats['frame'])
    box('door_frame_b', (dx + 0.03, dy + 0.45, floor + 1.1), (0.06, 0.08, 2.1), mats['frame'])
    box('door_frame_c', (dx + 0.03, dy, floor + 2.12), (0.06, 0.98, 0.08), mats['frame'])
    # the leaf, hinged at the south edge of the doorway, swung out by 62°
    a = math.radians(62)
    hinge = Vector((dx + 0.05, dy - 0.41, 0))
    centre = hinge + Vector((math.sin(a) * 0.41, math.cos(a) * 0.41, 0))
    box('door', (centre.x, centre.y, floor + 1.08), (0.04, 0.82, 2.0), mats['door'], rot=(0, 0, -a))
    sx_ = dx + 0.45
    box('step', (sx_, dy, (gz(sx_, dy) + floor) / 2), (0.6, 0.9, floor - gz(sx_, dy) + 0.05), mats['wood'], bevel=0.01)
    # the stove pipe, and an aerial from the roof
    cylinder('stove_pipe', (cx + 0.9, cy + 0.5, floor + h + 0.6), 0.07, 0.9, mats['steel'], verts=16)
    rod('aerial', (cx - 1.2, cy + 0.6, floor + h + 0.3), (cx - 1.2, cy + 0.6, floor + h + 1.6), 0.02, mats['mast'], round_=True)
    # light from the window and the door onto the ground
    for name, loc, rot, size, energy in (
        ('window_light', (cx - 0.55, wy - 0.2, wz), (math.radians(90), 0, 0), (0.8, 0.6), 40),
        ('door_light', (dx + 0.2, dy, floor + 1.0), (0, math.radians(90), 0), (1.9, 0.8), 55),
    ):
        light = bpy.data.lights.new(name, 'AREA')
        light.shape = 'RECTANGLE'
        light.size, light.size_y = size
        light.energy = energy
        light.color = srgb('#ffad5c')[:3]
        obj = link(bpy.data.objects.new(name, light))
        obj.location = loc
        obj.rotation_euler = rot
    return floor


MAST = (-4.1, -0.7)


def build_mast(mats):
    """A lattice mast with a red lamp on top, held by three guy wires."""
    mx, my = MAST
    base = gz(mx, my)
    top = base + 6.6
    r = 0.22
    legs = [Vector((mx + r * math.cos(a), my + r * math.sin(a), 0)) for a in (math.radians(90), math.radians(210), math.radians(330))]
    box('mast_footing', (mx, my, base - 0.05), (0.8, 0.8, 0.3), mats['concrete'], bevel=0.02)
    for i, leg in enumerate(legs):
        rod(f'mast_leg_{i}', (leg.x, leg.y, base + 0.1), (leg.x, leg.y, top), 0.035, mats['mast'])
    step = 0.55
    z = base + 0.1
    k = 0
    while z + step < top:
        for i in range(3):
            a, b = legs[i], legs[(i + 1) % 3]
            lower, upper = (a, b) if k % 2 == 0 else (b, a)
            rod(f'brace_{k}_{i}', (lower.x, lower.y, z), (upper.x, upper.y, z + step), 0.018, mats['mast'])
        k += 1
        z += step
    # the top section painted red, the lamp on top of it
    for i, leg in enumerate(legs):
        rod(f'mast_red_{i}', (leg.x, leg.y, top - 1.1), (leg.x, leg.y, top), 0.04, mats['mast_red'])
    box('mast_cap', (mx, my, top + 0.03), (0.5, 0.5, 0.06), mats['mast'])
    sphere('mast_lamp_glass', (mx, my, top + 0.14), 0.09, mats['lamp_red'])
    lamp = link(bpy.data.objects.new('mast_lamp', None))
    lamp.location = (mx, my, top + 0.14)
    light = bpy.data.lights.new('mast_light', 'POINT')
    light.color = srgb('#ff3320')[:3]
    light.energy = 6
    light.shadow_soft_size = 0.05
    link(bpy.data.objects.new('mast_light', light)).location = (mx, my, top + 0.3)
    for i, (ax, ay) in enumerate(((-4.75, 1.1), (-4.75, -2.5), (-2.55, 0.5))):
        az = gz(ax, ay)
        rod(f'guy_{i}', (mx, my, base + 4.8), (ax, ay, az + 0.05), 0.012, mats['steel'], round_=True)
        box(f'anchor_{i}', (ax, ay, az), (0.2, 0.2, 0.2), mats['concrete'])


def build_floodlight(mats):
    px, py = 3.3, 2.7
    base = gz(px, py)
    head = Vector((px, py, base + 3.3))
    rod('flood_pole', (px, py, base - 0.1), head, 0.09, mats['steel'], round_=True)
    aim = (Vector((0, 0, -0.4)) - head).normalized()
    rot = aim.to_track_quat('-Z', 'Y').to_euler()
    box('flood_housing', head + aim * 0.05, (0.42, 0.32, 0.22), mats['black_metal'], rot=rot, bevel=0.02)
    box('flood_lens', head + aim * 0.165, (0.36, 0.26, 0.01), mats['flood_lens'], rot=rot)
    light = bpy.data.lights.new('flood', 'SPOT')
    light.color = srgb('#e2eaff')[:3]
    light.energy = 900
    light.spot_size = math.radians(48)
    light.spot_blend = 0.45
    light.shadow_soft_size = 0.15
    obj = link(bpy.data.objects.new('flood', light))
    obj.location = head + aim * 0.2
    obj.rotation_euler = rot
    return head


def build_generator(mats, flood_head, floor):
    gx_, gy_ = 0.9, 3.9
    base = gz(gx_, gy_)
    box('gen_skid', (gx_, gy_, base + 0.05), (1.4, 0.8, 0.12), mats['steel'])
    box('generator', (gx_, gy_, base + 0.5), (1.2, 0.7, 0.75), mats['yellow'], bevel=0.03)
    for i in range(5):
        box(f'gen_vent_{i}', (gx_ - 0.3 + i * 0.12, gy_ - 0.355, base + 0.55), (0.06, 0.01, 0.4), mats['black_metal'])
    cylinder('gen_exhaust', (gx_ + 0.45, gy_ + 0.15, base + 1.0), 0.04, 0.35, mats['steel'], verts=12)
    hx, hy = HUT['c']

    def on_ground(x, y, lift=0.03):
        return (x, y, gz(x, y) + lift)

    out = (gx_ - 0.62, gy_, base + 0.3)
    cable('cable_hut', [out, on_ground(gx_ - 1.2, gy_ - 0.2), on_ground(hx + 1.0, hy + 0.9), (hx + HUT['w'] / 2, hy + 0.6, floor + 0.3)], 0.022, mats['rubber'])
    fx, fy = flood_head.x, flood_head.y
    cable('cable_flood', [(gx_ + 0.62, gy_ - 0.1, base + 0.3), on_ground(gx_ + 1.3, gy_ - 0.5), on_ground(fx - 0.3, fy + 0.1), (fx - 0.05, fy, gz(fx, fy) + 0.5)], 0.022, mats['rubber'])
    # and one into the hole: over the rim and down, out of sight
    pts = [
        (gx_ - 0.2, gy_ - 0.36, base + 0.25),
        on_ground(0.6, 3.0),
        on_ground(0.2, 2.0),
        on_ground(0.08, HOLE_R + 0.05, 0.04),
        (0.05, HOLE_R - 0.12, gz(0.05, HOLE_R) - 0.25),
        (0.0, HOLE_R - 0.25, -1.2),
    ]
    cable('cable_hole', pts, 0.025, mats['rubber'])
    for i, (x, y, tipped) in enumerate(((-0.4, 4.3, False), (0.05, 4.55, False), (2.2, 4.2, True))):
        z = gz(x, y)
        if tipped:
            cylinder(f'drum_{i}', (x, y, z + 0.29), 0.29, 0.88, mats['drum_olive'], rot=(math.radians(90), 0, math.radians(30)))
        else:
            cylinder(f'drum_{i}', (x, y, z + 0.44), 0.29, 0.88, mats['drum_red' if i == 0 else 'drum_olive'])


def build_stakes(mats):
    """Survey stakes in a ring round the hole, orange tape from stake to stake, one span torn."""
    count = 14
    tops = []
    for i in range(count):
        a = 2 * math.pi * i / count + 0.11
        x, y = STAKES_R * math.cos(a), STAKES_R * math.sin(a)
        z = gz(x, y)
        lean = (rng.uniform(-0.06, 0.06), rng.uniform(-0.06, 0.06), 0)
        box(f'stake_{i}', (x, y, z + 0.42), (0.045, 0.045, 0.95), mats['wood'], rot=lean)
        box(f'stake_top_{i}', (x + lean[1] * 0.4, y - lean[0] * 0.4, z + 0.84), (0.05, 0.05, 0.14), mats['orange'], rot=lean)
        tops.append(Vector((x + lean[1] * 0.3, y - lean[0] * 0.3, z + 0.72)))
    torn = 5
    for i in range(count):
        a, b = tops[i], tops[(i + 1) % count]
        if i == torn:
            # both ends hang down to the ground
            for k, (end, toward) in enumerate(((a, b), (b, a))):
                tip = end.lerp(toward, 0.3)
                tip.z = gz(tip.x, tip.y) + 0.02
                rod(f'tape_hang_{i}_{k}', end, tip, 0.006, mats['tape'])
            continue
        mid = (a + b) / 2
        mid.z -= 0.06
        rod(f'tape_{i}_a', a, mid, 0.006, mats['tape'])
        rod(f'tape_{i}_b', mid, b, 0.006, mats['tape'])


def build_theodolite(mats):
    tx, ty = 2.3, -2.5
    head = Vector((tx, ty, gz(tx, ty) + 1.35))
    for i in range(3):
        a = math.radians(40 + i * 120)
        fx, fy = tx + 0.45 * math.cos(a), ty + 0.45 * math.sin(a)
        rod(f'tripod_{i}', (fx, fy, gz(fx, fy)), head - Vector((0, 0, 0.05)), 0.03, mats['wood'])
    cylinder('theo_base', head + Vector((0, 0, 0.03)), 0.09, 0.06, mats['black_metal'], verts=24)
    aim = (Vector((0, 0, gz(0, 0))) - head).normalized()
    yaw = math.atan2(aim.y, aim.x)
    box('theo_body', head + Vector((0, 0, 0.16)), (0.14, 0.2, 0.22), mats['instrument'], rot=(0, 0, yaw), bevel=0.015)
    scope = aim.to_track_quat('Z', 'Y').to_euler()
    cylinder('theo_scope', head + Vector((0, 0, 0.22)), 0.035, 0.3, mats['black_metal'], rot=scope, verts=16)


def build_chair(mats):
    """A folding chair beside the hole, turned to face it, nobody in it."""
    cx, cy = -2.1, -1.6
    z = gz(cx, cy)
    # its front, local +y, toward the hole
    yaw = math.atan2(-cy, -cx) - math.pi / 2
    c, s = math.cos(yaw), math.sin(yaw)

    def at(lx, ly, lz):
        return Vector((cx + lx * c - ly * s, cy + lx * s + ly * c, z + lz))

    for sx in (-1, 1):
        rod(f'chair_leg_f{sx}', at(sx * 0.22, 0.22, 0), at(sx * 0.22, -0.2, 0.75), 0.022, mats['steel'], round_=True)
        rod(f'chair_leg_b{sx}', at(sx * 0.22, -0.22, 0), at(sx * 0.22, 0.18, 0.45), 0.022, mats['steel'], round_=True)
    box('chair_seat', at(0, 0.0, 0.45), (0.46, 0.4, 0.03), mats['canvas'], rot=(0, 0, yaw))
    box('chair_back', at(0, -0.2, 0.68), (0.46, 0.03, 0.26), mats['canvas'], rot=(math.radians(-8), 0, yaw))


def build_trees(mats):
    """Dead trees, bleached, without a leaf: a trunk and a few bare branches each."""
    for i, (x, y, height) in enumerate(((-4.3, 4.2, 4.6), (4.2, 1.2, 3.8), (-4.3, -4.1, 3.4), (2.6, 4.5, 4.1), (4.4, 4.4, 2.9))):
        z = gz(x, y) - 0.1
        tilt = (rng.uniform(-0.12, 0.12), rng.uniform(-0.12, 0.12))
        axis = Vector((math.sin(tilt[1]), -math.sin(tilt[0]), 1)).normalized()
        base = Vector((x, y, z))
        rot = axis.to_track_quat('Z', 'Y').to_euler()
        cylinder(f'trunk_{i}', base + axis * (height / 2), 0.12, height, mats['bark'], r2=0.025, verts=10, rot=rot)
        for k in range(4):
            h = height * rng.uniform(0.35, 0.8)
            start = base + axis * h
            a = rng.uniform(0, 2 * math.pi)
            length = rng.uniform(0.5, 1.2) * (1 - h / height + 0.3)
            end = start + Vector((math.cos(a) * length, math.sin(a) * length, length * rng.uniform(0.4, 1.0)))
            rod(f'branch_{i}_{k}', start, end, 0.035 * (1 - h / height) + 0.012, mats['bark'], round_=True)


def build_props(mats):
    hx, hy = HUT['c']
    cx_, cy_ = hx + HUT['w'] / 2 + 0.6, hy + 0.8
    box('crate', (cx_, cy_, gz(cx_, cy_) + 0.25), (0.55, 0.5, 0.5), mats['wood'], bevel=0.015, rot=(0, 0, 0.3))
    # the sign: a plate on a post, turned toward the camera
    px, py = 3.2, -1.2
    z = gz(px, py)
    rod('sign_post', (px, py, z - 0.1), (px, py, z + 1.3), 0.06, mats['wood'])
    yaw = math.radians(40)
    nx, ny = math.sin(yaw), -math.cos(yaw)
    box('sign_plate', (px + 0.04 * nx, py + 0.04 * ny, z + 1.15), (0.62, 0.02, 0.36), mats['plate'], rot=(0, 0, yaw))
    text_mesh('sign_text', 'STATION 4\nKEEP CLEAR', (px + 0.052 * nx, py + 0.052 * ny, z + 1.15), 0.085, mats['plate_ink'], rot=(math.pi / 2, 0, yaw))
    for i in range(18):
        a = rng.uniform(0, 2 * math.pi)
        r = rng.uniform(1.8, 4.7)
        x, y = r * math.cos(a), r * math.sin(a)
        if abs(x) > HALF - 0.2 or abs(y) > HALF - 0.2:
            continue
        s = rng.uniform(0.06, 0.2)
        sphere(f'rock_{i}', (x, y, gz(x, y) + s * 0.2), s, mats['rock'], scale=(1.0, rng.uniform(0.7, 1.2), rng.uniform(0.45, 0.7)), subdivisions=1)


def build_lights(scene):
    world = bpy.data.worlds.new('night')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = srgb('#121a2c')
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 0.9
    scene.world = world
    moon = bpy.data.lights.new('moon', 'SUN')
    moon.color = srgb('#a9bcff')[:3]
    moon.energy = 0.55
    moon.angle = math.radians(1.0)
    obj = link(bpy.data.objects.new('moon', moon))
    # from the south west, 35° up: the cut sides toward the camera catch it
    obj.rotation_euler = (math.radians(55), 0, math.radians(-45))


# --- the diorama: camera -----------------------------------------------------------------------


def look_at(obj, target):
    d = Vector(target) - obj.location
    obj.rotation_mode = 'QUATERNION'
    obj.rotation_quaternion = d.to_track_quat('-Z', 'Y')


CAMERA = dict(loc=(12.0, -15.0, 8.4), target=(-0.5, 0.4, -0.15), lens=26.0)


def build_camera():
    cam = bpy.data.cameras.new('camera_station')
    cam.lens = CAMERA['lens']
    cam.sensor_fit = 'HORIZONTAL'
    cam.sensor_width = 36
    cam.clip_start = 0.05
    cam.clip_end = 80.0
    obj = link(bpy.data.objects.new('camera_station', cam))
    obj.location = CAMERA['loc']
    look_at(obj, CAMERA['target'])
    return obj


# --- the diorama: bake and export --------------------------------------------------------------


def all_meshes():
    return [o for o in bpy.context.scene.objects if o.type == 'MESH']


def join_static():
    """Applies every modifier and joins every mesh into one object, `station`."""
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
    obj.name = 'station'
    obj.data.name = 'station'
    return obj


# texels per metre relative to the rest, by material: the cut sides are large and plain, the
# sign carries text, the window and the lamps are small and bright
DENSITY = {
    'strata': 0.7,
    'hole_wall': 0.6,
    'plate': 4.0,
    'plate_ink': 4.0,
    'window': 1.5,
    'mast': 0.8,
}


def unwrap(obj):
    """One UV atlas over the whole scene, its islands at an even density but for `DENSITY`."""
    me = obj.data
    for layer in list(me.uv_layers):
        me.uv_layers.remove(layer)
    me.uv_layers.active = me.uv_layers.new(name='bake')
    activate(obj)
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(60), island_margin=0.0, area_weight=0.0, scale_to_bounds=False)
    bpy.ops.object.mode_set(mode='OBJECT')
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
    settings = scene.render.bake
    settings.margin = 8
    settings.margin_type = 'EXTEND'
    activate(obj)

    lit = bake_target(obj, 'lit')
    scene.cycles.samples = BAKE_SAMPLES
    settings.use_pass_direct = True
    settings.use_pass_indirect = True
    settings.use_pass_diffuse = True
    settings.use_pass_glossy = False
    settings.use_pass_transmission = True
    settings.use_pass_emit = True
    bpy.ops.object.bake(type='COMBINED')

    albedo = bake_target(obj, 'albedo')
    scene.cycles.samples = 16
    settings.use_pass_direct = False
    settings.use_pass_indirect = False
    settings.use_pass_color = True
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
    image_settings = scene.render.image_settings
    image_settings.file_format = 'PNG'
    image_settings.color_mode = 'RGB'
    image_settings.color_depth = '8'
    image_settings.compression = 100
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
    image.name = 'station'
    mat = bpy.data.materials.new('station')
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = image
    tex.interpolation = 'Linear'
    nt.links.new(tex.outputs['Color'], nt.nodes['Material Output'].inputs['Surface'])
    obj.data.materials.clear()
    obj.data.materials.append(mat)


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
        export_animations=False,
    )


def render_views(scene, cam):
    scene.render.resolution_x, scene.render.resolution_y = 1280, 720
    scene.cycles.samples = 128
    scene.cycles.use_denoising = True
    scene.render.image_settings.file_format = 'PNG'
    scene.camera = cam
    scene.render.filepath = os.path.join(OUT, 'view-station.png')
    bpy.ops.render.render(write_still=True)
    top = bpy.data.cameras.new('top')
    top.type = 'ORTHO'
    top.ortho_scale = 2 * HALF + 2
    top_obj = link(bpy.data.objects.new('top', top))
    top_obj.location = (0, 0, 20)
    scene.camera = top_obj
    scene.render.resolution_x = scene.render.resolution_y = 720
    scene.render.filepath = os.path.join(OUT, 'view-top.png')
    bpy.ops.render.render(write_still=True)


def build_diorama():
    scene = reset()
    scene.render.resolution_x = 1920
    scene.render.resolution_y = 1080
    scene.view_settings.view_transform = 'AgX'
    scene.view_settings.look = 'AgX - Medium High Contrast'
    scene.view_settings.exposure = 1.5
    scene.cycles.max_bounces = 6
    scene.cycles.diffuse_bounces = 4
    scene.cycles.glossy_bounces = 2
    scene.cycles.sample_clamp_indirect = 4
    mats = materials()
    build_lights(scene)
    build_block(mats)
    floor = build_hut(mats)
    build_mast(mats)
    head = build_floodlight(mats)
    build_generator(mats, head, floor)
    build_stakes(mats)
    build_theodolite(mats)
    build_chair(mats)
    build_trees(mats)
    build_props(mats)
    cam = build_camera()
    if VIEWS:
        render_views(scene, cam)
        return
    obj = join_static()
    unwrap(obj)
    lit, albedo = bake(scene, obj)
    png = denoise(scene, lit, albedo, os.path.join(OUT, 'station.png'))
    unlit(obj, png)
    for o in list(scene.objects):
        if o.type == 'LIGHT':
            bpy.data.objects.remove(o)
    export(os.path.join(OUT, 'station.glb'))


def main():
    os.makedirs(OUT, exist_ok=True)
    if not ONLY_DIORAMA:
        build_map()
    if not ONLY_MAP:
        build_diorama()


main()


