import ironPins from './fixtures/ironworks-scenes.json' with {type:'json'}
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,themeOf,THEMES,frame as worldFrame} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {fixture,frame,remainingBoards,CASES} from '../tools/skill-strips.js'
import {foeRoundThreeBefore} from '../tools/foe-reference.js'
const pins=JSON.parse(fs.readFileSync(new URL('./fixtures/colony-last-pins.json',import.meta.url),'utf8'))
const D=load('Draw.js'),P=load('Palette.js'),old=renderer(execFileSync('git',['show',pins.base+':public/agents/Draw.js'],{maxBuffer:4e6}).toString())
const hash=b=>createHash('sha256').update(b).digest('hex'),names=['walk','shortfall','saved']
const foePins=JSON.parse(fs.readFileSync('test/fixtures/foe-round3-scenes.json','utf8'))

test('disabling only the three reviewed poses restores the exact complete C10 aggregates',()=>{
 const disabled=renderer(fs.readFileSync('public/agents/Draw.js','utf8')+'\ncolonyWalking=function(){return false};colonyShortFall=function(){return false};colonyNativeHome=function(){return false};')
 const disabledBefore=foeRoundThreeBefore(fs.readFileSync('public/agents/Draw.js','utf8')+'\ncolonyWalking=function(){return false};colonyShortFall=function(){return false};colonyNativeHome=function(){return false};')
 const S=load('Sim.js'),random=Math.random
 try {for(const [ticks,expected]of [
  [[350,900],'0644914d47455bcdc10e2a3adf86ffdb6480a101219505b4ab1ce98600881457'],
  [[120,350],'e665211633368a4fcdbbffbda8590fa73f9d0c1f411f34870bc3b9a097b04964']
 ])for(const draw of [old,disabledBefore,disabled]) {
  Math.random=()=>0.5;const sum=createHash('sha256')
  for(let level=1;level<=20;level++)for(const res of [1,2])for(const tick of ticks)
   sum.update(worldFrame(S,draw,P,{level,seed:3,ticks:tick,theme:'tokyo-night',res,page:res===2}).img.buf)
  assert.equal(foePins.disabled[ticks.join(',')].before,expected)
  assert.equal(ironPins.disabled[ticks.join(',')].before,foePins.disabled[ticks.join(',')].after)
  assert.equal(sum.digest('hex'),draw===disabled?ironPins.disabled[ticks.join(',')].after:expected)
 }}finally{Math.random=random}
})
for(const name of names)test(name+': consecutive native/page frames retain deliberate exact historical and reviewed pins',()=>{
 for(const res of [1,2])for(const dir of [-1,1]) {
  let changed=0;const seen=new Set()
  for(let t=0;t<16;t++) {
   const a=frame(old,name,t,res,dir).buf,b=frame(D,name,t,res,dir).buf,pin=pins.frames[name][`${res}/${dir}/${t}`]
   assert.equal(hash(a),pin.before);assert.equal(hash(b),pin.after);seen.add(hash(b))
   for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++
  }
  assert.ok(seen.size>=4,'readable keys')
  if(name==='saved'&&res===2)assert.equal(changed,0,'page arrival already reads well')
  else assert.ok(changed>=50*res*res,'visible at native display size')
 }
})
test('walk keeps every head rider, trait stride, hat and umbrella anchor on the exact old clock',()=>{
 for(const res of [1,2])for(const dir of [-1,1])for(const trait of Object.keys(D.TRAIT_LOOKS))for(let t=0;t<32;t++) {
  const {w,ag}=fixture('walk',t,dir);w.res=res;ag.trait=trait
  const a=old.agentDrawMotion(w,ag,'walk',old.agentIdle(w,ag)),b=D.agentDrawMotion(w,ag,'walk',D.agentIdle(w,ag))
  assert.equal(JSON.stringify(a),JSON.stringify(b));assert.equal(JSON.stringify(D.weatherCrown(w,ag)),JSON.stringify(old.weatherCrown(w,ag)))
  assert.equal(D.traitStride(w,ag,b.lead),old.traitStride(w,ag,a.lead))
  const pal=P.build(themeOf('tokyo-night').theme,1),images=[]
  for(const painter of [old,D]){const img=canvas(120,120);painter.drawUmbrella(img.ctx,w,pal,ag,40,40,'walk');painter.drawAgentHead(img.ctx,w,pal,ag,40,40,dir,pal.hair,pal.skin,'walk',a.drop);images.push(hash(img.buf))}
  assert.equal(images[0],images[1])
 }
})
function local(name,w,ag,pal,img) {
 if(name==='walk')D.drawColonyStep(img.ctx,w,pal,ag,40,40,ag.dir,pal.robe,0,false)
 else if(name==='shortfall')D.drawColonyShortFall(img.ctx,w,pal,ag,40,40,ag.dir,pal.robe)
 else D.drawColonyNativeHome(img.ctx,w,pal,ag,40,40,ag.dir,pal.robe)
}
test('new leg, drop and greeting motion freezes; anim repeats the steps without borrowing world ticks',()=>{
 for(const res of [1,2])for(const name of names) {
  const {w,ag}=fixture(name,0);w.res=res;const pal=P.build(themeOf('tokyo-night').theme,1)
  const paint=()=>{const img=canvas(120,120);local(name,w,ag,pal,img);return hash(img.buf)}
  if(name!=='saved'){const a=paint();ag.anim=16;assert.equal(paint(),a);w.ticks+=700;assert.equal(paint(),a)}
  w.reducedMotion=true;const still=paint()
  for(let t=0;t<16;t++){ag.anim=t;ag.fade=t;w.ticks+=13;assert.equal(paint(),still)}
 }
})
test('new paint is palette-only, grid-aligned, bounded, RNG-free and read-only',()=>{
 const random=Math.random
 try {for(const theme of Object.keys(THEMES))for(const res of [1,2])for(const name of names)for(const dir of [-1,1]) {
  Math.random=random;const {w,ag}=fixture(name,4,dir);w.res=res
  const pal=P.build(themeOf(theme).theme,1),img=canvas(120,120),before=hash(JSON.stringify(w));let calls=0
  Math.random=()=>{throw Error('draw RNG')}
  img.ctx.fillRect=(...r)=>{assert.ok(++calls<80);assert.ok(r.every(Number.isFinite));assert.ok(r.every(n=>Number.isInteger(n*res)));assert.ok(r[2]>0&&r[3]>0);assert.ok(Object.values(pal).includes(img.ctx.fillStyle))}
  img.ctx.fillStyle='#abcdef';img.ctx.globalAlpha=0.7
  local(name,w,ag,pal,img);assert.equal(hash(JSON.stringify(w)),before)
  assert.equal(img.ctx.fillStyle,'#abcdef');assert.equal(img.ctx.globalAlpha,0.7)
 }}finally{Math.random=random}
})
test('all other skills and both complete explosions keep every C10 pixel',()=>{
 for(const name of CASES.filter(n=>!names.includes(n)))for(const res of [1,2])for(const dir of [-1,1])for(let t=0;t<16;t++)
  {const a=hash(frame(old,name,t,res,dir).buf),pin=pins.frames[name]?.[`${res}/${dir}/${t}`]
   if(pin)assert.equal(a,pin.before)
   assert.equal(hash(frame(D,name,t,res,dir).buf),pin?pin.after:a,`${name}/${res}/${dir}/${t}`)}
 for(const name of ['walk','shortfall','saved'])for(const res of [1,2,3])for(const field of ['special','submerged','parry']) {
  const {w,ag}=fixture(name,4);w.res=res
  if(field==='special')ag.special='builder';if(field==='submerged')w.submerged=true;if(field==='parry')ag.brollyFor=12
  assert.equal(D.colonyWalking(w,ag),false);assert.equal(D.colonyShortFall(w,ag),false);assert.equal(D.colonyNativeHome(w,ag),false)
 }
})
test('review tool retains full-size both-facing strips and complete boards',()=>{
 const out='/tmp/xmas-dressing/anim4-test';remainingBoards(pins.base,out)
 for(const res of [1,2]) {
  for(const name of [...names,'explode','fall'])assert.ok(fs.statSync(`${out}/${name}-compact-res${res}.png`).size>100)
  for(const t of [0,2,4,6,10,14])assert.ok(fs.statSync(`${out}/remaining-full-${t}-res${res}.png`).size>1000)
 }
})
