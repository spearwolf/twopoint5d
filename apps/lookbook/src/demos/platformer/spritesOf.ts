import type {FeatureSprites, SpriteKind} from '@spearwolf/twopoint5d';

/**
 * The type of the mesh `new FeatureSprites(kind)` builds, for a field that holds one: the library
 * names the sprite of a kind (`SpriteOf`), and `FeatureSprites` takes the API of the kind, not the kind.
 */
export type SpritesOf<K> = FeatureSprites<K extends SpriteKind<infer Api> ? Api : never>;
