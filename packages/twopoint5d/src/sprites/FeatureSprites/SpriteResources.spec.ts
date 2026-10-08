import {createEffect, getEffectsCount, getSignalsCount} from '@spearwolf/signalize';
import {createSandbox} from 'sinon';
import {NearestFilter, Texture, Vector2, Vector3, Vector4} from 'three/webgpu';
import {afterEach, describe, expect, test} from 'vitest';

import {defineFeature} from '../SpriteFeature.js';
import {SpriteResources} from './SpriteResources.js';

const anim = defineFeature({name: 'anim', uniforms: {time: 0, light: [0.4, -1, 0.3]}, textures: {animsMap: {needsImage: true}}});
const color = defineFeature({name: 'color', textures: {colorMap: {}}});

const withImage = (width: number, height: number) => {
  const texture = new Texture();
  texture.image = {width, height} as unknown as HTMLImageElement;
  return texture;
};

describe('SpriteResources', () => {
  const sandbox = createSandbox();
  afterEach(() => sandbox.restore());

  test('holds one uniform per declared name, at its start value or the value it is given', () => {
    const resources = new SpriteResources([anim, color], {uniforms: {time: 2}});

    expect(resources.uniforms['time']!.value).toBe(2);
    expect(resources.uniforms['light']!.value).toEqual(new Vector3(0.4, -1, 0.3));
    expect(resources.textureNames).toEqual(['animsMap', 'colorMap']);
    resources.dispose();
  });

  test('skips a start value of undefined', () => {
    const resources = new SpriteResources([anim], {uniforms: {time: undefined}});

    expect(resources.uniforms['time']!.value).toBe(0);
    resources.dispose();
  });

  test('setUniform() writes a number or the components of a vector', () => {
    const resources = new SpriteResources([anim]);

    resources.setUniform('time', 1.5);
    resources.setUniform('light', 1, 2, 3);

    expect(resources.uniforms['time']!.value).toBe(1.5);
    expect(resources.uniforms['light']!.value).toEqual(new Vector3(1, 2, 3));
    expect(() => resources.setUniform('light', 1, 2)).toThrow(
      'SpriteResources: the uniform "light" is a vec3 and takes 3 values',
    );
    resources.dispose();
  });

  test('holds a vec2 and a vec4 uniform, and takes start values for them', () => {
    const shaped = defineFeature({name: 'shaped', uniforms: {offset: [1, 2], tint: [1, 1, 1, 1]}});
    const resources = new SpriteResources([shaped], {uniforms: {tint: [0.5, 0.25, 0, 1]}});

    expect(resources.uniforms['offset']!.value).toEqual(new Vector2(1, 2));
    expect(resources.uniforms['tint']!.value).toEqual(new Vector4(0.5, 0.25, 0, 1));
    resources.setUniform('offset', 3, 4);
    resources.setUniform('tint', 0, 0, 1, 0.5);
    expect(resources.uniforms['offset']!.value).toEqual(new Vector2(3, 4));
    expect(resources.uniforms['tint']!.value).toEqual(new Vector4(0, 0, 1, 0.5));
    resources.dispose();
  });

  test('refuses more values than a float uniform takes', () => {
    const resources = new SpriteResources([anim]);

    expect(() => resources.setUniform('time', 1, 2)).toThrow('SpriteResources: the uniform "time" is a float and takes 1 value');
    expect(() => new SpriteResources([anim], {uniforms: {time: [1, 2]}})).toThrow(
      'SpriteResources: the uniform "time" is a float and takes 1 value',
    );
    resources.dispose();
  });

  test('refuses an unknown uniform or texture name, naming the declared ones', () => {
    expect(() => new SpriteResources([anim], {uniforms: {tme: 0}})).toThrow(
      'SpriteResources: no feature declares the uniform "tme"; declared: time, light',
    );
    expect(() => new SpriteResources([color], {textures: {colormap: new Texture()}})).toThrow(
      'SpriteResources: no feature declares the texture "colormap"; declared: colorMap',
    );
    const resources = new SpriteResources([anim, color]);
    expect(() => resources.setTexture('colormap', new Texture())).toThrow(
      'no feature declares the texture "colormap"; declared: animsMap, colorMap',
    );
    expect(() => resources.setUniform('tme', 1)).toThrow('no feature declares the uniform "tme"; declared: time, light');
    expect(() => resources.uniform('tme', 'feature "x"')).toThrow(
      'feature "x" reads the uniform "tme", which no feature of these sprites declares',
    );
    resources.dispose();
  });

  test('refuses a uniform start value of the wrong shape', () => {
    expect(() => new SpriteResources([anim], {uniforms: {light: [1, 2]}})).toThrow(
      'SpriteResources: the uniform "light" is a vec3 and takes 3 values',
    );
  });

  test('shapeOf() answers the shape of a texture, and undefined while none is set', () => {
    const resources = new SpriteResources([color]);
    const texture = new Texture();

    expect(resources.shapeOf('colorMap')).toBeUndefined();
    resources.setTexture('colorMap', texture);
    expect(resources.shapeOf('colorMap')).toBeDefined();
    resources.dispose();
  });

  test('shapeOf() of a texture that needs an image waits for its measures, and touchTexture() re-reads it', () => {
    const resources = new SpriteResources([anim]);
    const texture = new Texture();
    resources.setTexture('animsMap', texture);

    expect(resources.shapeOf('animsMap')).toBeUndefined();
    texture.image = {width: 4, height: 2} as unknown as HTMLImageElement;
    resources.touchTexture('animsMap');
    expect(resources.shapeOf('animsMap')).toBeDefined();
    expect(resources.textureSize('animsMap').value).toEqual(new Vector2(4, 2));
    resources.dispose();
  });

  test('a texture of the same kind keeps the shape and notifies nobody; another kind changes it', () => {
    const resources = new SpriteResources([color]);
    resources.setTexture('colorMap', new Texture());
    let runs = 0;
    const effect = createEffect(() => {
      resources.shapeOf('colorMap');
      runs++;
    });

    resources.setTexture('colorMap', new Texture());
    expect(runs).toBe(1);
    const nearest = new Texture();
    nearest.minFilter = NearestFilter;
    nearest.magFilter = NearestFilter;
    resources.setTexture('colorMap', nearest);
    expect(runs).toBe(2);

    effect.destroy();
    resources.dispose();
  });

  test('keeps the size uniform of a texture at the measures of its image', () => {
    const resources = new SpriteResources([anim], {textures: {animsMap: withImage(8, 1)}});

    expect(resources.textureSize('animsMap').value).toEqual(new Vector2(8, 1));
    resources.setTexture('animsMap', withImage(16, 2));
    expect(resources.textureSize('animsMap').value).toEqual(new Vector2(16, 2));
    resources.setTexture('animsMap', undefined);
    expect(resources.textureSize('animsMap').value).toEqual(new Vector2(0, 0));
    resources.dispose();
  });

  test('declares() tells whether every uniform and texture of a feature is held here', () => {
    const resources = new SpriteResources([color]);

    expect(resources.declares(color)).toBe(true);
    expect(resources.declares(anim)).toBe(false);
    resources.dispose();
  });

  test('a constructor that throws leaves no signal or effect behind', () => {
    const signals = getSignalsCount();
    const effects = getEffectsCount();

    expect(() => new SpriteResources([anim, color], {textures: {colormap: new Texture()}})).toThrow(
      'SpriteResources: no feature declares the texture "colormap"; declared: animsMap, colorMap',
    );

    expect(getSignalsCount()).toBe(signals);
    expect(getEffectsCount()).toBe(effects);
  });

  describe('dispose()', () => {
    test('does NOT dispose a texture it holds', () => {
      const texture = new Texture();
      const textureDispose = sandbox.spy(texture, 'dispose');
      const resources = new SpriteResources([color], {textures: {colorMap: texture}});

      resources.dispose();

      expect(textureDispose.called).toBe(false);
    });

    test('behaves as documented afterwards', () => {
      const resources = new SpriteResources([anim, color], {textures: {colorMap: new Texture()}});

      resources.dispose();

      expect(resources.isDisposed).toBe(true);
      expect(resources.getTexture('colorMap')).toBeUndefined();
      expect(() => resources.setTexture('colorMap', new Texture())).not.toThrow();
      expect(resources.getTexture('colorMap')).toBeUndefined();
      expect(() => resources.touchTexture('animsMap')).not.toThrow();
      // a uniform keeps working; it reaches nothing that still renders
      resources.setUniform('time', 3);
      expect(resources.uniforms['time']!.value).toBe(3);
    });

    test('still refuses a misspelled name', () => {
      const resources = new SpriteResources([anim, color]);
      resources.dispose();

      expect(() => resources.setTexture('colormap', new Texture())).toThrow(
        'no feature declares the texture "colormap"; declared: animsMap, colorMap',
      );
      expect(() => resources.touchTexture('colormap')).toThrow('no feature declares the texture "colormap"');
      expect(() => resources.getTexture('colormap')).toThrow('no feature declares the texture "colormap"');
      expect(() => resources.setUniform('tme', 1)).toThrow('no feature declares the uniform "tme"; declared: time, light');
    });

    test('is safe to call twice', () => {
      const resources = new SpriteResources([color]);

      expect(() => {
        resources.dispose();
        resources.dispose();
      }).not.toThrow();
    });

    test('does not leak signals or effects', () => {
      const signals = getSignalsCount();
      const effects = getEffectsCount();

      const resources = new SpriteResources([anim, color], {textures: {colorMap: new Texture()}});
      expect(getSignalsCount()).toBeGreaterThan(signals);
      resources.dispose();

      expect(getSignalsCount()).toBe(signals);
      expect(getEffectsCount()).toBe(effects);
    });
  });
});
