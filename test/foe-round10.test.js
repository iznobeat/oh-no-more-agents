import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {load,canvas,frame,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {hazardFrame,hazardFixture,hazardSequence,enemyFixture,KINDS,STATES,roundTenReview} from '../tools/foe-strips.js'
import {foeRoundTenSourceBefore} from '../tools/foe-round10-reference.js'
import {foeRoundTenScenes} from '../tools/foe-round10-scenes.js'
const source=fs.readFileSync('public/agents/Draw.js','utf8'),D=renderer(source),old=renderer(foeRoundTenSourceBefore(source)),S=load('Sim.js'),P=load('Palette.js')
const specs=S.HAZARDS.filter(s=>['turret','darts','flame'].includes(s.id))
const hash=b=>createHash('sha256').update(b).digest('hex')
const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round10-pins.json','utf8'))
function corpus(draw){
 const result={}
 for(const s of specs)for(const res of[1,2])for(const dir of[-1,1]){
  const h=createHash('sha256')
  for(const{phase,t}of hazardSequence(s))h.update(hazardFrame(draw,s,phase,t,res,dir).buf)
  result[`${s.id}/${res}/${dir}`]=h.digest('hex')
 }
 return result
}
function paint(s,phase,t,res,reducedMotion=false){
 const{w,h}=hazardFixture(s,phase,t);w.res=res;w.reducedMotion=reducedMotion
 const img=canvas(400*res,248*res);D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h);return hash(img.buf)
}
function difference(a,b){let n=0;for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n}
test('C30 independent predecessor and reviewed complete cycle digests',()=>{
 assert.deepEqual(corpus(old),pins.before);assert.deepEqual(corpus(D),pins.after)
})
test('C30 cocked, firing and recovering poses visibly change at full native and page size',()=>{
 for(const s of specs)for(const res of[1,2])for(const[phase,t]of[['charge',8],['fire',3],['rest',3]])
  assert.ok(difference(hazardFrame(old,s,phase,t,res).buf,hazardFrame(D,s,phase,t,res).buf)>=6*res*res,`${s.id}/${phase}/${res}`)
})
test('C30 cock, hold, release and recovery use the real phase clocks with continuous mechanical joins',()=>{
 for(const res of[1,2]){
  const w={res},charge={winding:true},fire={live:true,tall:24},rest={cool:1,tall:24}
  for(const i of[0,1]){
   assert.equal(D.twinTurretDrop(w,{t:17},charge,i),D.twinTurretDrop(w,{t:0},fire,i))
   assert.equal(D.twinTurretDrop(w,{t:19},fire,i),D.twinTurretDrop(w,{t:0},rest,i))
   for(const t of[6,9,12])assert.equal(D.twinTurretDrop(w,{t},charge,i),-2)
  }
  assert.equal(D.twinTurretSpread(w,{t:7},charge),3)
  assert.equal(D.twinTurretSpread(w,{t:12},charge),3)
  assert.equal(D.twinTurretSpread(w,{t:17},charge),0)
  assert.equal(D.dartRackLength(w,{t:8},charge),6)
  assert.equal(D.dartRackLength(w,{t:17},charge),D.dartRackLength(w,{t:0},fire))
  assert.equal(D.dartRackLength(w,{t:9},fire),D.dartRackLength(w,{t:0},rest))
  assert.deepEqual(D.flameValvePose(w,{t:25},fire),D.flameValvePose(w,{t:0},rest))
  assert.equal(D.flameValvePose(w,{t:29},{...charge,tall:24}).open,3)
  for(const s of specs)assert.equal(paint(s,'rest',20,res),paint(s,'idle',20,res))
 }
})
function readonly(v){if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return v;return new Proxy(v,{get:(o,k)=>readonly(o[k]),set(){throw Error('world write')}})}
test('C30 every theme and cycle stays read-only, RNG-free, palette-only, bounded and on the native grid',()=>{
 const random=Math.random;Math.random=()=>{throw Error('drawing RNG')}
 try{for(const s of specs)for(const res of[1,2])for(const theme of Object.keys(THEMES))for(const{phase,t}of hazardSequence(s)){
  const{w,h}=hazardFixture(s,phase,t);w.res=res
  const img=canvas(400*res,248*res),fill=img.ctx.fillRect.bind(img.ctx),pal=P.build(themeOf(theme).theme,1),colours=new Set(Object.values(pal));let n=0
  img.ctx.fillRect=(...a)=>{assert.ok(++n<250);assert.ok(a.every(Number.isFinite));assert.ok(a.every(v=>Number.isInteger(v*res)),`${s.id}/${phase}/${t}/${res}: ${a}`);assert.ok(a[2]>=0&&a[3]>=0);assert.ok(colours.has(img.ctx.fillStyle));fill(...a)}
  D.drawHazardKind(img.ctx,readonly(w),pal,readonly(h));assert.equal(img.ctx.globalAlpha,1)
 }}finally{Math.random=random}
})
test('C30 every other hazard and all hostile states with Santa, party and antler riders stay exact',()=>{
 for(const res of[1,2]){
  for(const s of S.HAZARDS.filter(s=>!specs.includes(s)))for(const phase of['idle','charge','fire','rest'])for(const t of[0,3,12])
   assert.equal(hash(hazardFrame(D,s,phase,t,res).buf),hash(hazardFrame(old,s,phase,t,res).buf),`${s.id}/${phase}/${t}/${res}`)
  for(const kind of KINDS)for(const state of STATES)for(const mode of['santa','party','antlers'])for(const dir of[-1,1]){
   const actor=draw=>{const{w,en}=enemyFixture(kind,state,4,dir);w.res=res;w.season={redHats:mode};const img=canvas(400*res,248*res);draw.drawEnemy(img.ctx,w,{},en,{});return hash(img.buf)}
   assert.equal(actor(D),actor(old),`${kind}/${state}/${mode}/${dir}/${res}`)
  }
 }
})
test('C30 independent ordinary full-board before and after pins span every biome and scale',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const[key,pin]of Object.entries(pins.scenes)){
  const[level,res,ticks]=key.split('/').map(Number),opts={level,res,ticks,seed:3,page:res===2}
  assert.equal(hash(frame(S,old,P,opts).img.buf),pin.before,key+' before')
  assert.equal(hash(frame(S,D,P,opts).img.buf),pin.after,key+' after')
 }}finally{Math.random=random}
})
test('C30 restoring exactly three painters and removing seven helpers recovers the complete predecessor',()=>{
 assert.equal(foeRoundTenSourceBefore(source),execFileSync('git',['show','71ab84a324a134b0251aa916b5312ee88dc9f990:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
})
test('C30 explicit historical scene transitions reproduce independently',()=>{
 assert.deepEqual(foeRoundTenScenes(),JSON.parse(fs.readFileSync('test/fixtures/foe-round10-scenes.json','utf8')))
})
test('C30 review writer retains consecutive cycles, keys and complete seasonal boards at both scales',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'foes10-'))
 try{roundTenReview(out,old,D);for(const res of[1,2]){
  for(const s of specs)for(const suffix of['compact','compare'])assert.ok(fs.statSync(path.join(out,`${s.id}-${suffix}-res${res}.png`)).size>100)
  for(const mode of['none','christmas','newyear'])assert.ok(fs.statSync(path.join(out,`round10-${mode}-charge-full-res${res}.png`)).size>1000)
 }}finally{fs.rmSync(out,{recursive:true,force:true})}
})
test('C30 reduced live and idle secondary motion holds completely',()=>{
 for(const s of specs)for(const res of[1,2]){
  for(const t of[5,7,8])assert.equal(paint(s,'fire',t,res,true),paint(s,'fire',4,res,true),s.id+'/'+res)
  for(const t of[24,60,90])assert.equal(paint(s,'idle',t,res,true),paint(s,'idle',0,res,true),s.id+'/'+res)
 }
})
test('C30 moving page fittings refine the half-pixel grid',()=>{
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
test('C30 reduced-motion warnings retain persistent, visibly progressing poses',()=>{
 for(const s of specs)for(const res of[1,2])assert.notEqual(paint(s,'charge',1,res,true),paint(s,'charge',s.charge-1,res,true),s.id+'/'+res)
})


test('C30 complete dart arrowheads stay within eleven cells of the outlet in both facings',()=>{
 for(const res of[1,2])for(const dir of[-1,1])for(let t=0;t<10;t++)for(let row=0;row<3;row++){
  const img=canvas(128*res,56*res),pal=P.build(themeOf('tokyo-night').theme,1),outlet=dir>0?5:0,mouth=outlet+6*dir
  let calls=0
  img.ctx.fillRect=(x,y,width,height)=>{
   assert.ok(++calls<=3);assert.ok(x>=outlet-44&&x+width<=outlet+44,`${res}/${dir}/${t}/${row}: ${x},${width}`)
   assert.ok(y>=2+row*3&&y+height<=5+row*3)
  }
  D.drawDartVolley(img.ctx,{res},pal,{t,dir},{C:4,y0:0,hot:pal.fireHot},mouth,row)
 }
})


test('C30 quiet lamps and the flame pilot still breathe without reduced motion',()=>{
 for(const s of specs)for(const res of[1,2])assert.ok([24,60,90].some(t=>paint(s,'idle',t,res)!==paint(s,'idle',0,res)),s.id+'/'+res)
})
