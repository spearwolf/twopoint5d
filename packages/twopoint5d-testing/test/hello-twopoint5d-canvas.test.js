import {expect} from '@esm-bundle/chai';
import {Display} from '@spearwolf/twopoint5d';

describe('hello twopoint5d canvas', function () {
  // a cold webgpu start — adapter plus device — happens inside the constructor, and it is slow
  this.timeout(20000);

  /** @type {Display | undefined} */
  let display;

  afterEach(() => {
    display?.dispose();
    display = undefined;
  });

  it('renders its first frame as frame 1 on the canvas of the test page, at a size above 0x0', async () => {
    const el = document.querySelector('canvas#test-canvas');
    expect(el, 'canvas#test-canvas').to.exist;

    display = new Display(el);

    let firstFrameNo = -1;
    display.onNextFrame(({frameNo}) => {
      firstFrameNo = frameNo;
    });

    await display.start();

    console.debug(`Display: canvas dimension is ${display.width}x${display.height}`);
    expect(display.width, 'width').to.be.greaterThan(0);
    expect(display.height, 'height').to.be.greaterThan(0);

    await display.nextFrame();

    expect(firstFrameNo, 'the frameNo of the first frame').to.equal(1);
  });
});
