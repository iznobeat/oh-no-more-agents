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
