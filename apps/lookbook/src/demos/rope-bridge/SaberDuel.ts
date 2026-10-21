/**
 * The choreography of the light-saber duel on the bridge: two phantom duelists, one on each half of
 * the deck, whose blades swing in arcs, lock and part again. Pure numbers — where each hilt is held
 * and where each blade points — which `RopeBridge` draws as segments and hilts.
 *
 * An angle is the direction of a blade in degrees, as the duelist sees it: 0 straight ahead (towards
 * the other duelist), 90 straight up. The duelist on the right mirrors it.
 */

// time in seconds, then the angle of the left blade and of the right one
const KEYS: readonly (readonly [number, number, number])[] = [
  [0.0, 55, 55], // en garde
  [0.55, 125, 50], // the left one winds up
  [0.8, 47, 52], // strikes, and the right one blocks: the blades lock near their tips
  [1.35, 50, 56], // they push
  [1.65, 78, 30], // and part
  [2.2, 55, 55],
  [2.75, 50, 125], // the right one winds up
  [3.0, 52, 47], // strikes, blocked
  [3.55, 57, 50],
  [3.85, 28, 80],
  [4.3, 100, 100], // both raise their blades
  [4.6, 40, 40], // and cross them high in the middle
  [5.2, 44, 43],
  [5.6, 70, 70],
  [6.2, 55, 55],
];

const PERIOD = KEYS.at(-1)![0];

const smoothstep = (t: number) => t * t * (3 - 2 * t);

/** The two blade angles at time `t`, in degrees, eased from key to key. */
export function duelAngles(t: number, target: [number, number]): [number, number] {
  const time = ((t % PERIOD) + PERIOD) % PERIOD;
  let k = 0;
  while (k < KEYS.length - 2 && KEYS[k + 1]![0] <= time) k++;
  const [t0, l0, r0] = KEYS[k]!;
  const [t1, l1, r1] = KEYS[k + 1]!;
  const f = smoothstep(Math.min(1, (time - t0) / (t1 - t0)));
  // a duelist never stands quite still
  const breath = Math.sin(t * 5.3) * 2.5;
  target[0] = l0 + (l1 - l0) * f + breath;
  target[1] = r0 + (r1 - r0) * f - breath;
  return target;
}

/**
 * Where the blades `(ax, ay) → (bx, by)` and `(cx, cy) → (dx, dy)` cross, written to `target`; answers
 * `false` when they do not.
 */
export function crossing(
  ax: number,
  ay: number,
  bx: number,
  by: number,
  cx: number,
  cy: number,
  dx: number,
  dy: number,
  target: {x: number; y: number},
): boolean {
  const rx = bx - ax;
  const ry = by - ay;
  const sx = dx - cx;
  const sy = dy - cy;
  const denominator = rx * sy - ry * sx;
  if (Math.abs(denominator) < 1e-9) return false;
  const t = ((cx - ax) * sy - (cy - ay) * sx) / denominator;
  const u = ((cx - ax) * ry - (cy - ay) * rx) / denominator;
  if (t < 0 || t > 1 || u < 0 || u > 1) return false;
  target.x = ax + rx * t;
  target.y = ay + ry * t;
  return true;
}
