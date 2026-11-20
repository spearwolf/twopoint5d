-- Builds vending-machine.aseprite, the art of the lookbook demo stage-art-aseprite, through
-- Aseprite's Lua API. generate.mjs paints the pictures (paint.mjs), writes them with a layout.json
-- into a directory of their own and runs
--
--   aseprite -b --script-param dir=<that directory> --script-param out=<path>.aseprite --script vending-machine.lua
--
-- The script makes the file what the art reads: the frames with their durations, the layers bottom
-- first in their groups, the user data of each (`depth=40`), one cel per picture — cut to its pixels
-- —, a tag per loop and a slice with a pivot per moving part, named like its layer.

local dir = app.params["dir"]
local out = app.params["out"]
if dir == nil or dir == "" or out == nil or out == "" then
  error("vending-machine.lua: give --script-param dir=<pictures> and --script-param out=<path>.aseprite")
end

local file = assert(io.open(dir .. "/layout.json", "r"))
local layout = json.decode(file:read("a"))
file:close()

local int = math.tointeger

local sprite = Sprite(int(layout.width), int(layout.height), ColorMode.RGB)
-- the frames of the sprite and their durations; Aseprite counts frames from 1
for frame = 2, #layout.durations do
  sprite:newEmptyFrame(frame)
end
for frame, ms in ipairs(layout.durations) do
  sprite.frames[frame].duration = ms / 1000
end

-- a new sprite brings one layer; it goes once the layers of the layout stand
local placeholder = sprite.layers[1]

-- a cel per picture, cut to the box of its pixels and placed where they lie on the canvas
local function addCel(layer, cel)
  local image = Image { fromFile = dir .. "/" .. cel.file }
  local box = image:shrinkBounds()
  if box.width == 0 or box.height == 0 then
    error("vending-machine.lua: " .. cel.file .. " holds no pixel")
  end
  sprite:newCel(layer, int(cel.frame) + 1, Image(image, box), Point(box.x, box.y))
end

-- the entries bottom first: each goes on top of the ones before it in its parent
local function add(entries, parent)
  for _, entry in ipairs(entries) do
    local layer
    if entry.group ~= nil then
      layer = sprite:newGroup()
      layer.name = entry.group
    else
      layer = sprite:newLayer()
      layer.name = entry.name
    end
    layer.parent = parent
    layer.stackIndex = #parent.layers
    if entry.data ~= nil then
      layer.data = entry.data
    end
    if entry.group ~= nil then
      add(entry.layers, layer)
    else
      for _, cel in ipairs(entry.cels) do
        addCel(layer, cel)
      end
    end
  end
end
add(layout.layers, sprite)
sprite:deleteLayer(placeholder)

for _, t in ipairs(layout.tags) do
  local tag = sprite:newTag(int(t.from) + 1, int(t.to) + 1)
  tag.name = t.name
  tag.aniDir = t.direction == "pingpong" and AniDir.PING_PONG or AniDir.FORWARD
end

-- the pivot of a slice marks a pixel; the art reads its bottom left corner as the point a layer
-- turns about
for _, s in ipairs(layout.slices) do
  local slice = sprite:newSlice(Rectangle(int(s.x), int(s.y), int(s.w), int(s.h)))
  slice.name = s.name
  -- the blue Aseprite gives a slice drawn by hand; one made through the Lua API has no color
  slice.color = Color { r = 0, g = 0, b = 0xff, a = 0xff }
  slice.pivot = Point(int(s.px), int(s.py))
end

sprite:saveAs(out)
