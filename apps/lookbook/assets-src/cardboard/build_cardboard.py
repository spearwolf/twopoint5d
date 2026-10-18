"""Builds the cardboard atlas and the turntable texture of the lookbook demo `cardboard-parade`.

    python3 build_cardboard.py                 # render in Blender, then shade, cut, pack, check
    python3 build_cardboard.py --skip-render   # reuse the renders in .render-cache/

Writes `apps/lookbook/public/assets/cardboard/`: `cardboard.png` and `cardboard.json` (TexturePacker
JSON Hash), and `turntable.webp`. See README.md.
"""

import argparse
import json
import os
import shutil
import subprocess
import sys

import numpy as np
from PIL import Image

from prop_defs import BANDS, LIGHT, MARGIN, MATERIALS, PAPER, PAPER_EDGE, PROPS, SUPERSAMPLE

HERE = os.path.dirname(os.path.abspath(__file__))
CACHE = os.path.join(HERE, '.render-cache')
OUT = os.path.normpath(os.path.join(HERE, '..', '..', 'public', 'assets', 'cardboard'))
ATLAS_WIDTH = 1024
PADDING = 2

# a sample is opaque when at least this many of the SUPERSAMPLE² samples of its pixel hit a surface
OPAQUE_VOTES = 7

# the color index of every material and band: 1 + 3 · (id - 1) + band, 0 for no surface
RAMPS = [color for ramp in MATERIALS.values() for color in ramp]
PALETTE = np.array([(0, 0, 0)] + RAMPS, dtype=np.float64)


def seed_of(name):
    """A seed from the name of a frame, the same on every run and every machine."""
    return sum((i + 1) * ord(c) for i, c in enumerate(name))


# --- render ---

def run_blender():
    blender = shutil.which('blender') or '/usr/bin/blender'
    if os.path.isdir(CACHE):
        shutil.rmtree(CACHE)
    subprocess.run([blender, '--background', '--factory-startup', '--python', os.path.join(HERE, 'blender_render.py'),
                    '--', CACHE], check=True, stdout=subprocess.DEVNULL)


# --- shading ---

def color_indices(gbuffer):
    """The color index of every sample of a G-buffer render: the material and the band of its light."""
    rgba = gbuffer.astype(np.float64) / 255
    covered = gbuffer[..., 3] > 127
    nx = rgba[..., 0] * 2 - 1
    nz = rgba[..., 1] * 2 - 1
    # the visible side of a surface faces the viewer, along -y
    ny = -np.sqrt(np.clip(1 - nx * nx - nz * nz, 0, 1))
    light = np.array(LIGHT) / np.linalg.norm(LIGHT)
    term = np.clip(nx * light[0] + ny * light[1] + nz * light[2], 0, 1)
    band = np.digitize(term, BANDS)
    material = gbuffer[..., 2].astype(np.int64)
    indices = np.where(covered & (material > 0), 1 + 3 * (material - 1) + band, 0)
    return indices


def downscale(indices):
    """One color per output pixel by a vote of its samples, so colors never blend."""
    s = SUPERSAMPLE
    h, w = indices.shape[0] // s, indices.shape[1] // s
    blocks = indices[: h * s, : w * s].reshape(h, s, w, s).transpose(0, 2, 1, 3).reshape(h, w, s * s)
    votes = np.zeros((h, w, len(PALETTE)), dtype=np.int64)
    for index in np.unique(blocks):
        if index != 0:
            votes[..., index] = (blocks == index).sum(axis=2)
    opaque = votes.sum(axis=2) >= OPAQUE_VOTES
    return np.where(opaque, votes.argmax(axis=2), 0)


def dilate(mask, radius):
    out = mask.copy()
    h, w = mask.shape
    for dy in range(-radius, radius + 1):
        for dx in range(-radius, radius + 1):
            if dx * dx + dy * dy > radius * radius + radius:
                continue
            shifted = np.zeros_like(mask)
            shifted[max(dy, 0): h + min(dy, 0), max(dx, 0): w + min(dx, 0)] = \
                mask[max(-dy, 0): h + min(-dy, 0), max(-dx, 0): w + min(-dx, 0)]
            out |= shifted
    return out


def grain(shape, name, strength):
    rng = np.random.default_rng(seed_of(name))
    return 1 + strength * np.clip(rng.standard_normal(shape), -2, 2)


def cut_out(indices, name):
    """The print on paper: the shaded colors with a grain, the die-cut margin and its edge."""
    print_mask = indices > 0
    rgb = PALETTE[indices] * grain(indices.shape, name, 0.025)[..., None]
    margin = dilate(print_mask, MARGIN)
    edge = margin & ~print_mask & ~erode(margin)
    paper = np.array(PAPER, dtype=np.float64) * grain(indices.shape, name + '/paper', 0.012)[..., None]
    rgb = np.where((margin & ~print_mask)[..., None], paper, rgb)
    rgb = np.where(edge[..., None], np.array(PAPER_EDGE, dtype=np.float64), rgb)
    alpha = np.where(margin, 255, 0)
    image = np.dstack([np.clip(np.rint(rgb), 0, 255), alpha]).astype(np.uint8)
    image[~margin] = 0
    return image, print_mask


def erode(mask):
    padded = np.pad(mask, 1, constant_values=False)
    return (padded[1:-1, 1:-1] & padded[:-2, 1:-1] & padded[2:, 1:-1] & padded[1:-1, :-2] & padded[1:-1, 2:])


# --- 2D frames ---

def blob_shadow(size=64):
    y, x = np.mgrid[0:size, 0:size] + 0.5
    r = np.hypot(x - size / 2, y - size / 2) / (size / 2 - 1)
    t = np.clip((1 - r) / 0.6, 0, 1)
    alpha = np.rint(160 * t * t * (3 - 2 * t))
    image = np.zeros((size, size, 4), dtype=np.uint8)
    image[..., 0], image[..., 1], image[..., 2] = 52, 38, 26
    image[..., 3] = alpha
    image[alpha == 0] = 0
    return image


def ellipse(shape, cx, cy, rx, ry):
    y, x = np.mgrid[0: shape[0], 0: shape[1]] + 0.5
    return ((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1


def stamp(mask, name, rgb, alpha):
    image = np.zeros(mask.shape + (4,), dtype=np.uint8)
    shade = grain(mask.shape, name, 0.06)
    for i in range(3):
        image[..., i] = np.where(mask, np.clip(np.rint(rgb[i] * shade), 0, 255), 0)
    image[..., 3] = np.where(mask, alpha, 0)
    return image


def footprint(left):
    """A shoe print, the toes at the top of the frame; the left one bends inward to the right."""
    shape = (44, 22)
    bend = 1.5 if left else -1.5
    sole = ellipse(shape, 11 + bend, 13, 8, 11) | ellipse(shape, 11 - bend * 0.5, 34, 6, 7)
    gap = ellipse(shape, 11, 25, 9, 1.4)
    return stamp(sole & ~gap, 'foot_left' if left else 'foot_right', (92, 64, 40), 190)


def paw():
    shape = (28, 28)
    mask = ellipse(shape, 14, 19, 7, 6)
    for cx, cy in ((6, 10), (11, 6), (17, 6), (22, 10)):
        mask |= ellipse(shape, cx, cy, 3, 3.4)
    return stamp(mask, 'paw', (92, 64, 40), 190)


def turntable(size=512):
    """The disc of the turntable: the end grain of a tree slice, year rings and a ring of bark."""
    rng = np.random.default_rng(seed_of('turntable'))
    y, x = np.mgrid[0:size, 0:size] + 0.5
    dx, dy = x / size * 2 - 1, y / size * 2 - 1
    r = np.hypot(dx, dy)
    angle = np.arctan2(dy, dx)
    wobble = 0.02 * np.sin(angle * 3 + 1.3) + 0.01 * np.sin(angle * 5 + 0.4)
    rings = 0.5 + 0.5 * np.cos((r + wobble * r) * 2 * np.pi * 11 + r * r * 9)
    light = np.array((226, 190, 136), dtype=np.float64)
    dark = np.array((204, 162, 108), dtype=np.float64)
    wood = light + (dark - light) * (rings ** 3)[..., None]
    wood *= (1 + 0.015 * np.clip(rng.standard_normal((size, size)), -2, 2))[..., None]
    bark = np.array((92, 62, 38), dtype=np.float64)
    wood = np.where((r > 0.955)[..., None], bark, wood)
    wood = np.where(((r > 0.94) & (r <= 0.955))[..., None], np.array((150, 108, 66), dtype=np.float64), wood)
    image = np.dstack([np.clip(np.rint(wood), 0, 255), np.where(r <= 1, 255, 0)]).astype(np.uint8)
    image[r > 1] = 0
    return image


# --- packing ---

def pack(frames):
    """Shelves, the highest frames first; the sheet is ATLAS_WIDTH wide and a power of two high."""
    order = sorted(frames, key=lambda name: (-frames[name].shape[0], name))
    x = y = shelf = 0
    places = {}
    for name in order:
        h, w = frames[name].shape[:2]
        if x + w > ATLAS_WIDTH:
            x, y, shelf = 0, y + shelf + PADDING, 0
        places[name] = (x, y)
        x += w + PADDING
        shelf = max(shelf, h)
    height = 1
    while height < y + shelf:
        height *= 2
    sheet = np.zeros((height, ATLAS_WIDTH, 4), dtype=np.uint8)
    for name, (px, py) in places.items():
        h, w = frames[name].shape[:2]
        sheet[py: py + h, px: px + w] = frames[name]
    return sheet, places


def atlas_json(frames, places, sheet):
    entries = {}
    for name in sorted(frames):
        h, w = frames[name].shape[:2]
        x, y = places[name]
        entries[name] = {
            'frame': {'x': x, 'y': y, 'w': w, 'h': h},
            'rotated': False,
            'trimmed': False,
            'spriteSourceSize': {'x': 0, 'y': 0, 'w': w, 'h': h},
            'sourceSize': {'w': w, 'h': h},
        }
    return {
        'frames': entries,
        'meta': {
            'app': 'apps/lookbook/assets-src/cardboard/build_cardboard.py',
            'image': 'cardboard.png',
            'format': 'RGBA8888',
            'size': {'w': sheet.shape[1], 'h': sheet.shape[0]},
            'scale': '1',
        },
    }


# --- checks ---

def check(frames, standing, print_masks):
    failures = []
    expected = {prop['name'] for prop in PROPS} | {'blob', 'foot_left', 'foot_right', 'paw'}
    if set(frames) != expected:
        failures.append(f'frames {sorted(set(frames) ^ expected)} missing or unexpected')
    for name, image in frames.items():
        alpha = image[..., 3] > 0
        if not alpha.any():
            failures.append(f'{name}: empty')
            continue
        if alpha[0].any() or alpha[:, 0].any() or alpha[:, -1].any():
            failures.append(f'{name}: touches the top, left or right edge of its frame')
        if name in standing:
            if not alpha[-1].any():
                failures.append(f'{name}: stands above the bottom edge of its frame')
            rows = np.nonzero(print_masks[name].any(axis=1))[0]
            if rows[-1] != image.shape[0] - 1 - MARGIN:
                failures.append(f'{name}: the print ends {image.shape[0] - 1 - rows[-1]} px above the bottom, not {MARGIN}')
        elif alpha[-1].any():
            failures.append(f'{name}: touches the bottom edge of its frame')
    return failures


def main():
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument('--skip-render', action='store_true', help='reuse the renders in .render-cache/')
    args = parser.parse_args()

    if not args.skip_render:
        run_blender()

    frames, print_masks = {}, {}
    standing = {prop['name'] for prop in PROPS if prop['standing']}
    for prop in PROPS:
        name = prop['name']
        gbuffer = np.asarray(Image.open(os.path.join(CACHE, f'{name}.png')).convert('RGBA'))
        frames[name], print_masks[name] = cut_out(downscale(color_indices(gbuffer)), name)
    frames['blob'] = blob_shadow()
    frames['foot_left'] = footprint(left=True)
    frames['foot_right'] = footprint(left=False)
    frames['paw'] = paw()

    failures = check(frames, standing, print_masks)
    if failures:
        print('\n'.join(failures), file=sys.stderr)
        sys.exit(1)

    sheet, places = pack(frames)
    os.makedirs(OUT, exist_ok=True)
    Image.fromarray(sheet, 'RGBA').save(os.path.join(OUT, 'cardboard.png'), optimize=True)
    with open(os.path.join(OUT, 'cardboard.json'), 'w') as file:
        json.dump(atlas_json(frames, places, sheet), file, indent=2)
        file.write('\n')
    # the rings of the disc compress badly as a PNG; a lossy WebP is a tenth of it
    Image.fromarray(turntable(), 'RGBA').save(os.path.join(OUT, 'turntable.webp'), quality=88, method=6)
    print(f'{len(frames)} frames on {sheet.shape[1]} x {sheet.shape[0]} px, and the turntable — in {OUT}')


main()
