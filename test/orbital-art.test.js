import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,frame,canvas,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {orbitalSourceBefore,orbitalSheets} from '../tools/orbital-art.js'
import {orbitalScenes} from '../tools/orbital-scenes.js'
const source=fs.readFileSync('public/agents/Draw.js','utf8'),D=renderer(source),S=load('Sim.js'),P=load('Palette.js')
const before=renderer(execFileSync('git',['show','640ffe8fb092487a2f8adc6adcba2ab5b47972cb:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
const pins=JSON.parse(fs.readFileSync('test/fixtures/orbital-pins.json','utf8'))
const layers=['drawOrbitalViews','drawOrbitalHull','drawOrbitalDocks','drawOrbitalLife']
const hash=b=>createHash('sha256').update(b).digest('hex')
function world(level=7,res=1){return Object.assign(S.generate(level,0,3),{res,ticks:350})}
function picture(w,name,theme='tokyo-night'){
 const img=canvas(400*w.res,248*w.res),ctx=img.ctx,calls=[],fill=ctx.fillRect.bind(ctx)
 ctx.setTransform(w.res,0,0,w.res,0,0);ctx.fillStyle='#123456';ctx.globalAlpha=0.8
 ctx.fillRect=(...a)=>{assert.ok(calls.length<15000);assert.ok(a.every(Number.isFinite));assert.ok(a.every(n=>Number.isInteger(n*w.res)));assert.ok(a[2]>0&&a[3]>0);calls.push([...a,ctx.fillStyle]);fill(...a)}
 D[name](ctx,w,P.build(themeOf(theme).theme,w.level))
 assert.equal(ctx.fillStyle,'#123456');assert.equal(ctx.globalAlpha,0.8)
 return {calls,digest:hash(img.buf)}
}
function frozen(v,cache=new WeakMap()){
 if(!v||typeof v!=='object')return v
 if(cache.has(v))return cache.get(v)
 const p=new Proxy(v,{get:(o,k)=>frozen(Reflect.get(o,k),cache),set(){throw Error('world write')},defineProperty(){throw Error('world define')},deleteProperty(){throw Error('world delete')}})
 cache.set(v,p);return p
}
test('C22 twelve independently reviewed Spaceship frames preserve predecessor and successor pins',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[7,27,47])for(const ticks of[350,900]){
  const opts={level,ticks,res,page:res===2},key=`${level}/${ticks}/${res}`,a=frame(S,before,P,opts),b=frame(S,D,P,opts)
  assert.equal(b.world.biome,'Spaceship');assert.equal(hash(a.img.buf),pins[key].before);assert.equal(hash(b.img.buf),pins[key].after)
  let n=0;for(let i=0;i<a.img.buf.length;i+=3)if(a.img.buf[i]!==b.img.buf[i]||a.img.buf[i+1]!==b.img.buf[i+1]||a.img.buf[i+2]!==b.img.buf[i+2])n++
  assert.ok(n>1500*res*res,`${key}: ${n} visibly changed scenery pixels`)
 }}finally{Math.random=random}
})
test('C22 all twenty other biomes are byte-identical; removing the four call sites recovers the full predecessor',()=>{
 assert.equal(hash(orbitalSourceBefore(source).split('\n// C22:')[0]),hash(execFileSync('git',['show','640ffe8fb092487a2f8adc6adcba2ab5b47972cb:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()))
 const restored=renderer(orbitalSourceBefore(source)),random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(let level=1;level<=21;level++)for(const ticks of[120,350,900]){
  const opts={level,ticks,res,page:res===2},expected=hash(frame(S,before,P,opts).img.buf)
  assert.equal(hash(frame(S,restored,P,opts).img.buf),expected)
  if(level!==7)assert.equal(hash(frame(S,D,P,opts).img.buf),expected,`${level}/${ticks}/${res}`)
 }}finally{Math.random=random}
})
test('C22 palette-only pixel-grid additions preserve context and frozen worlds without RNG',()=>{
 for(const res of[1,2])for(const theme of Object.keys(THEMES)){
  const w=world(47,res),snapshot=JSON.stringify(w),colours=new Set(Object.values(P.build(themeOf(theme).theme,47))),random=Math.random
  Math.random=()=>{throw Error('drawing RNG')}
  try{for(const name of layers){const a=picture(frozen(w),name,theme);assert.ok(a.calls.every(c=>colours.has(c[4])));assert.equal(picture(frozen(w),name,theme).digest,a.digest)}}finally{Math.random=random}
  assert.equal(JSON.stringify(w),snapshot)
 }
 for(const level of[1,3,4,21])for(const name of layers)assert.equal(picture(world(level),name).calls.length,0)
})
test('C22 native fasteners stay inside DIRT and page plating gets no second texture',()=>{
 const w=world(47),calls=picture(w,'drawOrbitalHull').calls
 assert.ok(calls.length>0)
 for(const[x,y,width,height]of calls)for(const[xx,yy]of[[x,y],[x+width-1,y+height-1]])assert.equal(w.terrain[Math.floor(yy/4)*w.k.COLS+Math.floor(xx/4)],w.k.DIRT)
 w.ticks+=71;const a=picture(w,'drawOrbitalHull').digest;w.ticks+=71;assert.equal(picture(w,'drawOrbitalHull').digest,a)
 w.res=2;assert.equal(picture(w,'drawOrbitalHull').calls.length,0)
 w.res=1
 for(const m of[w.k.EMPTY,w.k.ROCK,w.k.ORE,w.k.STEEL]){w.terrain.fill(m);assert.equal(picture(w,'drawOrbitalHull').calls.length,0)}
})
test('C22 dock and drone footprints have support, reserve original decor and hazards, and cache by terrain identity/version',()=>{
 for(const level of[7,27,47]){
  const w=world(level),a=D.orbitalSpots(w);assert.ok(a.length<=3);assert.ok(a.length>0);assert.equal(D.orbitalSpots(w),a)
  for(const b of a){assert.ok(D.karstSupport(w,b.x,b.y));assert.ok(D.alpineClear(w,b.x-2,b.y-24,27,20,D.orbitalReserved(w)))}
  w.ticks++;assert.equal(D.orbitalSpots(w),a);w.terrainVersion++;const b=D.orbitalSpots(w);assert.notEqual(a,b)
  w.terrain=[...w.terrain];assert.notEqual(D.orbitalSpots(w),b)
  w.hazards=[{zx0:0,zx1:100,zy0:0,zy1:100}];w.terrainVersion++;assert.equal(D.orbitalSpots(w).length,0)
  w.terrain.fill(w.k.DIRT);w.terrainVersion++;assert.equal(D.orbitalSpots(w).length,0)
 }
})
test('C22 repair drones animate, hold under reduced motion, and clip to current air without a board scan',()=>{
 for(const res of[1,2]){
  const w=world(47,res);D.orbitalSpots(w)
  let reads=0;w.terrain=new Proxy(w.terrain,{get(o,k){if(/^\d+$/.test(String(k)))reads++;const v=Reflect.get(o,k);return typeof v==='function'?v.bind(o):v}});D.orbitalSpots(w);reads=0
  const a=picture(w,'drawOrbitalLife');assert.ok(a.calls.length>0);assert.ok(reads<500,`cached live layer read ${reads} cells`)
  w.ticks+=37;assert.notEqual(picture(w,'drawOrbitalLife').digest,a.digest)
  w.reducedMotion=true;const b=picture(w,'drawOrbitalLife');w.ticks+=137;assert.equal(picture(w,'drawOrbitalLife').digest,b.digest)
  for(const[x,y,width,height]of b.calls)for(const[xx,yy]of[[x,y],[x+width-1,y+height-1]])assert.ok(D.mechanismAir(w,xx,yy))
  w.terrain.fill(w.k.DIRT);assert.equal(picture(w,'drawOrbitalLife').calls.length,0)
 }
})
test('C22 original opaque colony and umbrella colours survive the complete scene',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[7,27,47]){
  const opts={level,ticks:350,res,page:res===2},a=frame(S,before,P,opts),b=frame(S,D,P,opts),w=b.world,pal=P.build(themeOf('tokyo-night').theme,level)
  const masks=['#000000','#ffffff'].map(bg=>{const img=canvas(400*res,248*res,bg);img.ctx.setTransform(res,0,0,res,0,0);D.drawActorColony(img.ctx,w,pal,{});return img.buf})
  let n=0;for(let i=0;i<masks[0].length;i+=3)if(masks[0][i]===masks[1][i]&&masks[0][i+1]===masks[1][i+1]&&masks[0][i+2]===masks[1][i+2]){n++;assert.equal(hash(a.img.buf.subarray(i,i+3)),hash(b.img.buf.subarray(i,i+3)))}
  assert.ok(n>20*res*res)
 }}finally{Math.random=random}
})
test('C22 historical transitions and complete review sheets are reproducible',()=>{
 assert.deepEqual(orbitalScenes(),JSON.parse(fs.readFileSync('test/fixtures/orbital-scenes.json','utf8')))
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'orbital-review-'))
 try{assert.deepEqual(orbitalSheets(dir),pins);for(const res of[1,2])assert.ok(fs.statSync(path.join(dir,`full-res${res}-sheet.png`)).size>1000)}finally{fs.rmSync(dir,{recursive:true,force:true})}
})

test('C22 docks reserve complete decor and motion envelopes across varied layouts',()=>{
 for(let level=7;level<=188;level+=20)for(const seed of[3,17]){
  const w=Object.assign(S.generate(level,0,seed),{res:1})
  for(const b of D.orbitalSpots(w)){
   assert.ok(D.alpineClear(w,b.x-2,b.y-24,27,20,D.orbitalReserved(w)))
   assert.ok(D.karstSupport(w,b.x,b.y))
  }
 }
 const w=world(47);w.hatch=null
 assert.ok(Array.isArray(D.orbitalSpots(w)))
})
function stagedScene(draw,w,pal){
 const img=canvas(400*w.res,248*w.res)
 draw.drawTerrain(img.ctx,w,pal);draw.drawActors(img.ctx,w,pal,{labels:false,intro:false,feed:false})
 return img.buf
}
test('C22 opaque ship hazard tells retain their exact complete-frame colours',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[127,167,207,247,327])for(const phase of['charge','fire','cool']){
  const w=world(level,res),pal=P.build(themeOf('tokyo-night').theme,level)
  for(const h of w.hazards){h.phase=phase;h.t=3}
  const a=stagedScene(before,w,pal),b=stagedScene(D,w,pal)
  const masks=['#000000','#ffffff'].map(bg=>{
   const img=canvas(400*res,248*res,bg);img.ctx.setTransform(res,0,0,res,0,0)
   for(const h of w.hazards)D.drawHazard(img.ctx,w,pal,h,{labels:false})

   return img.buf
  })
  let n=0
  for(let i=0;i<masks[0].length;i+=3)if(masks[0][i]===masks[1][i]&&masks[0][i+1]===masks[1][i+1]&&masks[0][i+2]===masks[1][i+2]){
   n++;assert.equal(hash(a.subarray(i,i+3)),hash(b.subarray(i,i+3)),`${level}/${res}/${phase} pixel ${i/3}`)
  }
  assert.ok(n>0,`${level}/${res}/${phase} has opaque hazard pixels`)
 }}finally{Math.random=random}
})

test('C22 crescent visibility placement is cached without clock reads and refreshes on carving',()=>{
 const w=world(),x=D.orbitalPlanetX(w)
 assert.ok([90,180,270].includes(x))
 assert.equal(D.orbitalCrescentAir(w,x),Math.max(...[90,180,270].map(n=>D.orbitalCrescentAir(w,n))))
 let reads=0
 w.terrain=new Proxy(w.terrain,{get(o,k){if(/^\d+$/.test(String(k)))reads++;return Reflect.get(o,k)}})
 D.orbitalPlanetX(w);reads=0;w.ticks+=50
 assert.equal(D.orbitalPlanetX(w),x);assert.equal(reads,0)
 w.terrainVersion++;D.orbitalPlanetX(w);assert.ok(reads>0)
})
