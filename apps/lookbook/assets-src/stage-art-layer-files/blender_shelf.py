"""Runs inside Blender: builds "the specimen shelf" — a shelf of specimen jars in the cabinet of a
research vessel, behind a brass fiddle rail — and renders it layer by layer through one
orthographic camera, each layer a full canvas, as a paint tool exports its layers:

    blender -b --factory-startup --python blender_shelf.py -- <out-dir> [--draft] [--cpu] [--only=<layer>,…]

`--draft` renders with an eighth of the samples, `--cpu` on the CPU even where Cycles finds a GPU,
`--only` the layers named (`wall`, `sunlight`, `shelf`, `coral`, `octopus`, `urchin`, `nautilus`,
`starfish`, `rail`, `tag`, `composite`).

Writes into `<out-dir>`: `wall.png` (the panelled bulkhead behind the shelf, opaque), `sunlight.png`
(the light of a porthole on the bulkhead, on black: the light alone), `shelf.png` (the shelf board
and the drawer under it, with the shadows of the jars), one picture per jar (`coral.png`,
`octopus.png`, `urchin.png`, `nautilus.png`, `starfish.png`), `rail.png` (the brass fiddle rail in
front of the jars) and `tag.png` (a paper tag on a string under the shelf), each 1280 × 800 and
transparent around its picture, and `layout.json` — the canvas, the pivots of the layers that
move, in canvas pixels, and the middle of the light of the porthole. `composite` renders the whole
scene in one picture, `composite.png`, for a look at the composition.

A jar is rendered with the bulkhead, the shelf and the other jars invisible to the camera but there
for the rays it refracts and reflects: its glass shows the bulkhead behind it, bent, and is opaque
where a paint tool would have it opaque; around the jar the film stays clear.

The canvas is laid out in pixels: one pixel is `S` metres on the plane of the camera, `wx(px)` is
the world x of a canvas column and `pixel(p)` the canvas pixel the camera sees a point at. The camera looks at the shelf from the front and a little from
above (`PITCH`). The bulkhead stands `WALL_DEPTH` canvas pixels behind the plane of the jars.
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
OUT = ARGS[0] if ARGS and not ARGS[0].startswith('--') else '/tmp/stage-art-layer-files'
DRAFT = '--draft' in ARGS
CPU = '--cpu' in ARGS
ONLY = next((a[len('--only=') :].split(',') for a in ARGS if a.startswith('--only=')), None)

WIDTH, HEIGHT = 1280, 800
S = 0.0008  # metres per canvas pixel
PITCH = math.radians(6)
ZC = 0.19  # the height of the point of the world in the middle of the canvas, at depth 0
WALL_DEPTH = 240  # canvas pixels from the plane of the jars to the bulkhead
WALL_Y = WALL_DEPTH * S
SHELF_FRONT = -0.15  # the front edge of the shelf board
RAIL_Y = -0.128

X = Vector((1, 0, 0))
U = Vector((0, math.sin(PITCH), math.cos(PITCH)))  # up on the canvas
D = Vector((0, math.cos(PITCH), -math.sin(PITCH)))  # the view direction
C0 = Vector((0, 0, ZC))

rng = random.Random(1872)


def pixel(p):
    """The canvas pixel the camera sees the point `p` at."""
    v = Vector(p) - C0
    return (WIDTH / 2 + v.dot(X) / S, HEIGHT / 2 - v.dot(U) / S)


def wx(px):
    """The world x of the canvas column `px`."""
    return (px - WIDTH / 2) * S


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
    scene.view_settings.exposure = -1.1
    scene.cycles.seed = 11
    scene.cycles.use_denoising = True
    scene.cycles.denoiser = 'OPENIMAGEDENOISE'
    scene.cycles.max_bounces = 16
    scene.cycles.glossy_bounces = 8
    scene.cycles.transmission_bounces = 16
    scene.cycles.transparent_max_bounces = 16
    scene.cycles.volume_bounces = 2
    scene.cycles.sample_clamp_indirect = 8
    scene.cycles.caustics_reflective = False
    scene.cycles.caustics_refractive = False
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
    cam.data.clip_start = 0.05
    cam.data.clip_end = 50
    cam.rotation_euler = (math.pi / 2 - PITCH, 0, 0)
    cam.location = C0 - 10 * D
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


def span(name, x0, x1, y0, y1, z0, z1, material=None, bevel=0.0, segments=2):
    return box(name, ((x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2), (x1 - x0, y1 - y0, z1 - z0), material, bevel, segments=segments)


def cylinder(name, c, r, depth, material=None, rot=(0, 0, 0), verts=64, bevel=0.0, r2=None):
    if r2 is None:
        bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=r, depth=depth, location=c, rotation=rot)
    else:
        bpy.ops.mesh.primitive_cone_add(vertices=verts, radius1=r, radius2=r2, depth=depth, location=c, rotation=rot)
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, bevel, smooth=35)


def rod(name, a, b, r, material=None, verts=24):
    a, b = Vector(a), Vector(b)
    v = b - a
    obj = cylinder(name, (a + b) / 2, r, v.length, material, verts=verts)
    obj.rotation_euler = v.to_track_quat('Z', 'Y').to_euler()
    return obj


def sphere(name, c, r, material=None, scale=(1, 1, 1), segments=48, rings=24):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=segments, ring_count=rings, radius=r, location=c)
    obj = bpy.context.active_object
    obj.name = name
    obj.scale = scale
    bpy.ops.object.transform_apply(scale=True)
    return finish(obj, material, smooth=80)


def torus(name, c, major, minor, material=None, rot=(0, 0, 0), major_seg=72, minor_seg=16):
    bpy.ops.mesh.primitive_torus_add(
        major_radius=major, minor_radius=minor, major_segments=major_seg, minor_segments=minor_seg, location=c, rotation=rot
    )
    obj = bpy.context.active_object
    obj.name = name
    return finish(obj, material, smooth=60)


def tapered_tube(name, points, radii, material, resolution=12):
    """A tube along a smooth curve through `points`, its radius at each point given by `radii`."""
    curve = bpy.data.curves.new(name, 'CURVE')
    curve.dimensions = '3D'
    curve.bevel_depth = 1.0
    curve.bevel_resolution = 5
    curve.use_fill_caps = True
    curve.resolution_u = resolution
    spline = curve.splines.new('BEZIER')
    spline.bezier_points.add(len(points) - 1)
    for bp, p, r in zip(spline.bezier_points, points, radii):
        bp.co = p
        bp.radius = r
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


def lathe(name, profile, material, segments=96, smooth=50):
    """The solid of revolution of `profile`, a list of `(r, z)` about the z axis; a point with r 0
    closes the solid on the axis."""
    bm = bmesh.new()
    rings = []
    for r, z in profile:
        if r <= 1e-9:
            rings.append([bm.verts.new((0, 0, z))])
            continue
        rings.append([bm.verts.new((r * math.cos(2 * math.pi * j / segments), r * math.sin(2 * math.pi * j / segments), z)) for j in range(segments)])
    for a, b in zip(rings, rings[1:]):
        if len(a) == 1 and len(b) == 1:
            continue
        if len(a) == 1:
            for j in range(segments):
                bm.faces.new((a[0], b[(j + 1) % segments], b[j]))
        elif len(b) == 1:
            for j in range(segments):
                bm.faces.new((a[j], a[(j + 1) % segments], b[0]))
        else:
            for j in range(segments):
                bm.faces.new((a[j], a[(j + 1) % segments], b[(j + 1) % segments], b[j]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bmesh(name, bm, material, smooth)


def text(name, body, c, size, material, extrude=0.0, align='CENTER', rot_z=0.0):
    """Text on a vertical plane facing the camera."""
    curve = bpy.data.curves.new(name, 'FONT')
    curve.body = body
    curve.size = size
    curve.align_x = align
    curve.align_y = 'CENTER'
    curve.extrude = extrude
    obj = link(bpy.data.objects.new(name, curve))
    obj.location = c
    obj.rotation_euler = (math.pi / 2, 0, rot_z)
    obj.data.materials.append(material)
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
        self.link(vec if vec is not None else self.coords('Object'), n.inputs['Vector'])
        return n.outputs['Fac']

    def voronoi(self, scale, vec=None):
        n = self.node('ShaderNodeTexVoronoi', feature='F1')
        n.inputs['Scale'].default_value = scale
        self.link(vec if vec is not None else self.coords('Object'), n.inputs['Vector'])
        return n.outputs['Distance']

    def coords(self, kind='Object'):
        return self.node('ShaderNodeTexCoord').outputs[kind]

    def mapping(self, scale, vec=None):
        n = self.node('ShaderNodeMapping')
        n.inputs['Scale'].default_value = scale
        self.link(vec if vec is not None else self.coords('Object'), n.inputs['Vector'])
        return n.outputs[0]

    def ao(self, distance=0.02):
        n = self.node('ShaderNodeAmbientOcclusion', samples=8)
        n.inputs['Distance'].default_value = distance
        return n.outputs['AO']

    def bump(self, height, strength=0.2, distance=0.002):
        n = self.node('ShaderNodeBump')
        n.inputs['Strength'].default_value = strength
        n.inputs['Distance'].default_value = distance
        self.link(height, n.inputs['Height'])
        self.link(n.outputs['Normal'], self.bsdf.inputs['Normal'])


def mat_plain(name, base, rough=0.5, metallic=0.0):
    m = Mat(name)
    m.set(Base_Color=base + (1,), Roughness=rough, Metallic=metallic)
    return m.m


def mat_teak(name, dark=(0.030, 0.012, 0.005), light=(0.11, 0.050, 0.020), grain_scale=(1.0, 22.0, 22.0), rough=0.32):
    """Varnished teak: long grain along x, a darker grime in the corners."""
    m = Mat(name)
    vec = m.mapping(grain_scale)
    grain = m.noise(14, 9, 0.68, vec)
    fine = m.noise(80, 4, 0.6, vec)
    tone = m.math('ADD', m.math('MULTIPLY', grain, 0.8), m.math('MULTIPLY', fine, 0.25))
    color = m.mix(m.math('SUBTRACT', tone, 0.25, clamp=True), dark + (1,), light + (1,))
    grime = m.math('SUBTRACT', 1.0, m.ao(0.03))
    color = m.mix(m.math('MULTIPLY', grime, 0.9, clamp=True), color, (0.015, 0.008, 0.004, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.link(m.math('ADD', rough, m.math('MULTIPLY', m.noise(6, 3), 0.18)), m.bsdf.inputs['Roughness'])
    m.set(Coat_Weight=0.35, Coat_Roughness=0.18)
    m.bump(fine, 0.12)
    return m.m


def mat_brass(name='brass', base=(0.72, 0.48, 0.18), rough=0.24):
    m = Mat(name)
    grime = m.noise(160, 6, 0.6)
    occluded = m.math('SUBTRACT', 1.0, m.ao(0.01))
    tarnish = m.math('ADD', m.math('MULTIPLY', m.math('SUBTRACT', grime, 0.35), 0.7), m.math('MULTIPLY', occluded, 1.2), clamp=True)
    color = m.mix(tarnish, base + (1,), (0.22, 0.13, 0.05, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.link(m.math('ADD', rough, m.math('MULTIPLY', tarnish, 0.3)), m.bsdf.inputs['Roughness'])
    m.set(Metallic=1.0)
    m.bump(m.noise(400, 3, 0.5), 0.04)
    return m.m


def mat_glass(name, tint=(0.93, 0.98, 0.95), rough=0.015):
    m = Mat(name)
    m.set(Base_Color=tint + (1,), Roughness=rough, IOR=1.5, Transmission_Weight=1.0)
    # the glass of an old jar is not quite even: a faint waviness in its surface
    m.bump(m.noise(30, 2, 0.5), 0.015)
    return m.m


def mat_liquid(name, absorb=(0.92, 0.78, 0.45), density=12.0):
    """Spirit gone yellow with age: a clear surface, an absorbing volume."""
    m = Mat(name)
    m.set(Base_Color=(1, 1, 1, 1), Roughness=0.0, IOR=1.36, Transmission_Weight=1.0)
    vol = m.node('ShaderNodeVolumeAbsorption')
    vol.inputs['Color'].default_value = absorb + (1,)
    vol.inputs['Density'].default_value = density
    m.link(vol.outputs[0], m.out.inputs['Volume'])
    return m.m


def mat_flesh(name, base, mottle, sss=0.25, rough=0.38):
    """A preserved animal: pale, waxy, mottled."""
    m = Mat(name)
    spots = m.voronoi(260)
    mot = m.math('ADD', m.math('MULTIPLY', m.noise(90, 5, 0.6), 0.9), m.math('MULTIPLY', m.math('LESS_THAN', spots, 0.18), 0.35))
    color = m.mix(m.math('SUBTRACT', mot, 0.35, clamp=True), base + (1,), mottle + (1,))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.set(Roughness=rough, Subsurface_Weight=sss, Subsurface_Scale=0.003, Coat_Weight=0.4, Coat_Roughness=0.15)
    m.bump(m.noise(300, 4, 0.6), 0.15)
    return m.m


def mat_suckers():
    """The arms of the octopus: the mottled skin with rows of pale suckers."""
    m = Mat('octopus_arm')
    cells = m.voronoi(520)
    sucker = m.math('LESS_THAN', cells, 0.32)
    skin = m.mix(m.math('SUBTRACT', m.noise(90, 5, 0.6), 0.3, clamp=True), (0.40, 0.22, 0.18, 1), (0.20, 0.09, 0.08, 1))
    m.link(m.mix(m.math('MULTIPLY', sucker, 0.6), skin, (0.62, 0.48, 0.40, 1)), m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.4, Subsurface_Weight=0.2, Subsurface_Scale=0.002, Coat_Weight=0.4, Coat_Roughness=0.15)
    m.bump(m.math('SUBTRACT', 1.0, cells), 0.35)
    return m.m


def mat_paper(name='paper', base=(0.62, 0.55, 0.40)):
    m = Mat(name)
    stain = m.math('MULTIPLY', m.noise(18, 6, 0.65), 0.6)
    edge = m.math('SUBTRACT', 1.0, m.ao(0.006))
    color = m.mix(m.math('ADD', m.math('SUBTRACT', stain, 0.2), edge, clamp=True), base + (1,), (0.36, 0.27, 0.15, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.85)
    m.bump(m.noise(500, 3, 0.6), 0.05)
    return m.m


def mat_cork():
    m = Mat('cork')
    pores = m.voronoi(900)
    color = m.mix(m.math('ADD', m.noise(200, 6, 0.7), m.math('MULTIPLY', m.math('LESS_THAN', pores, 0.12), 0.5)), (0.38, 0.24, 0.12, 1), (0.14, 0.08, 0.04, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.8)
    m.bump(pores, 0.3)
    return m.m


def mat_wax():
    m = Mat('wax')
    m.link(m.mix(m.noise(60, 4, 0.6), (0.18, 0.016, 0.012, 1), (0.09, 0.006, 0.006, 1)), m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.3, Subsurface_Weight=0.2, Subsurface_Scale=0.002)
    m.bump(m.noise(120, 4, 0.6), 0.25)
    return m.m


def mat_coral():
    m = Mat('coral')
    polyps = m.voronoi(700)
    color = m.mix(m.math('ADD', m.math('MULTIPLY', m.noise(120, 4), 0.5), m.math('MULTIPLY', m.math('LESS_THAN', polyps, 0.15), 0.5)), (0.40, 0.035, 0.022, 1), (0.62, 0.14, 0.08, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.45, Subsurface_Weight=0.15, Subsurface_Scale=0.002)
    m.bump(polyps, 0.2)
    return m.m


def mat_urchin(name, tip, root, centre=None, r0=0.0, r1=1.0):
    """The test and the spines of a sea urchin: dark violet at the root, paler towards the tip — by
    the distance from `centre` between `r0` and `r1`; without a centre the colour of the root."""
    m = Mat(name)
    if centre is None:
        m.link(m.mix(m.math('MULTIPLY', m.noise(500, 4), 0.4), root + (1,), tip + (1,)), m.bsdf.inputs['Base Color'])
    else:
        dist = m.node('ShaderNodeVectorMath', operation='DISTANCE')
        m.link(m.coords('Object'), dist.inputs[0])
        dist.inputs[1].default_value = centre
        t = m.math('DIVIDE', m.math('SUBTRACT', dist.outputs['Value'], r0), r1 - r0, clamp=True)
        m.link(m.mix(t, root + (1,), tip + (1,)), m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.35, Coat_Weight=0.3)
    return m.m


def mat_shell():
    """A nautilus: cream, with brown flames across the whorl that fade towards the aperture."""
    m = Mat('shell')
    uv = m.node('ShaderNodeSeparateXYZ')
    m.link(m.coords('UV'), uv.inputs[0])
    u = uv.outputs['X']  # along the spiral: 0 at the core, 1 at the aperture
    wobble = m.math('MULTIPLY', m.noise(40, 3, 0.5), 2.0)
    bands = m.math('SINE', m.math('ADD', m.math('MULTIPLY', u, 240.0), wobble))
    flame = m.math('GREATER_THAN', bands, 0.1)
    # the flames stop short of the aperture, where the last growth of the shell is plain
    fade = m.math('MULTIPLY', m.math('SUBTRACT', 0.97, u), 12.0, clamp=True)
    keep = m.math('MULTIPLY', flame, fade)
    color = m.mix(keep, (0.66, 0.58, 0.44, 1), (0.30, 0.12, 0.04, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.25, Coat_Weight=0.6, Coat_Roughness=0.08)
    m.bump(m.math('SINE', m.math('MULTIPLY', u, 420.0)), 0.04)
    return m.m


def mat_starfish():
    m = Mat('starfish')
    bumps = m.voronoi(450)
    tub = m.math('LESS_THAN', bumps, 0.22)
    color = m.mix(m.math('ADD', m.math('MULTIPLY', tub, 0.6), m.math('MULTIPLY', m.noise(60, 4), 0.4)), (0.40, 0.10, 0.03, 1), (0.60, 0.27, 0.10, 1))
    m.link(color, m.bsdf.inputs['Base Color'])
    m.set(Roughness=0.62, Subsurface_Weight=0.1, Subsurface_Scale=0.002)
    m.bump(m.math('SUBTRACT', 1.0, bumps), 0.5)
    return m.m


def mat_ink(name='ink'):
    return mat_plain(name, (0.035, 0.022, 0.012), 0.7)


def materials():
    return {
        'teak': mat_teak('teak'),
        'teak_board': mat_teak('teak_board', grain_scale=(1.0, 8.0, 30.0)),
        'brass': mat_brass(),
        'glass': mat_glass('glass'),
        'glass_green': mat_glass('glass_green', (0.80, 0.93, 0.84)),
        'glass_frosted': mat_glass('glass_frosted', (0.95, 0.97, 0.96), 0.35),
        'liquid': mat_liquid('liquid'),
        'liquid_pale': mat_liquid('liquid_pale', (0.95, 0.88, 0.66), 6.0),
        'octopus': mat_flesh('octopus', (0.40, 0.22, 0.18), (0.20, 0.09, 0.08)),
        'octopus_arm': mat_suckers(),
        'eye': mat_plain('eye', (0.02, 0.02, 0.025), 0.1),
        'coral': mat_coral(),
        'urchin': mat_urchin('urchin', (0.30, 0.12, 0.30), (0.08, 0.02, 0.09)),
        'shell': mat_shell(),
        'nacre': mat_plain('nacre', (0.86, 0.80, 0.74), 0.15, 0.3),
        'starfish': mat_starfish(),
        'paper': mat_paper('paper', (0.36, 0.30, 0.20)),
        'paper_tag': mat_paper('paper_tag', (0.52, 0.46, 0.33)),
        'ink': mat_ink(),
        'cork': mat_cork(),
        'wax': mat_wax(),
        'bakelite': mat_plain('bakelite', (0.02, 0.012, 0.008), 0.25),
        'string': mat_plain('string', (0.42, 0.36, 0.26), 0.9),
        'stone': mat_plain('stone', (0.30, 0.28, 0.25), 0.8),
        'chart': mat_paper('chart', (0.24, 0.20, 0.13)),
    }


# --- the cabinet ------------------------------------------------------------------------------


def build_wall(m):
    """The bulkhead behind the shelf: tongue-and-groove teak planks laid across, brass screws, a
    pinned chart of a dredging station."""
    top = 0.75
    bottom = -0.25
    plank = 0.072
    z = bottom
    i = 0
    while z < top:
        h = plank - 0.0025
        span(f'plank_{i}', -0.75, 0.75, WALL_Y, WALL_Y + 0.02, z, z + h, m['teak'], bevel=0.0012)
        z += plank
        i += 1
    span('groove_backing', -0.75, 0.75, WALL_Y + 0.004, WALL_Y + 0.03, bottom, top, m['ink'])
    # the screws of the planks, in two upright battens
    for bx in (-0.36, 0.36):
        zz = bottom + plank / 2
        while zz < top:
            cylinder(f'screw_{bx}_{zz:.3f}', (bx, WALL_Y - 0.0006, zz), 0.0028, 0.002, m['brass'], rot=(math.pi / 2, 0, 0), verts=24)
            zz += plank
    # the chart: a sheet pinned to the bulkhead, curling a little at its free corner
    cx, cz = -0.06, 0.40
    w, h = 0.20, 0.13
    bm = bmesh.new()
    nx, nz = 24, 16
    verts = []
    for j in range(nz + 1):
        row = []
        for k in range(nx + 1):
            u, v = k / nx, j / nz
            curl = 0.012 * max(0.0, (u - 0.75) / 0.25) ** 2 * max(0.0, (0.3 - v) / 0.3) ** 2
            row.append(bm.verts.new((cx - w / 2 + u * w, WALL_Y - 0.0012 - curl, cz - h / 2 + v * h)))
        verts.append(row)
    uv_layer = bm.loops.layers.uv.new()
    for j in range(nz):
        for k in range(nx):
            f = bm.faces.new((verts[j][k], verts[j][k + 1], verts[j + 1][k + 1], verts[j + 1][k]))
            for loop, (uu, vv) in zip(f.loops, ((k, j), (k + 1, j), (k + 1, j + 1), (k, j + 1))):
                loop[uv_layer].uv = (uu / nx, vv / nz)
    mesh_from_bmesh('chart', bm, m['chart'], smooth=60)
    ink = m['ink']
    y_ink = WALL_Y - 0.0016
    text('chart_title', 'R.V. PETREL', (cx, y_ink, cz + 0.047), 0.014, ink)
    text('chart_sub', 'Station 147  -  dredged 2,600 fathoms', (cx, y_ink, cz + 0.030), 0.0068, ink)
    # a sounding profile: the sea floor, drawn as a line across the sheet, and its depth marks
    pts = []
    for k in range(40):
        u = k / 39
        pts.append(Vector((cx - 0.085 + u * 0.17, y_ink, cz - 0.005 - 0.028 * math.sin(u * 3.0) ** 2 - 0.008 * math.sin(u * 17))))
    for a, b in zip(pts, pts[1:]):
        rod('profile', a, b, 0.0006, ink, verts=6)
    for k in range(6):
        x = cx - 0.085 + k * 0.034
        rod(f'tick_{k}', (x, y_ink, cz + 0.016), (x, y_ink, cz + 0.010), 0.0004, ink, verts=6)
    text('chart_note', 'Echinus, Nautilus, Octopus', (cx, y_ink, cz - 0.050), 0.0062, ink)
    for px, pz in ((cx - w / 2 + 0.008, cz + h / 2 - 0.008), (cx + w / 2 - 0.008, cz + h / 2 - 0.008), (cx - w / 2 + 0.008, cz - h / 2 + 0.008)):
        sphere('pin', (px, WALL_Y - 0.003, pz), 0.0032, m['brass'], segments=16, rings=8)


def build_shelf(m):
    """The shelf board, its rounded front edge, and the drawer under it with a brass cup handle."""
    span('board', -0.75, 0.75, SHELF_FRONT, WALL_Y + 0.01, -0.024, 0.0, m['teak_board'], bevel=0.004, segments=4)
    span('drawer', -0.75, 0.75, SHELF_FRONT + 0.006, WALL_Y, -0.40, -0.026, m['teak'], bevel=0.002)
    span('drawer_shadow_gap', -0.75, 0.75, SHELF_FRONT + 0.008, WALL_Y, -0.029, -0.024, m['ink'])
    for k, dx in enumerate((-0.30, 0.30)):
        # a cup handle: half a ring of brass lying against the drawer front, and its two screws
        handle = torus(f'handle_{k}', (dx, SHELF_FRONT + 0.006, -0.085), 0.026, 0.0045, m['brass'], rot=(math.pi / 2, 0, 0))
        bm_cut = handle.modifiers.new('cut', 'BOOLEAN')
        cutter = span(f'handle_cut_{k}', dx - 0.05, dx + 0.05, SHELF_FRONT - 0.04, SHELF_FRONT + 0.05, -0.085, -0.02, None)
        cutter.hide_render = True
        bm_cut.object = cutter
        bm_cut.operation = 'DIFFERENCE'
        span(f'handle_plate_{k}', dx - 0.034, dx + 0.034, SHELF_FRONT + 0.0035, SHELF_FRONT + 0.006, -0.094, -0.076, m['brass'], bevel=0.0012)
    # a card holder in the middle of the drawer, its card blank but for a number
    span('holder', -0.045, 0.045, SHELF_FRONT + 0.003, SHELF_FRONT + 0.006, -0.088, -0.056, m['brass'], bevel=0.001)
    span('holder_card', -0.040, 0.040, SHELF_FRONT + 0.0026, SHELF_FRONT + 0.0032, -0.084, -0.060, m['paper'])
    text('holder_text', 'No. 147 - 152', (0, SHELF_FRONT + 0.0024, -0.072), 0.0085, m['ink'])


def build_rail(m):
    """The fiddle rail: a brass bar across the front of the shelf on turned posts, that keeps the
    jars on the shelf when the ship rolls."""
    z = 0.058
    rod('rail_bar', (-0.8, RAIL_Y, z), (0.8, RAIL_Y, z), 0.0042, m['brass'], verts=32)
    for k, px in enumerate((150, 360, 575, 800, 1000, 1200)):
        x = wx(px)
        rod(f'rail_post_{k}', (x, RAIL_Y, 0.0), (x, RAIL_Y, z), 0.0032, m['brass'])
        sphere(f'rail_knob_{k}', (x, RAIL_Y, z), 0.0062, m['brass'], segments=24, rings=12)
        cylinder(f'rail_foot_{k}', (x, RAIL_Y, 0.002), 0.008, 0.004, m['brass'], verts=32, bevel=0.0012)


# --- the jars ---------------------------------------------------------------------------------

JARS = {}
PIVOTS = {}


NECK_H = 0.020  # the straight neck of a jar above its shoulder, with the lip


def jar_profile(r, h, neck, shoulder):
    """The outer and inner wall of a jar of radius `r` and height `h`, from the axis under its
    bottom round to the axis inside it: a rounded foot, a straight wall, a shoulder in to a neck of
    radius `neck`, a rolled lip at the top. Answers the profile, the inner radius and the top of the
    straight wall."""
    t = 0.0028  # the glass
    wall_top = h - NECK_H - shoulder
    neck_base = wall_top + shoulder
    out = [(0.0, 0.0)]
    for k in range(7):
        a = math.pi / 2 * k / 6
        out.append((r - 0.008 + 0.008 * math.sin(a), 0.008 - 0.008 * math.cos(a)))
    out.append((r, wall_top))
    for k in range(1, 9):
        a = math.pi / 2 * k / 8
        out.append((neck + (r - neck) * math.cos(a), wall_top + shoulder * math.sin(a)))
    out.append((neck, h - 0.006))
    for k in range(1, 6):
        a = math.pi * k / 5
        out.append((neck + 0.0025 - 0.0025 * math.cos(a), h - 0.006 + 0.003 * (1 - math.cos(a)) + 0.0 * a))
    out.append((neck - t, h))
    inner = [(neck - t, neck_base)]
    for k in range(7, 0, -1):
        a = math.pi / 2 * k / 8
        inner.append((neck - t + (r - neck) * math.cos(a), wall_top + (shoulder - t) * math.sin(a)))
    inner.append((r - t, wall_top))
    inner.append((r - t, 0.010))
    inner.append((r - t - 0.006, t + 0.001))
    inner.append((0.0, t + 0.001))
    return out + inner, r - t, wall_top


def card(name, x0, x1, y, z0, z1, material, nx=32, thickness=0.0003):
    """A thin upright card facing the camera, cut into `nx` columns so that it can be bent."""
    bm = bmesh.new()
    verts = []
    for j in range(2):
        verts.append([bm.verts.new((x0 + (x1 - x0) * k / nx, y, z0 + (z1 - z0) * j)) for k in range(nx + 1)])
    for k in range(nx):
        bm.faces.new((verts[0][k], verts[0][k + 1], verts[1][k + 1], verts[1][k]))
    bmesh.ops.solidify(bm, geom=list(bm.faces), thickness=thickness)
    return mesh_from_bmesh(name, bm, material)


def wrap(obj, jx, jy, radius):
    """Bends `obj`, made flat in front of the jar at `jx, jy`, round the jar's cylinder of `radius`:
    each vertex keeps its height and its distance in front of the plane that touches the jar."""
    activate(obj)
    if obj.type != 'MESH':
        bpy.ops.object.convert(target='MESH')
    bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
    for v in obj.data.vertices:
        dx = v.co.x - jx
        front = jy - math.sqrt(max(radius * radius - dx * dx, 0.0))
        v.co.y = front + (v.co.y - (jy - radius))
    obj.data.update()
    return obj


def build_jar(m, name, px, y, r, h, neck, shoulder, lid, glass, liquid, label_z, fill=0.86):
    x = wx(px)
    profile, inner_r, wall_top = jar_profile(r, h, neck, shoulder)
    jar = lathe(f'{name}_jar', profile, m[glass])
    jar.location = (x, y, 0.0)
    # Cycles traces no caustics: glass that cast shadows would leave the specimen in the dark
    jar.visible_shadow = False
    t = r - inner_r
    fill_h = min(h * fill, wall_top + shoulder - 0.004)
    liquid_profile = [(0.0, 0.0035), (inner_r - 0.0066, 0.0035), (inner_r - 0.0008, 0.010), (inner_r - 0.0008, min(fill_h, wall_top))]
    if fill_h > wall_top:
        # the spirit stands in the shoulder: its top follows the shoulder in
        a = math.asin(min(1.0, (fill_h - wall_top) / (shoulder - t)))
        for k in range(1, 7):
            ak = a * k / 6
            liquid_profile.append((neck - t + (r - neck) * math.cos(ak) - 0.0008, wall_top + (shoulder - t) * math.sin(ak) - 0.0004))
    liquid_profile.append((0.0, liquid_profile[-1][1]))
    spirit = lathe(f'{name}_liquid', liquid_profile, m[liquid])
    spirit.location = (x, y, 0.0)
    spirit.visible_shadow = False
    # the lid
    if lid == 'cork':
        cylinder(f'{name}_cork', (x, y, h + 0.004), neck + 0.002, 0.03, m['cork'], verts=48, r2=neck - 0.003, bevel=0.0015)
        bpy.data.objects[f'{name}_cork'].rotation_euler = (math.pi, 0, 0)
    elif lid == 'wax':
        cylinder(f'{name}_lid', (x, y, h + 0.003), neck + 0.007, 0.006, m['glass'], verts=64, bevel=0.0015)
        torus(f'{name}_seal', (x, y, h + 0.0005), neck + 0.006, 0.0055, m['wax'])
        cylinder(f'{name}_seal_top', (x, y, h + 0.0065), neck * 0.55, 0.004, m['wax'], verts=48, bevel=0.0015)
        tapered_tube(f'{name}_string_a', [Vector((x - neck - 0.009, y - 0.006, h + 0.0005)), Vector((x - neck - 0.014, y - 0.012, h - 0.016)), Vector((x - neck - 0.010, y - 0.014, h - 0.034))], [0.0009] * 3, m['string'])
        tapered_tube(f'{name}_string_b', [Vector((x - neck - 0.009, y - 0.006, h + 0.0005)), Vector((x - neck - 0.006, y - 0.015, h - 0.018)), Vector((x - neck - 0.001, y - 0.020, h - 0.030))], [0.0009] * 3, m['string'])
    elif lid == 'brass':
        cylinder(f'{name}_cap', (x, y, h + 0.006), neck + 0.006, 0.020, m['brass'], verts=64, bevel=0.002)
        for k in range(5):
            torus(f'{name}_knurl_{k}', (x, y, h - 0.0015 + k * 0.004), neck + 0.0062, 0.001, m['brass'], minor_seg=8)
    elif lid == 'stopper':
        cylinder(f'{name}_plug', (x, y, h - 0.008), neck - 0.002, 0.022, m['glass_frosted'], verts=48, r2=neck - 0.008)
        bpy.data.objects[f'{name}_plug'].rotation_euler = (math.pi, 0, 0)
        cylinder(f'{name}_plug_disc', (x, y, h + 0.004), neck + 0.004, 0.006, m['glass'], verts=64, bevel=0.0018)
        sphere(f'{name}_plug_knob', (x, y, h + 0.019), 0.013, m['glass'], scale=(1, 1, 0.8))
    elif lid == 'bakelite':
        cylinder(f'{name}_cap', (x, y, h + 0.008), neck + 0.006, 0.024, m['bakelite'], verts=64, bevel=0.003)
    # the label, on the front of the jar, bent round it
    label_w, label_h = min(0.064, r * 1.2), 0.036
    lz = label_z
    ly = y - r - 0.0004
    wrap(card(f'{name}_label', x - label_w / 2, x + label_w / 2, ly, lz - label_h / 2, lz + label_h / 2, m['paper']), x, y, r)
    for k, dz in enumerate((0.38, -0.38)):
        z = lz + label_h * dz
        wrap(card(f'{name}_rule_{k}', x - label_w * 0.44, x + label_w * 0.44, ly - 0.0004, z - 0.00035, z + 0.00035, m['ink'], thickness=0.0001), x, y, r)
    JARS[name] = dict(x=x, y=y, r=r, h=h, neck=neck, inner=inner_r, fill=liquid_profile[-1][1], label=(x, ly - 0.0005, lz))
    PIVOTS[name] = (x, y - r, 0.0)
    return jar


def jar_label_text(m, name, latin, number):
    j = JARS[name]
    x, ly, lz = j['label']
    wrap(text(f'{name}_latin', latin, (x, ly, lz + 0.0045), 0.0064, m['ink']), j['x'], j['y'], j['r'])
    wrap(text(f'{name}_number', number, (x, ly, lz - 0.0075), 0.0050, m['ink']), j['x'], j['y'], j['r'])


def build_octopus(m, name):
    j = JARS[name]
    x, y = j['x'], j['y']
    body = m['octopus']
    hz = j['fill'] * 0.64  # the head
    # the mantle and the head as one soft body: metaballs that run into each other
    mb = bpy.data.metaballs.new(f'{name}_body')
    mb.resolution = 0.0016
    mb.render_resolution = 0.0012
    mb.threshold = 0.5
    obj = link(bpy.data.objects.new(f'{name}_body', mb))
    obj.data.materials.append(body)

    def blob(c, radius, size=(1, 1, 1)):
        e = mb.elements.new(type='ELLIPSOID')
        e.co = c
        e.radius = radius
        e.size_x, e.size_y, e.size_z = size

    blob((x + 0.003, y + 0.012, hz + 0.050), 0.058, (0.78, 0.72, 0.86))  # the mantle
    blob((x, y - 0.002, hz + 0.004), 0.044, (0.80, 0.72, 0.58))  # the head
    for k in range(8):
        a = math.pi * 2 * k / 8 + 0.4
        blob((x + 0.014 * math.cos(a), y + 0.012 * math.sin(a), hz - 0.014), 0.014, (0.6, 0.6, 0.8))
    # two small eyes, half shut
    # the eyes sit on the sides of the head, under a fold of skin
    for side in (-1, 1):
        sphere(f'{name}_eye_{side}', (x + side * 0.0300, y - 0.0050, hz + 0.008), 0.0034, m['eye'], scale=(0.7, 1.2, 0.7))
        sphere(f'{name}_lid_{side}', (x + side * 0.0292, y - 0.0050, hz + 0.0108), 0.0050, body, scale=(0.8, 1.3, 0.55))
    # eight arms, tangled: each leaves the head, wanders down to the bottom of the jar and curls
    reach = j['inner'] - 0.012
    for k in range(8):
        a = math.pi * 2 * k / 8 + 0.4 + rng.uniform(-0.2, 0.2)
        pts = [Vector((x + 0.014 * math.cos(a), y + 0.012 * math.sin(a), hz - 0.016))]
        heading = Vector((math.cos(a) * 0.8, math.sin(a) * 0.5, -1.0)).normalized()
        cur = pts[0].copy()
        length = rng.uniform(0.14, 0.19)
        steps = 14
        bend = rng.uniform(-1.0, 1.0)
        for s in range(1, steps + 1):
            t = s / steps
            # down at first, then along the bottom and up the wall, coiling more towards the tip
            swing = Matrix.Rotation(bend * 0.35 + (0.5 + t * 1.8) * (0.25 if t > 0.55 else 0.0) * (1 if k % 2 else -1), 3, 'Y')
            heading = (swing @ heading).normalized()
            step = heading * (length / steps)
            cur = cur + step
            # the jar holds it: bounce off the bottom and the wall
            if cur.z < 0.012:
                cur.z = 0.012
                heading.z = abs(heading.z) * 0.6
            off = Vector((cur.x - x, cur.y - y, 0))
            if off.length > reach:
                off = off.normalized() * reach
                cur.x, cur.y = x + off.x, y + off.y
                heading = (heading - off.normalized() * heading.dot(off.normalized()) * 1.6).normalized()
            pts.append(cur.copy())
        radii = [0.0058 * (1 - i / steps) ** 1.15 + 0.0007 for i in range(steps + 1)]
        tapered_tube(f'{name}_arm_{k}', pts, radii, m['octopus_arm'], resolution=10)
    jar_label_text(m, name, 'Octopus vulgaris', 'Sta. 147 - No. 2')


def build_urchin(m, name):
    j = JARS[name]
    x, y = j['x'], j['y']
    r = 0.034
    cz = 0.004 + r * 0.8 + 0.010
    sphere(f'{name}_test', (x, y, cz), r, m['urchin'], scale=(1, 1, 0.8))
    bm = bmesh.new()
    n = 520
    golden = math.pi * (3 - math.sqrt(5))
    for k in range(n):
        zz = 1 - 2 * (k + 0.5) / n
        rr = math.sqrt(1 - zz * zz)
        a = golden * k
        d = Vector((rr * math.cos(a), rr * math.sin(a), zz * 0.8)).normalized()
        if d.z < -0.55:
            continue  # it rests on its spines underneath
        base = Vector((x, y, cz)) + Vector((d.x * r, d.y * r, d.z * r * 0.8))
        length = 0.016 + 0.022 * rng.random() * (0.6 + 0.4 * max(0.0, d.z + 0.3))
        mat = Matrix.Translation(base + d * length / 2) @ d.to_track_quat('Z', 'Y').to_matrix().to_4x4()
        bmesh.ops.create_cone(bm, cap_ends=True, segments=6, radius1=0.0013, radius2=0.00015, depth=length, matrix=mat)
    spine = mat_urchin(f'{name}_spine', (0.50, 0.36, 0.56), (0.12, 0.03, 0.14), (x, y, cz), r * 0.8, r + 0.03)
    mesh_from_bmesh(f'{name}_spines', bm, spine, smooth=40)
    jar_label_text(m, name, 'Echinus esculentus', 'Sta. 149 - No. 7')


def build_nautilus(m, name):
    j = JARS[name]
    x, y = j['x'], j['y']
    cz = j['fill'] * 0.62
    a0 = 0.026
    b = 0.177  # the growth of the spiral: the whorl triples in a turn
    k_tube = 0.52
    theta0, theta1 = -5.0 * math.pi, 0.3 * math.pi
    steps, segs = 360, 40
    bm = bmesh.new()
    uv_layer = bm.loops.layers.uv.new()
    rings = []
    for i in range(steps + 1):
        th = theta0 + (theta1 - theta0) * i / steps
        rad = a0 * math.exp(b * th)
        c = Vector((rad * math.cos(th), 0.0, rad * math.sin(th)))
        radial = Vector((math.cos(th), 0.0, math.sin(th)))
        side = Vector((0.0, 1.0, 0.0))
        rho = rad * k_tube
        ring = []
        for s in range(segs):
            phi = 2 * math.pi * s / segs
            p = c + radial * (rho * math.cos(phi)) + side * (rho * 0.92 * math.sin(phi))
            ring.append(bm.verts.new(p))
        rings.append(ring)
    for i in range(steps):
        for s in range(segs):
            f = bm.faces.new((rings[i][s], rings[i][(s + 1) % segs], rings[i + 1][(s + 1) % segs], rings[i + 1][s]))
            for loop, (ii, ss) in zip(f.loops, ((i, s), (i, s + 1), (i + 1, s + 1), (i + 1, s))):
                loop[uv_layer].uv = (ii / steps, ss / segs)
    # the aperture: a dark mouth with a rim of nacre
    end = rings[-1]
    centre = bm.verts.new(sum((v.co for v in end), Vector()) / segs)
    for s in range(segs):
        bm.faces.new((end[s], end[(s + 1) % segs], centre))
    shell = mesh_from_bmesh(f'{name}_shell', bm, m['shell'], smooth=60)
    shell.data.materials.append(m['eye'])
    for poly in shell.data.polygons[steps * segs :]:
        poly.material_index = 1
    shell.location = (x - 0.004, y, cz)
    shell.rotation_euler = (0, math.radians(-20), math.radians(-18))
    # it hangs from the stopper on a thread
    rod(f'{name}_thread', (x, y, j['h'] - 0.01), (x - 0.006, y + 0.002, cz + 0.046), 0.0004, m['string'], verts=6)
    jar_label_text(m, name, 'Nautilus pompilius', 'Sta. 152 - No. 1')


def build_starfish(m, name):
    j = JARS[name]
    x, y = j['x'], j['y']
    cz = j['fill'] * 0.6
    big, small = 0.050, 0.013
    rings, segs = 14, 200
    bm = bmesh.new()

    def outline(phi):
        c = abs(math.cos(5 * phi / 2))
        return small + (big - small) * c ** 1.8

    top_rings = []
    for i in range(1, rings + 1):
        t = i / rings
        ring = []
        for s in range(segs):
            phi = 2 * math.pi * s / segs
            rr = outline(phi) * t
            reach = outline(phi)
            hgt = 0.0075 * (1 - t ** 2) ** 0.5 * (0.5 + 0.5 * (small / reach) ** 0.3) + 0.0012
            ring.append(bm.verts.new((rr * math.cos(phi), -hgt, rr * math.sin(phi))))
        top_rings.append(ring)
    back = []
    for s in range(segs):
        phi = 2 * math.pi * s / segs
        back.append(bm.verts.new((outline(phi) * 0.92 * math.cos(phi), 0.0035, outline(phi) * 0.92 * math.sin(phi))))
    for a, b2 in zip(top_rings, top_rings[1:]):
        for s in range(segs):
            bm.faces.new((a[s], a[(s + 1) % segs], b2[(s + 1) % segs], b2[s]))
    cap = bm.verts.new((0, -0.0087, 0))
    for s in range(segs):
        bm.faces.new((cap, top_rings[0][(s + 1) % segs], top_rings[0][s]))
    rim = top_rings[-1]
    for s in range(segs):
        bm.faces.new((rim[s], rim[(s + 1) % segs], back[(s + 1) % segs], back[s]))
    bm.faces.new(list(reversed(back)))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    star = mesh_from_bmesh(f'{name}_body', bm, m['starfish'], smooth=70)
    star.location = (x, y + 0.004, cz)
    star.rotation_euler = (0, math.radians(14), 0)
    sub = star.modifiers.new('sub', 'SUBSURF')
    sub.levels = 1
    sub.render_levels = 1
    jar_label_text(m, name, 'Asterias rubens', 'Sta. 148 - No. 4')


def build_coral(m, name):
    j = JARS[name]
    x, y = j['x'], j['y']
    # a block of stone it grows from, and its branches
    span(f'{name}_stone', x - 0.016, x + 0.016, y - 0.012, y + 0.012, 0.0035, 0.018, m['stone'], bevel=0.004, segments=3)
    top = j['fill'] - 0.02

    def branch(p, d, length, radius, depth, idx):
        pts = [p]
        rads = [radius]
        cur = Vector(p)
        dd = Vector(d).normalized()
        for s in range(1, 6):
            dd = (dd + Vector((rng.uniform(-0.25, 0.25), rng.uniform(-0.12, 0.12), rng.uniform(0.0, 0.2)))).normalized()
            cur = cur + dd * (length / 5)
            cur.x = min(max(cur.x, x - j['inner'] + 0.006), x + j['inner'] - 0.006)
            cur.y = min(max(cur.y, y - j['inner'] + 0.006), y + j['inner'] - 0.006)
            cur.z = min(cur.z, top)
            pts.append(cur.copy())
            rads.append(radius * (1 - 0.55 * s / 5))
        tapered_tube(f'{name}_branch_{idx}', pts, rads, m['coral'], resolution=8)
        sphere(f'{name}_tip_{idx}', pts[-1], rads[-1] * 1.15, m['coral'], segments=12, rings=8)
        if depth == 0:
            return
        for k in range(2 + (1 if depth > 1 else 0)):
            at_s = rng.randint(2, 4)
            side = rng.choice((-1, 1))
            nd = Vector((dd.x + side * rng.uniform(0.5, 0.9), dd.y + rng.uniform(-0.3, 0.3), dd.z + rng.uniform(0.0, 0.4)))
            branch(pts[at_s], nd, length * rng.uniform(0.5, 0.7), rads[at_s] * 0.85, depth - 1, f'{idx}_{k}')

    branch(Vector((x, y, 0.016)), Vector((0.05, 0.0, 1.0)), 0.12, 0.0075, 3, 'm')
    jar_label_text(m, name, 'Corallium rubrum', 'Sta. 151 - No. 3')


# --- the tag ----------------------------------------------------------------------------------

TAG = {}


def build_tag(m):
    """A paper tag on a string, hung from a brass hook screwed under the front edge of the shelf, in
    front of the drawer."""
    hx = wx(860)
    hy = SHELF_FRONT + 0.0025  # under the lip of the board, in front of the drawer
    rod('hook_stem', (hx, hy, -0.023), (hx, hy, -0.031), 0.0016, m['brass'], verts=12)
    torus('hook_eye', (hx, hy, -0.0352), 0.0045, 0.0012, m['brass'], rot=(0, math.pi / 2, 0), minor_seg=8)
    knot = Vector((hx, hy - 0.001, -0.0395))
    tw, th, clip = 0.042, 0.050, 0.009
    top = knot.z - 0.012
    cy = hy - 0.0075
    # the string: a loop from the hook down to the eyelet of the tag
    for k, dx in enumerate((-0.0028, 0.0028)):
        tapered_tube(
            f'tag_string_{k}',
            [knot, Vector((hx + dx * 1.4, hy - 0.004, knot.z - 0.008)), Vector((hx + dx * 0.4, cy - 0.0006, top - 0.006))],
            [0.0008] * 3,
            m['string'],
        )
    # the tag: a card with clipped top corners and a brass eyelet
    bm = bmesh.new()
    outline = [(-tw / 2 + clip, 0), (tw / 2 - clip, 0), (tw / 2, -clip), (tw / 2, -th), (-tw / 2, -th), (-tw / 2, -clip)]
    verts = [bm.verts.new((hx + px, cy, top + pz)) for px, pz in outline]
    face = bm.faces.new(list(reversed(verts)))
    bmesh.ops.solidify(bm, geom=[face], thickness=0.0006)
    mesh_from_bmesh('tag_card', bm, m['paper_tag'])
    torus('tag_eyelet', (hx, cy - 0.0004, top - 0.006), 0.0036, 0.0011, m['brass'], rot=(math.pi / 2, 0, 0), minor_seg=8)
    ty = cy - 0.0008
    ink = m['ink']
    text('tag_station', 'Sta. 147', (hx, ty, top - 0.017), 0.0080, ink)
    text('tag_depth', '2,600 fm', (hx, ty, top - 0.027), 0.0060, ink)
    text('tag_date', '14 March', (hx, ty, top - 0.035), 0.0054, ink)
    span('tag_rule', hx - 0.015, hx + 0.015, ty - 0.0001, ty, top - 0.0405, top - 0.0400, ink)
    text('tag_hand', 'trawl, globigerina ooze', (hx, ty, top - 0.045), 0.0037, ink)
    TAG['pivot'] = knot


# --- light ------------------------------------------------------------------------------------


def build_rig():
    """A warm lamp from the upper right, the cool daylight of the porthole from the left, a soft
    light from above that draws the shoulders and lids of the jars."""

    def area(name, loc, target, size, energy, color, shape='DISK', size_y=None):
        light = bpy.data.lights.new(name, 'AREA')
        light.shape = shape
        light.size = size
        if size_y is not None:
            light.size_y = size_y
        light.energy = energy
        light.color = color
        obj = link(bpy.data.objects.new(name, light))
        obj.location = loc
        obj.rotation_euler = (Vector(target) - Vector(loc)).to_track_quat('-Z', 'Y').to_euler()
        obj.visible_camera = False
        return obj

    area('lamp', (0.85, -0.75, 0.75), (0.1, 0.05, 0.12), 0.25, 95, (1.0, 0.70, 0.42))
    area('porthole', (-1.1, -0.55, 0.45), (-0.2, 0.05, 0.15), 0.45, 55, (0.62, 0.78, 1.0))
    area('top', (0.0, -0.05, 0.62), (0.0, -0.02, 0.0), 1.4, 6, (1.0, 0.92, 0.82), shape='RECTANGLE', size_y=0.18)
    world = bpy.data.worlds.new('cabin')
    world.use_nodes = True
    world.node_tree.nodes['Background'].inputs['Color'].default_value = (0.020, 0.016, 0.013, 1)
    world.node_tree.nodes['Background'].inputs['Strength'].default_value = 1.0
    bpy.context.scene.world = world


def build_sun(m):
    """The sun through a porthole off the canvas to the left: a spot whose disc falls on the
    bulkhead above the jars."""
    light = bpy.data.lights.new('sun_spot', 'SPOT')
    light.energy = 900
    light.color = (1.0, 0.80, 0.55)
    light.spot_size = math.radians(6.5)
    light.spot_blend = 0.22
    light.shadow_soft_size = 0.01
    obj = link(bpy.data.objects.new('sun_spot', light))
    target = Vector((wx(420), WALL_Y, 0.36))
    obj.location = target + Vector((-1.0, -1.7, 0.7))
    obj.rotation_euler = (target - obj.location).to_track_quat('-Z', 'Y').to_euler()
    PIVOTS['sunlight'] = target
    # a plain matte screen where the bulkhead stands: the layer is the light alone, without the grain
    # and the chart it falls on, so that it can slide across them as the ship rolls
    screen = span('sun_screen', -0.8, 0.8, WALL_Y, WALL_Y + 0.01, -0.3, 0.8, mat_plain('screen', (0.18, 0.12, 0.08), 0.9))
    screen.visible_shadow = False


# --- rendering --------------------------------------------------------------------------------


def main():
    os.makedirs(OUT, exist_ok=True)
    scene = reset()
    m = materials()
    cols = {}
    layer_names = ('wall', 'shelf', 'coral', 'octopus', 'urchin', 'nautilus', 'starfish', 'rail', 'tag', 'rig', 'sun')
    for part in layer_names:
        cols[part] = collection(part)
    CURRENT['col'] = cols['rig']
    build_rig()
    CURRENT['col'] = cols['sun']
    build_sun(m)
    CURRENT['col'] = cols['wall']
    build_wall(m)
    CURRENT['col'] = cols['shelf']
    build_shelf(m)
    CURRENT['col'] = cols['rail']
    build_rail(m)
    # name, canvas x, depth, radius, height, neck, shoulder, lid, glass, spirit, height of the label
    jars = (
        ('coral', 230, 0.030, 0.042, 0.310, 0.030, 0.030, 'cork', 'glass', 'liquid_pale', 0.088, build_coral),
        ('octopus', 455, 0.004, 0.082, 0.285, 0.050, 0.045, 'wax', 'glass_green', 'liquid', 0.088, build_octopus),
        ('urchin', 680, -0.020, 0.080, 0.165, 0.062, 0.030, 'brass', 'glass', 'liquid_pale', 0.038, build_urchin),
        ('nautilus', 895, 0.012, 0.075, 0.235, 0.040, 0.050, 'stopper', 'glass', 'liquid', 0.084, build_nautilus),
        ('starfish', 1085, -0.028, 0.062, 0.195, 0.046, 0.030, 'bakelite', 'glass_green', 'liquid_pale', 0.084, build_starfish),
    )
    for name, px, y, r, h, neck, shoulder, lid, glass, liquid, label_z, build in jars:
        CURRENT['col'] = cols[name]
        build_jar(m, name, px, y, r, h, neck, shoulder, lid, glass, liquid, label_z)
        build(m, name)
    CURRENT['col'] = cols['tag']
    build_tag(m)
    CURRENT['col'] = None

    layout = {'canvas': [WIDTH, HEIGHT], 'pivots': {}, 'boxes': {}}
    for name in ('coral', 'octopus', 'urchin', 'nautilus', 'starfish'):
        layout['pivots'][name] = [round(c, 3) for c in pixel(PIVOTS[name])]
        j = JARS[name]
        # a generous box round the jar, for the generator to cut stray pixels of the render outside it
        x0, _ = pixel((j['x'] - j['r'] - 0.02, j['y'], 0))
        x1, _ = pixel((j['x'] + j['r'] + 0.02, j['y'], 0))
        _, y0 = pixel((j['x'], j['y'], j['h'] + 0.06))
        _, y1 = pixel((j['x'], j['y'] - j['r'], -0.012))
        layout['boxes'][name] = [round(x0), round(y0), round(x1 - x0), round(y1 - y0)]
    layout['pivots']['tag'] = [round(c, 3) for c in pixel(TAG['pivot'])]
    layout['sunlight'] = [round(c, 3) for c in pixel(PIVOTS['sunlight'])]
    layout['wall_depth'] = WALL_DEPTH
    with open(os.path.join(OUT, 'layout.json'), 'w') as f:
        json.dump(layout, f, indent=2)

    def show(*names):
        for name, col in cols.items():
            col.hide_render = name not in names

    def camera_sees(*names):
        """Only the objects of these collections are seen by the camera; the others are there for the light."""
        for name, col in cols.items():
            for o in col.all_objects:
                o.visible_camera = name in names and o.type != 'LIGHT'

    def render(file, samples):
        scene.cycles.samples = max(16, samples // 8) if DRAFT else samples
        scene.render.filepath = os.path.join(OUT, file)
        bpy.ops.render.render(write_still=True)
        print('rendered', file, flush=True)

    def wanted(part):
        return ONLY is None or part in ONLY

    sun = bpy.data.objects['sun_spot']
    screen = bpy.data.objects['sun_screen']
    jar_names = ('coral', 'octopus', 'urchin', 'nautilus', 'starfish')

    if wanted('composite'):
        show(*layer_names)
        camera_sees(*layer_names)
        screen.hide_render = True
        render('composite.png', 256)
        screen.hide_render = False
    if wanted('wall'):
        show('wall', 'shelf', 'rig')
        camera_sees('wall')
        render('wall.png', 256)
    if wanted('sunlight'):
        # the light of the sun on the bulkhead, on black: the light alone
        world = scene.world
        scene.render.film_transparent = False
        scene.world = bpy.data.worlds.new('black')
        scene.world.use_nodes = True
        scene.world.node_tree.nodes['Background'].inputs['Color'].default_value = (0, 0, 0, 1)
        show('sun')
        camera_sees('sun')
        bounces = scene.cycles.max_bounces
        scene.cycles.max_bounces = 0
        render('sunlight.png', 256)
        scene.cycles.max_bounces = bounces
        scene.world = world
        scene.render.film_transparent = True
    sun.hide_render = True
    if wanted('shelf'):
        show('wall', 'shelf', 'rail', 'rig', *jar_names)
        camera_sees('shelf')
        render('shelf.png', 256)
    for name in jar_names:
        if wanted(name):
            show('wall', 'shelf', 'rail', 'rig', *jar_names)
            camera_sees(name)
            render(f'{name}.png', 384)
    if wanted('rail'):
        show('wall', 'shelf', 'rail', 'rig', *jar_names)
        camera_sees('rail')
        render('rail.png', 256)
    if wanted('tag'):
        show('wall', 'shelf', 'tag', 'rig')
        camera_sees('tag')
        render('tag.png', 256)


main()
