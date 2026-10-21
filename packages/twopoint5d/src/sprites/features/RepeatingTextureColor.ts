import {abs, add, div, float, length, max, mix, mul, step, sub, varying, vec2, vec4} from 'three/tsl';
import {NearestFilter, type Node, type TextureNode} from 'three/webgpu';
import {sampleFrameAt} from '../../texture/sampleFrameAt.js';
import {defineFeature} from '../SpriteFeature.js';

// below this a thickness or a measure of the frame counts as none: the repeat stays finite
const NO_LENGTH = 1e-6;

/**
 * The color of a segment out of the `colorMap`: the frame repeated along the segment with its texels
 * kept square — `(length / thickness) / aspect` times, `aspect` the width over the height of the
 * frame as drawn, the length that of the segment and its caps — and held at its edges across it. A
 * 64 × 16 frame on a segment 8 long and 1 thick repeats twice.
 *
 * Worked out per fragment, so every wrap is exact, with explicit gradients unless both filters of
 * the `colorMap` are `NearestFilter`: a mipmapped frame shows no seam at its wraps. The lookup keeps
 * half a texel inside the frame, so a linear sample never reaches the neighbouring frame of an
 * atlas. A trimmed frame is stretched over the quad. Under `Flip` the segment shows the mirror image
 * of the unflipped segment: mirrored left for right, the repeat counts from the end. Takes the place
 * of `TextureColor`; while no `colorMap` is set the sprite is flat grey, and a texture of the same
 * kind swaps in without a rebuild.
 */
export const RepeatingTextureColor = defineFeature({
  name: 'repeatingTextureColor',
  requires: ['instancePosition', 'segmentEnd', 'quadSize'],
  textures: {colorMap: {}},
  colorSource: (frame, {attribute, uv, sample, textureSize}) => {
    const size = attribute<'vec2'>('quadSize');
    const drawnLength = add(length(sub(attribute<'vec3'>('segmentEnd'), attribute<'vec3'>('instancePosition'))), size.x);
    // the same for every vertex of a sprite, so one varying carries it exactly; recomputed here
    // rather than handed over by the placement, which every segment placement may stand in for
    const ratio = varying(div(drawnLength, max(abs(size.y), NO_LENGTH)));

    const flipDiagonal = (frame.flipDiagonal != null ? step(0.5, frame.flipDiagonal) : float(0)) as unknown as Node<'float'>;
    const texels = textureSize('colorMap');
    // the texels of the frame as it is drawn: under the diagonal flip u runs along the y of the texture
    const drawn = mul(abs(frame.texCoords.zw), mix(texels.xy, texels.yx, flipDiagonal)) as unknown as Node<'vec2'>;
    const repeats = div(mul(ratio, max(drawn.y, NO_LENGTH)), max(drawn.x, NO_LENGTH));

    // A mirror left for right — Flip — draws the mirror image of the whole segment: the frame as it
    // was before the mirror, counted from the end of the segment. A mirror of each repetition alone,
    // which the swapped s and s + u draw, would start the repeat at the same end, and a repeat that is
    // no whole number would end on another part of the frame than the unmirrored one begins with.
    // Upside down needs nothing: across, the frame is drawn once
    let texCoords = frame.texCoords;
    let along: Node<'float'> = uv.x;
    if (frame.mirror != null) {
      const mirrored = frame.mirror.x;
      const c = texCoords;
      texCoords = vec4(add(c.x, mul(c.z, mirrored)), c.y, mul(c.z, sub(1, mul(2, mirrored))), c.w) as unknown as Node<'vec4'>;
      along = mix(uv.x, sub(1, uv.x), mirrored) as unknown as Node<'float'>;
    }

    // ctx.uv read here, in the fragment graph: three interpolates the base uv, and the repeat wraps
    // per fragment
    const position = vec2(mul(along, repeats), uv.y) as unknown as Node<'vec2'>;

    return sampleFrameAt(
      (st, gradX, gradY) => {
        const lookup = sample('colorMap', st) as unknown as TextureNode;
        // three reads a texture whose filters are both NearestFilter with textureLoad and binds no
        // sampler for it, and a grad() fails on WebGPU; that test is part of the shape of a texture,
        // so a texture swapped in without a rebuild passes it alike. Every other texture takes the
        // gradients — on one without mipmaps they sample what a plain lookup samples
        const {minFilter, magFilter} = lookup.value;
        return (minFilter === NearestFilter && magFilter === NearestFilter
          ? lookup
          : lookup.grad(gradX, gradY)) as unknown as Node<'vec4'>;
      },
      {texCoords, flipDiagonal, drawnTexels: drawn},
      position,
      {wrap: ['repeat', 'clamp'], trim: 'stretch', inset: 0.5},
    );
  },
});
