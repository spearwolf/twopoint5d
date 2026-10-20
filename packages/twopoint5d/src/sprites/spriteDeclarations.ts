import {originOf, sourceNameOf} from './passes/passUniformNames.js';
import type {SpriteFeature, SpriteUniformDeclaration, SpriteUniformValue} from './SpriteFeature.js';

export interface SpriteDeclarations {
  readonly uniforms: ReadonlyMap<
    string,
    {readonly feature: SpriteFeature; readonly value: SpriteUniformValue; readonly shared: boolean}
  >;
  readonly textures: ReadonlyMap<string, {readonly feature: SpriteFeature; readonly needsImage: boolean}>;
}

const VECTOR_TYPES = ['float', 'vec2', 'vec3', 'vec4'] as const;

const isUniformValue = (value: unknown): value is SpriteUniformValue =>
  (typeof value === 'number' && Number.isFinite(value)) ||
  (Array.isArray(value) &&
    value.length >= 2 &&
    value.length <= 4 &&
    value.every((v) => typeof v === 'number' && Number.isFinite(v)));

const DECLARATION_KEYS: ReadonlySet<string> = new Set(['value', 'shared']);

// a declaration as {value, shared}, or undefined for one that is neither a value nor {value, shared?}
const declarationOf = (declared: unknown): {value: SpriteUniformValue; shared: boolean} | undefined => {
  if (isUniformValue(declared)) return {value: declared, shared: false};
  if (declared == null || typeof declared !== 'object' || Array.isArray(declared)) return undefined;
  const {value, shared} = declared as Partial<SpriteUniformDeclaration>;
  if (!isUniformValue(value) || (shared !== undefined && typeof shared !== 'boolean')) return undefined;
  if (Object.keys(declared).some((key) => !DECLARATION_KEYS.has(key))) return undefined;
  return {value, shared: shared === true};
};

const sizeOf = (value: SpriteUniformValue): number => (typeof value === 'number' ? 1 : value.length);
const shown = (value: SpriteUniformValue): string => JSON.stringify(value);
const shownDeclared = (declared: unknown): string => (typeof declared === 'object' ? JSON.stringify(declared) : String(declared));

const sameValue = (a: SpriteUniformValue, b: SpriteUniformValue): boolean =>
  typeof a === 'number' || typeof b === 'number'
    ? a === b
    : a.length === b.length && a.every((component, i) => component === b[i]);

const SHARED_RULE = 'a shared uniform has one type and one start value in every feature that declares it';

// why two declarations of one name by two features cannot be one uniform, with the fix; undefined
// when they can — both shared, alike in type and start value
function conflictOf(
  name: string,
  known: {feature: SpriteFeature; value: SpriteUniformValue; shared: boolean},
  feature: SpriteFeature,
  declaration: {value: SpriteUniformValue; shared: boolean},
): string | undefined {
  const head = `features "${known.feature.name}" and "${feature.name}" both declare the uniform "${name}"`;
  if (!known.shared && !declaration.shared) {
    return `${head} — rename one of them, or declare it as {value, shared: true} in both to share one uniform`;
  }
  if (known.shared !== declaration.shared) {
    const [sharing, other, value] = known.shared
      ? [known.feature, feature, known.value]
      : [feature, known.feature, declaration.value];
    return `${head}, and only "${sharing.name}" shares it — declare it as {value: ${shown(value)}, shared: true} in "${other.name}" as well, or rename one of them`;
  }
  const [a, b] = [sizeOf(known.value), sizeOf(declaration.value)];
  if (a !== b) {
    return `${head}, shared, as a ${VECTOR_TYPES[a - 1]} and as a ${VECTOR_TYPES[b - 1]} — ${SHARED_RULE}; rename one of them`;
  }
  if (!sameValue(known.value, declaration.value)) {
    return `${head}, shared, starting at ${shown(known.value)} and at ${shown(declaration.value)} — ${SHARED_RULE}; give both the same start value`;
  }
  return undefined;
}

/**
 * The uniforms and textures a set of features declares. One feature that comes along more than once
 * — in a kind and again in a pass, or as the renamed copy of a pass — declares each name once, as
 * long as every copy declares it for the same uniform of that feature: a uniform is taken once per
 * feature of origin and the name it declares it under. Features that declare one name shared, with
 * the same type and start value, hold one uniform. Any other two features that declare the same name
 * are refused, naming both and the fix, and so are two copies of one feature that rename two
 * different uniforms of it to one name.
 *
 * @internal
 */
export function collectSpriteDeclarations(features: Iterable<SpriteFeature>, where: string): SpriteDeclarations {
  const uniforms = new Map<string, {feature: SpriteFeature; value: SpriteUniformValue; shared: boolean}>();
  const textures = new Map<string, {feature: SpriteFeature; needsImage: boolean}>();

  for (const feature of new Set(features)) {
    const origin = originOf(feature);
    for (const [name, declared] of Object.entries(feature.uniforms ?? {})) {
      const known = uniforms.get(name);
      // the same uniform of the same feature — or of a copy of it — under the same name declares it once
      if (
        known != null &&
        originOf(known.feature) === origin &&
        sourceNameOf(known.feature, name) === sourceNameOf(feature, name)
      ) {
        continue;
      }
      const declaration = declarationOf(declared);
      if (declaration == null) {
        throw new TypeError(
          `${where}: feature "${feature.name}" starts the uniform "${name}" with ${shownDeclared(declared)}; a uniform takes a number, 2 to 4 numbers, or {value, shared}`,
        );
      }
      if (known != null) {
        const conflict = conflictOf(name, known, feature, declaration);
        if (conflict != null) throw new Error(`${where}: ${conflict}`);
        continue;
      }
      uniforms.set(name, {feature, ...declaration});
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
