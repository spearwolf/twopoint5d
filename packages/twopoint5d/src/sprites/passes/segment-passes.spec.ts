import {describe, expect, test} from 'vitest';

import {defineSprite} from '../defineSprite.js';
import {FeatureSprites} from '../FeatureSprites/FeatureSprites.js';
import {BillboardPlacement} from '../features/BillboardPlacement.js';
import {FlatPlacement} from '../features/FlatPlacement.js';
import {InstancePosition} from '../features/InstancePosition.js';
import {QuadSize} from '../features/QuadSize.js';
import {SegmentEnd} from '../features/SegmentEnd.js';
import {SegmentPlacement, segmentPlacement} from '../features/SegmentPlacement.js';
import {QuadBase} from '../SpriteBase.js';
import type {SpriteFeature} from '../SpriteFeature.js';
import {definePass} from './definePass.js';
import {BillboardReflectionPass, ReflectionPass, SegmentShadowPass, ShadowPass} from './passPresets.js';
import {PlanarShadow} from './PlanarShadow.js';
import {ShadowMask} from './ShadowMask.js';

const segmentsOn = (placement: SpriteFeature) =>
  defineSprite({base: QuadBase, features: [InstancePosition, SegmentEnd, placement, QuadSize]});

const PLACEMENTS = [SegmentPlacement, segmentPlacement({plane: 'xz'}), segmentPlacement({facing: 'camera'})];

// a kind of flat sprites with a segment end, for which a segment placement may stand in
const flatWithEnd = defineSprite({base: QuadBase, features: [InstancePosition, SegmentEnd, FlatPlacement, QuadSize]});

const shadowRefusal = (placement: SpriteFeature) =>
  `FeatureSprites: feature "lightFacingPlacement" of pass "shadow": it turns each sprite to the light about its instance position, and of a segment of "${placement.name}" it would draw the quad of the caps at the start — take SegmentShadowPass, which projects the segment as it lies`;
const reflectionRefusal = (placement: SpriteFeature) =>
  `FeatureSprites: feature "mirroredBillboardPlacement" of pass "reflection": it places each sprite as a billboard about its instance position, and of a segment of "${placement.name}" it would draw the quad of the caps at the start — take ReflectionPass, which mirrors the segment as it lies`;

describe('passes over segment sprites', () => {
  test('ShadowPass refuses a kind of segments and names SegmentShadowPass', () => {
    for (const placement of PLACEMENTS) {
      expect(() => new FeatureSprites(segmentsOn(placement), {capacity: 1, passes: [ShadowPass]})).toThrow(
        shadowRefusal(placement),
      );
    }
  });

  test('BillboardReflectionPass refuses a kind of segments and names ReflectionPass', () => {
    for (const placement of PLACEMENTS) {
      expect(() => new FeatureSprites(segmentsOn(placement), {capacity: 1, passes: [BillboardReflectionPass]})).toThrow(
        reflectionRefusal(placement),
      );
    }
  });

  test('ShadowPass refuses a segment placement swapped in, and every material keeps its placement', () => {
    for (const placement of PLACEMENTS) {
      const sprites = new FeatureSprites(flatWithEnd, {capacity: 1, passes: [ShadowPass, ReflectionPass]});

      expect(() => {
        sprites.placement = placement;
      }).toThrow(shadowRefusal(placement));
      expect(sprites.placement).toBe(FlatPlacement);
      expect(sprites.passes['reflection']!.material.placement).toBe(FlatPlacement);
      sprites.dispose();
    }
  });

  test('BillboardReflectionPass refuses a segment placement swapped in, and every material keeps its placement', () => {
    for (const placement of PLACEMENTS) {
      const sprites = new FeatureSprites(flatWithEnd, {capacity: 1, passes: [BillboardReflectionPass, SegmentShadowPass]});

      expect(() => {
        sprites.placement = placement;
      }).toThrow(reflectionRefusal(placement));
      expect(sprites.placement).toBe(FlatPlacement);
      expect(sprites.passes['shadow']!.material.placement).toBe(FlatPlacement);
      sprites.dispose();
    }
  });

  test('ShadowPass refuses a segment placement handed in as the placement option', () => {
    for (const placement of PLACEMENTS) {
      expect(() => new FeatureSprites(flatWithEnd, {capacity: 1, passes: [ShadowPass], placement})).toThrow(
        shadowRefusal(placement),
      );
    }
  });

  test('both still take a kind that holds a segment end but no segment placement', () => {
    const kind = defineSprite({base: QuadBase, features: [InstancePosition, SegmentEnd, BillboardPlacement, QuadSize]});

    const shadowed = new FeatureSprites(kind, {capacity: 1, passes: [ShadowPass]});
    const mirrored = new FeatureSprites(kind, {capacity: 1, passes: [BillboardReflectionPass]});

    expect(Object.keys(shadowed.passes)).toEqual(['shadow']);
    expect(Object.keys(mirrored.passes)).toEqual(['reflection']);
    shadowed.dispose();
    mirrored.dispose();
  });

  test('SegmentShadowPass is ShadowPass without the turn to the light, named shadow', () => {
    expect(SegmentShadowPass.name).toBe('shadow');
    expect(SegmentShadowPass.features).toEqual([PlanarShadow, ShadowMask]);
    expect(SegmentShadowPass.material).toEqual(ShadowPass.material);
    expect(SegmentShadowPass.renderOrder).toBe(ShadowPass.renderOrder);
    expect(SegmentShadowPass.visible).toBe(ShadowPass.visible);
    expect(SegmentShadowPass).toEqual(definePass({...ShadowPass, features: [PlanarShadow, ShadowMask]}));
  });

  test('SegmentShadowPass and ReflectionPass draw segments with the placement of the sprites', () => {
    for (const placement of PLACEMENTS) {
      const sprites = new FeatureSprites(segmentsOn(placement), {capacity: 1, passes: [SegmentShadowPass, ReflectionPass]});

      expect(sprites.passes['shadow']!.material.placement).toBe(placement);
      expect(sprites.passes['reflection']!.material.placement).toBe(placement);
      sprites.dispose();
    }
  });
});
