// Seasons: cosmetic dressing over the ordinary board, chosen by the viewer's
// own calendar or previewed with ?season=<name> (?season=none forces it off).
// Nothing here touches the simulation. It hangs display fields on the world as
// w.season, which Draw.js reads (a report title, an umbrella pattern, hats, a
// ticker line), tints the palette, and paints its props on the actors canvas
// after drawActors. Web-only, like sfx.js. To add a season, add an entry to
// SEASONS; to retire one, delete it. Every field is optional.
(function () {
  var SEASONS = {
    christmas: {
      from: [12, 1], advent: true, to: [12, 26],              // [month, day], both inclusive
      accent: "#e0314b",
      homePrefix: "HO HO HOME: ", homeSuffix: "",
      candy: "#d42a3c", candyEvery: 3,          // one floater umbrella in three
      hats: "santa",
      snow: 40,
      gift: true,
      homePuns: ["IS HOME FOR THE HOLIDAYS", "MADE THE NICE LIST", "DELIVERED. NO CHIMNEY REQUIRED"],
      deathPuns: ["IS ON THE NAUGHTY LIST", "GOT COAL", "WAS RETURNED, NO RECEIPT"]
    }
  }

  // The season in force: a valid ?season= wins, anything else in it is ignored.
  function pick(search, date) {
    var m = /[?&]season=([^&]*)/.exec(search || "")
    if (m && m[1] === "none") return null
    if (m && Object.prototype.hasOwnProperty.call(SEASONS, m[1])) return m[1]
    var md = (date.getMonth() + 1) * 100 + date.getDate()
    for (var name in SEASONS) {
      var s = SEASONS[name], a = s.advent ? adventStart(date) : s.from[0] * 100 + s.from[1], b = s.to[0] * 100 + s.to[1]
      if (a <= b ? md >= a && md <= b : md >= a || md <= b) return name
    }
    return null
  }

  function adventStart(date) {
    var nov = new Date(date.getTime())
    nov.setFullYear(date.getFullYear(), 10, 27)
    nov.setDate(27 + (7 - nov.getDay()) % 7)
    return (nov.getMonth() + 1) * 100 + nov.getDate()
  }

  var name = null
  try { name = pick(window.location.search, new Date()) } catch (e) { name = null }

  function tint(pal) {
    if (!name || !pal) return pal
    pal.decorLit = SEASONS[name].accent
    return pal
  }

  function dress(w) {
    if (!name || !w || w.season) return
    var s = SEASONS[name]
    w.season = { name: name, homePrefix: s.homePrefix, homeSuffix: s.homeSuffix,
      candy: s.candy, candyEvery: s.candyEvery, hats: w.biome === "North Pole" ? null : s.hats, note: null }
    w.seasonProps = makeProps(w)
    w.seasonSeen = {}
    w.seasonHome = w.saved
  }

  function cell(w, x, y) { return w.terrain[y * w.k.COLS + x] }

  function tagOf(w, ag) { return ag.special && w.specialSpec ? w.specialSpec.name.toUpperCase() : "AGENT " + ("00" + ag.id).slice(-3) }

  // New deaths get a line on the ticker; the first one home, and every fifth
  // after, gets a line too.
  function observe(w) {
    var s = SEASONS[name]
    for (var i = 0; i < w.agents.length; i++) {
      var ag = w.agents[i]
      if (ag.state !== "dead" || w.seasonSeen[ag.id]) continue
      w.seasonSeen[ag.id] = true
      if (s.deathPuns) w.season.note = { t: w.ticks, text: tagOf(w, ag) + " " + s.deathPuns[(w.lost + w.level) % s.deathPuns.length] }
    }
    if (s.homePuns && w.saved > w.seasonHome) {
      for (var n = w.seasonHome + 1; n <= w.saved; n++) {
        if (n !== 1 && n % 5 !== 0) continue
        var who = lastHome(w)
        if (who) w.season.note = { t: w.ticks, text: tagOf(w, who) + " " + s.homePuns[(n + w.level) % s.homePuns.length] }
      }
      w.seasonHome = w.saved
    }
  }

  function lastHome(w) {
    var id = w.homeOrder && w.homeOrder[w.homeOrder.length - 1]
    for (var i = 0; i < w.agents.length; i++) if (w.agents[i].id === id) return w.agents[i]
    return null
  }

  function paint(ctx, w) {
    if (!name || !w || !w.season) return
    observe(w)
    // Weather and wrapping sit out report plates and blackout overlays.
    if (w.done || (w.outage && w.ticks >= w.outage.at && w.ticks < w.outage.at + w.outage.len)) return
    var s = SEASONS[name]
    ctx.save()
    var actors = snowActors(w)
    drawProps(ctx, w, actors)
    if (s.snow) drawSnow(ctx, w, s.snow, actors)
    if (s.gift && w.exit) drawGift(ctx, w, actors)
    ctx.restore()
  }

  // Flakes drifting down through the air, a pure function of the tick: each
  // has its own column, speed and sway, and wraps from the floor to the top.
  // Only drawn over open air, so it reads as weather, not as noise on the rock.
  function snowActors(w) {
    var out = []
    for (var i = 0; i < w.agents.length; i++) {
      var ag = w.agents[i]
      if (!ag.gone && ag.state !== "dead" && ag.state !== "saved") {
        var b = seasonActorBox(w, ag)
        b.x -= 3; b.y -= 8; b.width += 6; b.height += 8
        out.push(b)
      }
    }
    return out
  }
  function snowAir(w, x, y, size, actors) {
    var c = w.k.CELL
    if (y < w.k.SKY * c + 18 || y + size > w.k.ROWS * c - 12) return false
    for (var yy = Math.floor(y / c); yy <= Math.floor((y + size - 0.5) / c); yy++)
      for (var xx = Math.floor(x / c); xx <= Math.floor((x + size - 0.5) / c); xx++)
        if (cell(w, xx, yy) !== w.k.EMPTY) return false
    if (seasonDanger(w, x, y, size, size)) return false
    var e = w.exit
    if (e && overlap(x, y, size, size, { x: e.x * c - 7, y: e.y * c - 7, width: e.w * c + 14, height: e.h * c + 14 })) return false
    for (var i = 0; i < actors.length; i++) if (overlap(x, y, size, size, actors[i])) return false
    return true
  }
  // Forty pure, staggered flakes. Triangle-wave drift needs no per-flake
  // trigonometry; full footprint tests preserve faces, canopies and danger tells.
  function drawSnow(ctx, w, n, actors) {
    var k = w.k, W = k.COLS * k.CELL, H = k.ROWS * k.CELL, t = w.reducedMotion ? 0 : w.ticks
    var unit = (w.res || 1) >= 2 ? 0.5 : 1
    ctx.save(); ctx.fillStyle = "#e4edf9"
    for (var i = 0; i < n; i++) {
      var h = (i * 2654435761) >>> 0, phase = (t + i * 13) % 96
      var sway = (phase < 48 ? phase : 96 - phase) / 24 - 1
      var x = Math.round((((h >>> 4) % W + sway + W) % W) / unit) * unit
      var y = Math.round((((h >>> 12) % H + t * (0.12 + (h & 15) / 80)) % H) / unit) * unit
      var big = i % 9 === 0, size = big ? 3 : 1
      if (!snowAir(w, x, y, size, actors)) continue
      ctx.globalAlpha = 0.3 + (h & 3) * 0.1
      if (big) { ctx.fillRect(x + 1, y, 1, 3); ctx.fillRect(x, y + 1, 3, 1) }
      else ctx.fillRect(x, y, 1, 1)
    }
    ctx.restore()
  }
  // Wrapping lives on the jambs and lintel. The portal, threshold and any
  // arriving face remain visible; a bow and folded ribbon sell the gift.
  function drawGift(ctx, w, actors) {
    var c = w.k.CELL, e = w.exit, x = e.x * c, y = e.y * c, width = e.w * c, height = e.h * c
    var mid = Math.round(x + width / 2)
    var fill = function(colour, xx, yy, wd, ht) {
      for (var i = 0; i < actors.length; i++) if (overlap(xx, yy, wd, ht, actors[i])) return
      ctx.fillStyle = colour; ctx.fillRect(xx, yy, wd, ht)
    }
    ctx.save()
    fill("#1d3e37", x - 2, y - 2, width + 4, 4)
    fill("#2c6252", x - 2, y, 4, height - 2); fill("#2c6252", x + width - 2, y, 4, height - 2)
    for (var row = 2; row < height - 3; row += 4) {
      fill("#d6d7b1", x - 1, y + row, 1, 1); fill("#d6d7b1", x + width, y + row + 1, 1, 1)
    }
    fill("#7c2135", x - 2, y - 1, width + 4, 2)
    fill("#d42a3c", x - 2, y - 1, width + 4, 1)
    fill("#d42a3c", x, y, 1, height - 2); fill("#d42a3c", x + width - 1, y, 1, height - 2)
    fill("#f0767d", x, y + Math.floor(height / 2), 2, 1); fill("#f0767d", x + width - 2, y + Math.floor(height / 2), 2, 1)
    fill("#8c2639", mid - 6, y - 6, 5, 4); fill("#8c2639", mid + 1, y - 6, 5, 4)
    fill("#e84a60", mid - 5, y - 6, 3, 1); fill("#e84a60", mid + 2, y - 6, 3, 1)
    fill("#d42a3c", mid - 3, y - 3, 2, 3); fill("#d42a3c", mid + 1, y - 3, 2, 3)
    fill("#ffe49a", mid - 1, y - 5, 2, 3)
    ctx.restore()
  }

  // Cache only layout choices. Paint checks current support and moving actors.
  // All footprints include their animation, so a glint never escapes safety.
  function propAir(w, p) {
    if (p.kind === "wreath") return true
    var c = w.k.CELL
    for (var y = Math.floor(p.y / c); y <= Math.floor((p.y + p.height - 0.5) / c); y++)
      for (var x = Math.floor(p.x / c); x <= Math.floor((p.x + p.width - 0.5) / c); x++)
        if (cell(w, x, y) !== w.k.EMPTY) return false
    return true
  }
  function propClear(w, p) {
    if (seasonDanger(w, p.x, p.y, p.width, p.height)) return false
    var c = w.k.CELL, e = w.exit
    if (e && overlap(p.x, p.y, p.width, p.height, {x:e.x*c-8,y:e.y*c-8,width:e.w*c+16,height:e.h*c+16})) return false
    return !propScenery(w, p)
  }
  function propScenery(w, p) {
    var c = w.k.CELL, decor = w.decor || []
    for (var i = 0; i < decor.length; i++) {
      var d = decor[i]
      if (overlap(p.x, p.y, p.width, p.height, {x:d.x*c-5,y:d.y*c-16,width:16,height:22})) return true
    }
    return false
  }
  function supported(w, p) {
    var c = w.k.CELL, yy = p.kind === "lights" ? p.y - 1 : p.y + p.height
    if (p.kind === "wreath") return true
    for (var x = p.x; x < p.x + p.width; x += c)
      if (!cell(w, Math.floor(x / c), Math.floor(yy / c))) return false
    return true
  }
  function addProp(w, out, kind, x, y, width, height) {
    var p = {kind:kind,x:x,y:y,width:width,height:height}
    if (x < 0 || x+width > w.k.COLS*w.k.CELL) return false
    if (!propAir(w, p) || !propClear(w, p) || !supported(w, p)) return false
    for (var i = 0; i < out.length; i++) if (overlap(x, y, width, height, out[i])) return false
    out.push(p); return true
  }
  function makeProps(w) {
    var out = [], c = w.k.CELL
    if (w.biome === "North Pole") return out
    placeWreath(w, out)
    for (var y = w.k.SKY + 4; y < w.k.ROWS - 4; y++)
      for (var x = 4; x < w.k.COLS - 11; x += 9)
        if (cell(w, x, y - 1)) addProp(w, out, "lights", x*c, y*c, 28, 6)
    placeSnowman(w, out)
    return out
  }
  function placeWreath(w, out) {
    if (!w.hatch) return
    var c = w.k.CELL, y = Math.max(w.k.SKY*c + 2, w.hatch.y*c + 10)
    for (var offset = 18; offset <= 42; offset += 12)
      for (var side = -1; side <= 1; side += 2)
        if (addProp(w, out, "wreath", w.hatch.x*c + side*offset - 6, y, 12, 13)) return
  }
  function placeSnowman(w, out) {
    var c = w.k.CELL
    for (var y = w.k.SKY + 8; y < w.k.ROWS - 3; y++)
      for (var x = 6; x < w.k.COLS - 8; x += 3)
        if (cell(w, x, y) && addProp(w, out, "snowman", x*c, y*c-20, 12, 20)) return
  }
  function propActors(w, p, actors) {
    for (var i = 0; i < actors.length; i++) if (overlap(p.x, p.y, p.width, p.height, actors[i])) return true
    var enemies = w.enemies || [], c = w.k.CELL
    for (var j = 0; j < enemies.length; j++) {
      var en = enemies[j]
      if (!en.gone && p.x < en.x*c+18 && p.x+p.width > en.x*c-18 && p.y < (en.y+1)*c+4 && p.y+p.height > (en.y+1)*c-32) return true
    }
    return propMission(w, p)
  }
  function propMission(w, p) {
    if (!w.mission) return false
    var targets = w.mission.targets, c = w.k.CELL
    for (var i = 0; i < targets.length; i++) {
      var a = targets[i]
      if (!a.home && p.x < a.x*c+15 && p.x+p.width > a.x*c-15 && p.y < (a.y+1)*c+4 && p.y+p.height > (a.y+1)*c-24) return true
    }
    return false
  }
  function drawProps(ctx, w, actors) {
    var props = w.seasonProps, t = w.reducedMotion ? 0 : w.ticks
    if (!props || w.biome === "North Pole") return
    for (var i = 0; i < props.length; i++) {
      var p = props[i]
      if (!propAir(w, p) || !supported(w, p) || seasonDanger(w, p.x, p.y, p.width, p.height) || propActors(w, p, actors)) continue
      if (p.kind === "lights") fairyLights(ctx, w, p, t)
      else if (p.kind === "wreath") wreath(ctx, w, p, t)
      else snowman(ctx, w, p, t)
    }
  }
  var BULBS = ["#fa5269", "#ffd66c", "#63dfaa", "#70bfff"]
  function fairyLights(ctx, w, p, t) {
    var x = p.x, y = p.y, unit = (w.res || 1) >= 2 ? 0.5 : 1
    ctx.fillStyle = "#32654d"
    ctx.fillRect(x, y, 3, 1); ctx.fillRect(x+3, y+1, 5, 1)
    ctx.fillRect(x+8, y+2, 12, 1); ctx.fillRect(x+20, y+1, 5, 1); ctx.fillRect(x+25, y, 3, 1)
    for (var i = 0; i < 5; i++) {
      var bx = x+1+i*6, by = y+(i===0 || i===4 ? 1 : 3)
      var lit = (Math.floor(t/9)+i+Math.floor(x/4))%5 === 0
      ctx.fillStyle = BULBS[(i+Math.floor(x/4))%4]; ctx.fillRect(bx, by, 2, 2)
      ctx.fillStyle = lit ? "#fff9db" : "#f4d5b0"; ctx.fillRect(bx, by, unit, unit)
      if (lit) {ctx.fillRect(bx-1, by, 1, 1);ctx.fillRect(bx+2, by+1, 1, 1)}
    }
  }
  function wreath(ctx, w, p, t) {
    var x=p.x, y=p.y
    ctx.fillStyle="#193d32";ctx.fillRect(x+2,y,8,2);ctx.fillRect(x,y+2,3,7);ctx.fillRect(x+9,y+2,3,7);ctx.fillRect(x+2,y+9,8,2)
    ctx.fillStyle="#3f9560";ctx.fillRect(x+3,y,5,1);ctx.fillRect(x,y+3,1,4);ctx.fillRect(x+10,y+4,2,4);ctx.fillRect(x+3,y+10,5,1)
    ctx.fillStyle="#ef5264";ctx.fillRect(x+2,y+8,3,3);ctx.fillRect(x+7,y+8,3,3);ctx.fillRect(x+5,y+10,2,3)
    ctx.fillStyle="#ffdd78";ctx.fillRect(x+5,y+8,2,2);ctx.fillRect(x+2,y+2,2,1);ctx.fillRect(x+9,y+5,1,2)
    if (Math.floor(t/12)%8 === 0) {ctx.fillStyle="#fff3cd";ctx.fillRect(x+5,y+1,1,3);ctx.fillRect(x+4,y+2,3,1)}
    if ((w.res || 1)>=2) {ctx.fillStyle="#ffa0a0";ctx.fillRect(x+2.5,y+8,2,0.5)}
  }
  function snowman(ctx, w, p, t) {
    var x=p.x, y=p.y, look=Math.floor(t/42)%6 === 1 ? 1 : 0
    ctx.fillStyle="#9ebbd0";ctx.fillRect(x+1,y+12,10,7);ctx.fillRect(x+3,y+6,6,7)
    ctx.fillStyle="#edf6fa";ctx.fillRect(x+2,y+12,8,7);ctx.fillRect(x+1,y+14,10,3);ctx.fillRect(x+3,y+6,6,5)
    ctx.fillStyle="#24394e";ctx.fillRect(x+2,y+4,9,2);ctx.fillRect(x+4,y,5,4)
    ctx.fillStyle="#e84a60";ctx.fillRect(x+4,y+3,5,1);ctx.fillRect(x+3,y+11,7,2);ctx.fillRect(x+8,y+12,2,4)
    ctx.fillStyle="#24394e";ctx.fillRect(x+4+look,y+7,1,1);ctx.fillRect(x+7+look,y+7,1,1);ctx.fillRect(x+5,y+14,1,1);ctx.fillRect(x+5,y+17,1,1)
    ctx.fillStyle="#f6a84b";ctx.fillRect(x+6+look,y+9,3,1)
    if ((w.res || 1)>=2) {ctx.fillStyle="#ffffff";ctx.fillRect(x+3,y+13,0.5,3)}
  }

  function overlap(x, y, width, height, b) {
    return x < b.x + b.width && x + width > b.x && y < b.y + b.height && y + height > b.y
  }
  function seasonActorBox(w, ag) {
    var c = w.k.CELL, halo = ag.floater ? 10 : 5, high = ag.floater ? 29 : 18
    return { x: ag.x * c - halo, y: (ag.y + 1) * c - high, width: halo * 2, height: high }
  }
  function seasonDanger(w, x, y, width, height) {
    var c = w.k.CELL, hazards = w.hazards || []
    for (var i = 0; i < hazards.length; i++) {
      var h = hazards[i]
      if (!h.wrecked && x < (h.zx1 + 1)*c+3 && x+width > h.zx0*c-3 && y < (h.zy1+1)*c+3 && y+height > h.zy0*c-3) return true
    }
    return false
  }

  window.AgentSeason = { name: name, pick: pick, tint: tint, dress: dress, paint: paint, SEASONS: SEASONS }
})()
