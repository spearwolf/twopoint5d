// Finds the code blocks of a Markdown document that are marked `ts check`.
//
// A pure function over text: no file system, no TypeScript. `checkDocSnippets.mjs` reads
// the files and hands them in, `compileSnippets.mjs` type-checks what comes out.
//
// Every fence is tracked, marked or not, because a `ts check` line inside another code
// block (a four-backtick block that shows Markdown, say) is an example of the marker, not
// the marker. A marker that is nearly right (`js check`, `ts check strict`) is reported
// instead of ignored: a typo must not drop a block out of the check without a word.
//
// In a `CHANGELOG.md` only the `## [Unreleased]` section counts, up to the next `## [`
// heading: a released section is history and shows the API of its release, so its
// blocks are neither compiled nor checked for their marker. A changelog without an
// Unreleased section has no block to check.

const OPENING_FENCE = /^(\s*)(`{3,})(.*)$/;
const CLOSING_FENCE = /^\s*(`{3,})\s*$/;

const MARKER = ['ts', 'check'];

const CHANGELOG = 'CHANGELOG.md';
const VERSION_HEADING = /^## \[/;
const UNRELEASED_HEADING = /^## \[Unreleased\]/;

/**
 * @param {string} markdown
 * @param {string} file
 * @returns {{
 *   snippets: Array<{file: string, line: number, indent: number, code: string}>,
 *   problems: Array<{file: string, line: number, message: string}>,
 * }}
 */
export function extractSnippets(markdown, file) {
  const snippets = [];
  const problems = [];
  const lines = markdown.split(/\r?\n/);

  // a pure function: the name of the file tells a changelog, not the file system
  const isChangelog = file.split(/[\\/]/).pop() === CHANGELOG;
  // outside a changelog every block counts; inside one only those under `## [Unreleased]`
  let inScope = !isChangelog;
  let unreleasedSeen = false;

  /**
   * @typedef {object} OpenFence
   * @property {boolean} marked
   * @property {number} indent
   * @property {number} ticks
   * @property {number} line
   * @property {string[]} code
   */
  /** @type {OpenFence | null} */
  let open = null;

  lines.forEach((text, index) => {
    const lineNumber = index + 1;

    if (open == null) {
      // a heading inside a code block is code, so the sections are tracked between fences only
      if (isChangelog && VERSION_HEADING.test(text)) {
        // the first `## [` heading after `## [Unreleased]` ends the section for good
        inScope = !unreleasedSeen && UNRELEASED_HEADING.test(text);
        if (inScope) unreleasedSeen = true;
        return;
      }

      const match = OPENING_FENCE.exec(text);
      // CommonMark: the info string of a backtick fence holds no backtick, so a line such
      // as "```inline``` prose" opens nothing
      if (match == null) return;
      // the three groups of the pattern always take part in a match
      const [, indent, ticks, rest] = /** @type {[string, string, string, string]} */ (/** @type {unknown} */ (match));
      if (rest.includes('`')) return;

      const info = rest.trim();
      const words = info.split(/\s+/).filter(Boolean);
      const marked = inScope && words.length === MARKER.length && MARKER.every((word, i) => words[i] === word);

      if (inScope && !marked && words.includes('check')) {
        problems.push({file, line: lineNumber, message: `unknown marker \`${info}\` — only \`ts check\` is checked`});
      }

      open = {
        marked,
        indent: indent.length,
        ticks: ticks.length,
        line: lineNumber,
        code: [],
      };
      return;
    }

    const closing = CLOSING_FENCE.exec(text);
    if (closing != null && /** @type {string} */ (closing[1]).length >= open.ticks) {
      if (open.marked) {
        snippets.push({file, line: open.line + 1, indent: open.indent, code: open.code.join('\n')});
      }
      open = null;
      return;
    }

    if (open.marked) {
      // a fence inside a list item is indented; CommonMark takes that much off every
      // code line
      open.code.push(text.replace(new RegExp(`^ {0,${open.indent}}`), ''));
    }
  });

  // the callback above assigns `open`, which the compiler does not follow
  const unclosed = /** @type {OpenFence | null} */ (open);
  if (unclosed?.marked) {
    problems.push({file, line: unclosed.line, message: 'code block marked `ts check` is never closed'});
  }

  return {snippets, problems};
}
