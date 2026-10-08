import type {SpriteFeature, SpriteFrameContext} from '../SpriteFeature.js';
import type {SpritePass} from './definePass.js';

// one array of copies per pass, so that every material and the shared resources of one pass see
// the same feature objects; and for each copy the feature it came from and, by the name the copy
// declares a uniform under, the name its feature of origin declares it under — for the declarations
const copiesOfPass = new WeakMap<SpritePass, readonly SpriteFeature[]>();
const originOfCopy = new WeakMap<SpriteFeature, {readonly origin: SpriteFeature; readonly sources: Map<string, string>}>();

// own keys only: a member of Object.prototype such as "constructor" is never renamed
const renamed = (names: Readonly<Record<string, string>>, name: string): string =>
  Object.hasOwn(names, name) ? names[name]! : name;

/** The name the features of `pass` read the uniform `name` under. @internal */
export const resolvedUniformName = (pass: SpritePass, name: string): string =>
  pass.uniformNames == null ? name : renamed(pass.uniformNames, name);

/** The feature a renamed copy came from; the feature itself for any other. @internal */
export const originOf = (feature: SpriteFeature): SpriteFeature => originOfCopy.get(feature)?.origin ?? feature;

/**
 * The name the feature of origin of `feature` declares its uniform `name` under: the name before the
 * renaming for a renamed copy, `name` itself for any other feature. @internal
 */
export const sourceNameOf = (feature: SpriteFeature, name: string): string =>
  originOfCopy.get(feature)?.sources.get(name) ?? name;

function renamedCopy(feature: SpriteFeature, names: Readonly<Record<string, string>>): SpriteFeature {
  const rename = <C extends SpriteFrameContext>(ctx: C): C => ({
    ...ctx,
    uniform: (name: string) => ctx.uniform(renamed(names, name)),
  });
  const {frame, local, placement, mesh, color, colorSource, uniforms} = feature;
  const sources = new Map<string, string>();
  for (const name of Object.keys(uniforms ?? {})) sources.set(renamed(names, name), name);
  const copy: SpriteFeature = Object.freeze({
    ...feature,
    ...(uniforms != null && {
      uniforms: Object.freeze(Object.fromEntries(Object.entries(uniforms).map(([name, value]) => [renamed(names, name), value]))),
    }),
    ...(frame != null && {frame: (ctx: SpriteFrameContext) => frame(rename(ctx))}),
    ...(local != null && {local: {order: local.order, transform: (input, ctx) => local.transform(input, rename(ctx))}}),
    ...(placement != null && {placement: (input, ctx) => placement(input, rename(ctx))}),
    ...(mesh != null && {mesh: {order: mesh.order, transform: (input, ctx) => mesh.transform(input, rename(ctx))}}),
    ...(color != null && {color: {order: color.order, transform: (input, ctx) => color.transform(input, rename(ctx))}}),
    ...(colorSource != null && {colorSource: (frame, ctx) => colorSource(frame, rename(ctx))}),
  } as SpriteFeature);
  originOfCopy.set(copy, {origin: feature, sources});
  return copy;
}

/**
 * The features `pass` draws with: its own, or — with `uniformNames` — copies of them that declare
 * and read the renamed uniforms. The copies are built once per pass. @internal
 */
export function stageFeaturesOf(pass: SpritePass): readonly SpriteFeature[] {
  const names = pass.uniformNames;
  if (names == null || Object.keys(names).length === 0) return pass.features;
  let copies = copiesOfPass.get(pass);
  if (copies == null) {
    copies = Object.freeze(pass.features.map((feature) => renamedCopy(feature, names)));
    copiesOfPass.set(pass, copies);
  }
  return copies;
}
