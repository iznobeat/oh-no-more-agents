import test from "node:test"
import assert from "node:assert/strict"
import { execSync } from "node:child_process"
import { serve, browser, settleCommute } from "../tools/phone.js"

// The biome tour: twenty thumbnails, the current one marked, a jump that goes
// forward to that biome and counts as nothing cleared; a row of its own that
// scrolls on a phone without scrolling the page.
let chromium = true
try { execSync("command -v chromium", { stdio: "ignore" }) } catch { chromium = false }
const sleep = ms => new Promise(r => setTimeout(r, ms))

test("the tour jumps forward to the biome, marks it, clears nothing, and scrolls in its own row on a phone", { skip: !chromium && "no chromium", timeout: 60000 }, async () => {
  const server = await serve(), b = await browser()
  const ev = async e => (await b.cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result.value
  try {
    await b.cmd("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 2, mobile: true })
    await b.cmd("Page.navigate", { url: `http://127.0.0.1:${server.address().port}/?level=3&seed=42` })
    for (let i = 0; i < 40 && !(await ev(`document.querySelectorAll("#tour .tour-stop").length`)); i++) await sleep(100)
    assert.equal(await ev(`document.querySelectorAll("#tour .tour-stop").length`), await ev(`BIOMES.length`))
    assert.equal(await ev(`[...document.querySelectorAll("#tour .tour-stop")].findIndex(b => b.getAttribute("aria-current") === "true")`), 2)
    assert.equal(await ev(`AgentTour.level(3, 0)`), 41, "forward to the next Cavern (21 is the North Pole), not back to level 1")
    assert.equal(await ev(`AgentTour.level(20, 19)`), 40)
    await ev(`document.querySelector("#tour .tour-stop[aria-label='Go to The Cloud']").click()`)
    for (let i = 0; i < 20 && (await ev(`AgentWorld().level`)) === 3; i++) await sleep(50)
    assert.equal(await ev(`AgentWorld().biome`), "The Cloud")
    assert.equal(await ev(`AgentWorld().level`), 20)
    assert.equal(await ev(`document.getElementById("lifetime").textContent`), "0 home, 0 levels", "a jump clears nothing")
    assert.equal(await ev(`document.documentElement.scrollWidth <= innerWidth`), true, "no page scroll")
    assert.equal(await ev(`document.getElementById("tour").scrollWidth > document.getElementById("tour").clientWidth`), true, "the row scrolls")
    assert.ok(await ev(`[...document.querySelectorAll("#tour canvas")].every(c => c.getContext("2d").getImageData(23, 0, 1, 1).data[3] > 0)`), "every thumbnail painted")
    await settleCommute(ev)
    await ev(`document.querySelector("#tour .tour-stop[aria-label='Go to Winter Market']").click()`)
    assert.equal(await ev(`AgentWorld().biome`), "Winter Market")
    assert.equal(await ev(`AgentWorld().level`), 601)
    await settleCommute(ev)
    await ev(`document.querySelector("#tour .tour-stop[aria-label='Go to Aurora Ridge']").click()`)
    assert.equal(await ev(`AgentWorld().biome`), "Aurora Ridge")
    assert.equal(await ev(`AgentWorld().level`), 631)
    assert.equal(await ev(`document.getElementById("lifetime").textContent`), "0 home, 0 levels")
    assert.deepEqual(b.errors, [])
  } finally { await b.close(); server.close() }
})

test("the skier replay is reachable by keyboard and touch on a narrow phone", { skip: !chromium && "no chromium", timeout: 60000 }, async () => {
  const server = await serve(), b = await browser()
  const ev = async e => (await b.cmd("Runtime.evaluate", { expression: e, returnByValue: true })).result.value
  const start = `http://127.0.0.1:${server.address().port}/?level=3&seed=42`
  const waitForLevel = async level => {
    for (let i = 0; i < 80 && await ev("window.AgentWorld && AgentWorld()?.level") !== level; i++) await sleep(100)
    assert.equal(await ev("AgentWorld().level"), level)
  }
  let posts = 0
  b.onEvent = e => {
    if (e.method === "Network.requestWillBeSent" && e.params.request.method === "POST"
        && new URL(e.params.request.url).pathname === "/api/saves") posts++
  }
  try {
    await b.cmd("Network.enable")
    await b.cmd("Emulation.setDeviceMetricsOverride", { width: 320, height: 740, deviceScaleFactor: 2, mobile: true })
    await b.cmd("Emulation.setTouchEmulationEnabled", { enabled: true })
    await b.cmd("Page.navigate", { url: start + "&season=none" })
    await waitForLevel(3)
    assert.ok(await ev(`(() => {
      const replay = document.getElementById("skier-replay").getBoundingClientRect()
      return replay.left >= 0 && replay.right <= innerWidth && replay.height >= 44
        && document.documentElement.scrollWidth <= innerWidth
    })()`))
    await ev('document.getElementById("daily").focus()')
    for (const type of ["keyDown", "keyUp"]) await b.cmd("Input.dispatchKeyEvent", { type, key: "Tab", code: "Tab", windowsVirtualKeyCode: 9 })
    assert.equal(await ev("document.activeElement.id"), "skier-replay")
    for (const type of ["keyDown", "keyUp"]) await b.cmd("Input.dispatchKeyEvent", { type, key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 })
    await waitForLevel(1531)
    assert.deepEqual(await ev("[AgentWorld().colonySeed, AgentWorld().mission.id, AgentWorld().mission.targets.length]"), [58581591, "skiers", 2])
    assert.equal(await ev("location.search"), "?season=none")
    assert.equal(await ev('document.querySelectorAll("#tour .tour-stop").length'), await ev("BIOMES.length"))
    await settleCommute(ev)
    await ev(`document.querySelector("#tour .tour-stop[aria-label='Go to Aurora Ridge']").click()`)
    await waitForLevel(1591)
    assert.equal(await ev("location.search"), "?season=none")

    await b.cmd("Page.navigate", { url: start })
    await waitForLevel(3)
    const point = await ev(`(() => {
      const link = document.getElementById("skier-replay")
      link.scrollIntoView({ block: "center" })
      const r = link.getBoundingClientRect()
      return { x: r.left + r.width / 2, y: r.top + r.height / 2 }
    })()`)
    await b.cmd("Input.dispatchTouchEvent", { type: "touchStart", touchPoints: [point] })
    await b.cmd("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] })
    await waitForLevel(1531)
    assert.deepEqual(await ev("[AgentWorld().colonySeed, AgentWorld().mission.id]"), [58581591, "skiers"])
    assert.equal(await ev("location.search"), "")
    assert.equal(await ev('document.getElementById("lifetime").textContent'), "0 home, 0 levels")
    assert.equal(posts, 0)
    assert.deepEqual(b.errors, [])
  } finally { await b.close(); server.close() }
})
