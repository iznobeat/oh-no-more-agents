import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { loadCore } from "../tools/load-core.js"
import { canvas, frame, themeOf } from "../tools/render.js"

// The North Pole: every twenty-first level, outside the cycle of twenty.
// Snow, a workshop door, reindeer to round up, a gift press and a nutcracker,
// and Secret Santa: presents on the floors and down the chimneys.
const S = loadCore("Sim.js"), D = loadCore("Draw.js"), P = loadCore("Palette.js")
const digest = buf => createHash("sha256").update(buf).digest("hex")
const theme = themeOf("tokyo-night").theme

test("every twenty-first level is the North Pole, and every other level keeps its biome", () => {
  assert.equal(S.BIOMES[20], "North Pole")
  for (const level of [21, 42, 63, 210]) assert.equal(S.generate(level, 0, 1).biome, "North Pole")
  // The twenty go round exactly as before on every other level.
  for (let level = 1; level <= 300; level++) {
    if (level % 21 === 0) continue
    assert.equal(S.BIOMES[S.biomeIndex(level)], S.BIOMES[(level - 1) % 20], "level " + level)
  }
  assert.equal(S.generate(41, 0, 1).biome, "Cavern")
  assert.equal(P.build(theme, 41).dirt, P.build(theme, 1).dirt, "Palette agrees: 41 is a Cavern")
  assert.notEqual(P.build(theme, 21).dirt, P.build(theme, 1).dirt, "and 21 has a tint of its own")
  assert.equal(P.build(theme, 42).dirt, P.build(theme, 21).dirt)
})

test("a fresh fall of snow on every top, and no boss holds the workshop", () => {
  for (const level of [21, 42, 63]) {
    const w = S.generate(level, 0, 3), k = w.k
    for (let y = k.SKY; y < k.ROWS - 2; y++) for (let x = 3; x < k.COLS - 3; x++) {
      const c = w.terrain[y * k.COLS + x]
      if (c === k.EMPTY || c === k.STEEL || c === k.BRICK) continue
      const top = w.terrain[(y - 1) * k.COLS + x] === k.EMPTY
      if (top) assert.equal(c, k.ORE, `cell ${x},${y}`)
    }
    assert.equal(S.bossLevel(w, level), false)
    if (w.mission) assert.equal(w.mission.kind, "reindeer")
  }
  let hazards = 0, reindeer = 0
  for (let k = 1; k <= 30; k++) {
    const w = S.generate(k * 21, 0, 3)
    hazards += w.hazards.length
    if (w.mission) reindeer++
  }
  assert.ok(hazards > 5, "the workshop's own hazards get a look in: " + hazards)
  assert.ok(reindeer > 3, "and the reindeer get out now and then: " + reindeer)
})

test("presents sit clear of the hatch, the door, the mission and every hazard", () => {
  for (let k = 1; k <= 12; k++) {
    const w = S.generate(k * 21, 0, k)
    assert.ok(Array.isArray(w.gifts) && w.sleighRuns.length > 0)
    for (const g of w.gifts) {
      assert.ok(g.landed && g.opened === -1)
      const x = Math.floor(g.x)
      assert.ok(w.terrain[(g.y + 1) * w.k.COLS + x] !== w.k.EMPTY, "on the floor")
      for (const h of w.hazards) assert.ok(x < h.zx0 - 3 || x > h.zx1 + 3 || g.y < h.zy0 - 2 || g.y > h.zy1 + 2)
      const e = w.exit
      assert.ok(x <= e.x - 5 || x >= e.x + e.w + 5 || Math.abs(e.y + e.h - 1 - g.y) >= 6)
    }
    for (const r of w.sleighRuns) assert.equal(r.dropped, false)
  }
  // Other biomes have none of it.
  const plain = S.generate(1, 0, 1)
  assert.equal(plain.gifts, null); assert.equal(plain.sleighRuns.length, 0)
})

test("a walker unwraps a present: the scarcest tool gets two more, once", () => {
  const w = S.generate(21, 0, 5)
  const g = w.gifts[0] || (w.gifts.push({ id: 0, x: 30.5, y: 20, landed: true, opened: -1, colour: 0, size: 0 }), w.gifts[0])
  for (const s of Object.keys(w.skills)) w.skills[s] = 5
  w.skills.basher = 1
  const ag = Object.assign(S.spawn(w), { x: g.x, y: g.y, state: "walk", dir: 1 })
  w.agents = [ag]
  // The floor under it must hold for the present to stay put.
  w.terrain[(Math.floor(g.y) + 1) * w.k.COLS + Math.floor(g.x)] = w.k.DIRT
  S.stepGifts(w)
  assert.equal(g.opened, w.ticks); assert.equal(g.skill, "basher"); assert.equal(g.by, ag.id)
  assert.equal(w.skills.basher, 1 + S.GIFT_GIVES); assert.equal(w.giftsOpened, 1)
  S.stepGifts(w)
  assert.equal(w.skills.basher, 1 + S.GIFT_GIVES, "a present only opens once")
  // A falling agent, or a dead one, finds nothing.
  const w2 = S.generate(21, 0, 5), g2 = w2.gifts[0]
  if (g2) {
    w2.agents = [Object.assign(S.spawn(w2), { x: g2.x, y: g2.y, state: "fall" })]
    S.stepGifts(w2)
    assert.equal(g2.opened, -1)
  }
})

test("the sleigh's drop comes down the chimney under an umbrella and lands", () => {
  const w = S.generate(42, 0, 7), run = w.sleighRuns[0], before = w.gifts.length
  w.agents = []
  w.ticks = run.t
  S.stepGifts(w)
  assert.equal(run.dropped, true); assert.equal(w.gifts.length, before + 1)
  const g = w.gifts[w.gifts.length - 1]
  assert.equal(g.landed, false); assert.ok(g.y >= run.y && g.y < run.y + 1, "starts at the ceiling")
  for (let i = 0; i < 200 && !g.landed; i++) S.stepGifts(w)
  assert.equal(g.landed, true)
  assert.ok(w.terrain[(g.y + 1) * w.k.COLS + Math.floor(g.x)] !== w.k.EMPTY)
  S.stepGifts(w)
  assert.equal(w.gifts.length, before + 1, "one drop per run")
})

test("plays to the end, with presents opened along the way", () => {
  let opened = 0, home = 0, out = 0
  for (const level of [21, 63, 105]) for (const seed of [1, 2]) {
    const w = S.generate(level, 0, seed)
    for (let i = 0; i < 20000 && !w.done; i++) S.step(w)
    assert.ok(w.done, "level " + level + " ends")
    opened += w.giftsOpened; home += w.saved; out += w.toRelease
  }
  assert.ok(opened > 0, "somebody finds a present")
  assert.ok(home / out > 0.6, "most of the colony gets home: " + home + "/" + out)
})

test("drawn at both resolutions: snow, door, presents, sleigh, reindeer, hazards", () => {
  for (const res of [1, 2]) {
    const r = frame(S, D, P, { level: 21, seed: 3, ticks: 400, res, theme: "tokyo-night" })
    assert.equal(r.world.biome, "North Pole")
  }
  const w = S.generate(21, 0, 3), pal = P.build(theme, 21)
  const run = w.sleighRuns[0]
  const draw = (res, ticks, fn) => {
    w.res = res; w.ticks = ticks
    const img = canvas(400 * res, 248 * res, "#000000")
    img.ctx.setTransform(res, 0, 0, res, 0, 0)
    fn(img.ctx)
    return digest(img.buf)
  }
  for (const res of [1, 2]) {
    const empty = draw(res, run.t - 400, () => {})
    assert.notEqual(draw(res, run.t - 20, ctx => D.drawNorthPoleSleigh(ctx, w, pal)), draw(res, run.t - 400, ctx => D.drawNorthPoleSleigh(ctx, w, pal)), "the sleigh is in the sky before its drop")
    assert.notEqual(draw(res, 10, ctx => D.drawNorthPoleGifts(ctx, w, pal)), empty, "presents on the floor")
    const g = w.gifts[0]
    if (g) {
      const shut = draw(res, 50, ctx => D.drawNorthPoleGifts(ctx, w, pal))
      Object.assign(g, { opened: 40, skill: "builder" })
      assert.notEqual(draw(res, 50, ctx => D.drawNorthPoleGifts(ctx, w, pal)), shut, "an opened present looks opened")
      Object.assign(g, { opened: -1, skill: null })
    }
    for (const variant of [0, 1]) for (const dir of [1, -1])
      assert.notEqual(draw(res, 0, ctx => D.drawReindeer(ctx, { freed: true, anim: 8, variant }, 50, 60, dir, pal)), empty)
    assert.notEqual(draw(res, 0, ctx => D.drawExitNorthPole(ctx, pal, 100, 100, 24, 20)), empty)
  }
  // Reduced motion: the sleigh and chimneys hold still.
  w.reducedMotion = true
  assert.equal(draw(2, run.t - 30, ctx => D.drawNorthChimney(ctx, w, run, -30)), draw(2, run.t - 60, ctx => D.drawNorthChimney(ctx, w, run, -60)))
})

test("drawing the workshop writes nothing to the world", () => {
  const w = S.generate(42, 0, 3), pal = P.build(theme, 42)
  for (let i = 0; i < 500; i++) S.step(w)
  const before = JSON.stringify(w)
  for (const res of [1, 2]) {
    w.res = res
    const img = canvas(400 * res, 248 * res)
    img.ctx.setTransform(res, 0, 0, res, 0, 0)
    D.drawTerrain(img.ctx, w, pal); D.drawActors(img.ctx, w, pal, {})
  }
  delete w.res
  const after = JSON.parse(JSON.stringify(w)); delete after.res
  const was = JSON.parse(before); delete was.res
  assert.deepEqual(Object.keys(after).sort(), Object.keys(was).sort())
})

test("snowball fights: a walker lobs one at the colleague ahead; never under reduced motion or off the snow", () => {
  const w = S.generate(21, 0, 3), pal = P.build(theme, 21)
  const a = Object.assign(S.spawn(w), { id: 1, x: 20.5, y: 16, dir: 1, state: "walk" })
  const b = Object.assign(S.spawn(w), { id: 2, x: 27.5, y: 16, dir: 1, state: "walk" })
  w.agents = [a, b]
  assert.equal(D.snowballTarget(w, a), b); assert.equal(D.snowballTarget(w, b), null)
  const shot = (ticks, edit = () => {}) => {
    w.ticks = ticks; edit()
    const img = canvas(800, 496, "#000000"), before = JSON.stringify(w.agents)
    img.ctx.setTransform(2, 0, 0, 2, 0, 0)
    D.drawSnowballs(img.ctx, w)
    assert.equal(JSON.stringify(w.agents), before)
    return digest(img.buf)
  }
  const blank = digest(canvas(800, 496, "#000000").buf)
  w.res = 2
  const start = 211 - 53    // phase 0 for thrower 1: (ticks + id * 53) % 211
  assert.notEqual(shot(start + 10), blank, "in flight")
  assert.notEqual(shot(start + 24), blank, "bursting")
  assert.equal(shot(start + 60), blank, "between throws")
  assert.equal(shot(start + 10, () => { w.reducedMotion = true }), blank)
  w.reducedMotion = false
  assert.equal(shot(start + 10, () => { w.biome = "Cavern" }), blank)
  w.biome = "North Pole"
  assert.equal(shot(start + 10, () => { w.res = 1 }), blank, "the panel keeps its pixels")
})

test("workshop elves: at benches clear of everything, hammering, waving at passers-by, never written to the world", () => {
  let total = 0
  for (const level of [21, 42, 63, 84, 105]) {
    const w = S.generate(level, 0, 3), spots = D.elfSpots(w)
    assert.ok(spots.length <= 2); total += spots.length
    assert.equal(D.elfSpots(w), spots, "cached")
    for (const s of spots) for (const h of w.hazards) assert.ok(s.x < h.zx0 - 5 || s.x > h.zx1 + 5)
  }
  assert.ok(total >= 6, "most levels have elves: " + total)
  const w = S.generate(21, 0, 3), s = D.elfSpots(w)[0]
  w.agents = []
  const shot = ticks => {
    w.ticks = ticks
    const img = canvas(400, 248, "#000000"), before = JSON.stringify(w)
    D.drawNorthElves(img.ctx, w)
    assert.equal(JSON.stringify(w), before, "drawing wrote to the world")
    return digest(img.buf)
  }
  const frames = new Set([0, 6, 12, 40, 80, 120].map(shot))
  assert.ok(frames.size > 2, "it works at its bench")
  w.agents = [Object.assign(S.spawn(w), { x: s.x + 1, y: s.y, state: "walk", dir: 1 })]
  const waving = shot(7)
  w.agents = []
  assert.notEqual(waving, shot(7), "and looks up to wave")
  w.reducedMotion = true
  assert.equal(shot(10), shot(90), "still under reduced motion")
  w.reducedMotion = false
  w.biome = "Cavern"
  assert.equal(shot(5), digest(canvas(400, 248, "#000000").buf))
})

test("frozen ponds: on open floors clear of everything, never under the door, and walkers skate across at a glide", () => {
  let total = 0
  for (let level = 21; level <= 420; level += 21) {
    const w = S.generate(level, 0, 3)
    assert.ok(w.ponds.length <= 3); total += w.ponds.length
    for (const p of w.ponds) {
      assert.ok(p.y <= w.exit.y + w.exit.h - 1, "not under the door")
      for (let x = p.x0; x < p.x1; x++) {
        assert.equal(w.iceAt[p.y * w.k.COLS + x], 1)
        assert.ok(S.solid(w, x, p.y + 1) && !S.solid(w, x, p.y), "flat, open floor")
      }
      for (let x = p.x0 - 1; x <= p.x1; x++) assert.ok(S.giftClear(w, x, p.y), `${level}: ${x} clear`)
    }
  }
  assert.ok(total >= 15, "most levels have a pond: " + total)
  assert.equal(S.generate(1, 0, 3).iceAt, null, "nowhere else")
  const w = S.generate(42, 0, 3), p = w.ponds[0]
  const ag = Object.assign(S.spawn(w), { x: p.x0 + 2.5, y: p.y, state: "walk", dir: -1 })
  const off = Object.assign({}, ag, { x: p.x0 - 3.5 })
  assert.ok(S.onIce(w, ag) && !S.onIce(w, off))
  assert.equal(+(S.walkStep(ag, w) / S.walkStep(off, w)).toFixed(3), S.ICE_GLIDE, "a glide, whichever way")
  ag.dir = 1
  assert.equal(+(S.walkStep(ag, w) / S.walkStep(off, w)).toFixed(3), S.ICE_GLIDE)
  w.terrain[(p.y + 1) * w.k.COLS + p.x0 + 2] = w.k.EMPTY
  assert.ok(!S.onIce(w, ag), "dug out, it is not ice any more")
})

test("frozen ponds drawn: ice at both resolutions, skaters on blades, a glint that moves, still under reduced motion", () => {
  const w = S.generate(42, 0, 3), p = w.ponds[0], pal = P.build(theme, 42), C = w.k.CELL
  for (const res of [1, 2]) {
    const img = canvas(400 * res, 248 * res, "#000000")
    img.ctx.setTransform(res, 0, 0, res, 0, 0)
    w.res = res
    D.drawNorthPoleSurfaces(img.ctx, w)
    const at = (x, y) => { const i = ((y * res) * img.W + x * res) * 3; return [img.buf[i], img.buf[i + 1], img.buf[i + 2]] }
    assert.deepEqual(at((p.x0 + 3) * C + 2, (p.y + 1) * C + 2), [0x8c, 0xc4, 0xe6], "ice, not snow")
    assert.deepEqual(at((p.x0 + 3) * C + 2, (p.y + 1) * C + 4), [0x4a, 0x7f, 0xae], "deep under the skin")
  }
  w.res = 2
  const shot = (ticks, agents) => {
    w.ticks = ticks; w.agents = agents
    const img = canvas(800, 496, "#000000"), before = JSON.stringify(w)
    img.ctx.setTransform(2, 0, 0, 2, 0, 0)
    D.drawNorthPondLife(img.ctx, w)
    assert.equal(JSON.stringify(w), before, "drawing wrote to the world")
    return digest(img.buf)
  }
  const blank = digest(canvas(800, 496, "#000000").buf)
  const glints = new Set([0, 20, 40, 60].map(t => shot(t, [])))
  assert.ok(glints.size > 2, "the glint slides along")
  const skater = Object.assign(S.spawn(w), { x: p.x0 + 3.5, y: p.y, state: "walk", dir: 1, anim: 4 })
  const walker = Object.assign({}, skater, { x: p.x0 - 4.5 })
  assert.ok(D.skating(w, skater) && !D.skating(w, walker))
  assert.notEqual(shot(500, [skater]), shot(500, []), "blades and spray")
  assert.equal(D.agentDrawMotion(w, skater, "walk", null).drop, 0, "a glide has no bob")
  w.reducedMotion = true
  assert.equal(shot(10, [skater]), shot(70, [Object.assign({}, skater, { anim: 9 })]), "still")
  assert.notEqual(shot(10, [skater]), blank, "the blades stay")
  w.reducedMotion = false
  w.iceAt = null
  assert.equal(shot(10, [skater]), blank, "no ponds, nothing")
})
