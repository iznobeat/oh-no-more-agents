import test from "node:test"
import assert from "node:assert/strict"
import { createHash } from "node:crypto"
import { loadCore } from "../tools/load-core.js"
import { canvas, themeOf } from "../tools/render.js"
import { colonySeed } from "../tools/simcheck.js"

const S = loadCore("Sim.js"), D = loadCore("Draw.js"), P = loadCore("Palette.js")
const level = S.biomeShowcaseLevel(S.BIOMES.indexOf("Winter Market"))
const theme = themeOf("tokyo-night").theme

test("the market appears after Advent and leaves neighbouring and North Pole levels in rotation", () => {
  assert.equal(level, 601)
  assert.equal(S.generate(level - 1, 0, 3).biome, "The Cloud")
  assert.equal(S.generate(level + 1, 0, 3).biome, "Ruins")
  assert.equal(S.generate(525, 0, 3).biome, "North Pole")
  assert.notEqual(P.build(theme, level).dirt, P.build(theme, 1).dirt)
})

test("market agents complete the lantern mission on seeded standard and wide boards", () => {
  try {
    for (const cols of [100, 164]) {
      S.setBoardCols(cols)
      for (const stage of [601, 661, 721]) for (const seed of [3, 1717, 9901]) {
        const w = S.generate(stage, 0, seed)
        assert.equal(w.mission?.kind, "lantern", `${stage}/${cols} mission site`)
        while (!w.done && w.ticks < 6000) S.step(w)
        assert.ok(w.done)
        assert.ok(w.saved >= w.released / 2, `${stage}/${cols}/${seed} saved ${w.saved}`)
        assert.equal(w.mission.completed, 3)
      }
    }
  } finally {
    S.setBoardCols(100)
  }
})

test("the market exit aisle lets the level 661 crowd move through together", () => {
  const w = S.generate(661, 0, colonySeed(661, 0, 3))
  assert.equal(Boolean(w.corridors[w.exitCorridor].hasStep), false)
  while (!w.done && w.ticks < 6000) S.step(w)
  assert.ok(w.done)
  assert.ok(w.saved >= w.toRelease * 0.9)
})

test("level 9241 fits three working lanterns in a narrow pocket before the exit", () => {
  const w = S.generate(9241, 0, colonySeed(9241, 0, 3))
  assert.equal(w.mission?.kind, "lantern")
  assert.deepEqual(w.mission.targets.map(target => target.x), [44.5, 47.5, 50.5])
  for (const { x, y } of w.mission.targets) {
    const col = Math.floor(x)
    for (let px = col - 1; px <= col + 1; px++) {
      assert.ok(S.solid(w, px, y), "the lantern has a supported floor")
      for (let py = y - 5; py < y; py++)
        assert.ok(!S.solid(w, px, py), "the lantern clears its ceiling")
    }
  }
  while (!w.done && w.ticks < 6000) S.step(w)
  assert.ok(w.done)
  assert.equal(w.mission.completed, 3)
  assert.ok(w.saved > 0)
})

test("lanterns catch in sequence and hold steady with reduced motion", () => {
  const w = S.generate(level, 0, 3), m = w.mission
  m.openedAt = 400
  for (const target of m.targets) target.freed = true
  for (const res of [1, 2]) {
    w.res = res
    const paint = ticks => {
      w.ticks = ticks
      const img = canvas(400 * res, 248 * res)
      img.ctx.setTransform(res, 0, 0, res, 0, 0)
      const before = JSON.stringify(w)
      D.drawMission(img.ctx, w, P.build(theme, level))
      assert.equal(JSON.stringify(w), before)
      return createHash("sha256").update(img.buf).digest("hex")
    }

    w.reducedMotion = false
    const first = paint(400), second = paint(404), third = paint(408)
    assert.equal(new Set([first, second, third]).size, 3)
    assert.notEqual(paint(430), paint(438))
    w.reducedMotion = true
    assert.equal(paint(400), paint(575))
  }
})

test("Market lanterns catch from the first helper's side on real replays", () => {
  const litLanterns = (w, pal) => {
    const { ctx } = canvas(1, 1), lamps = []
    ctx.fillRect = (x, y, width) => {
      if (ctx.fillStyle === "#fff0bd" && width === 2) lamps.push(x + 1)
    }
    D.drawMarketMission(ctx, w, pal)
    return lamps
  }

  for (const [stage, openedAt, fromRight] of [[841, 236, false], [901, 302, true], [9241, 340, true]]) {
    const w = S.generate(stage, 0, colonySeed(stage, 0, 3))
    const m = w.mission, pal = P.build(theme, stage)
    const positions = m.targets.map(t => t.x * w.k.CELL)
    const order = fromRight ? positions.slice().reverse() : positions
    for (const [age, count] of [[-1, 0], [0, 1], [3, 1], [4, 2], [7, 2], [8, 3]]) {
      while (w.ticks < openedAt + age) S.step(w)
      assert.equal(m.done, age >= 0)
      if (age >= 0) assert.equal(m.openedAt, openedAt)
      assert.equal(m.lanternsFromRight, fromRight)
      for (const res of [1, 2]) {
        w.res = res
        w.reducedMotion = false
        assert.deepEqual(litLanterns(w, pal), order.slice(0, count).sort((a, b) => a - b))
        w.reducedMotion = true
        assert.deepEqual(litLanterns(w, pal), age < 0 ? [] : positions)
      }
    }
  }

  const w = S.generate(841, 0, 3), m = w.mission
  w.agents.push({ id: 1, x: m.x, y: m.y, state: "walk" })
  S.stepMission(w)
  w.agents[0].x += 1
  while (!m.done && w.ticks < 4) {
    w.ticks++
    S.stepMission(w)
  }
  assert.equal(m.lanternsFromRight, false, "a centered first helper keeps the default order")
  assert.deepEqual(litLanterns(w, P.build(theme, w.level)), [m.targets[0].x * w.k.CELL])
})

test("ridge agents ride real cables across chasms and complete neighbouring ridge layouts", () => {
  for (const stage of [631, 691, 751]) {
    const w = S.generate(stage, 0, 3)
    assert.equal(w.biome, "Aurora Ridge")
    assert.equal(S.biomeIndex(stage), P.paletteBiome(stage))
    while (!w.done && w.ticks < 6000) S.step(w)
    assert.ok(w.done && w.saved >= w.released / 2)
    if (stage !== 751) assert.ok(w.ziplines.some(z => z.usedAt >= 0), "agents rode the cable")
  }
})

test("Ridge skiers change pose on the escort trail and keep skis clear of terrain", () => {
  const level = 1531, w = S.generate(level, 0, colonySeed(level, 0, 3))
  const pal = P.build(theme, level)
  const frames = new Map()
  while (!w.done && w.ticks < 6000) {
    const t = w.mission.targets[0], pose = D.escortPose(w, t)
    const state = t.home ? "shelter" : !t.freed ? "waiting"
      : pose.air && pose.moving ? "air" : pose.moving ? "walking" : null
    if (state && !frames.has(state)) frames.set(state, JSON.parse(JSON.stringify(w)))
    S.step(w)
  }
  assert.deepEqual([...frames.keys()], ["waiting", "walking", "air", "shelter"])
  assert.equal(w.escortsHome, 2)

  for (const res of [1, 2]) {
    const paint = frame => {
      frame.res = res
      const t = frame.mission.targets[0], { CELL } = frame.k
      const x = Math.round(t.x * CELL), y = Math.round(t.y * CELL)
      const img = canvas(40 * res, 24 * res)
      img.ctx.setTransform(res, 0, 0, res, (20 - x) * res, (18 - y) * res)
      const before = JSON.stringify(frame)
      D.drawRidgeSkier(img.ctx, frame, pal, t, x, y)
      assert.equal(JSON.stringify(frame), before)
      assert.ok(img.buf.some(Boolean))
      return createHash("sha256").update(img.buf).digest("hex")
    }
    assert.equal(new Set([...frames.values()].map(paint)).size, 4)
    const walk = structuredClone(frames.get("walking"))
    const skier = walk.mission.targets[0]
    const stride = paint(walk)
    skier.anim += 6
    assert.notEqual(paint(walk), stride)
    walk.reducedMotion = true
    const still = paint(walk)
    skier.anim += 6
    assert.equal(paint(walk), still)
  }

  const { COLS, CELL, EMPTY, ROCK } = w.k, x = 100, y = 100
  let clear = 0
  const ctx = { fillRect(left, top, width, height) {
    for (let py = top; py < top + height; py++) for (let px = left; px < left + width; px++)
      assert.equal(w.terrain[Math.floor(py / CELL) * COLS + Math.floor(px / CELL)], EMPTY)
    clear++
  } }
  w.terrain.fill(EMPTY)
  D.drawRidgeSkis(ctx, w, x, y, { dir: 1, air: false, phase: 1 })
  assert.ok(clear > 0)
  w.terrain.fill(ROCK)
  const beforeWall = clear
  D.drawRidgeSkis(ctx, w, x, y, { dir: 1, air: false, phase: 1 })
  assert.equal(clear, beforeWall)
})

test("Ridge skiers grip the visible cable only during their delayed rides", () => {
  const replays = [
    { level: 1531, seed: 58581591, frames: [
      [332, [false, false]], [333, [true, false]], [350, [true, true]],
      [365, [false, true]], [379, [false, false]], [504, [false, false]]
    ] },
    { level: 9991, seed: 79118742, frames: [
      [228, [false, false]], [229, [true, false]], [260, [true, true]],
      [290, [false, true]], [304, [false, false]], [414, [false, false]]
    ] },
    { level: 1411, seed: 11173722, frames: [[434, [false, false]], [497, [false, false]]] }
  ]
  const record = draw => {
    const { ctx } = canvas(1, 1), rects = []
    ctx.fillRect = (x, y, width, height) => {
      rects.push({ x, y, width, height, color: ctx.fillStyle, alpha: ctx.globalAlpha })
    }
    draw(ctx)
    return rects
  }
  for (const { level, seed, frames } of replays) {
    const w = S.generate(level, 0, seed), pal = P.build(theme, level)
    for (const [tick, riding] of frames) {
      while (w.ticks < tick) S.step(w)
      const targets = w.mission.targets
      assert.deepEqual(targets.map(t => t.escortZip), riding.map(active => active ? 0 : undefined))
      if (level === 1531 && tick === 332)
        assert.equal(w.agents.find(a => a.id === targets[0].escort).state, "zip")
      if (level === 1531 && tick === 365)
        assert.equal(D.escortPose(w, targets[0]).air, true)
      if (level === 1411 && tick === 434)
        assert.equal(D.escortPose(w, targets[0]).air, true)
      for (const res of [1, 2]) for (const reducedMotion of [false, true]) {
        w.res = res
        w.reducedMotion = reducedMotion
        const cable = record(ctx => D.drawRidgeLife(ctx, w, pal))
          .filter(r => r.color === pal.steelEdge && r.width === 1 / res && r.height === 1 / res)
        if (w.ziplines.length) {
          assert.ok(cable.length > 1)
          assert.ok(cable.every(r => r.alpha === 1), "aurora opacity stays off the cable")
        }
        for (const [i, t] of targets.entries()) {
          const x = Math.round(t.x * w.k.CELL), y = Math.round(t.y * w.k.CELL)
          const grips = record(ctx => D.drawRidgeSkier(ctx, w, pal, t, x, y))
            .filter(r => r.color === pal.umbrellaStem)
          assert.equal(grips.length, riding[i] ? 1 : 0)
          if (riding[i]) {
            const [grip] = grips
            assert.ok(cable.some(r => r.x === grip.x && r.y === grip.y), "the grip meets the painted cable")
            assert.ok(grip.height >= 2 && grip.height <= 8)
          }
        }
      }
    }
    assert.equal(w.escortsHome, 2)
  }
})

test("ridge aurora drifts without crossing terrain and stays still with reduced motion", () => {
  const w = S.generate(631, 0, 3)
  for (const res of [1, 2]) {
    w.res = res
    const paint = ticks => {
      w.ticks = ticks
      const img = canvas(400 * res, 248 * res)
      img.ctx.setTransform(res, 0, 0, res, 0, 0)
      const fill = img.ctx.fillRect.bind(img.ctx)
      img.ctx.fillRect = (x, y, width, height) => {
        assert.ok([x, y, width, height].every(n => Number.isInteger(n * res)))
        for (let row = y; row < y + height; row += 1 / res) {
          for (let col = x; col < x + width; col += 1 / res) {
            const k = w.k
            assert.equal(w.terrain[Math.floor(row / k.CELL) * k.COLS + Math.floor(col / k.CELL)], k.EMPTY)
          }
        }
        fill(x, y, width, height)
      }
      D.drawRidgeAurora(img.ctx, w)
      assert.ok(img.buf.some(Boolean))
      return createHash("sha256").update(img.buf).digest("hex")
    }

    w.reducedMotion = false
    assert.notEqual(paint(400), paint(560))
    w.reducedMotion = true
    assert.equal(paint(400), paint(560))
  }
})
