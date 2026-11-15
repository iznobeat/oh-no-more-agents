import {millSourceBefore} from '../tools/mill-art.js'
import {millSuccessor} from '../tools/mill-reference.js'
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,themeOf,THEMES,frame} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {hazardFrame,hazardFixture,hazardSequence,enemyFixture,KINDS,STATES,ROUND_THREE} from '../tools/foe-strips.js'
import {restoreFoeRoundThree} from '../tools/foe-reference.js'
const base='dc0a9a6f30b7e37ab9b69a3acff10ba865a292a3'
const beforeSource=execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
const source=fs.readFileSync('public/agents/Draw.js','utf8')
const old=renderer(beforeSource),D=load('Draw.js'),S=load('Sim.js'),P=load('Palette.js')
const hash=b=>createHash('sha256').update(b).digest('hex')
const specs=S.HAZARDS.filter(s=>ROUND_THREE.includes(s.id))
export function roundThreeCorpus(D){
 const pins={}
 for(const spec of specs)for(const res of [1,2])for(const dir of [-1,1]){
  const sum=createHash('sha256')
  for(const {phase,t}of hazardSequence(spec))sum.update(hazardFrame(D,spec,phase,t,res,dir).buf)
  pins[`${spec.id}/${res}/${dir}`]=sum.digest('hex')
 }
 return pins
}
test('C14 historical and reviewed complete cycles retain exact independent digests',()=>{
 const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round3-pins.json','utf8'))
 assert.deepEqual(roundThreeCorpus(old),pins.before)
 assert.deepEqual(roundThreeCorpus(D),pins.after)
})
function difference(a,b){let n=0;for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n}
test('C14 pullback, recoil and recovery visibly change native keys and refine page pixels',()=>{
 for(const spec of specs)for(const res of [1,2])for(const [phase,t]of [['charge',Math.floor(spec.charge/2)],['fire',3],['rest',3]]){
  assert.ok(difference(hazardFrame(old,spec,phase,t,res).buf,hazardFrame(D,spec,phase,t,res).buf)>=6*res*res,`${spec.id}/${phase}/${res}`)
 }
})
test('C14 machines and bat join at real Sim phase boundaries and settle by rest twelve',()=>{
 for(const res of [1,2]){
  const w={res},g={winding:true,cool:0,live:false}
  for(const id of ['piston','stamper']){
   const spec=specs.find(s=>s.id===id),full=id==='piston'?spec.w*4-8:spec.h*4-15,release=id==='piston'?5:7
   const pose=(phase,t)=>D.ramTravel(w,{t},{...g,winding:phase==='charge',live:phase==='fire',cool:phase==='rest'?Math.max(0,1-t/12):0},full,spec.charge,release)
   assert.equal(pose('charge',spec.charge-1),full)
   assert.equal(pose('charge',spec.charge-1),pose('fire',0))
   assert.equal(pose('fire',spec.fire-1),pose('rest',0))
   assert.equal(pose('charge',Math.floor(spec.charge/2)),-3)
   const fall=Array.from({length:release+1},(_,t)=>pose('charge',spec.charge-1-release+t))
   assert.ok(fall.every((v,i)=>!i||v>=fall[i-1]))
   assert.ok(fall.at(-1)-fall.at(-2)>fall[1]-fall[0],'release accelerates')
   assert.equal(pose('rest',12),0)
  }
  assert.deepEqual(D.echoBatPose(w,{t:23},g),D.echoBatPose(w,{t:0},{live:true}))
  assert.deepEqual(D.echoBatPose(w,{t:17},{live:true}),D.echoBatPose(w,{t:0},{cool:1}))
  for(const spec of specs)assert.equal(hash(hazardFrame(D,spec,'rest',20,res).buf),hash(hazardFrame(D,spec,'idle',20,res).buf),spec.id)
 }
})
test('C14 reduced motion holds live recoil, bat wings and rings while charge remains legible',()=>{
 for(const res of [1,2]){
  const w={res,reducedMotion:true}
  for(const t of [0,2,6,17]){
   assert.equal(D.ramTravel(w,{t},{live:true},12,18,5),12)
   assert.deepEqual(D.echoBatPose(w,{t},{live:true}),{wing:10,lift:0,jaw:3})
   const paint=t=>{const img=canvas(100,60);D.drawEchoRings(img.ctx,w,{fireHot:'#ffffff'},{t,reach:9},{show:true,live:true,C:4,cx:50,hot:'#ffffff'},10);return hash(img.buf)}
   assert.equal(paint(t),paint(0))
  }
  const extents=[]
  D.drawEchoRings({fillRect(x,y,width){extents.push(x,x+width)}},w,{}, {t:0,reach:9},{show:true,live:true,C:4,cx:50,hot:'#ffffff'},10)
  assert.ok(Math.min(...extents)<=20&&Math.max(...extents)>=80,'held screech still spans both dangerous sides')
  assert.notEqual(D.ramTravel(w,{t:0},{winding:true},12,18,5),D.ramTravel(w,{t:9},{winding:true},12,18,5))
  assert.notDeepEqual(D.echoBatPose(w,{t:0},{winding:true}),D.echoBatPose(w,{t:12},{winding:true}))
 }
})
function readonly(value){
 if(!value||typeof value!=='object'||ArrayBuffer.isView(value))return value
 return new Proxy(value,{get:(o,k)=>readonly(o[k]),set(){throw Error('drawing wrote world')}})
}
test('C14 painters stay pure, finite, bounded and aligned in every theme, cycle and facing',()=>{
 const random=Math.random
 try{
  Math.random=()=>{throw Error('drawing RNG')}
  for(const spec of specs)for(const res of [1,2])for(const dir of [-1,1])for(const theme of Object.keys(THEMES))for(const {phase,t}of hazardSequence(spec)){
   const {w,h}=hazardFixture(spec,phase,t,dir);w.res=res
   const img=canvas(400*res,248*res),fill=img.ctx.fillRect.bind(img.ctx);let n=0
   img.ctx.fillRect=(...r)=>{assert.ok(++n<200);assert.ok(r.every(Number.isFinite));assert.ok(r.every(v=>Number.isInteger(v*res)),`${spec.id}/${phase}/${t}/${res}: ${r}`);assert.ok(r[2]>=0&&r[3]>=0);fill(...r)}
   D.drawHazardKind(img.ctx,readonly(w),P.build(themeOf(theme).theme,1),readonly(h));assert.equal(img.ctx.globalAlpha,1)
  }
 }finally{Math.random=random}
})
test('C14 restoring exactly the three painters recovers complete baseline boards',()=>{
 const R=renderer(restoreFoeRoundThree(source,beforeSource)),random=Math.random
 try { Math.random=()=>0.5
 for(let level=1;level<=S.BIOMES.length;level++){
  const w=S.generate(level,0,3)
  for(let t=0;t<=400;t++){
   if(t)S.step(w)
   if(![120,350,400].includes(t))continue
   for(const res of [1,2]){
    const draw=D=>{w.res=res;const img=canvas(400*res,248*res),pal=P.build(themeOf('tokyo-night').theme,level);D.drawTerrain(img.ctx,w,pal);D.drawActors(img.ctx,w,pal,{});return hash(img.buf)}
    assert.equal(draw(R),draw(old),`${level}/${t}/${res}`)
   }
  }
 }
 }finally{Math.random=random}
})
test('C14 every excluded hazard and hostile state retains exact pixels with seasonal riders',()=>{
 for(const res of [1,2]){
  for(const spec of S.HAZARDS.filter(s=>!ROUND_THREE.includes(s.id)))for(const phase of ['idle','charge','fire','rest'])for(const t of [0,3,12])
   assert.equal(hash(hazardFrame(D,spec,phase,t,res).buf),hash(hazardFrame(old,spec,phase,t,res).buf),`${spec.id}/${phase}/${t}/${res}`)
  for(const kind of KINDS)for(const state of STATES)for(const mode of ['santa','party','antlers'])for(const dir of [-1,1]){
   const paint=D=>{const {w,en}=enemyFixture(kind,state,4,dir);w.res=res;w.season={redHats:mode};const img=canvas(400*res,248*res);D.drawEnemy(img.ctx,w,{},en,{});return hash(img.buf)}
   assert.equal(paint(D),paint(old),`${kind}/${state}/${mode}/${dir}/${res}`)
  }
 }
})

test('C14 changed ordinary full frames retain their exact before and after scene ledger',()=>{
 const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round3-scenes.json','utf8')),random=Math.random,c14=renderer(millSourceBefore(source))
 try {Math.random=()=>0.5
 for(const [key,pin]of Object.entries(pins.scenes)){
  const [level,res,ticks]=key.split('/').map(Number)
  const draw=R=>hash(frame(S,R,P,{level,res,ticks,seed:3,theme:'tokyo-night',page:res===2}).img.buf)
  assert.equal(draw(old),pin.before,key+' historical');assert.equal(draw(c14),pin.after,key+' reviewed C14');assert.equal(draw(D),millSuccessor(pin.after),key+' reviewed C19')
 }
 }finally{Math.random=random}
})
