// stage-masks/resolution: where everything of "Séance Photographs" lies, in units of the stage —
// origin in the middle, y up, 2 texels per unit. Shared by the generators and written into
// `layout.json` for the demo.

/** 2 texels per unit: the wall and the photographs are crisp where the view has 1.6–2 px per unit */
export const PX = 2;

/** the wall the three frames hang on: the whole view of the demo, 1200 × 640 units */
export const WALL = {left: -600, right: 600, bottom: -320, top: 320};

/**
 * One photograph (cabinet card) in units: `w` × `h`, its top a shallow segmental arch that rises
 * `arch` units over the corners. The demo draws each photograph with its middle at a panel.
 */
export const PHOTO = {w: 280, h: 380, arch: 46};

/** the middles of the three photographs, left to right */
export const PANELS = [
  {x: -385, y: 34},
  {x: 0, y: 34},
  {x: 385, y: 34},
];

/** the cream mat around a photograph and the ebonised frame around the mat, in units */
export const MAT = 18;
export const FRAME = 22;

/** the brass plaque under each frame, relative to the middle of its photograph */
export const PLAQUE = {dy: -262, w: 236, h: 34};

/**
 * The height of the arched top of the window at `x` (relative to the middle of a photograph).
 * @param {number} x @param {number} [grow] grows the window by this many units
 */
export function archTop(x, grow = 0) {
  const hw = PHOTO.w / 2 + grow;
  const t = Math.min(1, Math.abs(x) / hw);
  return PHOTO.h / 2 - PHOTO.arch + grow + PHOTO.arch * Math.sqrt(1 - t * t);
}

/**
 * The signed distance-like value of the arched window at a point, in units: positive inside.
 * Exact on the sides and the bottom, close enough on the arch for an anti-aliased rim.
 * @param {number} x @param {number} y @param {number} [grow]
 */
export function insideWindow(x, y, grow = 0) {
  const hw = PHOTO.w / 2 + grow;
  return Math.min(hw - Math.abs(x), y + PHOTO.h / 2 + grow, archTop(x, grow) - y);
}

/** The outline of the arched window as SVG path data, relative to its middle. @param {number} [grow] */
export function windowPath(grow = 0) {
  const hw = PHOTO.w / 2 + grow;
  const pts = [];
  for (let i = 0; i <= 48; i++) {
    const x = -hw + (2 * hw * i) / 48;
    pts.push(`${x.toFixed(2)} ${archTop(x, grow).toFixed(2)}`);
  }
  const bottom = -PHOTO.h / 2 - grow;
  return `M${-hw} ${bottom}L${pts.join('L')}L${hw} ${bottom}Z`;
}
