import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import { load, canvas } from "../tools/render.js"
import { season } from "../tools/gag-art.js"

// season.js: snow settles on the open tops as a level goes on, and the
// colony tramples a path through it that fills back in behind them.
const S = load("Sim.js")
const src = fs.readFileSync(new URL("../public/agents/season.js", import.meta.url), "utf8")

function setup(level = 5) {
  const api = season(src, "?season=christmas"), w = S.generate(level, 0, 3)
  api.dress(w); w.seasonProps = []; w.res = 1
  api.SEASONS.christmas.gift = false
  return { api, w }
}
function paint(api, w, agents = []) {
  w.agents = agents
  const img = canvas(400, 248, "#000000"); api.paint(img.ctx, w); return img
}

test("open tops gather snow over the level, up to three pixels; half-pixel steps at page resolution", () => {
  const { api, w } = setup(), d = api.settled(w), i = d.tops[0]
  assert.ok(d.tops.length > 100)
  for (const i of d.tops) {
    const x = i % w.k.COLS, y = Math.floor(i / w.k.COLS)
    assert.notEqual(w.terrain[i], w.k.EMPTY); assert.equal(w.terrain[i - w.k.COLS], w.k.EMPTY)
    for (const h of w.hazards) assert.ok(x < h.zx0 - 1 || x > h.zx1 + 1 || y < h.zy0 - 1 || y > h.zy1 + 2, "clear of hazards")
  }
  const at = t => { w.ticks = t; return api.settledDepth(w, d, i) }
  assert.deepEqual([0, 360, 720, 1080, 5000].map(at), [0, 1, 2, 3, 3])
  w.res = 2; assert.equal(at(540), 1.5); w.res = 1
  w.reducedMotion = true; assert.equal(at(0), 2, "a still frame has snow"); w.reducedMotion = false
  assert.equal(api.settled(w), d, "cached while the terrain stands")
  w.terrainVersion++; assert.notEqual(api.settled(w), d, "redone when it changes")
})

test("walkers trample a packed path that fills back in; nothing drawn over an agent or at the North Pole", () => {
  const { api, w } = setup(), d = api.settled(w), i = d.tops[Math.floor(d.tops.length / 2)]
  const x = i % w.k.COLS, y = Math.floor(i / w.k.COLS)
  const ag = Object.assign(S.spawn(w), { x: x + 0.5, y: y - 1, state: "walk", dir: 1 })
  w.ticks = 2000; w.done = false
  paint(api, w, [ag])
  assert.equal(d.trod[i], 2000, "trodden underfoot")
  assert.equal(api.settledDepth(w, d, i), 0)
  w.ticks = 2000 + 720; assert.equal(api.settledDepth(w, d, i), 2, "and filling back in")
  const fresh = paint(api, w), withAgent = paint(api, w, [Object.assign({}, ag, { state: "fall" })])
  const px = (y * 4 - 1) * 400 + x * 4 + 1
  assert.notDeepEqual([...fresh.buf.slice(px * 3, px * 3 + 3)], [0, 0, 0], "snow on the top")
  assert.deepEqual([...withAgent.buf.slice(px * 3, px * 3 + 3)], [0, 0, 0], "never over an agent")
  w.biome = "North Pole"; w.seasonDrift = null
  paint(api, w, [ag])
  assert.equal(w.seasonDrift, null, "the Pole keeps its own caps")
})
