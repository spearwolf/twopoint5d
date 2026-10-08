import {Texture} from 'three/webgpu';
import {describe, expect, test} from 'vitest';

import {attributeNamesOf, nodesOf, samplesTexture, textureNodesOf} from '../../testing/spriteGraph.js';
import {VertexObjectPool} from '../../vertex-objects/VertexObjectPool.js';
import {defineSprite, type SpriteOf} from '../defineSprite.js';
import {FeatureSpritesMaterial} from '../FeatureSprites/FeatureSpritesMaterial.js';
import {QuadBase} from '../SpriteBase.js';
import {AnimatedFrames} from './AnimatedFrames.js';
import {FlatPlacement} from './FlatPlacement.js';
import {InstancePosition} from './InstancePosition.js';
import {QuadSize} from './QuadSize.js';
import {Rotation} from './Rotation.js';
import {TextureColor} from './TextureColor.js';

const kind = defineSprite({
  base: QuadBase,
  features: [InstancePosition, FlatPlacement, QuadSize, Rotation, AnimatedFrames, TextureColor],
});

const makeAnimsMap = (width = 4, height = 4) => {
  const texture = new Texture();
  texture.image = {width, height} as unknown as HTMLImageElement;
  return texture;
};

describe('AnimatedFrames', () => {
  test('declares anim, the time uniform and the animsMap it waits for an image of', () => {
    expect(AnimatedFrames.attributes).toEqual({anim: {components: ['animId', 'animOffset']}});
    expect(AnimatedFrames.uniforms).toEqual({time: 0});
    expect(AnimatedFrames.textures).toEqual({animsMap: {needsImage: true}});
  });

  test('a sprite starts with animId and animOffset at 0, whatever its slot held before', () => {
    const pool = new VertexObjectPool<SpriteOf<typeof kind>>(kind.description, 1);
    const sprite = pool.createVO()!;
    sprite.animId = 3;
    sprite.animOffset = 0.5;
    pool.freeVO(sprite);

    const again = pool.createVO()!;

    expect([again.animId, again.animOffset]).toEqual([0, 0]);
    pool.dispose();
  });

  test('takes the time from the uniforms option and starts at 0 without one', () => {
    const timed = new FeatureSpritesMaterial(kind, {uniforms: {time: 2.5}});
    const plain = new FeatureSpritesMaterial(kind);

    expect([timed.uniforms['time']!.value, plain.uniforms['time']!.value]).toEqual([2.5, 0]);
    timed.dispose();
    plain.dispose();
  });

  test('draws the whole colorMap without trim while there is no animsMap', () => {
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture()}});

    expect(attributeNamesOf(material.positionNode!)).not.toContain('anim');
    expect(attributeNamesOf(material.colorNode!)).not.toContain('anim');
    material.dispose();
  });

  test('an animsMap drives the frame of both graphs, read by the anim attribute and the time', () => {
    const animsMap = makeAnimsMap();
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), animsMap}});

    expect(samplesTexture(material.colorNode!, animsMap)).toBe(true);
    expect(samplesTexture(material.positionNode!, animsMap)).toBe(true);
    expect(attributeNamesOf(material.colorNode!)).toContain('anim');
    const time = material.uniforms['time']!;
    expect([nodesOf(material.colorNode!).has(time), nodesOf(material.positionNode!).has(time)]).toEqual([true, true]);
    // flip and trim come out of the animsMap: the kind holds no texTrim attribute to read
    expect(attributeNamesOf(material.positionNode!)).not.toContain('texTrim');
    material.dispose();
  });

  test('an animsMap of the same kind and another size builds no node and takes the new size', () => {
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), animsMap: makeAnimsMap(4, 4)}});
    const {positionNode, colorNode, version} = material;
    const wider = makeAnimsMap(16, 1);

    material.setTexture('animsMap', wider);

    expect([material.positionNode, material.colorNode, material.version]).toEqual([positionNode, colorNode, version]);
    expect(material.resources.textureSize('animsMap').value.toArray()).toEqual([16, 1]);
    // the four lookups — header, tex coords, flip, trim — between the two graphs: the color graph
    // reads no trim, the position graph no flip
    const lookups = new Set(
      [...textureNodesOf(material.positionNode!), ...textureNodesOf(material.colorNode!)].filter((node) => node.value === wider),
    );
    expect(lookups.size).toBe(4);
    material.dispose();
  });

  test('touchTexture() on an animsMap that had its image builds no node and takes the new size', () => {
    const animsMap = makeAnimsMap(4, 4);
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), animsMap}});
    const {version} = material;
    animsMap.image = {width: 8, height: 8} as unknown as HTMLImageElement;

    material.touchTexture('animsMap');

    expect(material.version).toBe(version);
    expect(material.resources.textureSize('animsMap').value.toArray()).toEqual([8, 8]);
    material.dispose();
  });

  test('waits for the image of the animsMap and picks it up through touchTexture()', () => {
    const animsMap = new Texture();
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), animsMap}});

    expect(samplesTexture(material.colorNode!, animsMap)).toBe(false);
    animsMap.image = {width: 4, height: 4} as unknown as HTMLImageElement;
    material.touchTexture('animsMap');
    expect(samplesTexture(material.colorNode!, animsMap)).toBe(true);
    material.dispose();
  });

  test('an animsMap write builds the position and the color graph once each', () => {
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture()}});
    const {version} = material;

    material.setTexture('animsMap', makeAnimsMap());

    expect(material.version).toBe(version + 2);
    material.dispose();
  });

  test('a time write reaches the uniform and builds no node', () => {
    const material = new FeatureSpritesMaterial(kind, {textures: {colorMap: new Texture(), animsMap: makeAnimsMap()}});
    const {version} = material;

    material.setUniform('time', 1.25);

    expect(material.uniforms['time']!.value).toBe(1.25);
    expect(material.version).toBe(version);
    material.dispose();
  });

  test('does NOT dispose the animsMap and answers undefined for it afterwards', () => {
    const animsMap = makeAnimsMap();
    let disposed = false;
    animsMap.addEventListener('dispose', () => {
      disposed = true;
    });
    const material = new FeatureSpritesMaterial(kind, {textures: {animsMap}});

    material.dispose();

    expect(disposed).toBe(false);
    expect(material.getTexture('animsMap')).toBeUndefined();
    expect(() => material.touchTexture('animsMap')).not.toThrow();
  });
});
