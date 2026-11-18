import {MeshBasicMaterial} from 'three/webgpu';
import {describe, expect, it, vi} from 'vitest';
import {disposeMaterial} from './disposeMaterial';

describe('disposeMaterial()', () => {
  it('disposes one material once', () => {
    const material = new MeshBasicMaterial();
    const dispose = vi.spyOn(material, 'dispose');
    disposeMaterial(material);
    expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('disposes each material of a list once', () => {
    const materials = [new MeshBasicMaterial(), new MeshBasicMaterial()];
    const disposes = materials.map((material) => vi.spyOn(material, 'dispose'));
    disposeMaterial(materials);
    for (const dispose of disposes) expect(dispose).toHaveBeenCalledTimes(1);
  });

  it('does nothing for a mesh without a material', () => {
    expect(() => disposeMaterial(undefined)).not.toThrow();
    expect(() => disposeMaterial(null)).not.toThrow();
  });
});
