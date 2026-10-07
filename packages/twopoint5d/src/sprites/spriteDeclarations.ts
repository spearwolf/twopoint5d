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
 * The uniforms and textures a set of features declares. One feature that comes along more than
 * once — in a kind and again in a pass — declares its names once; two features that declare the
 * same name are refused, naming both.
 *
 * @internal
 */
export function collectSpriteDeclarations(features: Iterable<SpriteFeature>, where: string): SpriteDeclarations {
  const uniforms = new Map<string, {feature: SpriteFeature; value: SpriteUniformValue}>();
  const textures = new Map<string, {feature: SpriteFeature; needsImage: boolean}>();

  for (const feature of new Set(features)) {
    for (const [name, value] of Object.entries(feature.uniforms ?? {})) {
      const known = uniforms.get(name);
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
      if (known != null) {
        throw new Error(`${where}: features "${known.feature.name}" and "${feature.name}" both declare the texture "${name}"`);
      }
      textures.set(name, {feature, needsImage: declaration.needsImage === true});
    }
  }

  return {uniforms, textures};
}
