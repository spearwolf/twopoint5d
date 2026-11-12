import {on} from '@spearwolf/eventize';
import {
  ACESFilmicToneMapping,
  Color,
  ColorManagement,
  type Node,
  NoToneMapping,
  OrthographicCamera,
  PassNode,
  RenderPipeline,
  RenderTarget,
  Scene,
  SRGBColorSpace,
  type WebGPURenderer,
} from 'three/webgpu';
import {afterEach, describe, expect, it, vi} from 'vitest';
import {OnStageAfterPostProcessChanged} from '../events.js';
import {ParallaxProjection} from './ParallaxProjection.js';
import {Stage2D} from './Stage2D.js';
import type {StagePostProcess, StagePostProcessInput} from './StagePostProcess.js';

// asPassNode() does not read the renderer it is handed
const noRenderer = {} as WebGPURenderer;

const makeStage = () => {
  const stage = new Stage2D(new ParallaxProjection('xy|bottom-left', {fit: 'contain', width: 640}));
  stage.resize(320, 200);
  return stage;
};

/** A post-process that answers the pass it is handed and keeps the input of every build. */
function passThrough() {
  const inputs: StagePostProcessInput[] = [];
  const postProcess: StagePostProcess = {
    build: (input) => {
      inputs.push(input);
      return input.pass;
    },
  };
  return {postProcess, inputs};
}

interface Draw {
  pipeline: RenderPipeline;
  outputNode: Node;
  toneMapping: unknown;
  outputColorSpace: unknown;
  clearColor: number;
  clearAlpha: number;
  autoClear: boolean[];
}

/**
 * A renderer as far as a post-processed stage reads and writes it, and what it held at every
 * `RenderPipeline#render()` — the pipeline does not draw here.
 */
function makeRenderer() {
  const state = {
    clearColor: new Color(0x336699),
    clearAlpha: 0.5,
    target: null as RenderTarget | null,
    outputTarget: null as RenderTarget | null,
  };
  const mock = {
    toneMapping: ACESFilmicToneMapping as unknown,
    outputColorSpace: SRGBColorSpace as unknown,
    // off, all three: a StageRenderer turns autoClear off while it draws its stages, and a caller
    // may have turned off the other two
    autoClear: false,
    autoClearColor: false,
    autoClearDepth: false,
    getRenderTarget: () => state.target,
    getOutputRenderTarget: () => state.outputTarget,
    getClearColor: (out: Color) => out.copy(state.clearColor),
    getClearAlpha: () => state.clearAlpha,
    setClearColor: (color: Color, alpha = 1) => {
      state.clearColor.copy(color);
      state.clearAlpha = alpha;
    },
    render: vi.fn(),
  };
  return {renderer: mock as unknown as WebGPURenderer, mock, state};
}

describe('Stage2D#postProcess', () => {
  const draws: Draw[] = [];
  let throwFromPipeline: Error | undefined;

  const spyOnPipelines = () => {
    const render = vi.spyOn(RenderPipeline.prototype, 'render').mockImplementation(function (this: RenderPipeline) {
      const renderer = this.renderer as unknown as ReturnType<typeof makeRenderer>['mock'];
      draws.push({
        pipeline: this,
        outputNode: this.outputNode,
        toneMapping: renderer.toneMapping,
        outputColorSpace: renderer.outputColorSpace,
        clearColor: renderer.getClearColor(new Color()).getHex(),
        clearAlpha: renderer.getClearAlpha(),
        autoClear: [renderer.autoClear, renderer.autoClearColor, renderer.autoClearDepth],
      });
      if (throwFromPipeline) throw throwFromPipeline;
    });
    const dispose = vi.spyOn(RenderPipeline.prototype, 'dispose');
    return {render, dispose};
  };

  afterEach(() => {
    vi.restoreAllMocks();
    draws.length = 0;
    throwFromPipeline = undefined;
  });

  describe('the property', () => {
    it('is undefined by default', () => {
      expect(new Stage2D().postProcess).toBeUndefined();
    });

    it('announces an assignment with the stage and the post-process it replaced', () => {
      const stage = makeStage();
      const changed = vi.fn();
      on(stage, OnStageAfterPostProcessChanged, changed);
      const first = passThrough().postProcess;
      const second = passThrough().postProcess;

      stage.postProcess = first;
      expect(stage.postProcess).toBe(first);
      expect(changed.mock.calls).toEqual([[stage, undefined]]);

      stage.postProcess = second;
      stage.postProcess = undefined;
      expect(stage.postProcess).toBeUndefined();
      expect(changed.mock.calls).toEqual([
        [stage, undefined],
        [stage, first],
        [stage, second],
      ]);
    });

    it('announces nothing for the object it has already, and builds nothing again', () => {
      const stage = makeStage();
      const {postProcess, inputs} = passThrough();
      stage.postProcess = postProcess;
      const node = stage.asPassNode(noRenderer);
      const changed = vi.fn();
      on(stage, OnStageAfterPostProcessChanged, changed);

      stage.postProcess = postProcess;

      expect(changed).not.toHaveBeenCalled();
      expect(stage.asPassNode(noRenderer)).toBe(node);
      expect(inputs).toHaveLength(1);
    });

    it.each([
      ['null', null, 'null'],
      ['a function', () => undefined, '[Function]'],
      ['an object without build()', {dispose() {}}, '{dispose: [Function: dispose]}'],
      ['an object whose build is no function', {build: 1}, '{build: 1}'],
    ])('refuses %s, and keeps what it has', (_name, value, shown) => {
      const stage = makeStage();
      const {postProcess} = passThrough();
      stage.postProcess = postProcess;
      const changed = vi.fn();
      on(stage, OnStageAfterPostProcessChanged, changed);

      const refused = () => {
        stage.postProcess = value as unknown as StagePostProcess;
      };

      expect(refused).toThrow(TypeError);
      expect(refused).toThrow(`Stage2D#postProcess must be a StagePostProcess with a build() method or undefined, got ${shown}`);
      expect(stage.postProcess).toBe(postProcess);
      expect(changed).not.toHaveBeenCalled();
    });

    it('every listener hears an assignment, also behind one that throws, and the error comes out afterwards', () => {
      const stage = makeStage();
      const boom = new Error('listener');
      const second = vi.fn();
      on(stage, OnStageAfterPostProcessChanged, () => {
        throw boom;
      });
      on(stage, OnStageAfterPostProcessChanged, second);
      const {postProcess} = passThrough();

      let thrown: unknown;
      try {
        stage.postProcess = postProcess;
      } catch (error) {
        thrown = error;
      }

      expect(thrown).toBe(boom);
      expect(second).toHaveBeenCalledTimes(1);
      expect(stage.postProcess).toBe(postProcess);
    });
  });

  describe('build()', () => {
    it('does not run for a stage that is never drawn', () => {
      const stage = makeStage();
      const {postProcess, inputs} = passThrough();
      stage.postProcess = postProcess;
      stage.dispose();
      expect(inputs).toHaveLength(0);
    });

    it('does not run without a camera', () => {
      spyOnPipelines();
      const stage = new Stage2D();
      const {postProcess, inputs} = passThrough();
      stage.postProcess = postProcess;
      const {renderer, mock} = makeRenderer();

      stage.renderTo(renderer);

      expect(inputs).toHaveLength(0);
      expect(draws).toHaveLength(0);
      expect(mock.render).not.toHaveBeenCalled();
    });

    it('runs once, on the first draw, with the stage, a pass of its own over scene and camera, and onDispose', () => {
      spyOnPipelines();
      const stage = makeStage();
      const plain = stage.asPassNode(noRenderer);
      const {postProcess, inputs} = passThrough();
      stage.postProcess = postProcess;
      const {renderer} = makeRenderer();

      stage.renderTo(renderer);
      stage.renderTo(renderer);
      stage.asPassNode(noRenderer);

      expect(inputs).toHaveLength(1);
      const input = inputs[0]!;
      expect(input.stage).toBe(stage);
      expect(input.pass).toBeInstanceOf(PassNode);
      expect(input.pass, 'not the pass node of the stage without a post-process').not.toBe(plain);
      expect(input.pass.scene).toBe(stage.scene);
      expect(input.pass.camera).toBe(stage.camera);
      expect(input.onDispose).toBeTypeOf('function');
    });

    it('a build that answers no node is refused, releases what it registered and is asked again', () => {
      const stage = makeStage();
      const release = vi.fn();
      const passes: PassNode[] = [];
      let answer: unknown = {};
      stage.postProcess = {
        build: ({pass, onDispose}) => {
          passes.push(pass);
          onDispose(release);
          return answer as Node;
        },
      };

      expect(() => stage.asPassNode(noRenderer)).toThrow(TypeError);
      expect(() => stage.asPassNode(noRenderer)).toThrow('Stage2D#postProcess: build() must answer a node, got {}');
      expect(passes).toHaveLength(2);
      expect(release).toHaveBeenCalledTimes(2);

      answer = undefined;
      expect(() => stage.asPassNode(noRenderer)).toThrow('Stage2D#postProcess: build() must answer a node, got undefined');
    });

    it('a build that throws releases what it registered and its pass, and the next draw asks again', () => {
      spyOnPipelines();
      const stage = makeStage();
      const boom = new Error('build');
      const release = vi.fn();
      const disposed: boolean[] = [];
      let fail = true;
      stage.postProcess = {
        build: ({pass, onDispose}) => {
          onDispose(release);
          if (fail) {
            vi.spyOn(pass, 'dispose').mockImplementation(() => void disposed.push(true));
            throw boom;
          }
          return pass;
        },
      };
      const {renderer} = makeRenderer();

      let thrown: unknown;
      try {
        stage.renderTo(renderer);
      } catch (error) {
        thrown = error;
      }
      expect(thrown).toBe(boom);
      expect(release).toHaveBeenCalledTimes(1);
      expect(disposed).toEqual([true]);
      expect(draws).toHaveLength(0);

      fail = false;
      stage.renderTo(renderer);
      expect(draws).toHaveLength(1);
      expect(release, 'the release of the build that stands waits').toHaveBeenCalledTimes(1);
    });

    const LET_GO =
      'Stage2D#postProcess: the stage let go of this post-process while its build() ran: a build() neither assigns postProcess nor disposes the stage';

    it('a build that takes the post-process away is refused, leaves nothing behind, and the stage draws its scene', () => {
      const {dispose} = spyOnPipelines();
      const stage = makeStage();
      const release = vi.fn();
      const disposed: string[] = [];
      stage.postProcess = {
        build: ({pass, onDispose}) => {
          vi.spyOn(pass, 'dispose').mockImplementation(() => void disposed.push('pass'));
          onDispose(release);
          stage.postProcess = undefined;
          return pass;
        },
      };
      const {renderer, mock} = makeRenderer();

      expect(() => stage.renderTo(renderer)).toThrow(LET_GO);

      expect(release).toHaveBeenCalledTimes(1);
      expect(disposed).toEqual(['pass']);
      expect(draws, 'no pipeline drew').toHaveLength(0);
      expect(dispose, 'and none was built').not.toHaveBeenCalled();

      stage.renderTo(renderer);
      expect(mock.render.mock.calls).toEqual([[stage.scene, stage.camera]]);
    });

    it('a build that disposes the stage is refused and leaves nothing behind', () => {
      spyOnPipelines();
      const stage = makeStage();
      const disposed: string[] = [];
      stage.postProcess = {
        build: ({pass}) => {
          vi.spyOn(pass, 'dispose').mockImplementation(() => void disposed.push('pass'));
          stage.dispose();
          return pass;
        },
      };
      const {renderer} = makeRenderer();

      expect(() => stage.renderTo(renderer)).toThrow(LET_GO);

      expect(disposed).toEqual(['pass']);
      expect(draws).toHaveLength(0);
      expect(stage.isDisposed).toBe(true);
    });

    it('refuses an onDispose() with something that is no function', () => {
      const stage = makeStage();
      stage.postProcess = {
        build: ({pass, onDispose}) => {
          onDispose('later' as unknown as () => void);
          return pass;
        },
      };
      expect(() => stage.asPassNode(noRenderer)).toThrow(TypeError);
      expect(() => stage.asPassNode(noRenderer)).toThrow(
        'StagePostProcessInput#onDispose(): release must be a function, got "later"',
      );
    });
  });

  describe('asPassNode()', () => {
    it('answers the node of the build with a post-process, and the pass node of the stage without', () => {
      const stage = makeStage();
      const plain = stage.asPassNode(noRenderer);
      let built: Node | undefined;
      stage.postProcess = {
        build: ({pass}) => {
          built = (pass as unknown as {mul(factor: number): Node}).mul(0.5);
          return built;
        },
      };

      const processed = stage.asPassNode(noRenderer);
      expect(processed).toBe(built);
      expect(processed).not.toBe(plain);
      expect(stage.asPassNode(noRenderer), 'the same node while the post-process stays').toBe(processed);

      stage.postProcess = undefined;
      expect(stage.asPassNode(noRenderer)).toBe(plain);
    });

    it('throws without a camera, as it does without a post-process', () => {
      const stage = new Stage2D();
      stage.postProcess = passThrough().postProcess;
      expect(() => stage.asPassNode(noRenderer)).toThrow('Stage2D#asPassNode() has no camera to build a pass node with');
    });
  });

  describe('renderTo()', () => {
    it('runs a pipeline over the node of the build instead of drawing the scene', () => {
      spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const {renderer, mock} = makeRenderer();

      stage.renderTo(renderer);
      stage.renderTo(renderer);

      expect(mock.render, 'no plain draw of the scene').not.toHaveBeenCalled();
      expect(draws).toHaveLength(2);
      expect(draws[0]!.outputNode).toBe(stage.asPassNode(noRenderer));
      expect(draws[0]!.pipeline.renderer).toBe(renderer);
      expect(draws[1]!.pipeline, 'one pipeline for the renderer').toBe(draws[0]!.pipeline);
    });

    it('draws the scene again once the post-process is taken away', () => {
      spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const {renderer, mock} = makeRenderer();
      stage.renderTo(renderer);

      stage.postProcess = undefined;
      stage.renderTo(renderer);

      expect(draws).toHaveLength(1);
      expect(mock.render.mock.calls).toEqual([[stage.scene, stage.camera]]);
    });

    it('builds another pipeline for another renderer and disposes the one before', () => {
      const {dispose} = spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const first = makeRenderer().renderer;
      const second = makeRenderer().renderer;

      stage.renderTo(first);
      stage.renderTo(second);

      expect(draws[1]!.pipeline).not.toBe(draws[0]!.pipeline);
      expect(draws[1]!.pipeline.renderer).toBe(second);
      expect(draws[1]!.outputNode, 'over the same node').toBe(draws[0]!.outputNode);
      expect(dispose.mock.contexts).toEqual([draws[0]!.pipeline]);
    });

    it('writes linear into a render target, and gives the renderer back as it was', () => {
      spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const {renderer, mock, state} = makeRenderer();
      state.target = new RenderTarget(4, 4);

      stage.renderTo(renderer);

      expect(draws[0]!.toneMapping).toBe(NoToneMapping);
      expect(draws[0]!.outputColorSpace).toBe(ColorManagement.workingColorSpace);
      expect(mock.toneMapping).toBe(ACESFilmicToneMapping);
      expect(mock.outputColorSpace).toBe(SRGBColorSpace);
    });

    it('leaves the output transform alone for the output render target of the renderer, as on the canvas', () => {
      spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const {renderer, state} = makeRenderer();
      state.target = new RenderTarget(4, 4);
      state.outputTarget = state.target;

      stage.renderTo(renderer);

      expect(draws[0]!.toneMapping).toBe(ACESFilmicToneMapping);
      expect(draws[0]!.outputColorSpace).toBe(SRGBColorSpace);
    });

    it('leaves the output transform of the renderer alone on the canvas', () => {
      spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const {renderer} = makeRenderer();

      stage.renderTo(renderer);

      expect(draws[0]!.toneMapping).toBe(ACESFilmicToneMapping);
      expect(draws[0]!.outputColorSpace).toBe(SRGBColorSpace);
    });

    it('clears its pass to transparent black, and gives the renderer its clear color back', () => {
      spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const {renderer, state} = makeRenderer();

      stage.renderTo(renderer);

      expect([draws[0]!.clearColor, draws[0]!.clearAlpha]).toEqual([0x000000, 0]);
      expect([state.clearColor.getHex(), state.clearAlpha]).toEqual([0x336699, 0.5]);
    });

    it('has its quad clear color and depth of the target first, and gives the renderer its flags back', () => {
      spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const {renderer, mock} = makeRenderer();

      stage.renderTo(renderer);

      expect(draws[0]!.autoClear).toEqual([true, true, true]);
      expect([mock.autoClear, mock.autoClearColor, mock.autoClearDepth]).toEqual([false, false, false]);
    });

    it('gives the renderer back as it was when the pipeline throws', () => {
      spyOnPipelines();
      const stage = makeStage();
      stage.postProcess = passThrough().postProcess;
      const {renderer, mock, state} = makeRenderer();
      state.target = new RenderTarget(4, 4);
      throwFromPipeline = new Error('pipeline');

      expect(() => stage.renderTo(renderer)).toThrow(throwFromPipeline);

      expect(mock.toneMapping).toBe(ACESFilmicToneMapping);
      expect(mock.outputColorSpace).toBe(SRGBColorSpace);
      expect([state.clearColor.getHex(), state.clearAlpha]).toEqual([0x336699, 0.5]);
      expect([mock.autoClear, mock.autoClearColor, mock.autoClearDepth]).toEqual([false, false, false]);
    });
  });

  describe('scene and camera', () => {
    it('go into the pass of the build, which is not built again', () => {
      const stage = makeStage();
      const {postProcess, inputs} = passThrough();
      stage.postProcess = postProcess;
      const node = stage.asPassNode(noRenderer);
      const {pass} = inputs[0]!;

      const scene = new Scene();
      const camera = new OrthographicCamera();
      stage.scene = scene;
      stage.camera = camera;

      expect(pass.scene).toBe(scene);
      expect(pass.camera).toBe(camera);
      expect(stage.asPassNode(noRenderer)).toBe(node);
      expect(inputs).toHaveLength(1);
    });

    it('a build after the change takes the scene and the camera the stage has by then', () => {
      const stage = makeStage();
      const {postProcess, inputs} = passThrough();
      stage.postProcess = postProcess;
      const scene = new Scene();
      const camera = new OrthographicCamera();
      stage.scene = scene;
      stage.camera = camera;

      stage.asPassNode(noRenderer);

      expect(inputs[0]!.pass.scene).toBe(scene);
      expect(inputs[0]!.pass.camera).toBe(camera);
    });
  });

  describe('letting go of a build', () => {
    /** A post-process whose builds register two releases each, and what ran in which order. */
    const withReleases = () => {
      const log: string[] = [];
      const passes: PassNode[] = [];
      let builds = 0;
      const postProcess: StagePostProcess = {
        build: ({pass, onDispose}) => {
          const build = ++builds;
          passes.push(pass);
          vi.spyOn(pass, 'dispose').mockImplementation(() => void log.push(`pass ${build}`));
          onDispose(() => void log.push(`first ${build}`));
          onDispose(() => void log.push(`second ${build}`));
          return pass;
        },
      };
      return {postProcess, log, passes};
    };

    it('an assignment runs the releases once, in order, and disposes the pipeline and the pass', () => {
      const {dispose} = spyOnPipelines();
      const stage = makeStage();
      const {postProcess, log} = withReleases();
      stage.postProcess = postProcess;
      stage.renderTo(makeRenderer().renderer);

      stage.postProcess = undefined;

      expect(log).toEqual(['first 1', 'second 1', 'pass 1']);
      expect(dispose.mock.contexts).toEqual([draws[0]!.pipeline]);
    });

    it('dispose() runs the releases once and leaves the post-process object alone', () => {
      const {dispose} = spyOnPipelines();
      const stage = makeStage();
      const {postProcess, log} = withReleases();
      stage.postProcess = postProcess;
      stage.renderTo(makeRenderer().renderer);

      stage.dispose();
      stage.dispose();

      expect(log).toEqual(['first 1', 'second 1', 'pass 1']);
      expect(dispose).toHaveBeenCalledTimes(1);
      expect(stage.postProcess, 'the value it was left with').toBe(postProcess);
    });

    it('a release that throws holds up none of the others, and the errors come out afterwards', () => {
      const stage = makeStage();
      const first = new Error('first');
      const second = new Error('second');
      const third = vi.fn();
      stage.postProcess = {
        build: ({pass, onDispose}) => {
          onDispose(() => {
            throw first;
          });
          onDispose(() => {
            throw second;
          });
          onDispose(third);
          return pass;
        },
      };
      stage.asPassNode(noRenderer);

      let thrown: unknown;
      try {
        stage.postProcess = undefined;
      } catch (error) {
        thrown = error;
      }

      expect(third).toHaveBeenCalledTimes(1);
      expect(stage.postProcess).toBeUndefined();
      expect(thrown).toBeInstanceOf(AggregateError);
      expect((thrown as AggregateError).errors).toEqual([first, second]);
      expect((thrown as AggregateError).message).toBe(
        'Stage2D#postProcess: more than one of the releases of the previous post-process and the listeners of OnStageAfterPostProcessChanged threw',
      );
    });

    it('a release that assigns a post-process finds the new one in place, and its own assignment stands', () => {
      const stage = makeStage();
      const second = passThrough();
      const third = passThrough();
      const seen: unknown[] = [];
      stage.postProcess = {
        build: ({pass, onDispose}) => {
          onDispose(() => {
            seen.push(stage.postProcess);
            stage.postProcess = third.postProcess;
          });
          return pass;
        },
      };
      stage.asPassNode(noRenderer);
      const changed = vi.fn();
      on(stage, OnStageAfterPostProcessChanged, changed);

      stage.postProcess = second.postProcess;

      expect(seen, 'the state stood before the release ran').toEqual([second.postProcess]);
      expect(stage.postProcess).toBe(third.postProcess);
      stage.asPassNode(noRenderer);
      expect(second.inputs, 'the one that was replaced at once builds nothing').toHaveLength(0);
      expect(third.inputs).toHaveLength(1);
      expect(changed).toHaveBeenCalledTimes(2);
    });

    it('a release that disposes the stage leaves it disposed, with the value it was assigned', () => {
      const stage = makeStage();
      const next = passThrough();
      stage.postProcess = {
        build: ({pass, onDispose}) => {
          onDispose(() => stage.dispose());
          return pass;
        },
      };
      stage.asPassNode(noRenderer);

      stage.postProcess = next.postProcess;

      expect(stage.isDisposed).toBe(true);
      expect(stage.postProcess).toBe(next.postProcess);
      expect(() => stage.asPassNode(noRenderer)).toThrow('this stage has been disposed');
      expect(next.inputs).toHaveLength(0);
    });

    it('a release registered after the stage let go of the build runs at once', () => {
      const stage = makeStage();
      const {postProcess, inputs} = passThrough();
      stage.postProcess = postProcess;
      stage.asPassNode(noRenderer);
      stage.postProcess = undefined;
      const late = vi.fn();

      inputs[0]!.onDispose(late);

      expect(late).toHaveBeenCalledTimes(1);
    });

    it('one object on two stages builds twice, and the dispose of one stage leaves the other its node', () => {
      const first = makeStage();
      const second = makeStage();
      const {postProcess, log, passes} = withReleases();
      first.postProcess = postProcess;
      second.postProcess = postProcess;
      const firstNode = first.asPassNode(noRenderer);
      const secondNode = second.asPassNode(noRenderer);
      expect(firstNode).not.toBe(secondNode);
      expect(passes).toHaveLength(2);

      first.dispose();

      expect(log).toEqual(['first 1', 'second 1', 'pass 1']);
      expect(second.asPassNode(noRenderer)).toBe(secondNode);
    });

    it('a write after dispose() does nothing', () => {
      const stage = makeStage();
      const {postProcess, inputs} = passThrough();
      stage.dispose();
      const changed = vi.fn();
      on(stage, OnStageAfterPostProcessChanged, changed);

      stage.postProcess = postProcess;

      expect(stage.postProcess).toBeUndefined();
      expect(changed).not.toHaveBeenCalled();
      expect(inputs).toHaveLength(0);
    });
  });

  describe('memory', () => {
    it('releasePassNodeMemory() releases the render target of the pass of the build as well', () => {
      const stage = makeStage();
      const {postProcess, inputs} = passThrough();
      stage.postProcess = postProcess;
      stage.asPassNode(noRenderer);
      const rtDispose = vi.spyOn(inputs[0]!.pass.renderTarget, 'dispose');

      stage.releasePassNodeMemory();

      expect(rtDispose).toHaveBeenCalledTimes(1);
    });

    it('an assignment releases the render target of the pass node the stage no longer draws', () => {
      const stage = makeStage();
      const plain = stage.asPassNode(noRenderer) as PassNode;
      const rtDispose = vi.spyOn(plain.renderTarget, 'dispose');
      const nodeDispose = vi.spyOn(plain, 'dispose');

      stage.postProcess = passThrough().postProcess;

      expect(rtDispose).toHaveBeenCalledTimes(1);
      expect(nodeDispose, 'the node stays').not.toHaveBeenCalled();
    });
  });
});
