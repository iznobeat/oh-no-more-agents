import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { loadCore } from "../tools/load-core.js"
import { canvas, themeOf } from "../tools/render.js"

const S = loadCore("Sim.js"), D = loadCore("Draw.js"), P = loadCore("Palette.js")
const theme = themeOf("tokyo-night").theme

function scene() {
  const w = S.generate(1, 0, 3)
  const ag = Object.assign(S.spawn(w), { x: 40.5, y: w.corridors[0].floorY - 1, dir: 1, state: "walk", idle: 0 })
  w.agents = [ag]
  w.ticks = 400
  return { w, ag }
}

test("coffee drops parachute safely ahead of a walker, are sipped, and grant espresso zoomies", () => {
  const { w, ag } = scene(), basePace = S.walkStep(ag, w)
  assert.equal(S.dropCoffee(w), true)
  assert.ok(w.coffee && w.coffee.takenBy === -1)
  assert.equal(w.coffeesDropped, 1)
  assert.equal(S.dropCoffee(w), false, "only one cup on the board at a time")

  // Move walker over the cup while it is still parachuting: no pickup until landing.
  ag.x = w.coffee.x + 0.5
  S.stepCoffee(w)
  assert.equal(w.coffee.takenBy, -1)

  // Land the cup and let the walker pick it up.
  w.ticks += S.COFFEE_DROP
  S.stepCoffee(w)
  assert.equal(w.coffee.takenBy, ag.id)
  assert.equal(w.coffeesDrunk, 1)
  assert.equal(ag.sipFor, S.COFFEE_SIP)
  assert.ok(S.walkStep(ag, w) > basePace)

  // Sipping holds the walker briefly, then clears.
  let held = 0
  while (S.sipping(w, ag)) held++
  assert.equal(held, S.COFFEE_SIP - 1)
  w.ticks += S.COFFEE_SIP + 1
  S.stepCoffee(w)
  assert.equal(w.coffee, null)

  // Zoomies expire cleanly.
  w.ticks = ag.coffeeUntil
  assert.equal(S.walkStep(ag, w), basePace)
})

test("coffee drops are rate-limited, capped per level, and expire if unclaimed or undermined", () => {
  const { w, ag } = scene()
  for (let i = 0; i < S.COFFEE_LIMIT; i++) {
    assert.equal(S.dropCoffee(w), true)
    assert.equal(S.dropCoffee(w), false)
    w.coffee = null
    assert.equal(S.dropCoffee(w), false, "cooldown applies")
    w.ticks += S.COFFEE_COOL
  }
  assert.equal(S.dropCoffee(w), false, "capped at COFFEE_LIMIT per level")

  const second = scene()
  assert.equal(S.dropCoffee(second.w), true)
  second.w.ticks += S.COFFEE_LIFE + 1
  S.stepCoffee(second.w)
  assert.equal(second.w.coffee, null, "unclaimed cup vanishes")

  const third = scene()
  assert.equal(S.dropCoffee(third.w), true)
  const { x, y } = third.w.coffee
  third.w.terrain[(y + 1) * third.w.k.COLS + x] = third.w.k.EMPTY
  S.stepCoffee(third.w)
  assert.equal(third.w.coffee, null, "cup disappears if its floor is dug out")

  // Stuck walker gets unstuck on espresso.
  const stuck = scene()
  stuck.ag.idle = S.PEP_STUCK + 5
  stuck.ag.turns = 3
  assert.equal(S.dropCoffee(stuck.w), true)
  stuck.ag.x = stuck.w.coffee.x + 0.5
  stuck.w.ticks += S.COFFEE_DROP
  S.stepCoffee(stuck.w)
  assert.equal(stuck.ag.dir, -1)
  assert.equal(stuck.ag.turns, 0)

  // Spot picker skips gone/busy/blocked agents, falls back to already-caffeinated
  // walkers, and refuses when no walker has safe ground.
  const pick = scene()
  const gone = Object.assign(S.spawn(pick.w), { gone: true, state: "walk", x: 40, y: pick.ag.y })
  const trapped = Object.assign(S.spawn(pick.w), { state: "walk", x: 1, y: 1, dir: 1 })
  pick.ag.coffeeUntil = pick.w.ticks + 100
  pick.w.agents = [gone, trapped, pick.ag]
  assert.equal(S.dropCoffee(pick.w), true, "falls back to caffeinated walker when needed")
  pick.w.coffee = null; pick.w.ticks += S.COFFEE_COOL
  pick.w.agents = [gone, trapped]
  assert.equal(S.dropCoffee(pick.w), false, "refuses when no walker has a safe spot")
})

test("coffee quips fit the pixel font and animations render cleanly at both resolutions and reduced motion", () => {
  const { w, ag } = scene(), pal = P.build(theme, w.level)
  const seen = new Set()
  for (let i = 0; i < S.COFFEE_LINES; i++) {
    ag.coffeeAt = w.ticks
    ag.coffeeLine = i
    const q = D.quipFor(w, ag)
    seen.add(q.text)
    for (const ch of q.text) assert.ok(D.TRANSITION_GLYPHS[ch], `missing glyph ${ch}`)
  }
  assert.equal(seen.size, S.COFFEE_LINES)
  assert.equal(D.COFFEE_TEXT.length, S.COFFEE_LINES)

  assert.equal(S.dropCoffee(w), true)
  for (const res of [1, 2]) {
    w.res = res
    const render = fn => {
      const img = canvas(400 * res, 248 * res)
      img.ctx.setTransform(res, 0, 0, res, 0, 0)
      fn(img.ctx)
      assert.ok(img.buf.some(Boolean))
      return createHash("sha256").update(img.buf).digest("hex")
    }
    w.reducedMotion = false
    const chuteA = render(ctx => D.drawFloorCoffee(ctx, w, w.coffee))
    w.ticks += 6
    const chuteB = render(ctx => D.drawFloorCoffee(ctx, w, w.coffee))
    assert.notEqual(chuteA, chuteB, "parachuting cup descends")

    w.ticks = w.coffee.at + S.COFFEE_DROP + 5
    const steamA = render(ctx => D.drawFloorCoffee(ctx, w, w.coffee))
    w.ticks += 9
    const steamB = render(ctx => D.drawFloorCoffee(ctx, w, w.coffee))
    assert.notEqual(steamA, steamB, "waiting cup steams")

    w.reducedMotion = true
    const stillA = render(ctx => D.drawFloorCoffee(ctx, w, w.coffee))
    w.ticks += 30
    const stillB = render(ctx => D.drawFloorCoffee(ctx, w, w.coffee))
    assert.equal(stillA, stillB, "reduced motion holds waiting cup still")

    w.reducedMotion = false
    ag.sipFor = 5
    render(ctx => D.drawAgentCoffee(ctx, w, ag, 100, 100))
    ag.sipFor = 0
    ag.coffeeUntil = w.ticks + 100
    const zoomA = render(ctx => D.drawAgentCoffee(ctx, w, ag, 100, 100))
    w.ticks += 2
    const zoomB = render(ctx => D.drawAgentCoffee(ctx, w, ag, 100, 100))
    assert.notEqual(zoomA, zoomB, "caffeinated speed sparks animate")
    w.reducedMotion = true
    render(ctx => D.drawAgentCoffee(ctx, w, ag, 100, 100))
  }
})

test("when nobody drops coffee, a played level is byte-for-byte identical", () => {
  const a = S.generate(7, 0, 77), b = S.generate(7, 0, 77)
  while (!a.done) S.step(a)
  while (!b.done) S.step(b)
  assert.equal(a.saved, b.saved)
  assert.equal(a.ticks, b.ticks)
  assert.equal(a.coffeesDropped, undefined)
})
