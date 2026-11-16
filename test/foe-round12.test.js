import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {load,canvas,frame,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {hazardFrame,hazardFixture,hazardSequence,enemyFixture,KINDS,STATES,roundTwelveReview} from '../tools/foe-strips.js'
import {foeRoundTwelveSourceBefore} from '../tools/foe-round12-reference.js'
import {foeRoundTwelveScenes} from '../tools/foe-round12-scenes.js'
const source=fs.readFileSync('public/agents/Draw.js','utf8'),D=renderer(source),old=renderer(foeRoundTwelveSourceBefore(source)),S=load('Sim.js'),P=load('Palette.js')
const specs=S.HAZARDS.filter(s=>['sniper','grinder','sweeper'].includes(s.id))
const hash=b=>createHash('sha256').update(b).digest('hex')
const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round12-pins.json','utf8'))
function corpus(draw){
 const result={}
 for(const s of specs)for(const res of[1,2])for(const dir of[-1,1]){
  const h=createHash('sha256')
  for(const{phase,t}of hazardSequence(s))h.update(hazardFrame(draw,s,phase,t,res,dir).buf)
  result[`${s.id}/${res}/${dir}`]=h.digest('hex')
 }
 return result
}
function paint(s,phase,t,res,reducedMotion=false,clock){
 const{w,h}=hazardFixture(s,phase,t);w.res=res;w.reducedMotion=reducedMotion;if(clock!==undefined)w.ticks=clock
 const img=canvas(400*res,248*res);D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h);return hash(img.buf)
}
function difference(a,b){let n=0;for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n}
test('C32 independent predecessor and reviewed complete cycle digests',()=>{
 assert.deepEqual(corpus(old),pins.before);assert.deepEqual(corpus(D),pins.after)
})
test('C32 cocked, firing and recovering poses visibly change at full native and page size',()=>{
 for(const s of specs)for(const res of[1,2])for(const[phase,t]of[['charge',8],['fire',3],['rest',3]])
  assert.ok(difference(hazardFrame(old,s,phase,t,res).buf,hazardFrame(D,s,phase,t,res).buf)>=6*res*res,`${s.id}/${phase}/${res}`)
})
test('C32 held preparation, release and recovery follow the real clocks',()=>{
 for(const res of[1,2]){
  const w={res},base={wide:32,x0:0,C:4,t:400,show:true},charge={...base,winding:true},fire={...base,live:true},rest={...base,cool:1}
  for(const t of[12,24,43])assert.equal(D.mountedSniperSlide(w,{t},charge),4)
  assert.equal(D.mountedSniperSlide(w,{t:0},fire),1)
  assert.equal(D.mountedSniperSlide(w,{t:6},fire),4)
  assert.equal(D.mountedSniperSlide(w,{t:0},rest),4)
  for(const t of[10,18,25])assert.equal(D.sweeperCarriage(w,{t},charge).drop,4)
  assert.deepEqual(D.sweeperCarriage(w,{t:25},charge),D.sweeperCarriage(w,{t:0},fire))
  assert.deepEqual(D.sweeperCarriage(w,{t:33},fire),D.sweeperCarriage(w,{t:0},rest))
  for(const t of[8,16,23])assert.equal(D.grinderRollerPose(w,{t},charge).lift,4)
  assert.deepEqual(D.grinderRollerPose(w,{t:23},charge),D.grinderRollerPose(w,{t:0},fire))
  assert.deepEqual(D.grinderRollerPose(w,{t:29},fire),D.grinderRollerPose(w,{t:0},rest))
  for(const name of['mountedSniperSlide','sweeperCarriage','grinderRollerPose']){
   const pose=D[name](w,{t:12},{...base,cool:0})
   assert.deepEqual(pose,D[name](w,{t:0},base))
  }
 }
})
function readonly(v){if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return v;return new Proxy(v,{get:(o,k)=>readonly(o[k]),set(){throw Error('world write')}})}
test('C32 every theme and cycle stays read-only, RNG-free, palette-only, bounded and on the native grid',()=>{
 const random=Math.random;Math.random=()=>{throw Error('drawing RNG')}
 try{for(const s of specs)for(const res of[1,2])for(const theme of Object.keys(THEMES))for(const{phase,t}of hazardSequence(s)){
  const{w,h}=hazardFixture(s,phase,t);w.res=res
  const img=canvas(400*res,248*res),fill=img.ctx.fillRect.bind(img.ctx),pal=P.build(themeOf(theme).theme,1),colours=new Set(Object.values(pal));let n=0
  img.ctx.fillRect=(...a)=>{assert.ok(++n<250);assert.ok(a.every(Number.isFinite));assert.ok(a.every(v=>Number.isInteger(v*res)),`${s.id}/${phase}/${t}/${res}: ${a}`);assert.ok(a[2]>=0&&a[3]>=0);assert.ok(colours.has(img.ctx.fillStyle));fill(...a)}
  D.drawHazardKind(img.ctx,readonly(w),pal,readonly(h));assert.equal(img.ctx.globalAlpha,1)
 }}finally{Math.random=random}
})
test('C32 every other hazard and all hostile states with Santa, party and antler riders stay exact',()=>{
 for(const res of[1,2]){
  for(const s of S.HAZARDS.filter(s=>!specs.includes(s)))for(const phase of['idle','charge','fire','rest'])for(const t of[0,3,12])
   assert.equal(hash(hazardFrame(D,s,phase,t,res).buf),hash(hazardFrame(old,s,phase,t,res).buf),`${s.id}/${phase}/${t}/${res}`)
  for(const kind of KINDS)for(const state of STATES)for(const mode of['santa','party','antlers'])for(const dir of[-1,1]){
   const actor=draw=>{const{w,en}=enemyFixture(kind,state,4,dir);w.res=res;w.season={redHats:mode};const img=canvas(400*res,248*res);draw.drawEnemy(img.ctx,w,{},en,{});return hash(img.buf)}
   assert.equal(actor(D),actor(old),`${kind}/${state}/${mode}/${dir}/${res}`)
  }
 }
})
test('C32 independent ordinary full-board before and after pins span every biome and scale',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const[key,pin]of Object.entries(pins.scenes)){
  const[level,res,ticks]=key.split('/').map(Number),opts={level,res,ticks,seed:3,page:res===2}
  assert.equal(hash(frame(S,old,P,opts).img.buf),pin.before,key+' before')
  assert.equal(hash(frame(S,D,P,opts).img.buf),pin.after,key+' after')
 }}finally{Math.random=random}
})
test('C32 restoring exactly three painters and removing six helpers recovers the complete predecessor',()=>{
 assert.equal(foeRoundTwelveSourceBefore(source),execFileSync('git',['show','3310a0986421a92f1007154eed93028ac2654d15:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
})
test('C32 explicit historical scene transitions reproduce independently',()=>{
 assert.deepEqual(foeRoundTwelveScenes(),JSON.parse(fs.readFileSync('test/fixtures/foe-round12-scenes.json','utf8')))
})
test('C32 review writer retains consecutive cycles, keys and complete seasonal boards at both scales',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'foes12-'))
 try{roundTwelveReview(out,old,D);for(const res of[1,2]){
  for(const s of specs)for(const suffix of['compact','compare'])assert.ok(fs.statSync(path.join(out,`${s.id}-${suffix}-res${res}.png`)).size>100)
  for(const mode of['none','christmas','newyear'])assert.ok(fs.statSync(path.join(out,`round12-${mode}-charge-full-res${res}.png`)).size>1000)
 }}finally{fs.rmSync(out,{recursive:true,force:true})}
})
test('C32 reduced live and idle secondary motion holds completely',()=>{
 for(const s of specs)for(const res of[1,2]){
  for(const t of[5,7,8])assert.equal(paint(s,'fire',t,res,true,404),paint(s,'fire',4,res,true,404),s.id+'/'+res)
  for(const t of[24,60,90])assert.equal(paint(s,'idle',t,res,true),paint(s,'idle',0,res,true),s.id+'/'+res)
 }
})
test('C32 moving page fittings refine the half-pixel grid',()=>{
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
test('C32 reduced-motion warnings retain persistent, visibly progressing poses',()=>{
 for(const s of specs)for(const res of[1,2])assert.notEqual(paint(s,'charge',1,res,true),paint(s,'charge',s.charge-1,res,true),s.id+'/'+res)
})


test('C32 mounted sniper sight joins the moving muzzle and actual target on every charge/fire tick',()=>{
 const spec=specs.find(s=>s.id==='sniper')
 for(const res of[1,2])for(const phase of['charge','fire'])for(let t=0;t<spec[phase];t++){
  const {w,h}=hazardFixture(spec,phase,t);w.res=res
  const calls=[],img=canvas(800,496)
  img.ctx.fillRect=(...a)=>{assert.ok(calls.length<250);calls.push(a)}
  const g={C:4,hot:'#fff',live:phase==='fire'},muzzle=175,top=105
  D.drawMountedSniperSight(img.ctx,{...w,reducedMotion:true},h,g,muzzle,top)
  assert.deepEqual(calls[0],[muzzle,top,g.live?2:1,g.live?2:1])
  if(g.live)assert.deepEqual(calls.at(-1),[h.lineTo*4,h.lineY*4,2,2])
 }
})
test('C32 opposed rollers and held page carriages retain readable motion at native scale',()=>{
 for(const s of specs)for(const res of[1,2]){
  const values=new Set(Array.from({length:s.fire},(_,t)=>paint(s,'fire',t,res)))
  assert.ok(values.size>=4,s.id+'/'+res)
 }
})
test('C32 sweeper beam tracks the exact catchSweep world clock, including reduced motion',()=>{
 const spec=specs.find(s=>s.id==='sweeper')
 for(const res of[1,2])for(const reducedMotion of[false,true])for(let t=0;t<spec.fire;t++){
  const {w,h}=hazardFixture(spec,'fire',t);w.res=res;w.reducedMotion=reducedMotion
  const pal=P.build(themeOf('tokyo-night').theme,1),img=canvas(800,496),calls=[]
  img.ctx.fillRect=(...a)=>{assert.ok(calls.length<150);if(img.ctx.fillStyle===pal.fireHot)calls.push(a)}
  D.drawHazardKind(img.ctx,w,pal,h)
  const sweepX=(h.zx0+(h.zx1-h.zx0)*(0.5+0.5*Math.sin(w.ticks*0.05)))*4
  const floor=calls.find(a=>a[1]===(h.zy1+1)*4-1)
  assert.ok(floor,'full beam reaches floor at fire zero')
  assert.equal(floor[0],Math.round(sweepX))
 }
})
