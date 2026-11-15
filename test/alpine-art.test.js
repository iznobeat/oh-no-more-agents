import {alpineScenes} from '../tools/alpine-scenes.js'
import {alpineSuccessor,alpineSourceBefore} from '../tools/alpine-reference.js'
import os from 'node:os'
import path from 'node:path'
import {alpineSheets} from '../tools/alpine-art.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,frame,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
const source=fs.readFileSync('public/agents/Draw.js','utf8')
const old=renderer(execFileSync('git',['show','19156074ad1f2e8fea754864fa8db6888f0a300c:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
const D=load('Draw.js'),S=load('Sim.js'),P=load('Palette.js')
const hash=b=>createHash('sha256').update(b).digest('hex')
const layers=['drawAlpineSky','drawAlpineSnow','drawAlpineFirs','drawAlpineLife']
function world(level=3,res=1){return Object.assign(S.generate(level,0,3),{res,ticks:350})}
function picture(w,name,theme='tokyo-night'){
 const img=canvas(400*w.res,248*w.res),calls=[],ctx=img.ctx,fill=ctx.fillRect.bind(ctx)
 ctx.setTransform(w.res,0,0,w.res,0,0)
 ctx.fillStyle='#123456';ctx.globalAlpha=0.8
 ctx.fillRect=(...a)=>{
  assert.ok(calls.length<20000);assert.ok(a.every(Number.isFinite));assert.ok(a.every(n=>Number.isInteger(n*w.res)));assert.ok(a[2]>0&&a[3]>0)
  calls.push([...a,ctx.fillStyle]);fill(...a)
 }
 D[name](ctx,w,P.build(themeOf(theme).theme,w.level))
 assert.equal(ctx.fillStyle,'#123456');assert.equal(ctx.globalAlpha,0.8)
 return {...img,calls,digest:hash(img.buf)}
}
function frozen(v,cache=new WeakMap()){
 if(!v||typeof v!=='object')return v
 if(cache.has(v))return cache.get(v)
 const p=new Proxy(v,{get:(o,k)=>frozen(Reflect.get(o,k),cache),set(){throw Error('world write')},defineProperty(){throw Error('world define')},deleteProperty(){throw Error('world delete')}})
 cache.set(v,p);return p
}

test('C16 complete Frost boards retain independent historical and reviewed pins at both scales',()=>{
 const pins=JSON.parse(fs.readFileSync('test/fixtures/alpine-pins.json','utf8')),random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[3,23,43])for(const ticks of[350,900]){
  const opts={level,ticks,res,page:res===2},key=`${level}/${ticks}/${res}`
  const before=frame(S,old,P,opts).img.buf,after=frame(S,D,P,opts).img.buf
  assert.equal(hash(before),pins[key].before);assert.equal(hash(after),pins[key].after)
  let changed=0;for(let i=0;i<before.length;i+=3)if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])changed++
  assert.ok(changed>1500*res*res,`visible full frame ${key}: ${changed}`)
 }}finally{Math.random=random}
})
test('C16 all other biomes retain byte-identical complete frames; removing four hooks recovers Frost too',()=>{
 const without=renderer(source.replace(/^  drawAlpine(?:Sky|Snow|Firs|Life)\(ctx, w, pal\)\n/gm,'')),random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(let level=1;level<=21;level++)for(const ticks of[120,350]){
  const opts={level,ticks,res,page:res===2},expected=hash(frame(S,old,P,opts).img.buf)
  assert.equal(hash(frame(S,without,P,opts).img.buf),expected,`four-hook scope ${level}/${res}/${ticks}`)
  if(level!==3)assert.equal(hash(frame(S,D,P,opts).img.buf),expected,`unchanged biome ${level}/${res}/${ticks}`)
 }}finally{Math.random=random}
})
test('C16 additions use existing palette, preserve context, stay on grid and read frozen worlds without RNG',()=>{
 for(const res of[1,2])for(const theme of Object.keys(THEMES)){
  const w=world(23,res),before=JSON.stringify(w),p=P.build(themeOf(theme).theme,23),colours=new Set(Object.values(p)),random=Math.random
  Math.random=()=>{throw Error('drawing RNG')}
  try{for(const name of layers){const a=picture(frozen(w),name,theme);assert.ok(a.calls.every(c=>colours.has(c[4])));assert.equal(picture(frozen(w),name,theme).digest,a.digest)}}finally{Math.random=random}
  assert.equal(JSON.stringify(w),before)
 }
 for(const level of[1,8,21])for(const name of layers)assert.equal(picture(world(level),name).calls.length,0)
})
test('C16 snow strata stay inside original dirt and rock; cached architecture ignores ticks',()=>{
 for(const res of[1,2]){
  const w=world(43,res)
  for(const name of layers.slice(0,3)){
   const a=picture(w,name);w.ticks+=137;assert.equal(picture(w,name).digest,a.digest)
  }
  for(const [x,y,width,height]of picture(w,'drawAlpineSnow').calls)for(const [xx,yy]of[[x,y],[x+width-1,y+height-1]])assert.ok([w.k.DIRT,w.k.ROCK].includes(w.terrain[Math.floor(yy/4)*w.k.COLS+Math.floor(xx/4)]))
  for(const material of[w.k.EMPTY,w.k.STEEL,w.k.ORE]){w.terrain.fill(material);w.terrainVersion++;assert.equal(picture(w,'drawAlpineSnow').calls.length,0)}
 }
})
test('C16 live fir sites cache per terrain version and identity and exclude scenery, exits and hazards',()=>{
 const w=world(23),a=D.alpineSpots(w)
 assert.ok(a.length>0);assert.equal(D.alpineSpots(w),a)
 for(const b of a)assert.ok(D.alpineClear(w,b.x-3,b.y-3,25,28,D.abyssReserved(w)))
 w.ticks++;assert.equal(D.alpineSpots(w),a)
 w.terrainVersion++;const b=D.alpineSpots(w);assert.notEqual(b,a)
 w.terrain=[...w.terrain];assert.notEqual(D.alpineSpots(w),b)
 w.terrain.fill(w.k.DIRT);w.terrainVersion++;assert.equal(D.alpineSpots(w).length,0);assert.equal(picture(w,'drawAlpineLife').calls.length,0)
})
test('C16 spindrift animate at both scales, freeze under reduced motion and clip to current air',()=>{
 for(const res of[1,2]){
  const w=world(23,res),a=picture(w,'drawAlpineLife');assert.ok(a.calls.length>=4)
  w.ticks+=19;assert.notEqual(picture(w,'drawAlpineLife').digest,a.digest)
  w.reducedMotion=true;const b=picture(w,'drawAlpineLife');w.ticks+=300;assert.equal(picture(w,'drawAlpineLife').digest,b.digest)
  for(const[x,y,width,height]of b.calls)for(const[xx,yy]of[[x,y],[x+width-1,y+height-1]])assert.equal(w.terrain[Math.floor(yy/4)*w.k.COLS+Math.floor(xx/4)],w.k.EMPTY)
  w.terrain.fill(w.k.DIRT);w.terrainVersion++;assert.equal(picture(w,'drawAlpineLife').calls.length,0)
 }
})

test('C16 opaque colony and umbrella pixels retain exact complete-frame colours',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[3,23,43]){
  const opts={level,ticks:350,res,page:res===2},a=frame(S,old,P,opts),b=frame(S,D,P,opts),w=b.world,pal=P.build(themeOf('tokyo-night').theme,level)
  const masks=['#000000','#ffffff'].map(background=>{
   const img=canvas(400*res,248*res,background);img.ctx.setTransform(res,0,0,res,0,0);D.drawActorColony(img.ctx,w,pal,{});return img.buf
  })
  let opaque=0;const left=createHash('sha256'),right=createHash('sha256')
  for(let i=0;i<masks[0].length;i+=3)if(masks[0][i]===masks[1][i]&&masks[0][i+1]===masks[1][i+1]&&masks[0][i+2]===masks[1][i+2]){
   opaque++;left.update(a.img.buf.subarray(i,i+3));right.update(b.img.buf.subarray(i,i+3))
  }
  assert.ok(opaque>100*res*res);assert.equal(left.digest('hex'),right.digest('hex'))
 }}finally{Math.random=random}
})

test('C16 review retains full-frame before/after sheets and all 21 biomes at both scales',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'alpine-review-'))
 try{
  const corpus=alpineSheets('19156074ad1f2e8fea754864fa8db6888f0a300c',out),pins=JSON.parse(fs.readFileSync('test/fixtures/alpine-pins.json','utf8'))
  for(const [key,pin]of Object.entries(pins)){assert.equal(corpus.before[key],pin.before);assert.equal(corpus.after[key],pin.after)}
  for(const res of[1,2])for(const name of['full-res'+res+'-sheet.png',...Array.from({length:3},(_,i)=>`catalogue-${i+1}-res${res}.png`)])assert.ok(fs.statSync(path.join(out,name)).size>300)
 }finally{fs.rmSync(out,{recursive:true,force:true})}
})


test('C16 reviewed firs are grounded, complete footprints avoid old decor and hazard tells, carving removes them',()=>{
 for(const res of[1,2])for(const level of[3,23,43]){
  const w=frame(S,D,P,{level,ticks:350,res,page:res===2}).world,spots=D.alpineSpots(w)
  assert.ok(spots.length>0 && spots.length<=7)
  for(const b of spots){
   assert.ok(D.alpineClear(w,b.x-3,b.y-3,25,28,D.abyssReserved(w)))
   assert.ok(w.terrain[Math.floor((b.y+25)/4)*w.k.COLS+Math.floor((b.x+6)/4)])
  }
  for(const[x,y,width,height]of picture(w,'drawAlpineFirs').calls)
   for(let yy=y;yy<y+height;yy++)for(let xx=x;xx<x+width;xx++)assert.ok(D.mechanismAir(w,xx,yy))
  w.hazards=[{zx0:0,zx1:100,zy0:0,zy1:100}];w.terrainVersion++
  assert.equal(D.alpineSpots(w).length,0)
 }
 const w=world();w.terrain.fill(w.k.EMPTY)
 assert.ok(D.alpineClear(w,40,40,20,20,[]))
 w.terrain[12*w.k.COLS+12]=w.k.DIRT
 assert.equal(D.alpineClear(w,40,40,20,20,[]),false,'interior cells count too')
})
test('C16 every advanced historical scene is independently reproducible and prior pins remain explicit',()=>{
 const pins=JSON.parse(fs.readFileSync('test/fixtures/alpine-scenes.json','utf8'))
 assert.deepEqual(alpineScenes('19156074ad1f2e8fea754864fa8db6888f0a300c'),pins)
 for(const [before,pin]of Object.entries(pins))assert.equal(alpineSuccessor(before),pin.after)
 assert.equal(alpineSuccessor('unaffected'),'unaffected')
 assert.equal(alpineSourceBefore(source),source.replace(/^  drawAlpine(?:Sky|Snow|Firs|Life)\(ctx, w, pal\)\n/gm,''))
})
