import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import vm from "node:vm"
import { createHash } from "node:crypto"
import { loadCore } from "../tools/load-core.js"
import { canvas, themeOf } from "../tools/render.js"

const S = loadCore("Sim.js"), D = loadCore("Draw.js"), P = loadCore("Palette.js")
const theme = themeOf("tokyo-night").theme

function sfxHarness() {
  let tones = 0, noises = 0
  const node = () => ({ connect() {}, start() {}, stop() {}, frequency: { setValueAtTime() {}, exponentialRampToValueAtTime() {} }, gain: { setValueAtTime() {}, exponentialRampToValueAtTime() {}, linearRampToValueAtTime() {}, cancelScheduledValues() {}, value: 0 }, Q: { value: 1 }, type: "" })
  const ctx = { currentTime: 0, state: "running", sampleRate: 8000, destination: {}, createGain: node, createOscillator: () => { tones++; return node() }, createBiquadFilter: node, createBuffer: () => ({ getChannelData: () => new Float32Array(4000) }), createBufferSource: () => { noises++; return node() }, resume() {} }
  const sandbox = { window: { AudioContext: function () { return ctx } }, performance: { now: () => now } }
  let now = 1000
  vm.runInNewContext(fs.readFileSync(new URL("../public/agents/sfx.js", import.meta.url), "utf8"), sandbox)
  const api = sandbox.window.AgentSfx
  api.setOn(true)
  return { api, stepNow: ms => { now += ms }, counts: () => ({ tones, noises }) }
}

test("applause bursts over active walkers, respects cooldown, and never touches gameplay", () => {
  const w = S.generate(5, 0, 3)
  for (let i = 0; i < 200; i++) S.step(w)
  assert.equal(S.applaudColony(w), true)
  assert.equal(w.applauseCount, 1)
  assert.equal(S.applaudColony(w), false, "cooldown blocks rapid repeats")
  w.ticks += S.APPLAUSE_COOL
  assert.equal(S.applaudColony(w), true)
  assert.equal(w.applauseCount, 2)
  w.done = true
  w.ticks += S.APPLAUSE_COOL
  assert.equal(S.applaudColony(w), false, "refused after level ends")

  const fresh = S.generate(5, 0, 3)
  assert.equal(S.applaudColony(fresh), true, "falls back cleanly when no walkers are out")
  for (const res of [1, 2]) {
    fresh.res = res
    const render = ticks => {
      fresh.ticks = ticks
      const img = canvas(400 * res, 248 * res)
      img.ctx.setTransform(res, 0, 0, res, 0, 0)
      D.drawApplause(img.ctx, fresh)
      assert.ok(img.buf.some(Boolean))
      return createHash("sha256").update(img.buf).digest("hex")
    }
    fresh.reducedMotion = false
    assert.notEqual(render(fresh.applause.at + 4), render(fresh.applause.at + 18))
    fresh.reducedMotion = true
    const a = render(fresh.applause.at + 4), b = render(fresh.applause.at + 20)
    assert.equal(a, b, "reduced motion holds applause flecks still")
  }
})

test("pep-talk heart rises beside a cheered agent and holds still under reduced motion", () => {
  const w = S.generate(1, 0, 3)
  const ag = Object.assign(S.spawn(w), { x: 40.5, y: w.corridors[0].floorY - 1, dir: 1, state: "walk" })
  w.agents = [ag]; w.ticks = 300
  assert.equal(S.pepTalk(w, ag), true)
  for (const res of [1, 2]) {
    w.res = res
    const render = ticks => {
      w.ticks = ticks
      const img = canvas(400 * res, 248 * res)
      img.ctx.setTransform(res, 0, 0, res, 0, 0)
      D.drawPepHeart(img.ctx, w, ag, 100, 100)
      assert.ok(img.buf.some(Boolean))
      return createHash("sha256").update(img.buf).digest("hex")
    }
    w.reducedMotion = false
    assert.notEqual(render(302), render(312))
    w.reducedMotion = true
    assert.equal(render(302), render(312))
  }
})

test("sweepstake winner burst animates at the exit door only when the pick arrives first", () => {
  const w = S.generate(3, 0, 5)
  const ag = Object.assign(S.spawn(w), { id: 7, state: "saved", fade: 3 })
  w.agents = [ag]; w.bet = 7; w.homeOrder = [7, 2]
  for (const res of [1, 2]) {
    w.res = res
    const render = fade => {
      ag.fade = fade
      const img = canvas(400 * res, 248 * res)
      img.ctx.setTransform(res, 0, 0, res, 0, 0)
      D.drawBetWinBurst(img.ctx, w)
      assert.ok(img.buf.some(Boolean))
      return createHash("sha256").update(img.buf).digest("hex")
    }
    w.reducedMotion = false
    assert.notEqual(render(2), render(9))
    w.reducedMotion = true
    assert.equal(render(2), render(5))
  }
  w.homeOrder = [2, 7]
  const blank = createHash("sha256").update(canvas(400, 248).buf).digest("hex")
  const img = canvas(400, 248)
  D.drawBetWinBurst(img.ctx, w)
  assert.equal(createHash("sha256").update(img.buf).digest("hex"), blank, "second place gets no winner burst")
})

test("clean-sweep report cards earn twinkling gold corner stars strictly inside plate bounds", () => {
  const w = S.generate(8, 0, 3), pal = P.build(theme, 8)
  Object.assign(w, { res: 2, done: true, doneHold: 210, doneTicks: 16, saved: 14, toRelease: 14, lost: 0 })
  const l = D.pageReportLayout(w, pal)
  const blank = createHash("sha256").update(canvas(800, 496).buf).digest("hex")
  const paint = doneTicks => {
    w.doneTicks = doneTicks
    const img = canvas(800, 496)
    img.ctx.setTransform(2, 0, 0, 2, 0, 0)
    D.drawCleanSweepStars(img.ctx, w, pal, 200 - l.width / 2, l.y, l.width)
    return img
  }
  const a = paint(16), b = paint(24)
  assert.notEqual(createHash("sha256").update(a.buf).digest("hex"), blank)
  assert.notEqual(createHash("sha256").update(a.buf).digest("hex"), createHash("sha256").update(b.buf).digest("hex"))
  w.reducedMotion = true
  assert.equal(createHash("sha256").update(paint(16).buf).digest("hex"), createHash("sha256").update(paint(24).buf).digest("hex"))
  w.lost = 1
  assert.equal(createHash("sha256").update(paint(16).buf).digest("hex"), blank, "any loss skips clean-sweep stars")
  w.lost = 0; w.doneHold = undefined
  assert.equal(createHash("sha256").update(paint(16).buf).digest("hex"), blank, "hosts without doneHold keep original report pixels")
})

test("sfx plays cues for coffee drops, coffee sips, applause, and sweepstake wins", () => {
  const h = sfxHarness()
  const w = S.generate(1, 0, 3)
  const ag = Object.assign(S.spawn(w), { x: 40.5, y: w.corridors[0].floorY - 1, dir: 1, state: "walk" })
  w.agents = [ag]; w.ticks = 400
  h.api.observe(w)
  let prev = h.counts()

  assert.equal(S.dropCoffee(w), true)
  h.stepNow(500); h.api.observe(w)
  assert.ok(h.counts().tones > prev.tones, "coffee drop cue")
  prev = h.counts()

  ag.x = w.coffee.x + 0.5; w.ticks += S.COFFEE_DROP; S.stepCoffee(w)
  h.stepNow(500); h.api.observe(w)
  assert.ok(h.counts().tones > prev.tones, "coffee sip cue")
  prev = h.counts()

  assert.equal(S.applaudColony(w), true)
  h.stepNow(500); h.api.observe(w)
  assert.ok(h.counts().tones > prev.tones && h.counts().noises > prev.noises, "applause cue")
  prev = h.counts()

  w.bet = ag.id; w.homeOrder = [ag.id]
  h.stepNow(500); h.api.observe(w)
  assert.ok(h.counts().tones > prev.tones, "sweepstake win cue")
})
