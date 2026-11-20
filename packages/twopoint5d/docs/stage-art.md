# Art layers on a stage

Painted scenes, a kitchen out of an Aseprite file, a title screen out of the layers of a paint
tool: each layer of the artwork becomes a quad in the plane of a stage, at the pixel position it
was painted at, and moves, turns, fades and changes its frame by a pose. This guide starts with
what you want to do, goes on to a cheat sheet of the fields and options, and ends with the
reference.

Contents:

- [Scenarios](#scenarios)
- [Cheat sheet](#cheat-sheet)
- [Reference](#reference)

## Scenarios

### A scene out of an Aseprite file

### A scene out of layer PNGs

### A scene out of a packed atlas

### Loose props

### Moving a layer

### A timeline with a scrubber

A track is a timeline of poses: `artTrack(keys, options?)` takes keys with an `at` in seconds and
any fields of a pose, and `sample(seconds, pose)` writes the pose the track shows at that time.
It depends on the time alone, so a slider, a replay and a test show the same picture for the same
time.

```ts check
import {type ArtPose, artTrack} from '@spearwolf/twopoint5d';

const tilt = artTrack(
  [
    {at: 0, x: 412, y: 380, deg: 0},
    {at: 0.6, deg: 35, ease: 'ease-out'}, // x and y hold
    {at: 1.4, deg: 95, frame: 1}, // the carafe empties as it pours
    {at: 2.2, deg: 0, frame: 1},
  ],
  {ease: 'ease-in-out'}, // the ease of every key without one of its own
);

// a scrubber from 0 to 1 drives the time; the pose is one object, written again on every move
const pose: ArtPose = {};

function onScrub(value: number): ArtPose {
  return tilt.sample(value * tilt.duration, pose);
}

onScrub(0); // {x: 412, y: 380, deg: 0, frame: 0 ...}: the first key, as before it
onScrub(0.5); // between the second and the third key
onScrub(1); // the last key, and so for any time after it

export {onScrub};
```

What a track does with its keys:

- A key holds what it leaves out. `{at: 0.6, deg: 35}` turns the carafe and keeps it where it
  stands. A field the first key leaves out is not part of the track, and `sample()` leaves it
  alone on the pose, so two tracks that write different fields — one moves, one fades — run on one
  pose.
- `x`, `y`, `depth`, `deg`, `scaleX`, `scaleY` and `opacity` blend between two keys at the eased
  share of the stretch that arrives at the key; `ease` of a key beats the `ease` of the track
  (`'linear'` by default). `deg` blends as written: 0 to 350 turns 350 degrees, and −10 is the
  short way.
- `frame`, `visible` and `order` change at the key that sets them.
- Two keys at the same `at` make a cut: from that time on the later key shows.
- Before the first key the track shows the first, after the last the last. `playback: 'loop'` and
  `'pingpong'` run on over the duration, the playbacks of the atlas animations.
- `isMoving(seconds)` tells whether the pose is still on its way: within the keys, and always for
  a loop and a pingpong.

For a value that eases once and needs no track, `rampAt(seconds, start, duration, ease?)` answers
the share of a ramp, from 0 to 1:

```ts check
import {rampAt} from '@spearwolf/twopoint5d';

// a panel fades in over 0.4 seconds after the click at `clickedAt`
function opacityAt(now: number, clickedAt: number): number {
  return rampAt(now, clickedAt, 0.4, 'ease-out');
}

opacityAt(10, 10); // 0
opacityAt(10.2, 10); // between 0 and 1
opacityAt(11, 10); // 1

export {opacityAt};
```

`artTrack()` and `rampAt()` refuse what cannot be used and name the field: keys that are no list
or empty, an `at` that is not a finite number of 0 or more or is smaller than the one before, a
field outside what a pose takes (an `opacity` of 1.5, a `frame` of 0.5, an `order` of 1024), a key
that is no field of a pose (`rotation` for `deg`), an `ease` that is none, a `playback` other than
`'once'`, `'loop'` and `'pingpong'`, and a `duration` of 0 for `rampAt()`.

### A strip of steam

### A painted scene made deep

### Art on a `top-left` stage

### Drawing on demand

### A click on a layer

## Cheat sheet

### The fields of a pose

### The options

## Reference

### `StageArt`

### Sources

### Setting a pose

### Tracks

### Frames at a time

### Drawing on demand: `takeChanged()`

### Picking and more features

### `loaded` and `problems`
