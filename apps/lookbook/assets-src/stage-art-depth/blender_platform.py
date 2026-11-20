"""Runs inside Blender: builds "the drowned platform" — an underground station at night whose track
bed has flooded, a figure waiting under an umbrella at the platform edge — and renders it plane by
plane through one perspective camera, so that the renders lie on one canvas as the planes of a
multiplane camera:

    blender -b --factory-startup --python blender_platform.py -- <out-dir> [--draft] [--cpu] [--only=<layer>,…] [--composite]

`--draft` renders with an eighth of the samples, `--cpu` on the CPU even where Cycles finds a GPU,
`--only` the layers named, `--composite` the whole scene in one picture as well (`composite.png`,
for a look at the composition; the build does not use it).

Writes into `<out-dir>` one picture per layer, each 960 × 540 and transparent around its plane:
`bore.png` (the inside of the tunnel), `train-light.png` (the light of a train in the tunnel, on
black: the light alone), `end-wall.png` (the wall at the end of the hall with the mouth of the
tunnel, opaque over the whole canvas), `vault.png` (the walls, the ceiling and the far part of the
platform), `pillars.png`, `water.png` (the flooded track bed), `ripples-<n>.png` (a patch of the
water with rings from two drips, a loop of `RIPPLE_FRAMES` frames), `platform.png` (the near part
of the platform), `figure.png` and `cables.png`; and `layout.json` — the canvas, the distance of
the camera in canvas pixels, the depth of each plane and the canvas pixel of the train's lights.

**The canvas and the depth.** The camera stands `PLANE` metres in front of the plane of the
figure, the picture plane of the art, and looks straight down the hall. Its field of view is the
one of a `ParallaxProjection` whose camera stands `CAMERA_PX` canvas pixels in front of its plane,
so one metre on the picture plane is `CAMERA_PX / PLANE` canvas pixels, and a thing `L` metres from
the camera lies `(L − PLANE) · CAMERA_PX / PLANE` canvas pixels behind the picture plane: the depth
of its layer. Each layer is rendered alone — the others invisible to the camera, yet there for the
light, the shadows and the reflections —, so a far plane is whole behind the near ones and shows
what they hide once the camera moves.
"""

import json
import math
import os
import sys

import bmesh
import bpy
from mathutils import Matrix, Vector

ARGS = sys.argv[sys.argv.index('--') + 1 :] if '--' in sys.argv else []
OUT = ARGS[0] if ARGS and not ARGS[0].startswith('--') else '/tmp/stage-art-depth'
DRAFT = '--draft' in ARGS
CPU = '--cpu' in ARGS
COMPOSITE = '--composite' in ARGS
ONLY = next((a[len('--only=') :].split(',') for a in ARGS if a.startswith('--only=')), None)

WIDTH, HEIGHT = 960, 540
CAMERA_PX = 600  # the distance of the camera to the picture plane, in canvas pixels
PLANE = 8.0  # the same in metres
PX_PER_M = CAMERA_PX / PLANE
CAM = Vector((0.4, 0.0, 2.15))
RIPPLE_FRAMES = 8

WATER_Z = 0.35
DECK_Z = 1.05
EDGE_X = 1.4  # the edge of the platform; the track bed lies to the left of it
LEFT_X, RIGHT_X = -4.5, 7.5
CEILING_Z = 5.1
END_Y = 24.0  # the wall at the end of the hall
TUNNEL = dict(cx=-1.3, zc=2.0, r=2.3)  # the bore: its middle, the middle of its arch, its radius
NEAR_PLATFORM_END = 12.0  # the near part of the platform fades out over the last three metres before it
NEAR_FADE = 3.0
WATER_SPLIT = 9.0  # the near part of the flood reaches under the deck as far as the near platform is opaque
TRAIN = Vector((-1.3, 50.0, 1.45))  # between the two lights of the train

# the planes, by their distance from the camera in metres: a layer's depth is worked out from it
GROUPS = {
    'tunnel': 60.0,
    'mouth': END_Y,
    'hall': 15.2,
    'flood': 11.2,
    'edge': PLANE,
    'foreground': 5.6,
}
# the layers bottom first, each with its group
LAYERS = [
    ('bore', 'tunnel'),
    ('train-light', 'tunnel'),
    ('end-wall', 'mouth'),
    ('vault', 'hall'),
    ('pillars', 'hall'),
    ('water', 'flood'),
    ('ripples', 'flood'),
    ('platform', 'edge'),
    ('figure', 'edge'),
    ('cables', 'foreground'),
]



def pixel(p):
    """The canvas pixel the camera sees the point `p` at, y down."""
    v = Vector(p) - CAM
    return (WIDTH / 2 + v.x * CAMERA_PX / v.y, HEIGHT / 2 - v.z * CAMERA_PX / v.y)


def depth_px(distance):
    return round((distance - PLANE) * PX_PER_M)


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
    scene.view_settings.exposure = 1.5
    scene.cycles.seed = 11
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.max_bounces = 8
    scene.cycles.glossy_bounces = 4
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.volume_bounces = 1
    scene.cycles.sample_clamp_indirect = 4
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
    cam.data.type = 'PERSP'
    cam.data.sensor_fit = 'VERTICAL'
    cam.data.angle_y = 2 * math.atan((HEIGHT / 2) / CAMERA_PX)
    cam.data.clip_start = 0.1
    cam.data.clip_end = 200
    cam.rotation_euler = (math.pi / 2, 0, 0)  # straight along +y, level
    cam.location = CAM
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


def box(name, c, s, material=None, bevel=0.0, rot=(0, 0, 0)):
    bpy.ops.mesh.primitive_cube_add(size=1, location=c, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = s
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, material, bevel)


def span(name, x0, x1, y0, y1, z0, z1, material=None, bevel=0.0):
    return box(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), material, bevel)


def cylinder(name, c, r, depth, material=None, rot=(0, 0, 0), verts=32, r2=None, bevel=0.0):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=c, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=c, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, bevel, smooth=35)


def rod(name, a, b, r, material=None, verts=16):
    a, b = Vector(a), Vector(b)
    v = b - a
    obj = cylinder(name, (a + b) / 2, r, v.length, material, verts=verts)
    obj.rotation_euler = v.to_track_quat('Z', 'Y').to_euler()
    return obj


def sphere(name, c, r, material=None, scale=(1, 1, 1), segments=32, rings=16):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=r, location=c)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    return finish(obj, material, smooth=80)


def tube(name, points, r, material, resolution=24):
    """A round tube along a smooth curve through `points`."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = r
    curve.bevel_resolution = 4
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


def sag(a, b, drop, steps=8):
    """Points along a hanging cable from `a` to `b` that sags by `drop` in the middle."""
    a, b = Vector(a), Vector(b)
    return [a.lerp(b, i / steps) - Vector((0, 0, drop * 4 * (i / steps) * (1 - i / steps))) for i in range(steps + 1)]


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


def quad(name, corners, material):
    bm = bmesh.new()
    bm.faces.new([bm.verts.new(c) for c in corners])
    return mesh_from_bmesh(name, bm, material)


def text(name, body, c, size, material, rot, extrude=0.004):
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.align_x = 'CENTER'
    curve.align_y = 'CENTER'
    curve.extrude = extrude
    obj = link(bpy.data.objects.new(name, curve))
    obj.location = c
    obj.rotation_euler = rot
    obj.data.materials.append(material)
    return obj


def point_light(name, loc, energy, color, radius=0.05):
    light = bpy.data.lights.new(name, 'POINT')
    light.energy = energy
    light.color = color
    light.shadow_soft_size = radius
    obj = link(bpy.data.objects.new(name, light))
    obj.location = loc
    return obj


def spot_light(name, loc, rot, energy, color, size_deg, blend=0.6, radius=0.05):
    light = bpy.data.lights.new(name, 'SPOT')
    light.energy = energy
    light.color = color
    light.spot_size = math.radians(size_deg)
    light.spot_blend = blend
    light.shadow_soft_size = radius
    obj = link(bpy.data.objects.new(name, light))
    obj.location = loc
    obj.rotation_euler = rot
    return obj


def arch_profile(r, cx=None, zc=None, bottom=-0.2, steps=40):
    """The section of the tunnel, from its right foot over the arch to its left foot, in x and z."""
    cx = TUNNEL['cx'] if cx is None else cx
    zc = TUNNEL['zc'] if zc is None else zc
    pts = [(cx + r, bottom)]
    for i in range(steps + 1):
        a = math.pi * i / steps
        pts.append((cx + r * math.cos(a), zc + r * math.sin(a)))
    pts.append((cx - r, bottom))
    return pts


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

    def feed(self, sock, v):
        if isinstance(v, (int, float, tuple)):
            sock.default_value = v
        else:
            self.link(v, sock)

    def set(self, **inputs):
        for k, v in inputs.items():
            self.bsdf.inputs[k.replace('_', ' ')].default_value = v
        return self

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

    def position(self):
        return self.node('ShaderNodeNewGeometry').outputs['Position']

    def xyz(self, vec):
        n = self.node('ShaderNodeSeparateXYZ')
        self.link(vec, n.inputs[0])
        return n.outputs['X'], n.outputs['Y'], n.outputs['Z']

    def vec(self, x, y, z):
        n = self.node('ShaderNodeCombineXYZ')
        for sock, v in zip(n.inputs, (x, y, z)):
            self.feed(sock, v)
        return n.outputs[0]

    def noise(self, scale, detail=4.0, rough=0.55, vec=None):
        n = self.node('ShaderNodeTexNoise')
        n.inputs['Scale'].default_value = scale
        n.inputs['Detail'].default_value = detail
        n.inputs['Roughness'].default_value = rough
        self.link(vec if vec is not None else self.position(), n.inputs['Vector'])
        return n.outputs['Fac']

    def ramp(self, value, lo, hi):
        """0 below `lo`, 1 above `hi`, smooth between."""
        n = self.node('ShaderNodeMapRange', interpolation_type='SMOOTHSTEP')
        self.feed(n.inputs['Value'], value)
        n.inputs['From Min'].default_value = lo
        n.inputs['From Max'].default_value = hi
        return n.outputs['Result']

    def ao(self, distance=0.2):
        n = self.node('ShaderNodeAmbientOcclusion', samples=8)
        n.inputs['Distance'].default_value = distance
        return n.outputs['AO']

    def bump(self, height, strength=0.2, distance=0.01):
        n = self.node('ShaderNodeBump')
        n.inputs['Strength'].default_value = strength
        n.inputs['Distance'].default_value = distance
        self.link(height, n.inputs['Height'])
        self.link(n.outputs['Normal'], self.bsdf.inputs['Normal'])
        return n

    def fade_beyond_y(self, y_full, y_gone):
        """Transparent from `y_full` on, gone at `y_gone`: the near part of a thing that a far layer
        carries on, so the seam between the two planes is soft."""
        _, y, _ = self.xyz(self.position())
        alpha = self.math('SUBTRACT', 1.0, self.ramp(y, y_full, y_gone))
        transparent = self.node('ShaderNodeBsdfTransparent')
        mixed = self.node('ShaderNodeMixShader')
        self.link(alpha, mixed.inputs[0])
        self.link(transparent.outputs[0], mixed.inputs[1])
        self.link(self.bsdf.outputs[0], mixed.inputs[2])
        self.link(mixed.outputs[0], self.out.inputs['Surface'])


def wall_tiles(name='tiles', fade=None):
    """Glazed cream tiles, a band of green ones at shoulder height, grime running down, and the
    dark tide marks of the flood up to the height it reached."""
    m = Mat(name)
    x, y, z = m.xyz(m.position())
    along = m.math('ADD', x, y)
    tiles = m.node('ShaderNodeTexBrick', offset=0.5, offset_frequency=2)
    tiles.inputs['Scale'].default_value = 1.0
    tiles.inputs['Mortar Size'].default_value = 0.007
    tiles.inputs['Brick Width'].default_value = 0.3
    tiles.inputs['Row Height'].default_value = 0.15
    tiles.inputs['Color1'].default_value = (0.50, 0.47, 0.37, 1)
    tiles.inputs['Color2'].default_value = (0.42, 0.40, 0.31, 1)
    tiles.inputs['Mortar'].default_value = (0.07, 0.065, 0.055, 1)
    m.link(m.vec(along, z, 0.0), tiles.inputs['Vector'])
    color = tiles.outputs['Color']
    band = m.math('MULTIPLY', m.ramp(z, 2.05, 2.06), m.math('SUBTRACT', 1.0, m.ramp(z, 2.34, 2.35)))
    color = m.mix(m.math('MULTIPLY', band, m.math('SUBTRACT', 1.0, tiles.outputs['Fac'])), color, (0.03, 0.11, 0.08, 1))
    streaks = m.noise(1.0, 3, 0.6, m.vec(m.math('MULTIPLY', along, 6.0), m.math('MULTIPLY', z, 0.25), 0.0))
    grime = m.math('MULTIPLY', m.math('SUBTRACT', streaks, 0.38), 1.8, clamp=True)
    color = m.mix(m.math('MULTIPLY', grime, 0.7), color, (0.12, 0.10, 0.07, 1))
    tide = m.math('ADD', 1.55, m.math('MULTIPLY', m.noise(1.6, 4, 0.6), 0.5))
    flooded = m.math('SUBTRACT', 1.0, m.ramp(m.math('SUBTRACT', z, tide), -0.05, 0.05))
    color = m.mix(m.math('MULTIPLY', flooded, 0.92), color, (0.035, 0.045, 0.03, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    rough = m.math('ADD', 0.12, m.math('MULTIPLY', m.math('ADD', grime, flooded), 0.35))
    m.link(rough, m.bsdf.inputs['Roughness'])
    m.bump(tiles.outputs['Fac'], 0.35, 0.01)
    if fade:
        m.fade_beyond_y(*fade)
    return m.m


def concrete(name, base=(0.11, 0.105, 0.1), wet=0.5, fade=None, yellow_line=False):
    """Concrete, wet in patches that mirror the lamps; with the yellow line of a platform edge."""
    m = Mat(name)
    x, _, _ = m.xyz(m.position())
    n = m.noise(2.2, 6, 0.62)
    color = m.mix(m.noise(9, 5, 0.6), base + (1,), tuple(c * 0.6 for c in base) + (1,))
    puddles = m.ramp(m.noise(0.7, 3, 0.5), 1.0 - wet * 0.5 - 0.05, 1.0 - wet * 0.5 + 0.05)
    color = m.mix(m.math('MULTIPLY', puddles, 0.5), color, tuple(c * 0.45 for c in base) + (1,))
    if yellow_line:
        line = m.math('MULTIPLY', m.ramp(x, EDGE_X + 0.34, EDGE_X + 0.35), m.math('SUBTRACT', 1.0, m.ramp(x, EDGE_X + 0.49, EDGE_X + 0.5)))
        worn = m.math('MULTIPLY', line, m.ramp(m.noise(14, 4, 0.6), 0.32, 0.5))
        color = m.mix(worn, color, (0.55, 0.38, 0.03, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.link(m.math('ADD', 0.04, m.math('MULTIPLY', m.math('SUBTRACT', 1.0, puddles), 0.6)), m.bsdf.inputs['Roughness'])
    m.bump(n, 0.12, 0.02)
    if fade:
        m.fade_beyond_y(*fade)
    return m.m


def edge_face(name, fade=None):
    """The face of the platform above the flood: stained concrete, green slime at the waterline."""
    m = Mat(name)
    _, _, z = m.xyz(m.position())
    color = m.mix(m.noise(6, 5, 0.6), (0.075, 0.07, 0.065, 1), (0.04, 0.038, 0.035, 1))
    slime = m.math('SUBTRACT', 1.0, m.ramp(z, WATER_Z + 0.08, WATER_Z + 0.32 + 0.2 * 0.5))
    color = m.mix(slime, color, (0.03, 0.06, 0.025, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.link(m.math('SUBTRACT', 0.55, m.math('MULTIPLY', slime, 0.45)), m.bsdf.inputs['Roughness'])
    m.bump(m.noise(20, 4), 0.2)
    if fade:
        m.fade_beyond_y(*fade)
    return m.m


def painted_iron(name, base=(0.035, 0.075, 0.06)):
    """Cast iron under old green paint, rust bleeding out of the joints."""
    m = Mat(name)
    rust = m.math('MULTIPLY', m.math('SUBTRACT', 1.0, m.ao(0.15)), m.noise(7, 6, 0.65))
    rust = m.math('MULTIPLY', m.math('SUBTRACT', rust, 0.15), 2.5, clamp=True)
    color = m.mix(m.noise(3, 4, 0.6), base + (1,), tuple(c * 0.7 for c in base) + (1,))
    color = m.mix(rust, color, (0.12, 0.05, 0.02, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.link(m.math('ADD', 0.32, m.math('MULTIPLY', rust, 0.4)), m.bsdf.inputs['Roughness'])
    m.set(Metallic=0.2)
    m.bump(m.noise(40, 3), 0.1)
    return m.m


def sooty_brick(name):
    m = Mat(name)
    x, y, z = m.xyz(m.position())
    bricks = m.node('ShaderNodeTexBrick', offset=0.5, offset_frequency=2)
    bricks.inputs['Scale'].default_value = 1.0
    bricks.inputs['Mortar Size'].default_value = 0.012
    bricks.inputs['Brick Width'].default_value = 0.22
    bricks.inputs['Row Height'].default_value = 0.075
    bricks.inputs['Color1'].default_value = (0.08, 0.05, 0.035, 1)
    bricks.inputs['Color2'].default_value = (0.05, 0.035, 0.028, 1)
    bricks.inputs['Mortar'].default_value = (0.03, 0.03, 0.03, 1)
    # the bricks run round the bore: along its arch and along its length
    m.link(m.vec(m.math('ADD', m.math('MULTIPLY', x, 0.7), z), y, 0.0), bricks.inputs['Vector'])
    m.link(bricks.outputs['Color'], m.bsdf.inputs['Base Color'])
    m.link(m.math('ADD', 0.18, m.math('MULTIPLY', m.noise(3, 3), 0.4)), m.bsdf.inputs['Roughness'])
    m.bump(bricks.outputs['Fac'], 0.4)
    return m.m


def water(name, phase=None):
    """Black water, still but for a breath of noise. With `phase`, rings from two drips spread on
    it; the node `ripple_phase` sets how far, and the rings fade out towards the rim of the patch,
    whose alpha falls to 0 there, so that the patch lies on the still water without a seam."""
    m = Mat(name)
    m.set(Base_Color=(0.006, 0.009, 0.01, 1), Roughness=0.025, IOR=1.33, Specular_IOR_Level=0.6)
    pos = m.position()
    height = m.math('MULTIPLY', m.noise(1.4, 3, 0.5), 0.6)
    if phase is not None:
        x, y, _ = m.xyz(pos)
        value = m.node('ShaderNodeValue', name='ripple_phase', label='ripple_phase')
        value.outputs[0].default_value = phase
        rings = None
        for (dx, dy, offset, amp) in RIPPLE_DRIPS:
            r = m.math('SQRT', m.math('ADD', m.math('POWER', m.math('SUBTRACT', x, dx), 2.0), m.math('POWER', m.math('SUBTRACT', y, dy), 2.0)))
            wave = m.math('SINE', m.math('SUBTRACT', m.math('MULTIPLY', r, 2 * math.pi / RIPPLE_WAVELENGTH), m.math('ADD', value.outputs[0], offset)))
            fall = m.math('MULTIPLY', amp, m.math('EXPONENT', m.math('MULTIPLY', r, -1.0)))
            rings = m.math('MULTIPLY', wave, fall) if rings is None else m.math('ADD', rings, m.math('MULTIPLY', wave, fall))
        cx, cy, rr = RIPPLE_PATCH
        r = m.math('SQRT', m.math('ADD', m.math('POWER', m.math('SUBTRACT', x, cx), 2.0), m.math('POWER', m.math('DIVIDE', m.math('SUBTRACT', y, cy), 1.6), 2.0)))
        inside = m.math('SUBTRACT', 1.0, m.ramp(r, rr * 0.6, rr))
        # the rings die out towards the rim, where the patch is the still water it lies on
        height = m.math('ADD', height, m.math('MULTIPLY', rings, m.math('MULTIPLY', inside, inside)))
        transparent = m.node('ShaderNodeBsdfTransparent')
        mixed = m.node('ShaderNodeMixShader')
        m.link(inside, mixed.inputs[0])
        m.link(transparent.outputs[0], mixed.inputs[1])
        m.link(m.bsdf.outputs[0], mixed.inputs[2])
        m.link(mixed.outputs[0], m.out.inputs['Surface'])
    m.bump(height, 0.06, 0.05)
    return m.m


# the rings: the drips by x, y in metres, their phase offset and their strength; a ring every
# RIPPLE_WAVELENGTH metres; the patch they lie in, an ellipse longer along y, by its middle and radius
RIPPLE_DRIPS = [(-0.35, 7.4, 0.0, 1.0), (0.45, 9.9, 2.1, 0.8)]
RIPPLE_WAVELENGTH = 0.28
RIPPLE_PATCH = (-0.4, 8.6, 1.7)


def plain(name, base, rough=0.5, metallic=0.0, emission=None, strength=0.0, coat=0.0):
    m = Mat(name)
    m.set(Base_Color=base + (1,), Roughness=rough, Metallic=metallic, Coat_Weight=coat)
    if emission is not None:
        m.set(Emission_Color=emission + (1,), Emission_Strength=strength)
    return m.m


def umbrella_cloth():
    """Red cloth that the lamp above glows through."""
    m = Mat('umbrella')
    m.set(Base_Color=(0.32, 0.02, 0.015, 1), Roughness=0.55, Sheen_Weight=0.4)
    translucent = m.node('ShaderNodeBsdfTranslucent')
    translucent.inputs['Color'].default_value = (0.9, 0.12, 0.04, 1)
    mixed = m.node('ShaderNodeMixShader')
    mixed.inputs[0].default_value = 0.35
    m.link(m.bsdf.outputs[0], mixed.inputs[1])
    m.link(translucent.outputs[0], mixed.inputs[2])
    m.link(mixed.outputs[0], m.out.inputs['Surface'])
    return m.m


def materials():
    sodium = (1.0, 0.52, 0.18)
    return {
        'tiles': wall_tiles(),
        'ceiling': concrete('ceiling', (0.05, 0.05, 0.048), wet=0.2),
        'deck_far': concrete('deck_far', yellow_line=True),
        'deck_near': concrete('deck_near', yellow_line=True, fade=(NEAR_PLATFORM_END - NEAR_FADE, NEAR_PLATFORM_END)),
        'coping_far': concrete('coping_far', (0.2, 0.19, 0.17), wet=0.3),
        'coping_near': concrete('coping_near', (0.2, 0.19, 0.17), wet=0.3, fade=(NEAR_PLATFORM_END - NEAR_FADE, NEAR_PLATFORM_END)),
        'face_far': edge_face('face_far'),
        'face_near': edge_face('face_near', fade=(NEAR_PLATFORM_END - NEAR_FADE, NEAR_PLATFORM_END)),
        'iron': painted_iron('iron'),
        'beam': painted_iron('beam', (0.03, 0.035, 0.035)),
        'brick': sooty_brick('brick'),
        'arch': concrete('arch', (0.09, 0.085, 0.08), wet=0.2),
        'water': water('water'),
        'ripples': water('ripples', 0.0),
        'cable': plain('cable', (0.012, 0.012, 0.014), 0.3, coat=0.6),
        'copper': plain('copper', (0.55, 0.25, 0.12), 0.35, 1.0),
        'shade': plain('shade', (0.02, 0.03, 0.028), 0.35, 0.6),
        'shade_inside': plain('shade_inside', (0.6, 0.55, 0.45), 0.4),
        'bulb_sodium': plain('bulb_sodium', (1, 0.6, 0.3), 0.2, emission=sodium, strength=40.0),
        'bulb_dead': plain('bulb_dead', (0.2, 0.18, 0.15), 0.1, coat=1.0),
        'bulb_cold': plain('bulb_cold', (0.8, 0.9, 1), 0.2, emission=(0.62, 0.86, 1.0), strength=30.0),
        'signal_red': plain('signal_red', (1, 0.1, 0.05), 0.2, emission=(1.0, 0.06, 0.03), strength=60.0),
        'signal_off': plain('signal_off', (0.05, 0.08, 0.05), 0.15, coat=1.0),
        'tube_cold': plain('tube_cold', (0.8, 0.9, 1), 0.2, emission=(0.55, 0.85, 1.0), strength=12.0),
        'enamel_blue': plain('enamel_blue', (0.012, 0.04, 0.2), 0.25, coat=0.8),
        'enamel_white': plain('enamel_white', (0.75, 0.75, 0.72), 0.3, coat=0.8),
        'coat': plain('coat', (0.03, 0.04, 0.045), 0.75),
        'trousers': plain('trousers', (0.02, 0.02, 0.022), 0.8),
        'shoe': plain('shoe', (0.015, 0.012, 0.01), 0.3, coat=0.5),
        'skin': plain('skin', (0.42, 0.28, 0.22), 0.55),
        'hair': plain('hair', (0.02, 0.015, 0.012), 0.5),
        'scarf': plain('scarf', (0.55, 0.42, 0.12), 0.8),
        'umbrella': umbrella_cloth(),
        'case': plain('case', (0.16, 0.09, 0.05), 0.45, coat=0.3),
        'wood': plain('wood', (0.09, 0.055, 0.03), 0.6),
        'black': plain('black', (0.0, 0.0, 0.0), 1.0),
        'headlight': plain('headlight', (1, 1, 1), 0.2, emission=(1.0, 0.9, 0.75), strength=220.0),
    }


# --- the station ------------------------------------------------------------------------------


def build_bore(m):
    """The inside of the tunnel beyond the end wall: a brick bore over black water, its far end
    lost in the dark, two cold work lamps on its wall and cables along it."""
    r = TUNNEL['r']
    y0, y1 = END_Y - 0.4, 62.0
    bm = bmesh.new()
    prof = arch_profile(r)
    rings = []
    steps = 24
    for i in range(steps + 1):
        y = y0 + (y1 - y0) * i / steps
        rings.append([bm.verts.new((x, y, z)) for x, z in prof])
    for i in range(steps):
        for j in range(len(prof) - 1):
            bm.faces.new((rings[i][j], rings[i + 1][j], rings[i + 1][j + 1], rings[i][j + 1]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bore = mesh_from_bmesh('bore', bm, m['brick'], smooth=40)
    bore.data.flip_normals()
    for k in range(int((y1 - y0) / 3.0)):
        y = y0 + 1.5 + k * 3.0
        bm = bmesh.new()
        outer = arch_profile(r + 0.01, steps=40)
        inner = arch_profile(r - 0.1, steps=40)
        front = [bm.verts.new((x, y, z)) for x, z in outer]
        front_in = [bm.verts.new((x, y, z)) for x, z in inner]
        back_in = [bm.verts.new((x, y + 0.3, z)) for x, z in inner]
        for j in range(len(outer) - 1):
            bm.faces.new((front[j], front[j + 1], front_in[j + 1], front_in[j]))
            bm.faces.new((front_in[j], front_in[j + 1], back_in[j + 1], back_in[j]))
        mesh_from_bmesh(f'bore_rib_{k}', bm, m['arch'], smooth=40)
    # a collar round the mouth, behind the end wall: hidden at rest, it fills the edge of the mouth
    # when the camera moves and the deep bore drifts against the wall
    bm = bmesh.new()
    outer = arch_profile(r + 0.9, bottom=-0.2)
    inner = arch_profile(r, bottom=-0.2)
    yc = END_Y + 0.45
    ov = [bm.verts.new((x, yc, z)) for x, z in outer]
    iv = [bm.verts.new((x, yc, z)) for x, z in inner]
    for j in range(len(outer) - 1):
        bm.faces.new((ov[j], ov[j + 1], iv[j + 1], iv[j]))
    mesh_from_bmesh('bore_collar', bm, m['brick'])
    cap = quad('bore_end', [(-6, y1 - 0.1, -1), (4, y1 - 0.1, -1), (4, y1 - 0.1, 6), (-6, y1 - 0.1, 6)], m['black'])
    cap.visible_shadow = False
    quad('bore_water', [(TUNNEL['cx'] - r, y0, WATER_Z), (TUNNEL['cx'] + r, y0, WATER_Z), (TUNNEL['cx'] + r, y1, WATER_Z), (TUNNEL['cx'] - r, y1, WATER_Z)], m['water'])
    left = TUNNEL['cx'] - r + 0.08
    for k, z in enumerate((1.35, 1.5, 1.62)):
        tube(f'bore_cable_{k}', [Vector((left, y0, z)), Vector((left + 0.02, 40, z - 0.05)), Vector((left, y1, z))], 0.025, m['cable'])
    for k, y in enumerate((31.0, 41.0)):
        x = TUNNEL['cx'] + r - 0.12
        span(f'work_lamp_{k}', x - 0.06, x, y - 0.18, y + 0.18, 2.55, 2.65, m['bulb_cold'])
        point_light(f'work_lamp_light_{k}', (x - 0.2, y, 2.55), 6.0, (0.6, 0.85, 1.0))


def build_train(m):
    """The lights of a train far down the bore, with a breath of haze for their beam: rendered
    alone, on black, as the light layer the demo dollies through the tunnel."""
    for k, dx in enumerate((-0.55, 0.55)):
        cylinder(f'headlight_{k}', TRAIN + Vector((dx, 0, 0)), 0.12, 0.05, m['headlight'], rot=(math.pi / 2, 0, 0))
    spot_light('train_beam', TRAIN + Vector((0, 0.3, 0.1)), (-math.pi / 2, 0, 0), 700, (1.0, 0.9, 0.75), 50, 0.9, 0.3)
    # a ball of haze round the lamps, thick at them and thinning to nothing at its rim, cut at the
    # waterline: the light is a halo with no edge
    reach = 2.3
    haze = sphere('train_haze', TRAIN, reach, None, segments=24, rings=12)
    hm = bpy.data.materials.new('haze')
    hm.use_nodes = True
    nt = hm.node_tree
    nt.nodes.remove(nt.nodes['Principled BSDF'])
    vol = nt.nodes.new('ShaderNodeVolumePrincipled')
    vol.inputs['Color'].default_value = (0.8, 0.8, 0.8, 1)
    vol.inputs['Anisotropy'].default_value = 0.6

    def op(kind, a, b):
        n = nt.nodes.new('ShaderNodeMath')
        n.operation = kind
        for i, v in enumerate((a, b)):
            if isinstance(v, (int, float)):
                n.inputs[i].default_value = v
            elif v is not None:
                nt.links.new(v, n.inputs[i])
        return n.outputs[0]

    geo = nt.nodes.new('ShaderNodeNewGeometry')
    dist = nt.nodes.new('ShaderNodeVectorMath')
    dist.operation = 'DISTANCE'
    dist.inputs[1].default_value = TRAIN
    nt.links.new(geo.outputs['Position'], dist.inputs[0])
    sep = nt.nodes.new('ShaderNodeSeparateXYZ')
    nt.links.new(geo.outputs['Position'], sep.inputs[0])
    falloff = 0.85  # metres for the haze to thin by e
    thick = op('EXPONENT', op('MULTIPLY', dist.outputs['Value'], -1 / falloff), None)
    halo = op('MAXIMUM', op('SUBTRACT', thick, math.exp(-reach / falloff)), 0.0)
    above = op('GREATER_THAN', sep.outputs['Z'], WATER_Z)
    nt.links.new(op('MULTIPLY', op('MULTIPLY', halo, above), 0.4), vol.inputs['Density'])
    nt.links.new(vol.outputs[0], nt.nodes['Material Output'].inputs['Volume'])
    haze.data.materials.append(hm)


def build_end_wall(m):
    """The wall at the end of the hall, wider and higher than the hall, so it fills the canvas
    behind it; the mouth of the tunnel in it under a concrete arch, a red signal at its side and a
    caged lamp over it."""
    wall = span('end_wall', -26, 26, END_Y, END_Y + 0.4, -12, 16, m['tiles'])
    cutter = link(bpy.data.objects.new('mouth_cutter', bpy.data.meshes.new('mouth_cutter')))
    bm = bmesh.new()
    prof = arch_profile(TUNNEL['r'], bottom=-1.0)
    front = [bm.verts.new((x, END_Y - 1, z)) for x, z in prof]
    back = [bm.verts.new((x, END_Y + 1, z)) for x, z in prof]
    bm.faces.new(front)
    bm.faces.new(list(reversed(back)))
    for j in range(len(prof)):
        k = (j + 1) % len(prof)
        bm.faces.new((front[j], back[j], back[k], front[k]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    bm.to_mesh(cutter.data)
    bm.free()
    boolean = wall.modifiers.new('mouth', 'BOOLEAN')
    boolean.operation = 'DIFFERENCE'
    boolean.solver = 'EXACT'
    boolean.object = cutter
    # the arch: a frame of concrete round the mouth, standing out of the wall
    bm = bmesh.new()
    outer = arch_profile(TUNNEL['r'] + 0.38, bottom=WATER_Z - 0.3)
    inner = arch_profile(TUNNEL['r'], bottom=WATER_Z - 0.3)
    yf, yb = END_Y - 0.18, END_Y + 0.4
    of = [bm.verts.new((x, yf, z)) for x, z in outer]
    inf = [bm.verts.new((x, yf, z)) for x, z in inner]
    inb = [bm.verts.new((x, yb, z)) for x, z in inner]
    for j in range(len(outer) - 1):
        bm.faces.new((of[j], of[j + 1], inf[j + 1], inf[j]))
        bm.faces.new((inf[j], inf[j + 1], inb[j + 1], inb[j]))
    mesh_from_bmesh('mouth_arch', bm, m['arch'], smooth=40)
    # the signal at the right of the mouth, on a post in the water
    sx = TUNNEL['cx'] + TUNNEL['r'] + 0.55
    rod('signal_post', (sx, END_Y - 0.35, WATER_Z - 0.2), (sx, END_Y - 0.35, 2.55), 0.05, m['beam'])
    span('signal_head', sx - 0.16, sx + 0.16, END_Y - 0.45, END_Y - 0.3, 2.35, 3.15, m['shade'])
    cylinder('signal_red', (sx, END_Y - 0.47, 2.55), 0.07, 0.03, m['signal_red'], rot=(math.pi / 2, 0, 0))
    cylinder('signal_green', (sx, END_Y - 0.47, 2.9), 0.07, 0.03, m['signal_off'], rot=(math.pi / 2, 0, 0))
    point_light('signal_light', (sx, END_Y - 0.65, 2.55), 6.0, (1.0, 0.08, 0.03), 0.05)
    # a caged bulkhead lamp over the arch, cold
    lz = TUNNEL['zc'] + TUNNEL['r'] + 0.62
    sphere('bulkhead', (TUNNEL['cx'], END_Y - 0.08, lz), 0.13, m['bulb_cold'], scale=(1.4, 0.6, 1))
    for k in range(5):
        a = math.pi * (k + 1) / 6
        rod(f'bulkhead_cage_{k}', (TUNNEL['cx'] - 0.2, END_Y - 0.1 - 0.1 * math.sin(a), lz + 0.13 * math.cos(a)), (TUNNEL['cx'] + 0.2, END_Y - 0.1 - 0.1 * math.sin(a), lz + 0.13 * math.cos(a)), 0.008, m['beam'])
    point_light('bulkhead_light', (TUNNEL['cx'], END_Y - 0.35, lz), 160.0, (0.6, 0.85, 1.0), 0.1)
    # cable trays along the end wall into the bore
    tube('mouth_cable', sag((LEFT_X, END_Y - 0.1, 4.5), (TUNNEL['cx'] - TUNNEL['r'] - 0.25, END_Y - 0.1, 3.9), 0.15), 0.03, m['cable'])


def build_vault(m):
    """The hall round the track: the walls, the ceiling with its iron beams, the far part of the
    platform with a bench, the name of the station, and the lamps over the far platform."""
    span('left_wall', LEFT_X - 0.3, LEFT_X, -3, END_Y + 0.2, -1.0, CEILING_Z + 0.2, m['tiles'])
    span('right_wall', RIGHT_X, RIGHT_X + 0.3, -3, END_Y + 0.2, DECK_Z - 0.1, CEILING_Z + 0.2, m['tiles'])
    span('ceiling', LEFT_X - 0.3, RIGHT_X + 0.3, -3, END_Y + 0.2, CEILING_Z, CEILING_Z + 0.3, m['ceiling'])
    for k, y in enumerate((2.0, 6.0, 10.0, 14.0, 18.0, 22.0)):
        span(f'beam_{k}', LEFT_X, RIGHT_X, y - 0.14, y + 0.14, CEILING_Z - 0.42, CEILING_Z, m['beam'], bevel=0.01)
        span(f'beam_flange_{k}', LEFT_X, RIGHT_X, y - 0.2, y + 0.2, CEILING_Z - 0.46, CEILING_Z - 0.4, m['beam'], bevel=0.01)
    build_platform_part(m, NEAR_PLATFORM_END - NEAR_FADE - 0.4, END_Y + 0.1, 'far')
    # a bench against the right wall
    bx, by = RIGHT_X - 0.55, 12.6
    for k in range(4):
        span(f'bench_slat_{k}', bx - 0.24 + k * 0.13, bx - 0.14 + k * 0.13, by - 0.9, by + 0.9, DECK_Z + 0.44, DECK_Z + 0.47, m['wood'], bevel=0.008)
    for k in range(3):
        span(f'bench_back_{k}', bx + 0.22, bx + 0.25, by - 0.9, by + 0.9, DECK_Z + 0.6 + k * 0.13, DECK_Z + 0.69 + k * 0.13, m['wood'], bevel=0.008)
    for y in (by - 0.75, by + 0.75):
        span(f'bench_leg_{y}', bx - 0.24, bx + 0.25, y - 0.03, y + 0.03, DECK_Z, DECK_Z + 0.46, m['beam'])
    # the name of the station, on both walls
    for side, x, rot, y in (('left', LEFT_X + 0.03, (math.pi / 2, 0, math.pi / 2), 10.4), ('right', RIGHT_X - 0.03, (math.pi / 2, 0, -math.pi / 2), 16.0)):
        dx = 0.02 if side == 'left' else -0.02
        span(f'sign_{side}', min(x, x + dx), max(x, x + dx), y - 1.25, y + 1.25, 2.68, 3.22, m['enamel_blue'])
        span(f'sign_rim_{side}', min(x, x + dx * 0.5), max(x, x + dx * 0.5), y - 1.3, y + 1.3, 2.63, 3.27, m['enamel_white'])
        text(f'sign_text_{side}', 'WEIR LANE', (x + dx * 1.6, y, 2.95), 0.36, m['enamel_white'], rot)
    # a cold fluorescent tube on the left wall, over the flooded track
    for k, y in enumerate((7.0, 15.0, 21.0)):
        span(f'left_tube_{k}', LEFT_X + 0.02, LEFT_X + 0.08, y, y + 1.4, 3.85, 3.92, m['tube_cold'])
        point_light(f'left_tube_light_{k}', (LEFT_X + 0.4, y + 0.7, 3.8), 70.0, (0.55, 0.85, 1.0), 0.3)
    for y, lit in ((12.0, False), (16.0, True), (20.0, True)):
        hanging_lamp(m, (2.9, y), lit)


def hanging_lamp(m, at, lit, drop=0.95):
    """An enamel shade on a rod from a beam, its sodium bulb lit or dead."""
    x, y = at
    top = CEILING_Z - 0.46
    z = top - drop
    rod(f'lamp_rod_{y}', (x, y, top), (x, y, z + 0.12), 0.012, m['beam'])
    cylinder(f'lamp_shade_{y}', (x, y, z), 0.3, 0.2, m['shade'], r2=0.06, verts=40)
    cylinder(f'lamp_shade_in_{y}', (x, y, z - 0.005), 0.29, 0.2, m['shade_inside'], r2=0.05, verts=40)
    sphere(f'lamp_bulb_{y}', (x, y, z - 0.1), 0.07, m['bulb_sodium'] if lit else m['bulb_dead'])
    if lit:
        spot_light(f'lamp_light_{y}', (x, y, z - 0.12), (0, 0, 0), 1400.0, (1.0, 0.55, 0.22), 130, 0.7, 0.06)
        point_light(f'lamp_glow_{y}', (x, y, z - 0.1), 60.0, (1.0, 0.55, 0.22), 0.06)


def build_platform_part(m, y0, y1, which):
    """A stretch of the platform: the deck with its yellow line, the coping stones and the face
    above the flood."""
    span(f'deck_{which}', EDGE_X + 0.3, RIGHT_X, y0, y1, DECK_Z - 0.3, DECK_Z, m[f'deck_{which}'])
    span(f'coping_{which}', EDGE_X, EDGE_X + 0.3, y0, y1, DECK_Z - 0.18, DECK_Z + 0.015, m[f'coping_{which}'], bevel=0.02)
    span(f'face_{which}', EDGE_X + 0.04, EDGE_X + 0.3, y0, y1, WATER_Z - 0.5, DECK_Z - 0.17, m[f'face_{which}'])


def build_pillars(m):
    """Cast-iron columns down the platform, from the deck to the beams."""
    for y in (14.0, 18.0, 22.0):
        column(m, (4.0, y))


def column(m, at):
    x, y = at
    top = CEILING_Z - 0.46
    cylinder(f'col_base_{y}', (x, y, DECK_Z + 0.15), 0.27, 0.3, m['iron'], verts=24, bevel=0.02)
    cylinder(f'col_shaft_{y}', (x, y, (DECK_Z + 0.3 + top - 0.45) / 2), 0.16, top - 0.45 - DECK_Z - 0.3, m['iron'], verts=24)
    cylinder(f'col_neck_{y}', (x, y, top - 0.38), 0.2, 0.08, m['iron'], verts=24)
    cylinder(f'col_cap_{y}', (x, y, top - 0.18), 0.17, 0.32, m['iron'], r2=0.36, verts=24)
    span(f'col_plate_{y}', x - 0.4, x + 0.4, y - 0.4, y + 0.4, top - 0.03, top, m['iron'])


def build_water(m):
    """The flood over the track bed, to the foot of the end wall; under the near platform it
    reaches a little under the deck, which hides it, so that the near platform moving away from
    it never opens a gap."""
    quad('water_far', [(LEFT_X, WATER_SPLIT, WATER_Z), (EDGE_X + 0.04, WATER_SPLIT, WATER_Z), (EDGE_X + 0.04, END_Y, WATER_Z), (LEFT_X, END_Y, WATER_Z)], m['water'])
    quad('water_near', [(LEFT_X, -3, WATER_Z), (EDGE_X + 0.7, -3, WATER_Z), (EDGE_X + 0.7, WATER_SPLIT, WATER_Z), (LEFT_X, WATER_SPLIT, WATER_Z)], m['water'])
    # a few things the flood carries, away from the patch of the ripples: a plank and some paper
    span('plank', -3.9, -2.7, 16.4, 16.6, WATER_Z - 0.02, WATER_Z + 0.025, m['wood'], bevel=0.01).rotation_euler.z = 0.35
    span('paper', -3.6, -3.3, 10.6, 10.8, WATER_Z, WATER_Z + 0.004, m['enamel_white']).rotation_euler.z = 0.8


def build_ripples(m):
    cx, cy, rr = RIPPLE_PATCH
    bm = bmesh.new()
    bmesh.ops.create_circle(bm, cap_ends=True, segments=96, radius=1.0)
    bmesh.ops.scale(bm, vec=(rr, rr * 1.6, 1), verts=bm.verts)
    bmesh.ops.translate(bm, vec=(cx, cy, WATER_Z + 0.0005), verts=bm.verts)
    patch = mesh_from_bmesh('ripples', bm, m['ripples'])
    # the patch is a picture of the water, nothing else: no other ray sees it
    patch.visible_shadow = False
    patch.visible_diffuse = False
    patch.visible_glossy = False
    patch.visible_transmission = False
    patch.visible_volume_scatter = False


def build_platform(m):
    """The near part of the platform, which fades out where the far part goes on, two columns and
    the lamp over the figure."""
    build_platform_part(m, -3.0, NEAR_PLATFORM_END, 'near')
    for y in (6.0, 10.0):
        column(m, (4.0, y))
    for y, lit in ((4.4, False), (9.2, True)):
        hanging_lamp(m, (2.9, y), lit)


def build_figure(m):
    """Someone waiting at the edge under a red umbrella, a suitcase at their feet, turned towards
    the tunnel."""
    fx, fy = 2.45, 8.4
    z0 = DECK_Z
    turn = Matrix.Rotation(math.radians(28), 4, 'Z')
    parts = []

    def place(obj):
        bpy.context.view_layer.update()
        obj.matrix_world = Matrix.Translation((fx, fy, 0)) @ turn @ Matrix.Translation(-Vector((fx, fy, 0))) @ obj.matrix_world
        parts.append(obj)
        return obj

    for dx in (-0.09, 0.09):
        place(cylinder(f'leg_{dx}', (fx + dx, fy, z0 + 0.25), 0.06, 0.5, m['trousers'], verts=16))
        place(span(f'shoe_{dx}', fx + dx - 0.05, fx + dx + 0.05, fy - 0.06, fy + 0.2, z0, z0 + 0.07, m['shoe'], bevel=0.02))
    place(cylinder('coat', (fx, fy, z0 + 0.95), 0.27, 1.0, m['coat'], r2=0.2, verts=32))
    place(sphere('shoulders', (fx, fy, z0 + 1.45), 0.25, m['coat'], scale=(1, 0.62, 0.42)))
    place(cylinder('scarf', (fx, fy, z0 + 1.53), 0.1, 0.1, m['scarf'], verts=16))
    place(sphere('head', (fx, fy - 0.01, z0 + 1.66), 0.105, m['skin'], scale=(0.92, 1, 1.08)))
    place(sphere('hair', (fx, fy + 0.02, z0 + 1.69), 0.108, m['hair'], scale=(0.95, 1, 1.0)))
    place(rod('arm_up', (fx + 0.2, fy, z0 + 1.42), (fx + 0.12, fy + 0.18, z0 + 1.2), 0.05, m['coat']))
    place(rod('arm_fore', (fx + 0.12, fy + 0.18, z0 + 1.2), (fx + 0.04, fy + 0.14, z0 + 1.42), 0.045, m['coat']))
    place(rod('umbrella_shaft', (fx + 0.04, fy + 0.14, z0 + 1.32), (fx - 0.04, fy + 0.04, z0 + 2.12), 0.012, m['beam']))
    canopy = sphere('umbrella', (fx - 0.04, fy + 0.04, z0 + 1.98), 0.62, m['umbrella'], scale=(1, 1, 0.42), segments=8, rings=12)
    bm = bmesh.new()
    bm.from_mesh(canopy.data)
    bmesh.ops.delete(bm, geom=[v for v in bm.verts if v.co.z < -0.002], context='VERTS')
    bm.to_mesh(canopy.data)
    bm.free()
    canopy.rotation_euler = (math.radians(-8), math.radians(-6), 0)
    solid = canopy.modifiers.new('cloth', 'SOLIDIFY')
    solid.thickness = 0.008
    place(canopy)
    for k in range(8):
        a = 2 * math.pi * (k + 0.5) / 8
        tip = Vector((fx - 0.04 + 0.6 * math.cos(a), fy + 0.04 + 0.6 * math.sin(a), z0 + 1.97))
        place(rod(f'umbrella_rib_{k}', tip, tip - Vector((0, 0, 0.05)), 0.006, m['beam'], verts=6))
    case = span('suitcase', fx + 0.28, fx + 0.42, fy - 0.3, fy + 0.18, z0, z0 + 0.42, m['case'], bevel=0.02)
    parts.append(case)
    rod('suitcase_handle', (fx + 0.35, fy - 0.12, z0 + 0.42), (fx + 0.35, fy, z0 + 0.42), 0.012, m['shoe'])


def build_cables(m):
    """Cables torn from their trays, hanging across the front of the picture, one with a dead
    lamp on its end and one loose, dripping."""
    y = 5.6
    tube('cable_a', sag((LEFT_X - 0.5, y - 0.2, 5.0), (1.6, y + 0.3, 4.95), 1.55), 0.035, m['cable'])
    tube('cable_b', sag((LEFT_X - 0.5, y, 5.05), (2.2, y + 0.1, 5.0), 1.25), 0.028, m['cable'])
    tube('cable_c', sag((-1.2, y + 0.2, 5.0), (RIGHT_X, y - 0.1, 5.0), 0.95), 0.03, m['cable'])
    tube('cable_d', sag((0.6, y - 0.1, 5.05), (RIGHT_X, y + 0.3, 4.9), 1.6), 0.026, m['cable'])
    # a loose end that hangs down, its copper showing
    loose = [Vector((-2.45, y + 0.15, 5.0)), Vector((-2.35, y + 0.1, 4.2)), Vector((-2.15, y + 0.05, 3.55)), Vector((-2.2, y, 3.05))]
    tube('cable_loose', loose, 0.03, m['cable'])
    for k in range(5):
        a = 2 * math.pi * k / 5
        rod(f'strand_{k}', loose[-1], loose[-1] + Vector((0.03 * math.cos(a), 0.03 * math.sin(a), -0.09 - 0.02 * k)), 0.006, m['copper'], verts=6)
    # a cold light from behind and above catches the cables' rims; it lights the ceiling too
    point_light('cable_rim', (-0.6, y + 2.6, 4.55), 90.0, (0.55, 0.8, 1.0), 0.4)
    # a dead pendant lamp on its cable
    lx, lz = 0.9, 3.3
    tube('pendant_cable', [Vector((lx - 0.2, y + 0.2, 5.0)), Vector((lx - 0.05, y + 0.1, 4.2)), Vector((lx, y, lz + 0.12))], 0.014, m['cable'])
    cylinder('pendant_shade', (lx, y, lz), 0.2, 0.18, m['shade'], r2=0.05, verts=32, rot=(0.12, -0.2, 0))
    sphere('pendant_bulb', (lx + 0.01, y, lz - 0.09), 0.05, m['bulb_dead'])


# --- rendering --------------------------------------------------------------------------------


def main():
    os.makedirs(OUT, exist_ok=True)
    scene = reset()
    m = materials()
    cols = {name: collection(name) for name, _ in LAYERS}
    cols['train'] = collection('train')
    builders = {
        'bore': build_bore,
        'end-wall': build_end_wall,
        'vault': build_vault,
        'pillars': build_pillars,
        'water': build_water,
        'ripples': build_ripples,
        'platform': build_platform,
        'figure': build_figure,
        'cables': build_cables,
        'train': build_train,
    }
    for name, build in builders.items():
        CURRENT['col'] = cols[name]
        build(m)
    CURRENT['col'] = None

    world = bpy.data.worlds.new('night')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.01, 0.014, 0.018, 1)
    scene.world = world

    lights = [o for o in bpy.data.objects if o.type == 'LIGHT']
    for o in lights:
        o.visible_camera = False
    meshes = [o for o in bpy.data.objects if o.type != 'LIGHT' and o.name != 'camera']
    ripples = bpy.data.objects['ripples']
    cutter = bpy.data.objects['mouth_cutter']
    cutter.hide_render = True
    cols['train'].hide_render = True

    train_px = pixel(TRAIN)
    layout = {
        'canvas': [WIDTH, HEIGHT],
        'cameraPx': CAMERA_PX,
        'groups': {name: depth_px(distance) for name, distance in GROUPS.items()},
        'layers': [{'name': name, 'group': group} for name, group in LAYERS],
        'train': [round(train_px[0], 3), round(train_px[1], 3)],
        'rippleFrames': RIPPLE_FRAMES,
    }
    with open(os.path.join(OUT, 'layout.json'), 'w') as f:
        json.dump(layout, f, indent=2)

    def render(file, samples):
        scene.cycles.samples = max(16, samples // 8) if DRAFT else samples
        scene.render.filepath = os.path.join(OUT, file)
        bpy.ops.render.render(write_still=True)
        print('rendered', file, flush=True)

    def only_camera(name):
        for o in meshes:
            o.visible_camera = name in cols and o.name in cols[name].objects
        ripples.visible_camera = name == 'ripples'

    def wanted(name):
        return ONLY is None or name in ONLY

    if COMPOSITE:
        for o in meshes:
            o.visible_camera = o is not ripples
        scene.render.film_transparent = False
        render('composite.png', 256)
        scene.render.film_transparent = True

    for name, _ in LAYERS:
        if name in ('train-light', 'ripples') or not wanted(name):
            continue
        only_camera(name)
        # the end wall lies beyond the hall as well, and a camera that moves shows some of it: the
        # walls and the ceiling of the hall let the light through to it, so it is lit there too
        for o in cols['vault'].objects:
            o.visible_shadow = name != 'end-wall'
        render(f'{name}.png', 384)

    if wanted('ripples'):
        only_camera('ripples')
        phase = bpy.data.materials['ripples'].node_tree.nodes['ripple_phase']
        for frame in range(RIPPLE_FRAMES):
            phase.outputs[0].default_value = 2 * math.pi * frame / RIPPLE_FRAMES
            render(f'ripples-{frame}.png', 384)

    if wanted('train-light'):
        # the light of the train alone, on black: the station dark, the bore and the haze seen
        scene.render.film_transparent = False
        scene.world = bpy.data.worlds.new('black')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
        cols['train'].hide_render = False
        for name, col in cols.items():
            if name not in ('bore', 'train'):
                col.hide_render = True
        for o in lights:
            if o.name != 'train_beam':
                o.hide_render = True
        for o in cols['bore'].objects:
            if o.name.startswith('work_lamp'):
                o.hide_render = True
        # the lamps and their beam in the haze alone: the bore is there for the light, not the camera
        only_camera('train')
        render('train-light.png', 512)


main()
