// Finds the code blocks of a Markdown document that are marked `ts check`.
//
// A pure function over text: no file system, no TypeScript. `checkDocSnippets.mjs` reads
// the files and hands them in, `compileSnippets.mjs` type-checks what comes out.
//
// Every fence is tracked, marked or not, because a `ts check` line inside another code
// block (a four-backtick block that shows Markdown, say) is an example of the marker, not
// the marker. Backtick and tilde fences count alike, and a fence counts where CommonMark
// sees one: indented at most three columns past the start of its line, or past the content
// of the list item it sits in, a tab moving on to the next multiple of four. A line
// indented further is code of an indented block and neither opens nor closes a fence.
//
// A marker that is nearly right (`js check`, `ts check strict`) is reported instead of
// ignored: a typo must not drop a block out of the check without a word. So is a marker
// inside a blockquote: `checkDocSnippets` does not unwrap quotes, and the block would
// otherwise fall out of the check in silence.
//
// In a `CHANGELOG.md` only the `## [Unreleased]` section counts, up to the next `## [`
// heading: a released section is history and shows the API of its release, so its
// blocks are neither compiled nor checked for their marker. A changelog without an
// Unreleased section has no block to check.

const OPENING_FENCE = /^([ \t]*)(`{3,}|~{3,})(.*)$/;
const CLOSING_FENCE = /^([ \t]*)(`{3,}|~{3,})\s*$/;
const QUOTED_FENCE = /^\s*>[\s>]*(`{3,}|~{3,})(.*)$/;
// a bullet or an ordered marker of a list item, and the spaces after it
const LIST_ITEM = /^[ \t]*([-+*]|\d{1,9}[.)])( +|$)/;
const LEADING_WHITESPACE = /^[ \t]*/;

// CommonMark: a fence may be indented up to three columns past the start of its container,
// the line or the content of a list item; four or more make the line code of an indented block
const MAX_FENCE_INDENT = 3;

/**
 * The column a run of leading spaces and tabs ends at: a tab moves on to the next multiple of 4.
 * @param {string} whitespace
 * @returns {number}
 */
const columnsOf = (whitespace) => {
  let column = 0;
  for (const char of whitespace) column = char === '\t' ? column + 4 - (column % 4) : column + 1;
  return column;
};

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
   * @property {number} indent the columns of the fence line itself
   * @property {number} base the content column of the list item the fence sits in, 0 outside a list
   * @property {'`' | '~'} fence
   * @property {number} size
   * @property {number} line
   * @property {string[]} code
   */
  /** @type {OpenFence | null} */
  let open = null;
  // the content columns of the list items the next line may sit in, innermost last
  /** @type {number[]} */
  const listContent = [];

  lines.forEach((text, index) => {
    const lineNumber = index + 1;

    if (open == null) {
      if (text.trim() === '') return;
      const indent = columnsOf(LEADING_WHITESPACE.exec(text)?.[0] ?? '');
      // a line indented less than the content of a list item is outside that item. A lazy
      // continuation line of a paragraph ends the item here, which CommonMark does not; only a fence
      // four or more columns deep that follows such a line in the same item is read differently
      while (listContent.length > 0 && /** @type {number} */ (listContent.at(-1)) > indent) listContent.pop();
      const base = listContent.at(-1) ?? 0;
      // code of an indented block, or text that goes on a paragraph: it opens no fence and no list item
      if (indent - base > MAX_FENCE_INDENT) return;

      // a heading inside a code block is code, so the sections are tracked between fences only
      if (isChangelog && VERSION_HEADING.test(text)) {
        // the first `## [` heading after `## [Unreleased]` ends the section for good
        inScope = !unreleasedSeen && UNRELEASED_HEADING.test(text);
        if (inScope) unreleasedSeen = true;
        return;
      }

      const match = OPENING_FENCE.exec(text);
      if (match == null) {
        const item = LIST_ITEM.exec(text);
        if (item != null) {
          const marker = /** @type {string} */ (item[1]);
          const spaces = /** @type {string} */ (item[2]).length;
          // CommonMark: the content starts after 1 to 4 spaces; after 5 or more, or at the end of the
          // line, one column past the marker
          listContent.push(indent + marker.length + (spaces >= 1 && spaces <= 4 ? spaces : 1));
          return;
        }

        const quoted = inScope ? QUOTED_FENCE.exec(text) : null;
        if (quoted != null) {
          // both groups of the pattern always take part in a match
          const quotedFence = /** @type {string} */ (quoted[1]);
          const quotedRest = /** @type {string} */ (quoted[2]);
          // a quoted fence is never tracked as open: its code lines start with `>` themselves
          if (!(quotedFence.startsWith('`') && quotedRest.includes('`'))) {
            const info = quotedRest.trim();
            if (info.split(/\s+/).includes('check')) {
              problems.push({
                file,
                line: lineNumber,
                message: `a code block marked \`${info}\` inside a blockquote is not checked — only a \`ts check\` block outside a quote is compiled`,
              });
            }
          }
        }
        return;
      }
      // the groups of the pattern always take part in a match
      const run = /** @type {string} */ (match[2]);
      const rest = /** @type {string} */ (match[3]);
      const fence = /** @type {'`' | '~'} */ (run.charAt(0));
      // CommonMark: the info string of a backtick fence holds no backtick, so a line such
      // as "```inline``` prose" opens nothing; the info string of a tilde fence may
      if (fence === '`' && rest.includes('`')) return;

      const info = rest.trim();
      const words = info.split(/\s+/).filter(Boolean);
      const marked = inScope && words.length === MARKER.length && MARKER.every((word, i) => words[i] === word);

      if (inScope && !marked && words.includes('check')) {
        problems.push({file, line: lineNumber, message: `unknown marker \`${info}\` — only \`ts check\` is checked`});
      }

      open = {
        marked,
        indent,
        base,
        fence,
        size: run.length,
        line: lineNumber,
        code: [],
      };
      return;
    }

    const closing = CLOSING_FENCE.exec(text);
    // CommonMark: only a run of the same character, at least as long as the opening one, closes
    const run = /** @type {string} */ (closing?.[2]);
    if (
      closing != null &&
      columnsOf(/** @type {string} */ (closing[1])) - open.base <= MAX_FENCE_INDENT &&
      run.charAt(0) === open.fence &&
      run.length >= open.size
    ) {
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
