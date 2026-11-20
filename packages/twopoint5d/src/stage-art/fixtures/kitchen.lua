-- Builds kitchen.aseprite, the painted scene of the stage art fixtures (see README.md), through
-- Aseprite's Lua API. export.mjs runs it as
--
--   aseprite -b --script-param out=<path>/kitchen.aseprite --script kitchen.lua
--
-- and exports the file it saves. The pixels are plain filled shapes: what the fixtures test is the
-- json of the export, the boxes, names, user data, tags and slices.

local out = app.params["out"]
if out == nil or out == "" then
  error("kitchen.lua: give the path of the file to write as --script-param out=<path>")
end

local W, H = 320, 180

-- the duration of each of the four frames of the sprite, in seconds
local DURATIONS = { 0.2, 0.1, 0.1, 0.15 }

local WALL = { x = 0, y = 0, w = 320, h = 180 }
local WINDOW = { x = 196, y = 22, w = 84, h = 64 }
local TABLE = { x = 40, y = 118, w = 240, h = 62 }
local CARAFE = { x = 92, y = 70, w = 34, h = 52 }
local LADLE = { x = 150, y = 84, w = 18, h = 40 }
-- the steam grows and sinks back: a cel of its own size at every frame
local STEAM = {
  { x = 100, y = 40, w = 14, h = 26 },
  { x = 98, y = 34, w = 18, h = 32 },
  { x = 96, y = 28, w = 22, h = 38 },
  { x = 97, y = 31, w = 20, h = 35 },
}

local sprite = Sprite(W, H, ColorMode.RGB)
for frame = 2, #DURATIONS do
  sprite:newEmptyFrame(frame)
end
for frame, duration in ipairs(DURATIONS) do
  sprite.frames[frame].duration = duration
end

-- a cel of the box `box` at `frame`, filled with `color`; with `hollow` only its outline, so that
-- the pixels differ and the box stays the same
local function paint(layer, frame, box, color, hollow)
  local image = Image(box.w, box.h, ColorMode.RGB)
  local pixel = app.pixelColor.rgba(color.red, color.green, color.blue, color.alpha)
  for y = 0, box.h - 1 do
    for x = 0, box.w - 1 do
      if not hollow or x == 0 or y == 0 or x == box.w - 1 or y == box.h - 1 then
        image:drawPixel(x, y, pixel)
      end
    end
  end
  sprite:newCel(layer, frame, image, Point(box.x, box.y))
end

-- The layers, bottom first. A new sprite brings one layer, the bottom one: it becomes the wall.
local wall = sprite.layers[1]
wall.name = "wall"

local backdrop = sprite:newGroup()
backdrop.name = "backdrop"
backdrop.data = "depth=600"
backdrop.color = Color { r = 0xd9, g = 0x57, b = 0x63, a = 0xff }
wall.parent = backdrop

local window = sprite:newLayer()
window.name = "window"
window.data = "depth=600"
window.color = Color { r = 0x5f, g = 0xcd, b = 0xe4, a = 0xff }
window.parent = backdrop

local function topLayer(name)
  local layer = sprite:newLayer()
  layer.name = name
  layer.parent = sprite
  layer.stackIndex = #sprite.layers
  return layer
end

local tableLayer = topLayer("table")
local carafe5 = topLayer("carafe5")
local ladle = topLayer("ladle")
local steam = topLayer("steam")

for frame = 1, #DURATIONS do
  paint(wall, frame, WALL, Color { r = 0x5b, g = 0x6e, b = 0xe1, a = 0xff })
  paint(window, frame, WINDOW, Color { r = 0xcb, g = 0xdb, b = 0xfc, a = 0xff })
  paint(tableLayer, frame, TABLE, Color { r = 0x8f, g = 0x56, b = 0x3b, a = 0xff })
  -- full at frames 0 and 1, empty at 2 and 3: other pixels, the same box
  paint(carafe5, frame, CARAFE, Color { r = 0x99, g = 0xe5, b = 0x50, a = 0xff }, frame > 2)
  -- taken off the table at frame 3: no cel there
  if frame < 4 then
    paint(ladle, frame, LADLE, Color { r = 0x84, g = 0x7e, b = 0x87, a = 0xff })
  end
  paint(steam, frame, STEAM[frame], Color { r = 0xff, g = 0xff, b = 0xff, a = 0xc0 })
end

-- frames 1 to 3 of the json: Aseprite counts the frames of its Lua API from 1
local puff = sprite:newTag(2, 4)
puff.name = "puff"
puff.aniDir = AniDir.PING_PONG

-- the pivot marks the pixel (109, 121): the middle of the carafe's foot
local slice = sprite:newSlice(Rectangle(CARAFE.x, CARAFE.y, CARAFE.w, CARAFE.h))
slice.name = "carafe5"
-- the blue Aseprite gives a slice drawn by hand; one made through the Lua API has no color
slice.color = Color { r = 0, g = 0, b = 0xff, a = 0xff }
slice.pivot = Point(17, 51)

sprite:saveAs(out)
