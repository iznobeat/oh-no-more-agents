import os from 'node:os'
import path from 'node:path'
import {ironworksSheets} from '../tools/ironworks-art.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,frame,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
const source=fs.readFileSync('public/agents/Draw.js','utf8')
const old=renderer(execFileSync('git',['show','6aaf4b4b2a2aa720eea7ce0488d85d34f0fded3b:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
const D=load('Draw.js'),S=load('Sim.js'),P=load('Palette.js')
const hash=b=>createHash('sha256').update(b).digest('hex')
const layers=['drawIronworksHall','drawIronworksBrick','drawIronworksKilns','drawIronworksLife']
function world(level=4,res=1){return Object.assign(S.generate(level,0,3),{res,ticks:350})}
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

test('C15 complete Foundry boards retain independent historical and reviewed pins at both scales',()=>{
 const pins=JSON.parse(fs.readFileSync('test/fixtures/ironworks-pins.json','utf8')),random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[4,24,44])for(const ticks of[350,900]){
  const opts={level,ticks,res,page:res===2},key=`${level}/${ticks}/${res}`
  const before=frame(S,old,P,opts).img.buf,after=frame(S,D,P,opts).img.buf
  assert.equal(hash(before),pins[key].before);assert.equal(hash(after),pins[key].after)
  let changed=0;for(let i=0;i<before.length;i+=3)if(before[i]!==after[i]||before[i+1]!==after[i+1]||before[i+2]!==after[i+2])changed++
  assert.ok(changed>1500*res*res,`visible full frame ${key}: ${changed}`)
 }}finally{Math.random=random}
})
test('C15 all other biomes retain byte-identical complete frames; removing four hooks recovers Foundry too',()=>{
 const without=renderer(source.replace(/^  drawIronworks(?:Hall|Brick|Kilns|Life)\(ctx, w, pal\)\n/gm,'')),random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(let level=1;level<=21;level++)for(const ticks of[120,350]){
  const opts={level,ticks,res,page:res===2},expected=hash(frame(S,old,P,opts).img.buf)
  assert.equal(hash(frame(S,without,P,opts).img.buf),expected,`four-hook scope ${level}/${res}/${ticks}`)
  if(level!==4)assert.equal(hash(frame(S,D,P,opts).img.buf),expected,`unchanged biome ${level}/${res}/${ticks}`)
 }}finally{Math.random=random}
})
test('C15 additions use existing palette, preserve context, stay on grid and read frozen worlds without RNG',()=>{
 for(const res of[1,2])for(const theme of Object.keys(THEMES)){
  const w=world(24,res),before=JSON.stringify(w),p=P.build(themeOf(theme).theme,24),colours=new Set(Object.values(p)),random=Math.random
  Math.random=()=>{throw Error('drawing RNG')}
  try{for(const name of layers){const a=picture(frozen(w),name,theme);assert.ok(a.calls.every(c=>colours.has(c[4])));assert.equal(picture(frozen(w),name,theme).digest,a.digest)}}finally{Math.random=random}
  assert.equal(JSON.stringify(w),before)
 }
 for(const level of[1,8,21])for(const name of layers)assert.equal(picture(world(level),name).calls.length,0)
})
test('C15 refractory joints stay inside original dirt and rock; cached architecture ignores ticks',()=>{
 for(const res of[1,2]){
  const w=world(44,res)
  for(const name of layers.slice(0,3)){
   const a=picture(w,name);w.ticks+=137;assert.equal(picture(w,name).digest,a.digest)
  }
  for(const [x,y,width,height]of picture(w,'drawIronworksBrick').calls)for(const [xx,yy]of[[x,y],[x+width-1,y+height-1]])assert.ok([w.k.DIRT,w.k.ROCK].includes(w.terrain[Math.floor(yy/4)*w.k.COLS+Math.floor(xx/4)]))
  for(const material of[w.k.EMPTY,w.k.STEEL,w.k.ORE]){w.terrain.fill(material);w.terrainVersion++;assert.equal(picture(w,'drawIronworksBrick').calls.length,0)}
 }
})
test('C15 live fitting sites cache per terrain version and identity and exclude scenery, exits and hazards',()=>{
 const w=world(24),a=D.ironworksSpots(w)
 assert.ok(a.length>0);assert.equal(D.ironworksSpots(w),a)
 for(const b of a)assert.ok(D.abyssClear(w,b.x,b.y-2,24,14,D.abyssReserved(w)))
 w.ticks++;assert.equal(D.ironworksSpots(w),a)
 w.terrainVersion++;const b=D.ironworksSpots(w);assert.notEqual(b,a)
 w.terrain=[...w.terrain];assert.notEqual(D.ironworksSpots(w),b)
 w.terrain.fill(w.k.DIRT);w.terrainVersion++;assert.equal(D.ironworksSpots(w).length,0);assert.equal(picture(w,'drawIronworksLife').calls.length,0)
})
test('C15 fans and exhaust animate at both scales, freeze under reduced motion and clip to current air',()=>{
 for(const res of[1,2]){
  const w=world(24,res),a=picture(w,'drawIronworksLife');assert.ok(a.calls.length>10)
  w.ticks+=19;assert.notEqual(picture(w,'drawIronworksLife').digest,a.digest)
  w.reducedMotion=true;const b=picture(w,'drawIronworksLife');w.ticks+=300;assert.equal(picture(w,'drawIronworksLife').digest,b.digest)
  for(const[x,y,width,height]of b.calls)for(const[xx,yy]of[[x,y],[x+width-1,y+height-1]])assert.equal(w.terrain[Math.floor(yy/4)*w.k.COLS+Math.floor(xx/4)],w.k.EMPTY)
  w.terrain.fill(w.k.DIRT);w.terrainVersion++;assert.equal(picture(w,'drawIronworksLife').calls.length,0)
 }
})

test('C15 opaque colony and umbrella pixels retain exact complete-frame colours',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[4,24,44]){
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

test('C15 review retains full-frame before/after sheets and all 21 biomes at both scales',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'ironworks-review-'))
 try{
  const corpus=ironworksSheets('6aaf4b4b2a2aa720eea7ce0488d85d34f0fded3b',out),pins=JSON.parse(fs.readFileSync('test/fixtures/ironworks-pins.json','utf8'))
  for(const [key,pin]of Object.entries(pins)){assert.equal(corpus.before[key],pin.before);assert.equal(corpus.after[key],pin.after)}
  for(const res of[1,2])for(const name of['full-res'+res+'-sheet.png',...Array.from({length:3},(_,i)=>`catalogue-${i+1}-res${res}.png`)])assert.ok(fs.statSync(path.join(out,name)).size>300)
 }finally{fs.rmSync(out,{recursive:true,force:true})}
})
