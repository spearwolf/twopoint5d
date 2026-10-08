import {originOf, sourceNameOf} from './passes/passUniformNames.js';
import type {SpriteFeature, SpriteUniformValue} from './SpriteFeature.js';

export interface SpriteDeclarations {
  readonly uniforms: ReadonlyMap<string, {readonly feature: SpriteFeature; readonly value: SpriteUniformValue}>;
  readonly textures: ReadonlyMap<string, {readonly feature: SpriteFeature; readonly needsImage: boolean}>;
}

const isUniformValue = (value: unknown): value is SpriteUniformValue =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 4 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v)));

/**
 * The uniforms and textures a set of features declares. One feature that comes along more than once
 * — in a kind and again in a pass, or as the renamed copy of a pass — declares each name once, as
 * long as every copy declares it for the same uniform of that feature: a uniform is taken once per
 * feature of origin and the name it declares it under. Two features that declare the same name are
 * refused, naming both, and so are two copies of one feature that rename two different uniforms of
 * it to one name.
 *
 * @internal
 */
export function collectSpriteDeclarations(features: Iterable<SpriteFeature>, where: string): SpriteDeclarations {
  const uniforms = new Map<string, {feature: SpriteFeature; value: SpriteUniformValue}>();
  const textures = new Map<string, {feature: SpriteFeature; needsImage: boolean}>();

  for (const feature of new Set(features)) {
    const origin = originOf(feature);
    for (const [name, value] of Object.entries(feature.uniforms ?? {})) {
      const known = uniforms.get(name);
      // the same uniform of the same feature — or of a copy of it — under the same name declares it once
      if (
        known != null &&
        originOf(known.feature) === origin &&
        sourceNameOf(known.feature, name) === sourceNameOf(feature, name)
      ) {
        continue;
      }
      if (known != null) {
        throw new Error(`${where}: features "${known.feature.name}" and "${feature.name}" both declare the uniform "${name}"`);
      }
      if (!isUniformValue(value)) {
        throw new TypeError(
          `${where}: feature "${feature.name}" starts the uniform "${name}" with ${String(value)}; a uniform takes a number or 2 to 4 numbers`,
        );
      }
      uniforms.set(name, {feature, value});
    }
    for (const [name, declaration] of Object.entries(feature.textures ?? {})) {
      const known = textures.get(name);
      if (known != null && originOf(known.feature) === origin) continue;
      if (known != null) {
        throw new Error(`${where}: features "${known.feature.name}" and "${feature.name}" both declare the texture "${name}"`);
      }
      textures.set(name, {feature, needsImage: declaration.needsImage === true});
    }
  }

  return {uniforms, textures};
}
