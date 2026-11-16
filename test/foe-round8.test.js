import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {foeRoundEightScenes} from '../tools/foe-round8-scenes.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {load,canvas,frame,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {hazardFrame,hazardFixture,hazardSequence,enemyFixture,KINDS,STATES,roundEightReview} from '../tools/foe-strips.js'
import {foeRoundEightSourceBefore} from '../tools/foe-round8-reference.js'
const source=fs.readFileSync('public/agents/Draw.js','utf8'),D=renderer(source),old=renderer(foeRoundEightSourceBefore(source)),S=load('Sim.js'),P=load('Palette.js')
const specs=S.HAZARDS.filter(s=>['vinelock','blackice','shredder'].includes(s.id))
const hash=b=>createHash('sha256').update(b).digest('hex')
const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round8-pins.json','utf8'))
function corpus(D){
 const result={}
 for(const s of specs)for(const res of[1,2])for(const dir of[-1,1]){
  const h=createHash('sha256')
  for(const {phase,t}of hazardSequence(s))h.update(hazardFrame(D,s,phase,t,res,dir).buf)
  result[`${s.id}/${res}/${dir}`]=h.digest('hex')
 }
 return result
}
test('C28 independent predecessor and reviewed complete cycle digests',()=>{
 assert.deepEqual(corpus(old),pins.before);assert.deepEqual(corpus(D),pins.after)
})
function difference(a,b){let n=0;for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n}
test('C28 anticipation and recovery visibly change full-size native and page key poses',()=>{
 for(const s of specs)for(const res of[1,2])for(const[phase,t]of[['charge',Math.floor(s.charge/2)],['fire',3],['rest',3]])
  assert.ok(difference(hazardFrame(old,s,phase,t,res).buf,hazardFrame(D,s,phase,t,res).buf)>=6*res*res,`${s.id}/${phase}/${res}`)
})
test('C28 charge/fire boundaries join and mechanical recovery settles',()=>{
 for(const res of[1,2]){
  const w={res},g={winding:true},live={live:true},rest={cool:1}
  assert.deepEqual(D.vineLockPose(w,{t:13},g),D.vineLockPose(w,{t:0},live))
  assert.equal(D.blackIcePose(w,{t:11},g),D.blackIcePose(w,{t:0},live))
  assert.equal(D.blackIcePose(w,{t:21},live),D.blackIcePose(w,{t:0},rest))
  assert.deepEqual(D.shredderPose(w,{t:23},live),D.shredderPose(w,{t:0},rest))
  for(const s of specs)assert.equal(hash(hazardFrame(D,s,'rest',20,res).buf),hash(hazardFrame(D,s,'idle',20,res).buf))
 }
})
function readonly(v){if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return v;return new Proxy(v,{get:(o,k)=>readonly(o[k]),set(){throw Error('world write')}})}
test('C28 pure bounded palette-only grid-aligned painters throughout every theme and cycle',()=>{
 const random=Math.random;Math.random=()=>{throw Error('drawing RNG')}
 try{for(const s of specs)for(const res of[1,2])for(const theme of Object.keys(THEMES))for(const{phase,t}of hazardSequence(s)){
  const{w,h}=hazardFixture(s,phase,t);w.res=res
  const img=canvas(400*res,248*res),fill=img.ctx.fillRect.bind(img.ctx),pal=P.build(themeOf(theme).theme,1),colours=new Set([...Object.values(pal),'#ffffff']);let n=0
  img.ctx.fillRect=(...a)=>{assert.ok(++n<250);assert.ok(a.every(Number.isFinite));assert.ok(a.every(v=>Number.isInteger(v*res)),`${s.id}/${phase}/${t}/${res}: ${a}`);assert.ok(a[2]>=0&&a[3]>=0);assert.ok(colours.has(img.ctx.fillStyle));fill(...a)}
  D.drawHazardKind(img.ctx,readonly(w),pal,readonly(h));assert.equal(img.ctx.globalAlpha,1)
 }}finally{Math.random=random}
})
test('C28 all other hazards and every enemy state with seasonal riders retain exact bytes',()=>{
 for(const res of[1,2]){
  for(const s of S.HAZARDS.filter(s=>!specs.includes(s)))for(const phase of['idle','charge','fire','rest'])for(const t of[0,3,12])
   assert.equal(hash(hazardFrame(D,s,phase,t,res).buf),hash(hazardFrame(old,s,phase,t,res).buf),`${s.id}/${phase}/${t}/${res}`)
  for(const kind of KINDS)for(const state of STATES)for(const mode of['santa','party','antlers'])for(const dir of[-1,1]){
   const paint=D=>{const{w,en}=enemyFixture(kind,state,4,dir);w.res=res;w.season={redHats:mode};const img=canvas(400*res,248*res);D.drawEnemy(img.ctx,w,{},en,{});return hash(img.buf)}
   assert.equal(paint(D),paint(old),`${kind}/${state}/${mode}/${dir}/${res}`)
  }
 }
})
test('C28 full boards retain independent predecessor and successor scene pins',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const[key,pin]of Object.entries(pins.scenes)){
  const[level,res,ticks]=key.split('/').map(Number),opts={level,res,ticks,seed:3,page:res===2}
  assert.equal(hash(frame(S,old,P,opts).img.buf),pin.before,key+' before')
  assert.equal(hash(frame(S,D,P,opts).img.buf),pin.after,key+' after')
 }}finally{Math.random=random}
})

test('C28 restoring precisely three painters and four helpers recovers exact predecessor source',()=>{
 assert.equal(foeRoundEightSourceBefore(source),execFileSync('git',['show','087a129d4c2a18b3c37e4d1cc3dc63e051066f62:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
})
test('C28 deliberate historical scene transitions are independently reproducible',()=>{
 assert.deepEqual(foeRoundEightScenes(),JSON.parse(fs.readFileSync('test/fixtures/foe-round8-scenes.json','utf8')))
})
test('C28 review writer retains both scales and seasonal complete boards',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'foes8-'))
 try{roundEightReview(out,old,D);for(const res of[1,2]){
  for(const s of specs)for(const suffix of['compact','compare'])assert.ok(fs.statSync(path.join(out,`${s.id}-${suffix}-res${res}.png`)).size>100)
  for(const mode of['none','christmas','newyear'])assert.ok(fs.statSync(path.join(out,`round8-${mode}-charge-full-res${res}.png`)).size>1000)
 }}finally{fs.rmSync(out,{recursive:true,force:true})}
})

test('C28 reduced live frames hold completely and page poses use half-pixel refinement',()=>{
 for(const s of specs)for(const res of[1,2]){
  const paint=t=>{const{w,h}=hazardFixture(s,'fire',t);w.res=res;w.reducedMotion=true;const img=canvas(400*res,248*res);D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h);return hash(img.buf)}
  for(const t of[7,13,19])assert.equal(paint(t),paint(4),s.id+'/'+res)
 }
 for(const s of specs){
  let fine=false
  for(const phase of['charge','fire'])for(const t of[1,3,5]){
   const{w,h}=hazardFixture(s,phase,t);w.res=2
   const img=canvas(800,496),fill=img.ctx.fillRect.bind(img.ctx)
   img.ctx.fillRect=(...a)=>{fine ||= a.some(v=>Number.isInteger(v*2)&&!Number.isInteger(v));fill(...a)}
   D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h)
  }
  assert.ok(fine,s.id+' page refinement')
 }
})

test('C28 quiet idle still moves, and reduced idle holds',()=>{
 for(const s of specs)for(const res of[1,2]){
  const paint=(t,reducedMotion)=>{const{w,h}=hazardFixture(s,'idle',t);w.res=res;w.reducedMotion=reducedMotion;const img=canvas(400*res,248*res);D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h);return hash(img.buf)}
  assert.ok([24,60,90].some(t=>paint(t,false)!==paint(0,false)),s.id+'/'+res)
  for(const t of[24,60,90])assert.equal(paint(t,true),paint(0,true),s.id+'/'+res)
 }
})

test('C28 reduced-motion warnings retain phase progress',()=>{
 for(const s of specs)for(const res of[1,2]){
  const paint=t=>{const{w,h}=hazardFixture(s,'charge',t);w.res=res;w.reducedMotion=true;const img=canvas(400*res,248*res);D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h);return hash(img.buf)}
  assert.notEqual(paint(1),paint(s.charge-1),s.id+'/'+res)
 }
})
