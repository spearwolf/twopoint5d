"""The cardboard cut-outs of the lookbook demo `cardboard-parade`, as data.

Shared by both sides: `blender_render.py` builds the props inside Blender, `build_cardboard.py`
shades, cuts and packs what Blender rendered. Plain Python, no imports from either.

Units are meters. A standing prop stands on z = 0 and faces -y, the front view of Blender; its x
runs to the right of the image, its z up.
"""

# output pixels per meter, and the supersampling of the render
PX_PER_M = 64
SUPERSAMPLE = 4

# the die-cut margin around the print, in output pixels
MARGIN = 3

# the light of the print, in the space of the render: x right, y away from the viewer, z up — from
# the upper left, a little in front
LIGHT = (-0.55, -0.55, 0.63)

# the light term at which the print steps from the shadow color to the middle one, and on to the light one
BANDS = (0.28, 0.72)

# paper: the margin of the cut, and its edge
PAPER = (244, 239, 225)
PAPER_EDGE = (185, 171, 143)

# each material is a ramp of three colors: in shadow, lit, in full light
MATERIALS = {
    'leaf': ((78, 122, 58), (111, 158, 75), (156, 196, 106)),
    'fir': ((47, 94, 70), (70, 128, 94), (106, 163, 122)),
    'poplar': ((192, 138, 42), (224, 173, 60), (244, 208, 106)),
    'trunk': ((107, 74, 47), (138, 98, 64), (168, 128, 90)),
    'wall_cream': ((217, 199, 160), (236, 220, 183), (251, 240, 210)),
    'wall_terracotta': ((168, 85, 56), (201, 111, 76), (227, 143, 108)),
    'wall_blue': ((92, 127, 158), (122, 160, 191), (159, 194, 220)),
    'roof_red': ((142, 59, 46), (176, 78, 58), (207, 106, 79)),
    'roof_slate': ((76, 85, 102), (100, 111, 130), (133, 146, 166)),
    'window': ((46, 74, 99), (63, 101, 133), (111, 156, 192)),
    'door': ((90, 58, 38), (122, 80, 52), (154, 106, 70)),
    'wood': ((154, 112, 72), (185, 138, 90), (214, 168, 116)),
    'sign_yellow': ((214, 164, 30), (240, 193, 58), (255, 224, 122)),
    'sign_teal': ((47, 138, 134), (63, 169, 164), (111, 202, 196)),
    'sign_pink': ((196, 87, 122), (224, 115, 151), (243, 155, 182)),
    'sign_orange': ((200, 100, 42), (232, 128, 62), (248, 164, 102)),
    'skin': ((201, 142, 106), (226, 170, 133), (243, 200, 166)),
    'cloth_red': ((168, 52, 52), (204, 72, 66), (232, 110, 98)),
    'cloth_blue': ((52, 82, 150), (70, 108, 186), (110, 146, 214)),
    'cloth_green': ((58, 120, 82), (78, 152, 104), (118, 186, 138)),
    'cloth_purple': ((104, 66, 140), (132, 90, 170), (168, 128, 204)),
    'hat': ((42, 42, 51), (60, 60, 72), (90, 90, 106)),
    'feather': ((216, 212, 200), (239, 235, 224), (255, 250, 240)),
    'beak': ((214, 120, 30), (240, 150, 46), (255, 186, 90)),
    'fur': ((138, 90, 52), (168, 115, 63), (200, 147, 90)),
    'ink': ((30, 30, 36), (30, 30, 36), (30, 30, 36)),
}

# the id a material carries through the render: its place in MATERIALS, from 1 — 0 is no surface
MATERIAL_IDS = {name: i + 1 for i, name in enumerate(MATERIALS)}


def box(material, center, size, rotation=(0, 0, 0)):
    return {'shape': 'box', 'material': material, 'center': center, 'size': size, 'rotation': rotation}


def cylinder(material, base, radius, height, segments=16, smooth=True):
    return {'shape': 'cone', 'material': material, 'base': base, 'radius1': radius, 'radius2': radius,
            'height': height, 'segments': segments, 'smooth': smooth}


def cone(material, base, radius1, height, radius2=0.0, segments=16, smooth=False):
    return {'shape': 'cone', 'material': material, 'base': base, 'radius1': radius1, 'radius2': radius2,
            'height': height, 'segments': segments, 'smooth': smooth}


def sphere(material, center, radius, scale=(1, 1, 1), smooth=True):
    return {'shape': 'sphere', 'material': material, 'center': center, 'radius': radius, 'scale': scale,
            'smooth': smooth}


def hull(material, points):
    """A convex hull of the points, flat shaded."""
    return {'shape': 'hull', 'material': material, 'points': points}


def prism_roof(material, center_x, eaves_z, ridge_z, width, depth):
    """A gable roof: a triangle across x, extruded along y."""
    half_w = width / 2
    half_d = depth / 2
    points = []
    for y in (-half_d, half_d):
        points += [(center_x - half_w, y, eaves_z), (center_x + half_w, y, eaves_z), (center_x, y, ridge_z)]
    return hull(material, points)


def arrow_board(material, z, length=0.75, height=0.24, thickness=0.06, x0=-0.06):
    """A sign board that points to +x, its blunt end at x0."""
    tip = x0 + length
    shoulder = tip - height * 0.6
    points = []
    for y in (-thickness / 2, thickness / 2):
        points += [(x0, y, z - height / 2), (x0, y, z + height / 2), (shoulder, y, z + height / 2),
                   (tip, y, z), (shoulder, y, z - height / 2)]
    return hull(material, points)


def window(center_x, center_z, width=0.22, height=0.28, front=-0.46):
    return box('window', (center_x, front, center_z), (width, 0.04, height))


def door(center_x, width=0.26, height=0.5, front=-0.46):
    return box('door', (center_x, front, height / 2), (width, 0.04, height))


def eyes(center_x, z, front, spacing=0.055, radius=0.022):
    return [sphere('ink', (center_x - spacing, front, z), radius), sphere('ink', (center_x + spacing, front, z), radius)]


def person(cloth, hat):
    """A figure seen from the front: legs, a coat as a cone, a head, eyes and a hat."""
    parts = [
        cylinder('hat', (-0.06, 0, 0), 0.045, 0.28, segments=10),
        cylinder('hat', (0.06, 0, 0), 0.045, 0.28, segments=10),
        cone(cloth, (0, 0, 0.24), 0.22, 0.52, radius2=0.09, segments=20, smooth=True),
        sphere(cloth, (-0.2, 0, 0.6), 0.055),
        sphere(cloth, (0.2, 0, 0.6), 0.055),
        sphere('skin', (0, 0, 0.9), 0.15),
        *eyes(0, 0.92, -0.135),
    ]
    if hat == 'top':
        parts += [cylinder('hat', (0, 0, 1.0), 0.16, 0.025), cylinder('hat', (0, 0, 1.02), 0.1, 0.2)]
    elif hat == 'cone':
        parts += [cone('hat', (0, 0, 0.98), 0.14, 0.32, segments=20, smooth=True)]
    elif hat == 'beret':
        parts += [sphere('hat', (0.03, 0, 1.03), 0.13, scale=(1.15, 1.15, 0.45))]
    elif hat == 'bun':
        parts += [sphere('trunk', (0, 0.02, 1.07), 0.075), sphere('trunk', (0, 0.03, 0.97), 0.14, scale=(1.05, 1, 0.8))]
    return parts


DOG = [
    box('fur', (0, 0, 0.32), (0.46, 0.14, 0.16)),
    box('fur', (-0.17, 0, 0.13), (0.06, 0.06, 0.26)),
    box('fur', (-0.08, 0, 0.13), (0.06, 0.06, 0.26)),
    box('fur', (0.1, 0, 0.13), (0.06, 0.06, 0.26)),
    box('fur', (0.19, 0, 0.13), (0.06, 0.06, 0.26)),
    box('fur', (0.27, 0, 0.47), (0.17, 0.13, 0.15)),
    box('fur', (0.38, 0, 0.44), (0.09, 0.09, 0.08)),
    sphere('ink', (0.43, -0.03, 0.46), 0.025),
    box('trunk', (0.22, -0.04, 0.53), (0.05, 0.03, 0.13), rotation=(0, -20, 0)),
    sphere('ink', (0.31, -0.07, 0.5), 0.018),
    box('fur', (-0.28, 0, 0.42), (0.04, 0.04, 0.2), rotation=(0, -35, 0)),
]

DUCK = [
    box('beak', (-0.03, 0, 0.015), (0.09, 0.08, 0.03)),
    box('beak', (0.05, 0, 0.015), (0.09, 0.08, 0.03)),
    cylinder('beak', (-0.03, 0, 0.0), 0.012, 0.1, segments=8),
    cylinder('beak', (0.04, 0, 0.0), 0.012, 0.1, segments=8),
    sphere('feather', (0, 0, 0.24), 0.17, scale=(1.35, 0.9, 0.9)),
    hull('feather', [(-0.26, -0.05, 0.26), (-0.26, 0.05, 0.26), (-0.36, 0, 0.36), (-0.16, -0.06, 0.32), (-0.16, 0.06, 0.32)]),
    sphere('feather', (0.17, 0, 0.44), 0.1),
    cone('beak', (0.24, 0, 0.43), 0.035, 0.12, segments=10),
    sphere('ink', (0.21, -0.08, 0.47), 0.018),
]


def _fence():
    parts = [box('wood', (-0.7, 0, 0.4), (0.09, 0.09, 0.8)), box('wood', (0.7, 0, 0.4), (0.09, 0.09, 0.8))]
    parts += [box('wood', (0, 0.02, z), (1.5, 0.04, 0.08)) for z in (0.25, 0.58)]
    for i in range(6):
        x = -0.5 + i * 0.2
        parts.append(hull('wood', [(x - 0.05, -0.01, 0.02), (x + 0.05, -0.01, 0.02), (x - 0.05, -0.01, 0.62),
                                   (x + 0.05, -0.01, 0.62), (x, -0.01, 0.72), (x - 0.05, -0.04, 0.02),
                                   (x + 0.05, -0.04, 0.02), (x - 0.05, -0.04, 0.62), (x + 0.05, -0.04, 0.62),
                                   (x, -0.04, 0.72)]))
    return parts


def _signpost(material):
    return [cylinder('wood', (0, 0, 0), 0.045, 1.35, segments=10), arrow_board(material, 1.15),
            arrow_board(material, 0.86, length=0.6, height=0.2)]


# every prop of the atlas: its name in the atlas, whether it stands on the ground (its feet on the
# bottom edge of the frame), and its parts
PROPS = [
    {'name': 'tree_round', 'standing': True, 'parts': [
        cylinder('trunk', (0, 0, 0), 0.08, 0.95), sphere('leaf', (0, 0, 1.25), 0.55),
        sphere('leaf', (-0.32, 0, 1.0), 0.3), sphere('leaf', (0.34, 0, 1.05), 0.32)]},
    {'name': 'tree_fir', 'standing': True, 'parts': [
        cylinder('trunk', (0, 0, 0), 0.07, 0.4), cone('fir', (0, 0, 0.3), 0.6, 0.8, segments=7),
        cone('fir', (0, 0, 0.75), 0.46, 0.7, segments=7), cone('fir', (0, 0, 1.2), 0.32, 0.6, segments=7)]},
    {'name': 'tree_poplar', 'standing': True, 'parts': [
        cylinder('trunk', (0, 0, 0), 0.06, 0.5), sphere('poplar', (0, 0, 1.3), 0.32, scale=(1, 1, 2.8))]},
    {'name': 'bush', 'standing': True, 'parts': [
        sphere('leaf', (-0.24, 0, 0.18), 0.26), sphere('leaf', (0.24, 0, 0.17), 0.25),
        sphere('leaf', (0, 0, 0.3), 0.34)]},
    {'name': 'house_cream', 'standing': True, 'parts': [
        box('wall_cream', (0, 0, 0.5), (1.2, 0.9, 1.0)), prism_roof('roof_red', 0, 0.98, 1.55, 1.42, 1.0),
        door(0.28), window(-0.3, 0.6), window(0, 1.18, width=0.18, height=0.18, front=-0.52),
        box('roof_red', (0.38, 0, 1.45), (0.14, 0.14, 0.4))]},
    {'name': 'house_tall', 'standing': True, 'parts': [
        box('wall_terracotta', (0, 0, 0.85), (0.8, 0.8, 1.7)), prism_roof('roof_slate', 0, 1.68, 2.15, 0.98, 0.9),
        door(0), window(-0.18, 0.95), window(0.18, 0.95), window(-0.18, 1.4), window(0.18, 1.4)]},
    {'name': 'house_wide', 'standing': True, 'parts': [
        box('wall_blue', (0, 0, 0.45), (1.6, 0.9, 0.9)), prism_roof('roof_slate', 0, 0.88, 1.22, 1.78, 1.0),
        door(-0.45), window(0.05, 0.5, width=0.3), window(0.5, 0.5, width=0.3),
        box('roof_red', (-0.5, 0, 1.2), (0.16, 0.16, 0.36))]},
    {'name': 'fence', 'standing': True, 'parts': _fence()},
    {'name': 'sign_yellow', 'standing': True, 'parts': _signpost('sign_yellow')},
    {'name': 'sign_teal', 'standing': True, 'parts': _signpost('sign_teal')},
    {'name': 'sign_pink', 'standing': True, 'parts': _signpost('sign_pink')},
    {'name': 'sign_orange', 'standing': True, 'parts': _signpost('sign_orange')},
    {'name': 'figure_red', 'standing': True, 'parts': person('cloth_red', 'beret')},
    {'name': 'figure_blue', 'standing': True, 'parts': person('cloth_blue', 'top')},
    {'name': 'figure_green', 'standing': True, 'parts': person('cloth_green', 'cone')},
    {'name': 'figure_purple', 'standing': True, 'parts': person('cloth_purple', 'bun')},
    {'name': 'dog', 'standing': True, 'parts': DOG},
    {'name': 'duck', 'standing': True, 'parts': DUCK},
]
