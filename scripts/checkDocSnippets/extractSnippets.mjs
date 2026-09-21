// Finds the code blocks of a Markdown document that are marked `ts check`.
//
// A pure function over text: no file system, no TypeScript. `checkDocSnippets.mjs` reads the
// files and hands them in, `compileSnippets.mjs` type-checks what comes out.
//
// Every fence is tracked, marked or not, because a `ts check` line inside another code block
// (a four-backtick block that shows Markdown, say) is an example of the marker, not the marker.
// A marker that is nearly right (`js check`, `ts check strict`) is reported instead of ignored:
// a typo must not drop a block out of the check without a word.

const OPENING_FENCE = /^(\s*)(`{3,})(.*)$/;
const CLOSING_FENCE = /^\s*(`{3,})\s*$/;

const MARKER = ['ts', 'check'];

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

  let open = null;

  lines.forEach((text, index) => {
    const lineNumber = index + 1;

    if (open == null) {
      const match = OPENING_FENCE.exec(text);
      // CommonMark: the info string of a backtick fence holds no backtick, so a line such as
      // "```inline``` prose" opens nothing
      if (match == null || match[3].includes('`')) return;

      const info = match[3].trim();
      const words = info.split(/\s+/).filter(Boolean);
      const marked = words.length === MARKER.length && MARKER.every((word, i) => words[i] === word);

      if (!marked && words.includes('check')) {
        problems.push({file, line: lineNumber, message: `unknown marker \`${info}\` — only \`ts check\` is checked`});
      }

      open = {marked, indent: match[1].length, ticks: match[2].length, line: lineNumber, code: []};
      return;
    }

    const closing = CLOSING_FENCE.exec(text);
    if (closing != null && closing[1].length >= open.ticks) {
      if (open.marked) {
        snippets.push({file, line: open.line + 1, indent: open.indent, code: open.code.join('\n')});
      }
      open = null;
      return;
    }

    if (open.marked) {
      // a fence inside a list item is indented; CommonMark takes that much off every code line
      open.code.push(text.replace(new RegExp(`^ {0,${open.indent}}`), ''));
    }
  });

  if (open?.marked) {
    problems.push({file, line: open.line, message: 'code block marked `ts check` is never closed'});
  }

  return {snippets, problems};
}
