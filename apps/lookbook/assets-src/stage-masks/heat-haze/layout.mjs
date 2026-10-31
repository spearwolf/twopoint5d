// stage-masks/heat-haze: the frame of "Crematorium Window" that the generators and the demo share.
// Units of the stage: origin in the middle, y up, 2 texels per unit.

/** the glass of the tall window: half width, the sill, where the sides turn into the pointed arch, the apex */
export const GLASS = {hw: 200, sill: -165, spring: 20, apex: 250};
/** the splayed stone reveal around the glass at its outer edge, on the face of the wall */
export const REVEAL = {hw: 258, sill: -207, spring: 20, apex: 318};
/** the two lancets the mullion parts the glass into: the middle x of each, half width, sill, springline, apex */
export const LANCET = {cx: 101, hw: 91, sill: -165, spring: 20, apex: 160};
/** the roundel above the lancets */
export const ROUNDEL = {x: 0, y: 200, r: 30};
/** the cast-iron vent under the sill, where the heat of the furnace comes out */
export const VENT = {x: 0, y: -246, hw: 110, hh: 15};
/** the outside: the picture behind the glass covers this much of the world, a margin for the haze */
export const OUTSIDE = {left: -280, right: 280, bottom: -230, top: 300};
/** the whole world the interior covers */
export const WORLD = {left: -600, right: 600, bottom: -320, top: 320};
/** the sodium lamp in the cemetery: where its lantern hangs */
export const LAMP = {x: 104, y: 6};

/**
 * Whether (x, y) is inside a pointed arch window of half width `hw`, sill, springline and apex.
 * @param {number} x @param {number} y @param {{hw: number, sill: number, spring: number, apex: number}} w
 * @param {number} [cx]
 */
export function insideArch(x, y, w, cx = 0) {
  const dx = Math.abs(x - cx);
  if (y < w.sill || dx > w.hw) return false;
  if (y <= w.spring) return true;
  const h = w.apex - w.spring;
  const r = (h * h + w.hw * w.hw) / (2 * w.hw);
  // the arc of the far side: its centre lies r − hw beyond the middle
  const ox = dx + (r - w.hw);
  return ox * ox + (y - w.spring) ** 2 <= r * r;
}

/**
 * The SVG path of a pointed arch window, in units with y up.
 * @param {{hw: number, sill: number, spring: number, apex: number}} w @param {number} [cx]
 */
export function archPath(w, cx = 0) {
  const h = w.apex - w.spring;
  const r = (h * h + w.hw * w.hw) / (2 * w.hw);
  const f = (/** @type {number} */ v) => (Math.round(v * 100) / 100).toString();
  // y is flipped by the document transform, so the arcs sweep the other way round
  return `M${f(cx - w.hw)} ${f(w.sill)}L${f(cx - w.hw)} ${f(w.spring)}A${f(r)} ${f(r)} 0 0 0 ${f(cx)} ${f(w.apex)}A${f(r)} ${f(r)} 0 0 0 ${f(cx + w.hw)} ${f(w.spring)}L${f(cx + w.hw)} ${f(w.sill)}Z`;
}
