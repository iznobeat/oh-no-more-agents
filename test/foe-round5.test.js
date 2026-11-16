import {foeRoundSixSourceBefore} from '../tools/foe-round6-reference.js'
import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {foeRoundFiveScenes} from '../tools/foe-round5-scenes.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {load,canvas,frame,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {hazardFrame,hazardFixture,hazardSequence,enemyFrame,enemyFixture,KINDS,STATES,roundFiveReview} from '../tools/foe-strips.js'
import {foeRoundFiveSourceBefore} from '../tools/foe-round5-reference.js'
const source=foeRoundSixSourceBefore(fs.readFileSync('public/agents/Draw.js','utf8')),D=renderer(source),old=renderer(foeRoundFiveSourceBefore(source)),S=load('Sim.js'),P=load('Palette.js')
const specs=S.HAZARDS.filter(s=>['rockfall','scarab','snake'].includes(s.id))
const hash=b=>createHash('sha256').update(b).digest('hex')
const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round5-pins.json','utf8'))
function corpus(D){
 const result={}
 for(const s of specs)for(const res of[1,2])for(const dir of[-1,1]){
  const h=createHash('sha256')
  for(const {phase,t}of hazardSequence(s))h.update(hazardFrame(D,s,phase,t,res,dir).buf)
  result[`${s.id}/${res}/${dir}`]=h.digest('hex')
 }
 return result
}
test('C25 independent predecessor and reviewed complete cycle digests',()=>{
 assert.deepEqual(corpus(old),pins.before);assert.deepEqual(corpus(D),pins.after)
})
function difference(a,b){let n=0;for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n}
test('C25 anticipation and recovery visibly change full-size native and page key poses',()=>{
 for(const s of specs)for(const res of[1,2])for(const[phase,t]of[['charge',Math.floor(s.charge/2)],['fire',3],['rest',3]])
  assert.ok(difference(hazardFrame(old,s,phase,t,res).buf,hazardFrame(D,s,phase,t,res).buf)>=6*res*res,`${s.id}/${phase}/${res}`)
})
test('C25 Sim phase boundaries join and recovery settles by twelve',()=>{
 for(const res of[1,2]){
  const w={res},charge={winding:true,show:true,tall:24},fire={live:true,show:true,tall:24},rest={cool:1,tall:24}
  assert.deepEqual(D.snakeStrikePose(w,{t:19},charge),D.snakeStrikePose(w,{t:0},fire))
  assert.deepEqual(D.snakeStrikePose(w,{t:15},fire),D.snakeStrikePose(w,{t:0},rest))
  for(let i=0;i<4;i++){
   assert.deepEqual(D.rockLoadPose(w,{t:35},charge,i),D.rockLoadPose(w,{t:0},fire,i))
   assert.deepEqual(D.rockLoadPose(w,{t:17},fire,i),D.rockLoadPose(w,{t:0},rest,i))
  }
  for(let i=0;i<5;i++)assert.deepEqual(D.scarabLaunchPose(w,{t:17},charge,i),D.scarabLaunchPose(w,{t:0},fire,i))
  for(const s of specs)assert.equal(hash(hazardFrame(D,s,'rest',20,res).buf),hash(hazardFrame(D,s,'idle',20,res).buf))
 }
})
test('C25 reduced motion holds live poses and wing flutter while keeping the wind-up',()=>{
 for(const res of[1,2]){
  const w={res,reducedMotion:true},fire={live:true,tall:24}
  for(const t of[0,3,7,13]){
   assert.deepEqual(D.snakeStrikePose(w,{t},fire),D.snakeStrikePose(w,{t:0},fire))
   for(let i=0;i<4;i++)assert.deepEqual(D.rockLoadPose(w,{t},fire,i),D.rockLoadPose(w,{t:0},fire,i))
   for(let i=0;i<5;i++)assert.deepEqual(D.scarabLaunchPose(w,{t},fire,i),D.scarabLaunchPose(w,{t:0},fire,i))
  }
  assert.notDeepEqual(D.snakeStrikePose(w,{t:0},{winding:true}),D.snakeStrikePose(w,{t:10},{winding:true}))
 }
})
test('C25 native idle retains the old breathing and shuffle; reduced idle is held at both scales',()=>{
 for(const spec of specs)for(const t of[0,24,60,90]){
  assert.equal(hash(hazardFrame(D,spec,'idle',t,1).buf),hash(hazardFrame(old,spec,'idle',t,1).buf))
 }
 for(const spec of specs)for(const res of[1,2]){
  const paint=t=>{const{w,h}=hazardFixture(spec,'idle',t);w.res=res;w.reducedMotion=true;const img=canvas(400*res,248*res);D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h);return hash(img.buf)}
  for(const t of[24,60,90])assert.equal(paint(t),paint(0))
 }
})
function readonly(v){if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return v;return new Proxy(v,{get:(o,k)=>readonly(o[k]),set(){throw Error('world write')}})}
test('C25 pure bounded palette-only grid-aligned painters throughout every theme and cycle',()=>{
 const random=Math.random;Math.random=()=>{throw Error('drawing RNG')}
 try{for(const s of specs)for(const res of[1,2])for(const theme of Object.keys(THEMES))for(const{phase,t}of hazardSequence(s)){
  const{w,h}=hazardFixture(s,phase,t);w.res=res
  const img=canvas(400*res,248*res),fill=img.ctx.fillRect.bind(img.ctx),pal=P.build(themeOf(theme).theme,1),colours=new Set(Object.values(pal));let n=0
  img.ctx.fillRect=(...a)=>{assert.ok(++n<250);assert.ok(a.every(Number.isFinite));assert.ok(a.every(v=>Number.isInteger(v*res)),`${s.id}/${phase}/${t}/${res}: ${a}`);assert.ok(a[2]>=0&&a[3]>=0);assert.ok(colours.has(img.ctx.fillStyle));fill(...a)}
  D.drawHazardKind(img.ctx,readonly(w),pal,readonly(h));assert.equal(img.ctx.globalAlpha,1)
 }}finally{Math.random=random}
})
test('C25 all other hazards and every enemy state with seasonal riders retain exact bytes',()=>{
 for(const res of[1,2]){
  for(const s of S.HAZARDS.filter(s=>!specs.includes(s)))for(const phase of['idle','charge','fire','rest'])for(const t of[0,3,12])
   assert.equal(hash(hazardFrame(D,s,phase,t,res).buf),hash(hazardFrame(old,s,phase,t,res).buf),`${s.id}/${phase}/${t}/${res}`)
  for(const kind of KINDS)for(const state of STATES)for(const mode of['santa','party','antlers'])for(const dir of[-1,1]){
   const paint=D=>{const{w,en}=enemyFixture(kind,state,4,dir);w.res=res;w.season={redHats:mode};const img=canvas(400*res,248*res);D.drawEnemy(img.ctx,w,{},en,{});return hash(img.buf)}
   assert.equal(paint(D),paint(old),`${kind}/${state}/${mode}/${dir}/${res}`)
  }
 }
})
test('C25 full boards retain independent predecessor and successor scene pins',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const[key,pin]of Object.entries(pins.scenes)){
  const[level,res,ticks]=key.split('/').map(Number),opts={level,res,ticks,seed:3,page:res===2}
  assert.equal(hash(frame(S,old,P,opts).img.buf),pin.before,key+' before')
  assert.equal(hash(frame(S,D,P,opts).img.buf),pin.after,key+' after')
 }}finally{Math.random=random}
})

test('C25 restoring precisely three painters and four helpers recovers exact predecessor source',()=>{
 assert.equal(foeRoundFiveSourceBefore(source),execFileSync('git',['show','da0d2b8c38e9beae8062ccc4a41e4b5c821c361b:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
})
test('C25 deliberate historical scene transitions are independently reproducible',()=>{
 assert.deepEqual(foeRoundFiveScenes(),JSON.parse(fs.readFileSync('test/fixtures/foe-round5-scenes.json','utf8')))
})
test('C25 review writer retains both scales and seasonal complete boards',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'foes5-'))
 try{roundFiveReview(out,old,D);for(const res of[1,2]){
  for(const s of specs)for(const suffix of['compact','compare'])assert.ok(fs.statSync(path.join(out,`${s.id}-${suffix}-res${res}.png`)).size>100)
  for(const mode of['none','christmas','newyear'])assert.ok(fs.statSync(path.join(out,`round5-${mode}-charge-full-res${res}.png`)).size>1000)
 }}finally{fs.rmSync(out,{recursive:true,force:true})}
})
