// Finds the code blocks of a Markdown document that are marked `ts check`.
//
// A pure function over text: no file system, no TypeScript. `checkDocSnippets.mjs` reads
// the files and hands them in, `compileSnippets.mjs` type-checks what comes out.
//
// Every fence is tracked, marked or not, because a `ts check` line inside another code
// block (a four-backtick block that shows Markdown, say) is an example of the marker, not
// the marker. Backtick and tilde fences count alike, and a fence counts where CommonMark
// sees one: indented at most three columns past the start of its line or past the
// content of the list item it sits in, the line of the item's marker included. A tab
// moves on to the next multiple of four columns, before a fence as after a list marker.
// A line indented further is code of an indented block and neither opens nor closes a
// fence. A line of three or more of the same `*`, `-` or `_`, spaced or not, is a
// thematic break and no list item. A block inside a list item ends with the item, at the
// first line that is not blank and is indented less than the item's content; a marked
// block that ends so is reported, as one that never closes is.
//
// The code of a block loses the indentation CommonMark takes off it, up to the column of
// its fence, and a snippet carries for each code line how far that moved its characters,
// so that a diagnostic points at the column of the Markdown line, tabs and all.
//
// A marker that is nearly right (`js check`, `ts check strict`) is reported instead of
// ignored: a typo must not drop a block out of the check without a word. So is a marker
// inside a blockquote, in a list item of the quote as well: `checkDocSnippets` does not
// unwrap quotes, and the block would otherwise fall out of the check in silence.
//
// In a `CHANGELOG.md` only the `## [Unreleased]` section counts, up to the next `## [`
// heading: a released section is history and shows the API of its release, so its
// blocks are neither compiled nor checked for their marker. A changelog without an
// Unreleased section has no block to check.

// applied to the rest of a line behind its indentation and its list markers
const OPENING_FENCE = /^(`{3,}|~{3,})(.*)$/;
const CLOSING_FENCE = /^([ \t]*)(`{3,}|~{3,})\s*$/;
// a quote marker, then any more quote markers, list markers and spaces, then a fence: a list marker
// counts only with a space or a tab behind it, as CommonMark has it
const QUOTED_FENCE = /^\s*>(?:[ \t>]|(?:[-+*]|\d{1,9}[.)])(?=[ \t]))*(`{3,}|~{3,})(.*)$/;
// a bullet or an ordered marker of a list item, and the spaces and tabs after it
const LIST_ITEM = /^([-+*]|\d{1,9}[.)])([ \t]+|$)/;
// CommonMark: three or more of the same `*`, `-` or `_`, spaced or not, make a thematic break,
// which wins over a list item
const THEMATIC_BREAK = /^([-*_])(?:[ \t]*\1){2,}[ \t]*$/;
const LEADING_WHITESPACE = /^[ \t]*/;

// CommonMark: a fence may be indented up to three columns past the start of its container,
// the line or the content of a list item; four or more make the line code of an indented block
const MAX_FENCE_INDENT = 3;

/**
 * The column a run of spaces and tabs that starts at column `from` ends at: a tab moves on to the
 * next multiple of 4.
 * @param {string} whitespace
 * @param {number} [from]
 * @returns {number}
 */
const columnsOf = (whitespace, from = 0) => {
  let column = from;
  for (const char of whitespace) column = char === '\t' ? column + 4 - (column % 4) : column + 1;
  return column;
};

/**
 * Takes up to `columns` columns of indentation off a code line, as CommonMark does with the lines
 * of a fenced block: a tab counts up to the next multiple of 4, and one that reaches past `columns`
 * leaves the rest of its width as spaces.
 * @param {string} text
 * @param {number} columns
 * @returns {{code: string, offset: number}} `offset` is what a character index in `code` needs
 *   added to point at the same character in `text`
 */
const stripIndent = (text, columns) => {
  let column = 0;
  let index = 0;
  while (index < text.length && column < columns) {
    const char = text[index];
    if (char === ' ') column += 1;
    else if (char === '\t') column += 4 - (column % 4);
    else break;
    index += 1;
  }
  const kept = column > columns ? ' '.repeat(column - columns) : '';
  return {code: kept + text.slice(index), offset: index - kept.length};
};

const MARKER = ['ts', 'check'];

const CHANGELOG = 'CHANGELOG.md';
const VERSION_HEADING = /^## \[/;
const UNRELEASED_HEADING = /^## \[Unreleased\]/;

/**
 * @typedef {object} OpenFence
 * @property {boolean} marked
 * @property {number} indent the column the fence starts at; CommonMark takes up to that many
 *   columns off each code line
 * @property {number} base the content column of the list item the fence sits in, 0 outside a list;
 *   a line that is not blank and is indented less ends the item and the block
 * @property {'`' | '~'} fence
 * @property {number} size
 * @property {number} line
 * @property {string[]} code
 * @property {number[]} offsets for each code line, the `offset` of `stripIndent()`
 */

/**
 * What the scan of one document keeps from line to line.
 *
 * @typedef {object} ScanState
 * @property {string} file
 * @property {boolean} isChangelog
 * @property {boolean} inScope outside a changelog every block counts; inside one only those under
 *   `## [Unreleased]`
 * @property {boolean} unreleasedSeen
 * @property {OpenFence | null} open
 * @property {number[]} listContent the content columns of the list items the next line may sit in,
 *   innermost last
 * @property {Array<{file: string, line: number, code: string, offsets: number[]}>} snippets
 * @property {Array<{file: string, line: number, message: string}>} problems
 */

/**
 * @param {string} markdown
 * @param {string} file
 * @returns {{
 *   snippets: ScanState['snippets'],
 *   problems: ScanState['problems'],
 * }}
 *   `offsets` holds for each line of `code` what a character index of that line needs added to
 *   point at the same character of the Markdown line.
 */
export function extractSnippets(markdown, file) {
  /** @type {ScanState} */
  const state = {
    file,
    // a pure function: the name of the file tells a changelog, not the file system
    isChangelog: file.split(/[\\/]/).pop() === CHANGELOG,
    inScope: false,
    unreleasedSeen: false,
    open: null,
    listContent: [],
    snippets: [],
    problems: [],
  };
  state.inScope = !state.isChangelog;

  for (const [index, text] of markdown.split(/\r?\n/).entries()) {
    readLine(state, text, index + 1);
  }

  if (state.open?.marked) {
    state.problems.push({file, line: state.open.line, message: 'code block marked `ts check` is never closed'});
  }

  return {snippets: state.snippets, problems: state.problems};
}

/**
 * Reads one line of the document into the state: the code of the open block, or whatever the
 * line opens.
 *
 * @param {ScanState} state
 * @param {string} text
 * @param {number} lineNumber
 */
function readLine(state, text, lineNumber) {
  if (state.open != null && continueOpenBlock(state, text, lineNumber)) return;

  if (text.trim() === '') return;

  // a heading inside a code block is code, so the sections are tracked between fences only
  if (state.isChangelog && readChangelogHeading(state, text)) return;

  const whitespace = LEADING_WHITESPACE.exec(text)?.[0] ?? '';
  const markers = readListMarkers(state, text, whitespace, columnsOf(whitespace));
  if (markers == null) return;
  const {column, base, rest} = markers;

  const match = OPENING_FENCE.exec(rest);
  if (match == null) {
    reportQuotedFence(state, rest, lineNumber);
    return;
  }
  openFence(state, match, column, base, lineNumber);
}

/**
 * Takes a line into the open block: it is code of the block, or the fence that closes it, or it
 * ends the list item the block sits in and the block with it.
 *
 * @param {ScanState} state
 * @param {string} text
 * @param {number} lineNumber
 * @returns {boolean} `true` if the line belonged to the block; `false` if it ended the list item
 *   and the block, and has to be read again outside the block
 */
function continueOpenBlock(state, text, lineNumber) {
  const open = /** @type {OpenFence} */ (state.open);
  // CommonMark: a line that is not blank and is indented less than the content of the list
  // item the block sits in ends the item, and the block with it — code has no lazy
  // continuation. The line is read again outside the block: it may open the next one
  const whitespace = LEADING_WHITESPACE.exec(text)?.[0] ?? '';
  if (text.trim() !== '' && columnsOf(whitespace) < open.base) {
    if (open.marked) {
      state.problems.push({
        file: state.file,
        line: open.line,
        message: `code block marked \`ts check\` is never closed — its list item ends at line ${lineNumber}`,
      });
    }
    state.open = null;
    return false;
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
      state.snippets.push({file: state.file, line: open.line + 1, code: open.code.join('\n'), offsets: open.offsets});
    }
    state.open = null;
    return true;
  }

  if (open.marked) {
    const {code, offset} = stripIndent(text, open.indent);
    open.code.push(code);
    open.offsets.push(offset);
  }
  return true;
}

/**
 * Follows the `## [` headings of a changelog: the section of the state is `## [Unreleased]`, up to
 * the next such heading.
 *
 * @param {ScanState} state
 * @param {string} text
 * @returns {boolean} `true` if the line was a `## [` heading
 */
function readChangelogHeading(state, text) {
  if (!VERSION_HEADING.test(text)) return false;
  // a heading starts at column 0, outside every list item
  state.listContent.length = 0;
  // the first `## [` heading after `## [Unreleased]` ends the section for good
  state.inScope = !state.unreleasedSeen && UNRELEASED_HEADING.test(text);
  if (state.inScope) state.unreleasedSeen = true;
  return true;
}

/**
 * Takes the list items off a line that start on it, and keeps the content columns of the items
 * in the state; the rest of the line behind the markers is what may open a fence.
 *
 * @param {ScanState} state
 * @param {string} text
 * @param {string} whitespace the indentation of the line
 * @param {number} indent the column the indentation ends at
 * @returns {{column: number, base: number, rest: string} | null} the column and the list content
 *   column the rest of the line starts at, and the rest; `null` if the line opens nothing: code of
 *   an indented block, a thematic break, or an item with an empty or indented first line
 */
function readListMarkers(state, text, whitespace, indent) {
  const {listContent} = state;
  // a line indented less than the content of a list item is outside that item. Paragraphs are
  // not tracked: a lazy continuation line of a paragraph ends the item here, and a list marker
  // that may not interrupt a paragraph (an empty item, an ordered one that does not start at 1)
  // starts one all the same, which CommonMark does neither; only a fence four or more columns
  // deep that follows such a line is read differently
  while (listContent.length > 0 && /** @type {number} */ (listContent.at(-1)) > indent) listContent.pop();
  let base = listContent.at(-1) ?? 0;
  // code of an indented block, or text that goes on a paragraph: it opens no fence and no
  // list item
  if (indent - base > MAX_FENCE_INDENT) return null;

  // the line is read from its first character on: a list marker hands the rest of the line on
  // as the first line of its item, which may open a fence or start with another marker
  let column = indent;
  let rest = text.slice(whitespace.length);
  for (;;) {
    if (THEMATIC_BREAK.test(rest)) return null;
    const item = LIST_ITEM.exec(rest);
    if (item == null) break;
    const start = column + /** @type {string} */ (item[1]).length;
    const end = columnsOf(/** @type {string} */ (item[2]), start);
    rest = rest.slice(item[0].length);
    // CommonMark: the content starts after 1 to 4 columns of spaces or tabs; on an otherwise
    // empty line, or after 5 or more (the item starts with indented code), one column past the
    // marker
    const content = rest === '' || end - start > 4 ? start + 1 : end;
    listContent.push(content);
    // an empty first line, or one of indented code, opens no fence and holds no other marker
    if (content !== end) return null;
    column = content;
    base = content;
  }
  return {column, base, rest};
}

/**
 * Reports a block marked `check` inside a blockquote, which the check does not compile.
 *
 * @param {ScanState} state
 * @param {string} rest the line behind its indentation and list markers
 * @param {number} lineNumber
 */
function reportQuotedFence(state, rest, lineNumber) {
  const quoted = state.inScope ? QUOTED_FENCE.exec(rest) : null;
  if (quoted == null) return;
  // both groups of the pattern always take part in a match
  const quotedFence = /** @type {string} */ (quoted[1]);
  const quotedRest = /** @type {string} */ (quoted[2]);
  // a quoted fence is never tracked as open: its code lines start with `>` themselves
  if (quotedFence.startsWith('`') && quotedRest.includes('`')) return;
  const info = quotedRest.trim();
  if (info.split(/\s+/).includes('check')) {
    state.problems.push({
      file: state.file,
      line: lineNumber,
      message: `a code block marked \`${info}\` inside a blockquote is not checked — only a \`ts check\` block outside a quote is compiled`,
    });
  }
}

/**
 * Opens the block of a fence line: checks its marker, reports a marker that is nearly right, and
 * sets `state.open`. A line that only looks like a fence opens nothing.
 *
 * @param {ScanState} state
 * @param {RegExpExecArray} match the match of `OPENING_FENCE` on the rest of the line
 * @param {number} column the column the fence starts at
 * @param {number} base the content column of the list item the fence sits in, 0 outside a list
 * @param {number} lineNumber
 */
function openFence(state, match, column, base, lineNumber) {
  // the groups of the pattern always take part in a match
  const run = /** @type {string} */ (match[1]);
  const info = /** @type {string} */ (match[2]);
  const fence = /** @type {'`' | '~'} */ (run.charAt(0));
  // CommonMark: the info string of a backtick fence holds no backtick, so a line such
  // as "```inline``` prose" opens nothing; the info string of a tilde fence may
  if (fence === '`' && info.includes('`')) return;

  const marker = info.trim();
  const words = marker.split(/\s+/).filter(Boolean);
  const marked = state.inScope && words.length === MARKER.length && MARKER.every((word, i) => words[i] === word);

  if (state.inScope && !marked && words.includes('check')) {
    state.problems.push({
      file: state.file,
      line: lineNumber,
      message: `unknown marker \`${marker}\` — only \`ts check\` is checked`,
    });
  }

  state.open = {
    marked,
    indent: column,
    base,
    fence,
    size: run.length,
    line: lineNumber,
    code: [],
    offsets: [],
  };
}
