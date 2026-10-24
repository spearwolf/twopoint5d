import {expect} from '@esm-bundle/chai';
import {whenRejectionsReported} from './helpers/fixtures.js';

// The runner writes every unhandled rejection of a page into the browser logs of the run, as
// "An error was thrown in a Promise outside a test" with its stack. The control rejection of
// whenRejectionsReported() is left unhandled on purpose and must not show there: a green run that
// prints an error text teaches its readers to look past one. This file checks that the helper and
// the init script of web-test-runner.config.js that takes the control off the page work together.

describe('whenRejectionsReported()', function () {
  // the four kinds the runner collects into its browser logs
  const kinds = /** @type {const} */ (['log', 'debug', 'warn', 'error']);
  /** @type {Map<(typeof kinds)[number], (...args: unknown[]) => void>} */
  const originals = new Map();

  const restoreConsole = () => {
    for (const [kind, original] of originals) console[kind] = original;
    originals.clear();
  };

  // a test the runner times out never reaches its finally, and every file after it would write
  // into the stubs
  afterEach(restoreConsole);

  it('writes nothing to the console', async () => {
    /** @type {Array<[string, unknown[]]>} */
    const written = [];
    for (const kind of kinds) {
      originals.set(kind, console[kind]);
      console[kind] = (...args) => {
        written.push([kind, args]);
      };
    }
    try {
      await whenRejectionsReported();
      // a logger that heard of the control writes from a promise reaction of the same event, and
      // all of those have run before the next task
      await new Promise((resolve) => setTimeout(resolve, 0));
    } finally {
      restoreConsole();
    }

    expect(written, 'what went to the console while whenRejectionsReported() ran').to.deep.equal([]);
  });
});
