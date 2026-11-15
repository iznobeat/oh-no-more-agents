import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {fixture,frame,run,balanceBoards,CASES} from '../tools/skill-strips.js'
const BASE='d7135de4e8e14ba4d93370d6604d4a3966e7e16e'
const D=load('Draw.js'),P=load('Palette.js')
const old=renderer(execFileSync('git',['show',BASE+':public/agents/Draw.js'],{maxBuffer:4e6}).toString())
const names=['mine','block','float'],hash=b=>createHash('sha256').update(b).digest('hex')
const pins=JSON.parse(fs.readFileSync(new URL('./fixtures/colony-balance-pins.json',import.meta.url),'utf8'))
for(const name of names)test(name+': reviewed native/page keys visibly change and retain exact before/after pins',()=>{
 for(const res of [1,2])for(const dir of [-1,1]) {
  const seen=new Set();let pixels=0
  for(let t=0;t<16;t++) {
   const a=frame(old,name,t,res,dir).buf,b=frame(D,name,t,res,dir).buf,pin=pins[name][`${res}/${dir}/${t}`]
   assert.equal(hash(a),pin.before);assert.equal(hash(b),pin.after);seen.add(hash(b))
   for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])pixels++
  }
  assert.ok(seen.size>=6,'clear in-betweens');assert.ok(pixels>150*res*res,'full-size visible change')
 }
})
function paint(w,ag) {
 const res=w.res||1,pal=P.build(themeOf('tokyo-night').theme,1),img=canvas(100*res,100*res)
 img.ctx.setTransform(res,0,0,res,0,0)
 D.drawColonyBalanceBody(img.ctx,w,pal,ag,40,40,ag.dir,pal.robe)
 if(res===2)D.drawColonyBalanceFine(img.ctx,w,pal,ag,40,40,ag.dir,D.agentDrawMotion(w,ag,ag.state,D.agentIdle(w,ag)).drop)
 return hash(img.buf)
}
test('plant releases on the existing cool clock; balance cycles on anim and all new motion freezes',()=>{
 for(const res of [1,2])for(const name of names) {
  const {w,ag}=fixture(name,0);w.res=res
  if(name==='mine') {
   for(let t=0;t<6;t++){ag.mineCool=150-t;assert.equal(D.colonyBalance(w,ag),'mine')}
   ag.mineCool=144;assert.equal(D.colonyBalance(w,ag),'');ag.mineCool=150
  } else {const a=paint(w,ag);ag.anim=16;assert.equal(paint(w,ag),a)}
  w.reducedMotion=true;const still=paint(w,ag)
  for(let t=0;t<6;t++){ag.anim=t*3;ag.mineCool=150-t;w.ticks=400+t*80;assert.equal(paint(w,ag),still)}
 }
})
test('balance painters use the existing palette and pixel grid, bounded calls, no RNG or world writes',()=>{
 const random=Math.random
 try {for(const theme of Object.keys(THEMES))for(const res of [1,2])for(const dir of [-1,1])for(const name of names) {
  Math.random=random;const {w,ag}=fixture(name,4,dir);w.res=res
  const pal=P.build(themeOf(theme).theme,1),img=canvas(200,200),before=hash(JSON.stringify(w))
  Math.random=()=>{throw Error('draw RNG')};let calls=0
  img.ctx.fillRect=(...r)=>{assert.ok(++calls<120);assert.ok(r.every(Number.isFinite));assert.ok(r.every(n=>Number.isInteger(n*res)));assert.ok(r[2]>0&&r[3]>0);assert.ok(Object.values(pal).includes(img.ctx.fillStyle))}
  img.ctx.fillStyle='#abcdef';img.ctx.globalAlpha=0.7
  assert.equal(D.drawColonyBalanceBody(img.ctx,w,pal,ag,40,40,dir,pal.robe),true)
  assert.equal(img.ctx.fillStyle,'#abcdef');assert.equal(img.ctx.globalAlpha,0.7)
  if(res===2)D.drawColonyBalanceFine(img.ctx,w,pal,ag,40,40,dir,D.agentDrawMotion(w,ag,ag.state,null).drop)
  assert.equal(hash(JSON.stringify(w)),before)
 }}finally{Math.random=random}
})
test('specials, divers, parries, share art and deliberate blocker fidgets keep their established poses',()=>{
 for(const name of names)for(const res of [1,2])for(const field of ['special','submerged','parry','share']) {
  const {w,ag}=fixture(name,4);w.res=res
  if(field==='special')ag.special='builder'
  if(field==='submerged')w.submerged=true
  if(field==='parry')ag.brollyFor=12
  if(field==='share')w.res=3
  assert.equal(D.colonyBalance(w,ag),'')
 }
 const {w,ag}=fixture('block',0)
 for(let t=0;t<240;t++){w.ticks=t;if(D.agentIdle(w,ag).pose)assert.equal(D.colonyBalance(w,ag),'')}
})
test('all ten unselected actions retain every C9 sprite pixel',()=>{
 for(const name of CASES.filter(n=>!names.includes(n)))for(const res of [1,2])for(const dir of [-1,1])for(let t=0;t<16;t++)
  assert.equal(hash(frame(D,name,t,res,dir).buf),hash(frame(old,name,t,res,dir).buf),`${name}/${res}/${dir}/${t}`)
})
test('the complete original floating umbrella paint survives every new native/page pose',()=>{
 for(const res of [1,2])for(const dir of [-1,1])for(let t=0;t<16;t++) {
  const {w,ag}=fixture('float',t,dir);w.res=res
  const pal=P.build(themeOf('tokyo-night').theme,1),a=canvas(120,120),b=canvas(120,120)
  old.drawUmbrella(a.ctx,w,pal,ag,40,40,'fall');D.drawUmbrella(b.ctx,w,pal,ag,40,40,'fall')
  assert.equal(hash(a.buf),hash(b.buf))
  const head=canvas(120,120,'#000000'),body=canvas(120,120,'#000000')
  D.drawAgentDryHead(head.ctx,w,pal,ag,40,40,dir,pal.hair,pal.skin,0)
  D.drawAgentDryHead(body.ctx,w,pal,ag,40,40,dir,pal.hair,pal.skin,0)
  D.drawColonyBalanceBody(body.ctx,w,pal,ag,40,40,dir,pal.robe)
  // The new grip routes outside the original opaque head, including shades.
  for(let y=40;y<47;y++)for(let x=40;x<48;x++) {
   const i=(y*120+x)*3
   if(head.buf[i]||head.buf[i+1]||head.buf[i+2])assert.equal(hash(body.buf.subarray(i,i+3)),hash(head.buf.subarray(i,i+3)),'head clearance')
  }
 }
 const {w,ag}=fixture('float',0);w.reducedMotion=true;w.res=1
 const pal=P.build(themeOf('tokyo-night').theme,1),seen=[]
 for(const ticks of [0,17,80,350]){w.ticks=ticks;const img=canvas(120,120);D.drawUmbrella(img.ctx,w,pal,ag,40,40,'fall');seen.push(hash(img.buf))}
 assert.equal(new Set(seen).size,1)
})
test('review retains all actions, compact both-facing strips and complete boards at both scales',()=>{
 const out='/tmp/xmas-dressing/anim3-test';run(BASE,out);balanceBoards(BASE,out)
 for(const res of [1,2]) {
  for(const name of names){const png=fs.readFileSync(`${out}/${name}-compact-res${res}.png`);assert.equal(png.readUInt32BE(16),16*24*res)}
  for(const t of [0,2,4,6,10,14])assert.ok(fs.statSync(`${out}/balance-full-${t}-res${res}.png`).size>1000)
 }
})
