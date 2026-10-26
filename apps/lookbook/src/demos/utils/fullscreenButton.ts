import type {Display} from '@spearwolf/twopoint5d';

/**
 * Hands the fullscreen of `display` to the fullscreen button of the `DemoNavBar`: the button shows
 * itself where a fullscreen can succeed, toggles it on a click and follows its state, Escape and
 * the back gesture of a phone included; the hint "tap for fullscreen" shows while `onLandscape`
 * waits for a tap. A demo that does not call it shows no button. Lets go once the display is
 * disposed.
 */
export function bindFullscreenButton(display: Display): void {
  const button = document.querySelector<HTMLButtonElement>('button.demo-fullscreen-action');
  const hint = document.querySelector<HTMLElement>('.demo-fullscreen-hint');
  if (button == null) return;

  // held here: display.fullscreen throws once the display is disposed
  const {fullscreen} = display;

  // synchronously in the click handler: the browser grants fullscreen only to a user gesture
  const onClick = () => {
    void fullscreen.toggle();
  };

  button.hidden = !fullscreen.isAvailable;
  button.addEventListener('click', onClick);

  const unsubscribe = display.onFullscreenChange(({isActive, isArmed}) => {
    button.setAttribute('aria-pressed', String(isActive));
    if (hint != null) hint.hidden = !isArmed;
  });

  display.onDispose(() => {
    unsubscribe();
    button.removeEventListener('click', onClick);
    button.hidden = true;
    if (hint != null) hint.hidden = true;
  });
}
