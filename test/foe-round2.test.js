import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {hazardFrame,hazardFixture,hazardSequence,enemyFixture,KINDS,STATES,ROUND_TWO} from '../tools/foe-strips.js'
import {restoreFoeRoundTwo} from '../tools/foe-reference.js'
const base='f252faa2c0f8d22dec66208580177bfccaf29036'
const beforeSource=execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
const source=fs.readFileSync('public/agents/Draw.js','utf8')
const old=renderer(beforeSource),D=load('Draw.js'),S=load('Sim.js'),P=load('Palette.js')
const hash=b=>createHash('sha256').update(b).digest('hex')
const specs=S.HAZARDS.filter(s=>ROUND_TWO.includes(s.id))
export function roundTwoCorpus(D){
 const pins={}
 for(const spec of specs)for(const res of [1,2])for(const dir of [-1,1]){
  const sum=createHash('sha256')
  for(const {phase,t}of hazardSequence(spec))sum.update(hazardFrame(D,spec,phase,t,res,dir).buf)
  pins[`${spec.id}/${res}/${dir}`]=sum.digest('hex')
 }
 return pins
}
test('C13 exact complete hazard cycles preserve historical and reviewed digests',()=>{
 const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-round2-pins.json','utf8'))
 assert.deepEqual(roundTwoCorpus(old),pins.before)
 assert.deepEqual(roundTwoCorpus(D),pins.after)
})
function difference(a,b){let n=0;for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n}
test('C13 new key poses change enough native pixels to read at full size',()=>{
 for(const spec of specs)for(const res of [1,2])for(const [phase,t]of [['charge',Math.floor(spec.charge/2)],['fire',4],['rest',3]]){
  const a=hazardFrame(old,spec,phase,t,res),b=hazardFrame(D,spec,phase,t,res)
  assert.ok(difference(a.buf,b.buf)>=6*res*res,`${spec.id}/${phase}/${res}`)
 }
})
test('C13 charge releases and recovery join on the Sim phase boundaries',()=>{
 for(const res of [1,2]){
  const w={res},g={cx:100,y0:0,y1:24,tall:24,wide:24,show:true,winding:true}
  assert.deepEqual(D.trapJawPose(w,{t:7},g),D.trapJawPose(w,{t:0},{...g,winding:false,live:true}))
  assert.deepEqual(D.pendulumPose(w,{t:27},g),D.pendulumPose(w,{t:0},{...g,winding:false,live:true}))
  const last=D.pendulumPose(w,{t:23},{...g,winding:false,live:true})
  assert.deepEqual(last,D.pendulumPose(w,{t:0},{...g,winding:false,cool:1}))
  for(let i=0;i<4;i++){
   const charged=D.snowLoadPose(w,{t:27},{...g,progress:27/28},i)
   const fire=D.snowLoadPose(w,{t:0},{...g,winding:false,live:true},i)
   assert.equal(charged.y,fire.y);assert.equal(fire.y+fire.radius,g.y1-i*4)
   assert.deepEqual(D.snowLoadPose(w,{t:23},{...g,winding:false,live:true},i),D.snowLoadPose(w,{t:0},{...g,winding:false,cool:1},i))
  }
  for(const spec of specs)assert.equal(hash(hazardFrame(D,spec,'rest',20,res).buf),hash(hazardFrame(D,spec,'idle',20,res).buf),spec.id)
 }
})
test('C13 reduced motion holds live bodies and idle motion; charge still communicates progress',()=>{
 for(const res of [1,2]){
  const w={res,reducedMotion:true},g={cx:100,y0:0,y1:24,tall:24,wide:24,show:true,live:true}
  for(const t of [0,2,6,17]){
   assert.equal(D.pendulumAngle(w,{t},g),0)
   assert.deepEqual(D.snowLoadPose(w,{t},g,0),D.snowLoadPose(w,{t:0},g,0))
   assert.deepEqual(D.trapJawPose(w,{t},g),D.trapJawPose(w,{t:0},g))
  }
  const early=D.pendulumAngle(w,{t:0},{...g,live:false,winding:true})
  assert.notEqual(early,D.pendulumAngle(w,{t:14},{...g,live:false,winding:true}))
 }
})
function readonly(value){
 if(!value||typeof value!=='object'||ArrayBuffer.isView(value))return value
 return new Proxy(value,{get:(o,k)=>readonly(o[k]),set(){throw Error('drawing wrote world')}})
}
test('C13 every new painter is pure, finite, bounded and native or half-pixel aligned',()=>{
 const random=Math.random
 try{
  Math.random=()=>{throw Error('drawing RNG')}
  for(const spec of specs)for(const res of [1,2])for(const theme of Object.keys(THEMES))for(const {phase,t}of hazardSequence(spec)){
   const {w,h}=hazardFixture(spec,phase,t);w.res=res
   const img=canvas(400*res,248*res),fill=img.ctx.fillRect.bind(img.ctx);let n=0
   img.ctx.fillRect=(...r)=>{assert.ok(++n<500);assert.ok(r.every(Number.isFinite));assert.ok(r.every(v=>Number.isInteger(v*res)),`${spec.id}/${phase}/${t}/${res}: ${r}`);fill(...r)}
   D.drawHazardKind(img.ctx,readonly(w),P.build(themeOf(theme).theme,1),readonly(h));assert.equal(img.ctx.globalAlpha,1)
  }
 }finally{Math.random=random}
})
test('C13 complete-board scope audit recovers the baseline with only the three painters restored',()=>{
 const R=renderer(restoreFoeRoundTwo(source,beforeSource)),random=Math.random
 try { Math.random=()=>0.5
 for(let level=1;level<=S.BIOMES.length;level++){
  const a=S.generate(level,0,3),b=S.generate(level,0,3)
  for(let t=0;t<=400;t++){
   if(t){S.step(a);S.step(b)}
   if(![120,350,400].includes(t))continue
   for(const res of [1,2]){
    const draw=(D,w)=>{w.res=res;const img=canvas(400*res,248*res),pal=P.build(themeOf('tokyo-night').theme,level);D.drawTerrain(img.ctx,w,pal);D.drawActors(img.ctx,w,pal,{});return hash(img.buf)}
    assert.equal(draw(R,a),draw(old,b),`${level}/${t}/${res}`)
   }
  }
 }
 }finally{Math.random=random}
})
test('C13 all excluded hazards and every enemy keep exact pixels including seasonal riders',()=>{
 for(const res of [1,2]){
  for(const spec of S.HAZARDS.filter(s=>!ROUND_TWO.includes(s.id)))for(const phase of ['idle','charge','fire','rest'])
   assert.equal(hash(hazardFrame(D,spec,phase,3,res).buf),hash(hazardFrame(old,spec,phase,3,res).buf),`${spec.id}/${phase}/${res}`)
  for(const kind of KINDS)for(const state of STATES)for(const mode of ['santa','party'])for(const dir of [-1,1]){
   const paint=D=>{const {w,en}=enemyFixture(kind,state,4,dir);w.res=res;w.season={redHats:mode};const img=canvas(400*res,248*res);D.drawEnemy(img.ctx,w,{},en,{});return hash(img.buf)}
   assert.equal(paint(D),paint(old),`${kind}/${state}/${mode}/${dir}/${res}`)
  }
 }
})
