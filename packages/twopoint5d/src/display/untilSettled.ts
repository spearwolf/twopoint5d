/**
 * For a frame step that sets a pose from the clock and knows whether its motion still runs: the
 * function handed out answers `true` while `moving` is `true`, and once more in the frame `moving`
 * turns `false` — the frame that wrote the end pose, which a `FramePacer` would otherwise never
 * draw.
 *
 * The function remembers the frame before; every motion gets one of its own.
 */
export function untilSettled(): (moving: boolean) => boolean {
  let wasMoving = false;
  return (moving: boolean): boolean => {
    const answer = moving || wasMoving;
    wasMoving = moving;
    return answer;
  };
}
