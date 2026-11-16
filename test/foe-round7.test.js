import {foeRoundEightSourceBefore} from '../tools/foe-round8-reference.js'
import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {foeRoundSevenScenes} from '../tools/foe-round7-scenes.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {load,canvas,frame,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {hazardFrame,hazardFixture,hazardSequence,enemyFrame,enemyFixture,KINDS,STATES,roundSevenReview} from '../tools/foe-strips.js'
import {foeRoundSevenSourceBefore} from '../tools/foe-round7-reference.js'
const source=foeRoundEightSourceBefore(fs.readFileSync('public/agents/Draw.js','utf8')),D=renderer(source),old=renderer(foeRoundSevenSourceBefore(source)),S=load('Sim.js'),P=load('Palette.js')
const specs=S.HAZARDS.filter(s=>['geyser','frostjet','shark'].includes(s.id))
const hash=b=>createHash('sha256').update(b).digest('hex')
const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round7-pins.json','utf8'))
function corpus(D){
 const result={}
 for(const s of specs)for(const res of[1,2])for(const dir of[-1,1]){
  const h=createHash('sha256')
  for(const {phase,t}of hazardSequence(s))h.update(hazardFrame(D,s,phase,t,res,dir).buf)
  result[`${s.id}/${res}/${dir}`]=h.digest('hex')
 }
 return result
}
test('C27 independent predecessor and reviewed complete cycle digests',()=>{
 assert.deepEqual(corpus(old),pins.before);assert.deepEqual(corpus(D),pins.after)
})
function difference(a,b){let n=0;for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n}
test('C27 anticipation and recovery visibly change full-size native and page key poses',()=>{
 for(const s of specs)for(const res of[1,2])for(const[phase,t]of[['charge',Math.floor(s.charge/2)],['fire',3],['rest',3]])
  assert.ok(difference(hazardFrame(old,s,phase,t,res).buf,hazardFrame(D,s,phase,t,res).buf)>=6*res*res,`${s.id}/${phase}/${res}`)
})
test('C27 existing phase clocks connect release poses and settle by rest twelve',()=>{
 for(const res of[1,2]){
  const w={res},charge={winding:true,C:4,tall:24,wide:24,t:429,seed:40},fire={live:true,C:4,tall:24,wide:24,t:430,seed:40}
  assert.deepEqual(D.geyserPose(w,{t:29},charge),D.geyserPose(w,{t:0},fire))
  assert.deepEqual(D.frostJetPose(w,{t:21},charge),D.frostJetPose(w,{t:0},fire))
  assert.equal(D.sharkAttackPose(w,{t:29},charge).swim,D.sharkAttackPose(w,{t:0},fire).swim)
  for(const s of specs)if(s.id!=='shark')assert.equal(hash(hazardFrame(D,s,'rest',20,res).buf),hash(hazardFrame(D,s,'idle',20,res).buf))
 }
})
test('C27 reduced motion holds discharge travel and tail while retaining warning progress',()=>{
 for(const res of[1,2]){
  const w={res,reducedMotion:true},fire={live:true,C:4,tall:24,wide:24,t:430,seed:40}
  for(const fn of['geyserPose','frostJetPose','sharkAttackPose']){
   for(const t of[0,3,7,13])assert.deepEqual(D[fn](w,{t},fire),D[fn](w,{t:0},fire))
   assert.notDeepEqual(D[fn](w,{t:0},{...fire,live:false,winding:true}),D[fn](w,{t:18},{...fire,live:false,winding:true}))
  }
 }
})
function readonly(v){if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return v;return new Proxy(v,{get:(o,k)=>readonly(o[k]),set(){throw Error('world write')}})}
test('C27 pure bounded palette-only grid-aligned painters throughout every theme and cycle',()=>{
 const random=Math.random;Math.random=()=>{throw Error('drawing RNG')}
 try{for(const s of specs)for(const res of[1,2])for(const theme of Object.keys(THEMES))for(const{phase,t}of hazardSequence(s)){
  const{w,h}=hazardFixture(s,phase,t);w.res=res
  const img=canvas(400*res,248*res),fill=img.ctx.fillRect.bind(img.ctx),pal=P.build(themeOf(theme).theme,1),colours=new Set([...Object.values(pal),'#ffffff']);let n=0
  img.ctx.fillRect=(...a)=>{assert.ok(++n<250);assert.ok(a.every(Number.isFinite));assert.ok(a.every(v=>Number.isInteger(v*res)),`${s.id}/${phase}/${t}/${res}: ${a}`);assert.ok(a[2]>=0&&a[3]>=0);assert.ok(colours.has(img.ctx.fillStyle));fill(...a)}
  D.drawHazardKind(img.ctx,readonly(w),pal,readonly(h));assert.equal(img.ctx.globalAlpha,1)
 }}finally{Math.random=random}
})
test('C27 all other hazards and every enemy state with seasonal riders retain exact bytes',()=>{
 for(const res of[1,2]){
  for(const s of S.HAZARDS.filter(s=>!specs.includes(s)))for(const phase of['idle','charge','fire','rest'])for(const t of[0,3,12])
   assert.equal(hash(hazardFrame(D,s,phase,t,res).buf),hash(hazardFrame(old,s,phase,t,res).buf),`${s.id}/${phase}/${t}/${res}`)
  for(const kind of KINDS)for(const state of STATES)for(const mode of['santa','party','antlers'])for(const dir of[-1,1]){
   const paint=D=>{const{w,en}=enemyFixture(kind,state,4,dir);w.res=res;w.season={redHats:mode};const img=canvas(400*res,248*res);D.drawEnemy(img.ctx,w,{},en,{});return hash(img.buf)}
   assert.equal(paint(D),paint(old),`${kind}/${state}/${mode}/${dir}/${res}`)
  }
 }
})
test('C27 full boards retain independent predecessor and successor scene pins',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const[key,pin]of Object.entries(pins.scenes)){
  const[level,res,ticks]=key.split('/').map(Number),opts={level,res,ticks,seed:3,page:res===2}
  assert.equal(hash(frame(S,old,P,opts).img.buf),pin.before,key+' before')
  assert.equal(hash(frame(S,D,P,opts).img.buf),pin.after,key+' after')
 }}finally{Math.random=random}
})

test('C27 restoring precisely five painters and five helpers recovers exact predecessor source',()=>{
 assert.equal(foeRoundSevenSourceBefore(source),execFileSync('git',['show','0a817f23c0c323d43ebbe0e7936d4d4b544e31b4:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
})
test('C27 deliberate historical scene transitions are independently reproducible',()=>{
 assert.deepEqual(foeRoundSevenScenes(),JSON.parse(fs.readFileSync('test/fixtures/foe-round7-scenes.json','utf8')))
})
test('C27 review writer retains both scales and seasonal complete boards',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'foes5-'))
 try{roundSevenReview(out,old,D);for(const res of[1,2]){
  for(const s of specs)for(const suffix of['compact','compare'])assert.ok(fs.statSync(path.join(out,`${s.id}-${suffix}-res${res}.png`)).size>100)
  for(const mode of['none','christmas','newyear'])assert.ok(fs.statSync(path.join(out,`round7-${mode}-charge-full-res${res}.png`)).size>1000)
 }}finally{fs.rmSync(out,{recursive:true,force:true})}
})

test('C27 reduced live frames hold completely and page poses use half-pixel refinement',()=>{
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

test('C27 retains native idle steam and patrol while reduced idle holds still',()=>{
 for(const s of specs.filter(s=>s.id!=='airlock'))for(const t of[0,24,60,90])
  assert.equal(hash(hazardFrame(D,s,'idle',t,1).buf),hash(hazardFrame(old,s,'idle',t,1).buf),s.id+'/'+t)
 for(const s of specs.filter(s=>s.id!=='airlock'))for(const res of[1,2]){
  const paint=t=>{const{w,h}=hazardFixture(s,'idle',t);w.res=res;w.reducedMotion=true;const img=canvas(400*res,248*res);D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h);return hash(img.buf)}
  for(const t of[24,60,90])assert.equal(paint(t),paint(0),s.id+'/'+res)
 }
})
