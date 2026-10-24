// Named one by one: a file of this module exports for its neighbours as well, and only what is
// listed here is published
export {lightOf} from './bindings/lightOf.js';
export {planeOf} from './bindings/planeOf.js';
export type {SpriteUniformSource} from './bindings/SpriteUniformSource.js';
export {defineSprite, type SpriteApiOf, type SpriteKind, type SpriteKindApiOf, type SpriteOf} from './defineSprite.js';
export {Anchor, type AnchorApi} from './features/Anchor.js';
export {AnimatedFrames, type AnimatedFramesApi} from './features/AnimatedFrames.js';
export {AtlasFrame, type AtlasFrameApi, type PreparedSpriteFrame, prepareSpriteFrame} from './features/AtlasFrame.js';
export {
  AxisBillboardPlacement,
  axisBillboardPlacement,
  type AxisBillboardPlacementOptions,
} from './features/AxisBillboardPlacement.js';
export {BillboardPlacement} from './features/BillboardPlacement.js';
export {Fade, type FadeApi} from './features/Fade.js';
export {FlatPlacement, flatPlacement, type FlatPlacementOptions, GroundPlacement} from './features/FlatPlacement.js';
export {Flip, type FlipApi} from './features/Flip.js';
export {Flash, type FlashApi} from './features/Flash.js';
export {InstancePosition, type InstancePositionApi} from './features/InstancePosition.js';
export {NineSlice, type NineSliceApi, type SliceInsets} from './features/NineSlice.js';
export {Orientation, type OrientationApi} from './features/Orientation.js';
export {PaletteSwap, paletteSwap, type PaletteSwapApi, type PaletteSwapOptions} from './features/PaletteSwap.js';
export {QuadSize, type QuadSizeApi} from './features/QuadSize.js';
export {RepeatingTextureColor} from './features/RepeatingTextureColor.js';
export {Rotation, type RotationApi} from './features/Rotation.js';
export {SegmentEnd, type SegmentEndApi} from './features/SegmentEnd.js';
export {SegmentPlacement, segmentPlacement, type SegmentPlacementOptions} from './features/SegmentPlacement.js';
export {Shear, type ShearApi} from './features/Shear.js';
export {TableFrame, tableFrame, type TableFrameApi, type TableFrameOptions} from './features/TableFrame.js';
export {TextureColor} from './features/TextureColor.js';
export {Tint, type TintApi} from './features/Tint.js';
export {wave, type WaveOptions} from './features/Wave.js';
export {Yaw, type YawApi} from './features/Yaw.js';
export {
  FeatureSprites,
  type FeatureSpritesOf,
  type FeatureSpritesOptions,
  FeatureSpritesPass,
  type SpriteSortKeyName,
} from './FeatureSprites/FeatureSprites.js';
export {FeatureSpritesGeometry, type FeatureSpritesGeometryParameters} from './FeatureSprites/FeatureSpritesGeometry.js';
export {FeatureSpritesMaterial, type FeatureSpritesMaterialParameters} from './FeatureSprites/FeatureSpritesMaterial.js';
export {SpriteResources, type SpriteResourcesOptions, type SpriteUniformNode} from './FeatureSprites/SpriteResources.js';
export {type GridBase, gridBase, type GridBaseOptions, type GridBaseVO} from './GridBase.js';
export {
  billboardVertexByInstancePosition,
  colorFromTextureByTexCoords,
  texCoordsFromIndex,
  vertexByInstancePosition,
} from './node-utils.js';
export {Darken} from './passes/Darken.js';
export {definePass, type SpritePass} from './passes/definePass.js';
export {LightFacingPlacement} from './passes/LightFacingPlacement.js';
export {MirrorAtPlane} from './passes/MirrorAtPlane.js';
export {MirroredBillboardPlacement} from './passes/MirroredBillboardPlacement.js';
export {
  BillboardReflectionPass,
  ReflectionPass,
  SegmentShadowPass,
  shadowFallsOnPlane,
  ShadowPass,
} from './passes/passPresets.js';
export {PlanarShadow} from './passes/PlanarShadow.js';
export {ShadowMask} from './passes/ShadowMask.js';
export {type AnimatedSprite, AnimatedSpriteKind, type TexturedSprite, TexturedSpriteKind} from './presets.js';
export {QuadBase, type QuadBaseArgs, type QuadBaseVO, type SpriteBase, type SpriteBaseVO} from './SpriteBase.js';
export {
  ColorOrder,
  defineFeature,
  FrameOrder,
  LocalOrder,
  MeshOrder,
  type SpriteFeature,
  type SpriteFrameContext,
  type SpriteFrameNodes,
  type SpriteFrameStage,
  type SpriteKindShape,
  type SpriteMethod,
  type SpriteShaderContext,
  type SpriteStage,
  type SpriteTextureDeclaration,
  type SpriteUniformDeclaration,
  type SpriteUniformValue,
  UvOrder,
} from './SpriteFeature.js';
export {type PickPointer, type SpritePick, SpritePicker, type SpritePickOf} from './SpritePicker.js';
export type {SpritePipeline} from './spritePipeline.js';
