import {cryoSourceBefore} from '../tools/cryo-art.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,frame,canvas,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {antiqueSourceBefore,antiqueSheets} from '../tools/antique-art.js'
import {antiqueScenes} from '../tools/antique-scenes.js'
const source=cryoSourceBefore(fs.readFileSync('public/agents/Draw.js','utf8')),D=renderer(source),S=load('Sim.js'),P=load('Palette.js')
const before=renderer(execFileSync('git',['show','5692b063d1d5eb32f72db12045dd549679c87779:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
const pins=JSON.parse(fs.readFileSync('test/fixtures/antique-pins.json','utf8'))
const layers=['drawAntiqueHall','drawAntiqueStone','drawAntiqueGarden','drawAntiqueLife']
const hash=b=>createHash('sha256').update(b).digest('hex')
function world(level=2,res=1){return Object.assign(S.generate(level,0,3),{res,ticks:350})}
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
test('C17 twelve independently reviewed Ruins frames preserve predecessor and successor pins',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[2,22,62])for(const ticks of[350,900]){
  const opts={level,ticks,res,page:res===2},key=`${level}/${ticks}/${res}`,a=frame(S,before,P,opts),b=frame(S,D,P,opts)
  assert.equal(b.world.biome,'Ruins');assert.equal(hash(a.img.buf),pins[key].before);assert.equal(hash(b.img.buf),pins[key].after)
  let n=0;for(let i=0;i<a.img.buf.length;i+=3)if(a.img.buf[i]!==b.img.buf[i]||a.img.buf[i+1]!==b.img.buf[i+1]||a.img.buf[i+2]!==b.img.buf[i+2])n++
  assert.ok(n>1500*res*res,`${key}: ${n} visibly changed scenery pixels`)
 }}finally{Math.random=random}
})
test('C17 all twenty other biomes are byte-identical; removing four hooks recovers the full predecessor',()=>{
 assert.equal(hash(antiqueSourceBefore(source).split('\n// C17:')[0]),hash(execFileSync('git',['show','5692b063d1d5eb32f72db12045dd549679c87779:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()))
 const restored=renderer(antiqueSourceBefore(source)),random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(let level=1;level<=21;level++)for(const ticks of[120,350]){
  const opts={level,ticks,res,page:res===2},expected=hash(frame(S,before,P,opts).img.buf)
  assert.equal(hash(frame(S,restored,P,opts).img.buf),expected)
  if(level!==2)assert.equal(hash(frame(S,D,P,opts).img.buf),expected,`${level}/${ticks}/${res}`)
 }}finally{Math.random=random}
})
test('C17 palette-only pixel-grid additions preserve context and frozen worlds without RNG',()=>{
 for(const res of[1,2])for(const theme of Object.keys(THEMES)){
  const w=world(22,res),snapshot=JSON.stringify(w),colours=new Set(Object.values(P.build(themeOf(theme).theme,22))),random=Math.random
  Math.random=()=>{throw Error('drawing RNG')}
  try{for(const name of layers){const a=picture(frozen(w),name,theme);assert.ok(a.calls.every(c=>colours.has(c[4])));assert.equal(picture(frozen(w),name,theme).digest,a.digest)}}finally{Math.random=random}
  assert.equal(JSON.stringify(w),snapshot)
 }
 for(const level of[1,3,4,21])for(const name of layers)assert.equal(picture(world(level),name).calls.length,0)
})
test('C17 only bare native DIRT gets courses; original page material and cached art stay unchanged with time',()=>{
 for(const res of[1,2]){
  const w=world(22,res)
  for(const name of layers.slice(0,3)){const a=picture(w,name);w.ticks+=71;assert.equal(picture(w,name).digest,a.digest)}
  const calls=picture(w,'drawAntiqueStone').calls
  if(res===2)assert.equal(calls.length,0);else assert.ok(calls.length>0)
  for(const[x,y,width,height]of calls)for(const[xx,yy]of[[x,y],[x+width-1,y+height-1]])assert.equal(w.terrain[Math.floor(yy/4)*w.k.COLS+Math.floor(xx/4)],w.k.DIRT)
  for(const m of[w.k.EMPTY,w.k.ROCK,w.k.ORE,w.k.STEEL]){w.terrain.fill(m);assert.equal(picture(w,'drawAntiqueStone').calls.length,0)}
 }
})
test('C17 garden footprints have support, reserve original decor and hazards, and cache by terrain identity/version',()=>{
 for(const level of[2,22,62]){
  const w=world(level),a=D.antiqueSpots(w);assert.ok(a.length>0&&a.length<=7);assert.equal(D.antiqueSpots(w),a)
  for(const b of a){assert.ok(D.antiqueSupport(w,b.x,b.y));assert.ok(D.alpineClear(w,b.x-3,b.y-24,25,24,D.abyssReserved(w)))}
  w.ticks++;assert.equal(D.antiqueSpots(w),a);w.terrainVersion++;const b=D.antiqueSpots(w);assert.notEqual(a,b)
  w.terrain=[...w.terrain];assert.notEqual(D.antiqueSpots(w),b)
  w.hazards=[{zx0:0,zx1:100,zy0:0,zy1:100}];w.terrainVersion++;assert.equal(D.antiqueSpots(w).length,0)
  w.terrain.fill(w.k.DIRT);w.terrainVersion++;assert.equal(D.antiqueSpots(w).length,0)
 }
})
test('C17 butterflies animate, hold under reduced motion, and clip to current air without a board scan',()=>{
 for(const res of[1,2]){
  const w=world(22,res),a=picture(w,'drawAntiqueLife');assert.ok(a.calls.length>0)
  w.ticks+=37;assert.notEqual(picture(w,'drawAntiqueLife').digest,a.digest)
  w.reducedMotion=true;const b=picture(w,'drawAntiqueLife');w.ticks+=137;assert.equal(picture(w,'drawAntiqueLife').digest,b.digest)
  for(const[x,y,width,height]of b.calls)for(const[xx,yy]of[[x,y],[x+width-1,y+height-1]])assert.ok(D.mechanismAir(w,xx,yy))
  w.terrain.fill(w.k.DIRT);assert.equal(picture(w,'drawAntiqueLife').calls.length,0)
 }
})
test('C17 original opaque colony and umbrella colours survive the complete scene',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[2,22,62]){
  const opts={level,ticks:350,res,page:res===2},a=frame(S,before,P,opts),b=frame(S,D,P,opts),w=b.world,pal=P.build(themeOf('tokyo-night').theme,level)
  const masks=['#000000','#ffffff'].map(bg=>{const img=canvas(400*res,248*res,bg);img.ctx.setTransform(res,0,0,res,0,0);D.drawActorColony(img.ctx,w,pal,{});return img.buf})
  let n=0;for(let i=0;i<masks[0].length;i+=3)if(masks[0][i]===masks[1][i]&&masks[0][i+1]===masks[1][i+1]&&masks[0][i+2]===masks[1][i+2]){n++;assert.equal(hash(a.img.buf.subarray(i,i+3)),hash(b.img.buf.subarray(i,i+3)))}
  assert.ok(n>20*res*res)
 }}finally{Math.random=random}
})
test('C17 historical transitions and complete review sheets are reproducible',()=>{
 assert.deepEqual(antiqueScenes(),JSON.parse(fs.readFileSync('test/fixtures/antique-scenes.json','utf8')))
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'antique-review-'))
 try{assert.deepEqual(antiqueSheets(dir),pins);for(const res of[1,2])assert.ok(fs.statSync(path.join(dir,`full-res${res}-sheet.png`)).size>1000)}finally{fs.rmSync(dir,{recursive:true,force:true})}
})
