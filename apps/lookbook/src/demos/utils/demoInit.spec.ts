import type {Display, DisplayEventProps} from '@spearwolf/twopoint5d';
import {describe, expect, it, vi} from 'vitest';
import {catchPrecompile, onDemoInit, startDemo} from './demoInit';

const props = {} as DisplayEventProps;

/** Stubs `document`; `demoUi` is what `querySelector('demo-ui')` answers. */
const stubDocument = (demoUi: {append: ReturnType<typeof vi.fn>} | null) => {
  const line = {className: '', textContent: '', setAttribute: vi.fn()};
  const createElement = vi.fn(() => line);
  const body = {append: vi.fn()};
  vi.stubGlobal('document', {
    createElement,
    querySelector: (selector: string) => (selector === 'demo-ui' ? demoUi : null),
    body,
  });
  return {line, createElement, body};
};

const silenceConsole = () => vi.spyOn(console, 'error').mockImplementation(() => {});

describe('startDemo()', () => {
  it('shows a failed init under the name of the demo, in the console and over the canvas, and the display starts all the same', async () => {
    const consoleError = silenceConsole();
    const demoUi = {append: vi.fn()};
    const {line} = stubDocument(demoUi);
    const error = new Error('the atlas answered 404');
    const display = {
      start: vi.fn(async (callback: (props: DisplayEventProps) => Promise<void>) => {
        await callback(props);
        return display;
      }),
    } as unknown as Display;

    await expect(
      startDemo(display, 'cardboard-parade', async () => {
        throw error;
      }),
    ).resolves.toBe(display);

    expect(consoleError).toHaveBeenCalledWith('cardboard-parade: the demo failed to start', error);
    expect(line.className).toBe('demo-failure');
    expect(line.setAttribute).toHaveBeenCalledWith('role', 'alert');
    expect(line.textContent).toBe('cardboard-parade failed to start: the atlas answered 404. The console has the details.');
    expect(demoUi.append).toHaveBeenCalledWith(line);
  });

  it('hands the props of the display to the init, and shows nothing when the init succeeds', async () => {
    const consoleError = silenceConsole();
    const {createElement} = stubDocument({append: vi.fn()});
    const display = {
      start: vi.fn(async (callback: (props: DisplayEventProps) => Promise<void>) => {
        await callback(props);
        return display;
      }),
    } as unknown as Display;
    const init = vi.fn(async (_props: DisplayEventProps) => {});

    await startDemo(display, 'textured-quads', init);

    expect(init).toHaveBeenCalledOnce();
    expect(init).toHaveBeenCalledWith(props);
    expect(consoleError).not.toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalled();
  });

  it('writes the line into the body of a page without <demo-ui>, and a thrown value that is no Error as it is', async () => {
    silenceConsole();
    const {line, body} = stubDocument(null);
    const display = {
      start: vi.fn(async (callback: (props: DisplayEventProps) => Promise<void>) => {
        await callback(props);
        return display;
      }),
    } as unknown as Display;

    await startDemo(display, 'map2d-cam-visi', async () => {
      throw 'gone';
    });

    expect(line.textContent).toBe('map2d-cam-visi failed to start: gone. The console has the details.');
    expect(body.append).toHaveBeenCalledWith(line);
  });

  it('rejects where start() itself rejects, and shows nothing', async () => {
    const consoleError = silenceConsole();
    const {createElement} = stubDocument({append: vi.fn()});
    const error = new Error('the display was disposed');
    const display = {start: vi.fn(async () => Promise.reject(error))} as unknown as Display;

    await expect(startDemo(display, 'vector-balls', async () => {})).rejects.toBe(error);

    expect(consoleError).not.toHaveBeenCalled();
    expect(createElement).not.toHaveBeenCalled();
  });
});

describe('onDemoInit()', () => {
  it('puts the guarded init on onInit, and answers what onInit answers', async () => {
    const consoleError = silenceConsole();
    stubDocument({append: vi.fn()});
    const unsubscribe = () => {};
    let captured: ((props: DisplayEventProps) => Promise<void>) | undefined;
    const display = {
      onInit: vi.fn((listener: (props: DisplayEventProps) => Promise<void>) => {
        captured = listener;
        return unsubscribe;
      }),
    } as unknown as Display;
    const error = new Error('broken json');

    const answer = onDemoInit(display, 'first-sprite', async () => {
      throw error;
    });

    expect(answer).toBe(unsubscribe);
    await expect(captured?.(props)).resolves.toBeUndefined();
    expect(consoleError).toHaveBeenCalledWith('first-sprite: the demo failed to start', error);
  });
});

describe('catchPrecompile()', () => {
  it('logs a failed precompile() under the name of the demo, and resolves', async () => {
    const consoleError = silenceConsole();
    const error = new Error('no shader');

    await expect(catchPrecompile('stage-masks-portal', Promise.reject(error))).resolves.toBeUndefined();

    expect(consoleError).toHaveBeenCalledWith('stage-masks-portal: precompile() failed, the shaders build on first use', error);
  });

  it('resolves with nothing logged when precompile() resolves', async () => {
    const consoleError = silenceConsole();

    await expect(catchPrecompile('stage-masks-portal', Promise.resolve())).resolves.toBeUndefined();

    expect(consoleError).not.toHaveBeenCalled();
  });
});
