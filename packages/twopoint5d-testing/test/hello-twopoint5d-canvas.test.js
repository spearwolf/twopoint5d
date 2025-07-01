import {expect} from '@esm-bundle/chai';
import {Display} from '@spearwolf/twopoint5d';

let display;
let firstFrameNo = -1;

describe('hello twopoint5d canvas', () => {
  it('canvas element exists', () => {
    const el = document.querySelector('canvas#test-canvas');

    expect(el).to.exist;
  });

  it('create Display', () => {
    const el = document.querySelector('canvas#test-canvas');
    display = new Display(el);

    display.onNextFrame(({frameNo}) => {
      if (display.isFirstFrame) {
        firstFrameNo = frameNo;
        console.debug(`Display: first frame rendered with frameNo=${firstFrameNo}`);
      }
    });

    expect(display).to.exist;
  });

  it('display has a dimension greater than 0x0', async () => {
    await display.start();

    console.debug(`Display: canvas dimension is ${display.width}x${display.height}`);

    expect(display.width).to.greaterThan(0);
    expect(display.height).to.greaterThan(0);
  });

  it('frameNo starts at 1', async () => {
    const {display: _display, renderer: _renderer, ...otherDisplayArgs} = await display.nextFrame();

    console.debug(`Display: current frameNo is #${display.frameNo}, "renderFrame" event args=`, {
      ...otherDisplayArgs,
      display: _display ? '[Object]' : 'undefined',
      renderer: _renderer ? '[Object]' : 'undefined',
    });

    expect(firstFrameNo).to.equal(1, 'first frameNo should be 1');
    expect(display.frameNo).to.greaterThan(0, 'current frameNo should be equal or greater');
  });
});
