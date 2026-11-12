import {ACESFilmicToneMapping, Color, FloatType, SRGBColorSpace, type TextureDataType, type ToneMapping} from 'three/webgpu';
import {type Mock, vi} from 'vitest';
import type {IRenderable} from '../stage/IRenderable.js';
import type {IStage} from '../stage/IStage.js';

/**
 * The members of a `WebGPURenderer` a `StageDirector` and its pipelines touch. Both factories below
 * satisfy it, so a member added to one and not to the other fails the type check.
 */
export interface RendererSurface {
  autoClear: boolean;
  autoClearColor: boolean;
  autoClearDepth: boolean;
  autoClearStencil: boolean;
  samples: number;
  toneMapping: ToneMapping;
  outputColorSpace: string;
  xr: {enabled: boolean};
  initialized: boolean;
  setClearColor(color: Color, alpha?: number): void;
  getClearColor(out: Color): Color;
  setClearAlpha(alpha: number): void;
  getClearAlpha(): number;
  clear(color?: boolean, depth?: boolean, stencil?: boolean): unknown;
  render(scene: unknown, camera: unknown): unknown;
  setRenderTarget(target: unknown): void;
  getRenderTarget(): unknown;
  getOutputRenderTarget(): unknown;
  getPixelRatio(): number;
  getOutputBufferType(): TextureDataType;
  init(): Promise<unknown>;
  compileAsync(scene: unknown, camera: unknown): Promise<unknown>;
}

/** A renderer whose members are mocks; the clear color, the clear alpha and the target are kept in `__` fields. */
export function createRendererMock() {
  const m = {
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true,
    __clearColor: new Color(0x111111),
    __clearAlpha: 1,
    __renderTarget: null as unknown,
    setClearColor: vi.fn<RendererSurface['setClearColor']>(),
    getClearColor: vi.fn<RendererSurface['getClearColor']>(),
    setClearAlpha: vi.fn<RendererSurface['setClearAlpha']>(),
    getClearAlpha: vi.fn<RendererSurface['getClearAlpha']>(),
    clear: vi.fn<RendererSurface['clear']>(),
    render: vi.fn<RendererSurface['render']>(),
    setRenderTarget: vi.fn<RendererSurface['setRenderTarget']>(),
    getRenderTarget: vi.fn<RendererSurface['getRenderTarget']>(),
    getOutputRenderTarget: vi.fn<RendererSurface['getOutputRenderTarget']>(() => null),
    getPixelRatio: vi.fn<RendererSurface['getPixelRatio']>(() => 1),
    samples: 0,
    getOutputBufferType: vi.fn<RendererSurface['getOutputBufferType']>(() => FloatType),
    toneMapping: ACESFilmicToneMapping,
    outputColorSpace: SRGBColorSpace,
    xr: {enabled: false},
    initialized: true,
    init: vi.fn<RendererSurface['init']>(async () => {}),
    compileAsync: vi.fn<RendererSurface['compileAsync']>(async () => {}),
  } satisfies RendererSurface & {__clearColor: Color; __clearAlpha: number; __renderTarget: unknown};
  m.setRenderTarget.mockImplementation((rt) => {
    m.__renderTarget = rt;
  });
  m.getRenderTarget.mockImplementation(() => m.__renderTarget);
  m.setClearColor.mockImplementation((c, a) => {
    m.__clearColor.copy(c);
    if (typeof a === 'number') m.__clearAlpha = a;
  });
  m.getClearColor.mockImplementation((out) => out.copy(m.__clearColor));
  m.setClearAlpha.mockImplementation((a) => {
    m.__clearAlpha = a;
  });
  m.getClearAlpha.mockImplementation(() => m.__clearAlpha);
  return m;
}

/** The members of a renderer as plain functions: a mock records its calls, and the record allocates. */
export function createPlainRenderer() {
  let target: unknown = null;
  const clearColor = new Color(0x111111);
  return {
    autoClear: true,
    autoClearColor: true,
    autoClearDepth: true,
    autoClearStencil: true,
    samples: 0,
    toneMapping: ACESFilmicToneMapping,
    outputColorSpace: SRGBColorSpace,
    xr: {enabled: false},
    initialized: true,
    setClearColor() {},
    getClearColor: (out: Color) => out.copy(clearColor),
    setClearAlpha() {},
    getClearAlpha: () => 1,
    clear() {},
    render() {},
    setRenderTarget(rt: unknown) {
      target = rt;
    },
    getRenderTarget: () => target,
    getOutputRenderTarget: () => null,
    getPixelRatio: () => 1,
    getOutputBufferType: () => FloatType,
    init: async () => {},
    compileAsync: async () => {},
  } satisfies RendererSurface;
}

export type FakeStage = IStage & IRenderable & {renderTo: Mock; resize: Mock; updateFrame: Mock};

/** A layer whose methods are mocks. */
export function fakeStage(name: string): FakeStage {
  return {name, resize: vi.fn(), updateFrame: vi.fn(), renderTo: vi.fn()};
}

/** A layer whose methods are plain functions that do nothing. */
export const plainStage = (name: string): IStage & IRenderable => ({name, resize() {}, updateFrame() {}, renderTo() {}});

export const names = (stages: ReadonlyArray<IStage>) => stages.map((s) => s.name);
