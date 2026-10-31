// stage-masks/flashlight: where everything of "The Crawlspace" lies, in units of the level, the
// origin on the projection plane in the middle of the crawlspace, y up. The generators draw from it
// and `layout.json` hands it to the demo, so the picture and the light agree.

/** where the camera of the level stands in front of the projection plane, under either projection */
export const CAMERA_DISTANCE = 500;

/** the dirt the crawlspace stands on, at every depth */
export const FLOOR_Y = -150;

/**
 * The three painted layers, back to front: their depth `z`, the texels per unit `ppu` (the size on
 * the screen under the parallax projection, at 2 pixels per unit of the plane), the frame they
 * cover and how many images the frame is cut into (no image is wider than 2400 pixels). Each frame
 * covers the view at its depth wherever the camera goes (x within ±700, y within ±30). The view is
 * at most 960 × 540 units at any shape of the window: `fit: 'cover'` with both sides shows less
 * along one axis, never more (720 × 540 at 4:3, 960 × 411 at 21:9, 378 × 540 in a portrait of
 * 700 × 1000), so frames sized for 960 × 540 hold at every aspect ratio.
 */
export const LAYERS = {
  back: {z: -400, ppu: 1.5, left: -1600, right: 1600, bottom: -540, top: 540, tiles: 2},
  mid: {z: -180, ppu: 2, left: -1380, right: 1380, bottom: -420, top: 420, tiles: 3},
  play: {z: 0, ppu: 2, left: -1200, right: 1200, bottom: -320, top: 320, tiles: 2},
};

/** where the player may crawl, and where the camera may go, in x */
export const PLAYER_RANGE = 820;
export const CAMERA_RANGE = 700;

/** the vent in the back wall: the opening, and the shaft of moonlight that falls through it */
export const VENT = {x: 560, y: 70, hw: 58, hh: 26};

/** the posts of the play layer */
export const POSTS = [-520, 420];

/** the three drawings, pinned to the first post: the middle of each sheet, its tilt in radians */
export const DRAWINGS = [
  {name: 'drawing-house', x: -520, y: 60, tilt: -0.06},
  {name: 'drawing-family', x: -520, y: -18, tilt: 0.05},
  {name: 'drawing-friend', x: -470, y: 22, tilt: 0.11},
];

/** the drain pipe of the middle layer and the joint that drips */
export const DRAIN = {y: 104, drip: -260};

/** the near things, in front of the plane: frame, x, y of their middle, z */
export const NEAR = [
  {name: 'near-post', x: -880, y: -40, z: 170},
  {name: 'near-cobweb', x: -250, y: 250, z: 150},
  {name: 'near-wires', x: 330, y: 205, z: 170},
  {name: 'near-rubble', x: 760, y: -255, z: 170},
  {name: 'near-post', x: 1180, y: -40, z: 170},
  {name: 'near-tuft', x: -1250, y: 240, z: 150},
];

/**
 * Where the eyes wait in the dark below the level, beside the things that are there when the light
 * comes: x, y, z, the frame of the eyes.
 */
export const EYES = [
  {x: -126, y: -92, z: 0, frame: 'eyes-pale'},
  {x: -850, y: -96, z: -180, frame: 'eyes-ember'},
  {x: 905, y: -88, z: -180, frame: 'eyes-three'},
  {x: 600, y: -40, z: -400, frame: 'eyes-pale'},
  {x: -430, y: 210, z: -180, frame: 'eyes-ember'},
  {x: 790, y: -88, z: 0, frame: 'eyes-three'},
  {x: -1060, y: 140, z: -400, frame: 'eyes-pale'},
  {x: 140, y: 200, z: -180, frame: 'eyes-ember'},
  {x: -592, y: -72, z: 0, frame: 'eyes-ember'},
  {x: 1180, y: 160, z: -400, frame: 'eyes-three'},
];
