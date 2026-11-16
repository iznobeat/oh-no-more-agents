import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {createHash} from 'node:crypto'
import {load,canvas,frame,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {hazardFrame,hazardFixture,hazardSequence,enemyFixture,KINDS,STATES,roundThirteenReview} from '../tools/foe-strips.js'
import {foeRoundThirteenSourceBefore} from '../tools/foe-round13-reference.js'
import {foeRoundThirteenScenes} from '../tools/foe-round13-scenes.js'
const source=fs.readFileSync('public/agents/Draw.js','utf8'),D=renderer(source),old=renderer(foeRoundThirteenSourceBefore(source)),S=load('Sim.js'),P=load('Palette.js')
const specs=S.HAZARDS.filter(s=>['gun','sentry','tripwire'].includes(s.id))
const hash=b=>createHash('sha256').update(b).digest('hex')
const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round13-pins.json','utf8'))
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
test('C33 independent predecessor and reviewed complete cycle digests',()=>{
 assert.deepEqual(corpus(old),pins.before);assert.deepEqual(corpus(D),pins.after)
})
test('C33 cocked, firing and recovering poses visibly change at full native and page size',()=>{
 for(const s of specs)for(const res of[1,2])for(const[phase,t]of[['charge',8],['fire',3],['rest',3]])
  assert.ok(difference(hazardFrame(old,s,phase,t,res).buf,hazardFrame(D,s,phase,t,res).buf)>=6*res*res,`${s.id}/${phase}/${res}`)
})
test('C33 preparation holds and returns on existing phase clocks',()=>{
 for(const res of[1,2]){
  const w={res},base={t:400},charge={winding:true},fire={live:true},rest={cool:1}
  for(const[name,peak,at,last]of[['sprayerBarrelDrop',4,7,15],['sentryShutterOpen',3,12,33],['tripwireTension',4,8,19]]){
   assert.equal(D[name](w,{t:0},charge),0)
   for(const t of[at,last])assert.equal(D[name](w,{t},charge),peak)
   assert.equal(D[name]({...w,reducedMotion:true},{t:0},fire),peak)
   assert.equal(D[name](w,{t:0},rest),peak)
   assert.equal(D[name](w,{t:12},base),0)
  }
 }
})
function readonly(v){if(!v||typeof v!=='object'||ArrayBuffer.isView(v))return v;return new Proxy(v,{get:(o,k)=>readonly(o[k]),set(){throw Error('world write')}})}
test('C33 every theme and cycle stays read-only, RNG-free, palette-only, bounded and on the native grid',()=>{
 const random=Math.random;Math.random=()=>{throw Error('drawing RNG')}
 try{for(const s of specs)for(const res of[1,2])for(const theme of Object.keys(THEMES))for(const{phase,t}of hazardSequence(s)){
  const{w,h}=hazardFixture(s,phase,t);w.res=res
  const img=canvas(400*res,248*res),fill=img.ctx.fillRect.bind(img.ctx),pal=P.build(themeOf(theme).theme,1),colours=new Set([...Object.values(pal),'#1c1c22','#e9edf7','#ffffff','#ff5268','#5c1424','#5dffa0','#1f4a33']);let n=0
  img.ctx.fillRect=(...a)=>{assert.ok(++n<250);assert.ok(a.every(Number.isFinite));assert.ok(a.every(v=>Number.isInteger(v*res)),`${s.id}/${phase}/${t}/${res}: ${a}`);assert.ok(a[2]>=0&&a[3]>=0);assert.ok(colours.has(img.ctx.fillStyle));fill(...a)}
  D.drawHazardKind(img.ctx,readonly(w),pal,readonly(h));assert.equal(img.ctx.globalAlpha,1)
 }}finally{Math.random=random}
})
test('C33 every other hazard and all hostile states with Santa, party and antler riders stay exact',()=>{
 for(const res of[1,2]){
  for(const s of S.HAZARDS.filter(s=>!specs.includes(s)))for(const phase of['idle','charge','fire','rest'])for(const t of[0,3,12])
   assert.equal(hash(hazardFrame(D,s,phase,t,res).buf),hash(hazardFrame(old,s,phase,t,res).buf),`${s.id}/${phase}/${t}/${res}`)
  for(const kind of KINDS)for(const state of STATES)for(const mode of['santa','party','antlers'])for(const dir of[-1,1]){
   const actor=draw=>{const{w,en}=enemyFixture(kind,state,4,dir);w.res=res;w.season={redHats:mode};const img=canvas(400*res,248*res);draw.drawEnemy(img.ctx,w,{},en,{});return hash(img.buf)}
   assert.equal(actor(D),actor(old),`${kind}/${state}/${mode}/${dir}/${res}`)
  }
 }
})
test('C33 independent ordinary full-board before and after pins span every biome and scale',()=>{
 const random=Math.random;Math.random=()=>0.5
 try{for(const[key,pin]of Object.entries(pins.scenes)){
  const[level,res,ticks]=key.split('/').map(Number),opts={level,res,ticks,seed:3,page:res===2}
  assert.equal(hash(frame(S,old,P,opts).img.buf),pin.before,key+' before')
  assert.equal(hash(frame(S,D,P,opts).img.buf),pin.after,key+' after')
 }}finally{Math.random=random}
})
test('C33 restoring exactly three painters and removing six helpers recovers the complete predecessor',()=>{
 assert.equal(foeRoundThirteenSourceBefore(source),execFileSync('git',['show','abd55d1a61a798af3cecd8444ac6a81cbc5e359f:public/agents/Draw.js'],{maxBuffer:4<<20}).toString())
})
test('C33 explicit historical scene transitions reproduce independently',()=>{
 assert.deepEqual(foeRoundThirteenScenes(),JSON.parse(fs.readFileSync('test/fixtures/foe-round13-scenes.json','utf8')))
})
test('C33 review writer retains consecutive cycles, keys and complete seasonal boards at both scales',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'foes13-'))
 try{roundThirteenReview(out,old,D);for(const res of[1,2]){
  for(const s of specs)for(const suffix of['compact','compare'])assert.ok(fs.statSync(path.join(out,`${s.id}-${suffix}-res${res}.png`)).size>100)
  for(const mode of['none','christmas','newyear'])assert.ok(fs.statSync(path.join(out,`round13-${mode}-charge-full-res${res}.png`)).size>1000)
 }}finally{fs.rmSync(out,{recursive:true,force:true})}
})
test('C33 reduced live and idle secondary motion holds completely',()=>{
 for(const s of specs)for(const res of[1,2]){
  for(const t of[5,7,8])assert.equal(paint(s,'fire',t,res,true,404),paint(s,'fire',4,res,true,404),s.id+'/'+res)
  for(const t of[24,60,90])assert.equal(paint(s,'idle',t,res,true),paint(s,'idle',0,res,true),s.id+'/'+res)
 }
})
test('C33 moving page fittings refine the half-pixel grid',()=>{
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
test('C33 reduced-motion warnings retain persistent, visibly progressing poses',()=>{
 for(const s of specs)for(const res of[1,2])assert.notEqual(paint(s,'charge',1,res,true),paint(s,'charge',s.charge-1,res,true),s.id+'/'+res)
})


test('C33 sentry beam uses catchFired origin and full reach on every live tick',()=>{
 const spec=specs.find(s=>s.id==='sentry')
 for(const res of[1,2])for(const dir of[-1,1])for(const reducedMotion of[false,true])for(let t=0;t<spec.fire;t++){
  const{w,h}=hazardFixture(spec,'fire',t,dir);w.res=res;w.reducedMotion=reducedMotion
  const img=canvas(800,496),calls=[];img.ctx.fillRect=(...a)=>{assert.ok(calls.length<100);calls.push(a)}
  const g={C:4,hot:'#fff',live:true,y0:100,cx:166}
  D.drawSentryBeam(img.ctx,w,{},h,g)
  const start=(h.zx0+h.zx1)/2*4,end=start+spec.reach*4*dir
  assert.deepEqual(calls[0],[Math.min(start,end),104,Math.abs(end-start)+1,2])
 }
})
test('C33 wire retains its full fixed reach throughout every phase',()=>{
 const spec=specs.find(s=>s.id==='tripwire')
 for(const res of[1,2])for(const{phase,t}of hazardSequence(spec)){
  const{w,h}=hazardFixture(spec,phase,t);w.res=res
  const img=canvas(800,496),calls=[],pal=P.build(themeOf('tokyo-night').theme,1)
  img.ctx.fillRect=(...a)=>{assert.ok(calls.length<100);calls.push(a)}
  D.drawHazardKind(img.ctx,w,pal,h)
  assert.ok(calls.some(a=>a[0]===h.zx0*4&&a[1]===(h.zy1+1)*4-7&&a[2]===spec.w*4&&a[3]===1))
 }
})
