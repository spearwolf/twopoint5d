// the inputs a key presses rather than types into
const PRESSED_INPUT_TYPES = new Set(['checkbox', 'radio', 'button', 'submit', 'reset', 'color', 'file', 'image']);

/**
 * Whether a keyboard shortcut of a demo leaves `event` alone. lil-gui builds its number and text
 * fields as `<input type="text">`, its checkboxes as `<input type="checkbox">`, and its functions
 * and folder titles as `<button>`; a shortcut must not take their keys from them.
 *
 * - with Ctrl, Meta or Alt held the key is a shortcut of the browser: ignored
 * - a target that is no element — the window, the document — is the demo's
 * - in an editable element, a `<textarea>` or a `<select>` every key is ignored
 * - on a `<button>`, or an `<input>` that is pressed rather than typed into (a checkbox, a color
 *   …), only Space, Enter and NumpadEnter are ignored, the keys that press it; an arrow on a
 *   focused button still steers the demo
 * - in any other `<input>` — one without a `type` is a text field — every key is ignored
 *
 * `event.repeat` is left to the page: a movement key needs its repeats for the `preventDefault()`
 * of its own. A keyup handler asks nothing — a key let go in a field lets go of the held input
 * all the same.
 */
export function ignoredKey(event: KeyboardEvent): boolean {
  if (event.ctrlKey || event.metaKey || event.altKey) return true;
  const target = event.target;
  if (!(target instanceof HTMLElement)) return false;
  if (target.isContentEditable || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT') return true;
  const pressed =
    target.tagName === 'BUTTON' ||
    (target.tagName === 'INPUT' && PRESSED_INPUT_TYPES.has((target.getAttribute('type') ?? 'text').toLowerCase()));
  if (pressed) return event.code === 'Space' || event.code === 'Enter' || event.code === 'NumpadEnter';
  return target.tagName === 'INPUT';
}
