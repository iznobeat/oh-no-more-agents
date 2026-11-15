import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {fixture,frame,run,actionBoards,FRAME_COUNT,CASES} from '../tools/skill-strips.js'
const D=load('Draw.js'),P=load('Palette.js')
const BASE='91531f2a3b64ed55a341f10894cf7282cda24846'
const old=renderer(execFileSync('git',['show',BASE+':public/agents/Draw.js'],{maxBuffer:4e6}).toString())
const hash=b=>createHash('sha256').update(b).digest('hex')
const pins=JSON.parse(fs.readFileSync(new URL('./fixtures/colony-action-pins.json',import.meta.url),'utf8'))
for(const name of ['climb','bomb','splat'])test(name+': reviewed native/page motion has distinct key poses and deliberate exact pins',()=>{
 const before=createHash('sha256'),after=createHash('sha256')
 for(const res of [1,2])for(const dir of [-1,1]){
  const poses=[];let changed=0
  for(let t=0;t<FRAME_COUNT;t++){
   const a=frame(old,name,t,res,dir).buf,b=frame(D,name,t,res,dir).buf
   before.update(a);after.update(b);poses.push(hash(b))
   for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])changed++
  }
  assert.ok(new Set(poses).size>=5,'readable in-betweens');assert.ok(changed>=100*res*res,'visible at full size')
 }
 assert.equal(before.digest('hex'),pins[name].before)
 assert.equal(after.digest('hex'),pins[name].after)
})
test('the ten unselected actions keep every C8 pixel at native and page scale',()=>{
 for(const name of CASES.filter(n=>!['climb','bomb','splat'].includes(n)))for(const res of [1,2])for(const dir of [-1,1])for(let t=0;t<FRAME_COUNT;t++)
  assert.equal(hash(frame(D,name,t,res,dir).buf),hash(frame(old,name,t,res,dir).buf),`${name}/${res}/${dir}/${t}`)
})
test('climb repeats on anim; fuse drives the accelerating brace; new reduced-motion paint holds still',()=>{
 for(const res of [1,2])for(const name of ['climb','bomb']){
  const {w,ag}=fixture(name,0);w.res=res
  const pal=P.build(themeOf('tokyo-night').theme,1)
  const paint=()=>{const img=canvas(100*res,100*res);img.ctx.setTransform(res,0,0,res,0,0);D.drawColonyActionBody(img.ctx,w,pal,ag,40,40,1,pal.robe);if(res===2)D.drawSkillDetail(img.ctx,w,pal,ag,40,40,1);return hash(img.buf)}
  if(name==='climb'){const a=paint();ag.anim=16;assert.equal(paint(),a)}
  else {ag.fuse=60;const a=paint();ag.fuse=56;assert.notEqual(paint(),a)}
  w.reducedMotion=true;const still=paint()
  for(let t=0;t<30;t++){ag.anim=t;ag.fuse=90-t;w.ticks=t;assert.equal(paint(),still)}
 }
 for(const res of [1,2]){
  const {w}=fixture('splat',0);w.res=res;w.reducedMotion=true
  const pal=P.build(themeOf('tokyo-night').theme,1),poses=[]
  for(let age=0;age<30;age++){const img=canvas(100,100);img.ctx.translate(40,40);D.drawColonySplat(img.ctx,w,pal,age);poses.push(hash(img.buf))}
  assert.equal(new Set(poses).size,1)
 }
})
test('new painters are palette-only, bounded, aligned, read-only and RNG-free in both facings',()=>{
 const random=Math.random
 try{for(const theme of Object.keys(THEMES))for(const res of [1,2])for(const dir of [-1,1])for(const name of ['climb','bomb','splat']){
  Math.random=random;const {w,ag}=fixture(name,4,dir);w.res=res
  const pal=P.build(themeOf(theme).theme,1),img=canvas(200,200),colors=new Set([...Object.values(pal),'#ffffff'])
  Math.random=()=>{throw Error('draw RNG')}
  for(let t=0;t<20;t++){
   ag.anim=t;ag.fuse=40-t;let count=0
   img.ctx.fillRect=(...r)=>{assert.ok(++count<100);assert.ok(r.every(Number.isFinite));assert.ok(r.every(n=>Number.isInteger(n*res)));assert.ok(r[2]>0&&r[3]>0);assert.ok(colors.has(img.ctx.fillStyle))}
   const snapshot=hash(JSON.stringify(w))
   if(name==='splat')D.drawColonySplat(img.ctx,w,pal,t)
   else {D.drawColonyActionBody(img.ctx,w,pal,ag,40,40,dir,pal.robe);if(res===2)D.drawColonyActionFine(img.ctx,w,pal,ag,40,40,dir,D.agentDrawMotion(w,ag,name,null).drop)}
   assert.equal(hash(JSON.stringify(w)),snapshot)
  }
 }}finally{Math.random=random}
})
test('parrying umbrellas, shelf climbers, divers, specials and share art retain established living poses',()=>{
 for(const name of ['climb','bomb'])for(const res of [1,2,3])for(const dir of [-1,1])for(const fields of [{brollyFor:12,brollyDir:dir},{special:'builder'}]){
  const {w,ag}=fixture(name,4,dir);w.res=res;Object.assign(ag,fields)
  assert.equal(D.colonyAction(w,ag),false)
  const pal=P.build(themeOf('tokyo-night').theme,1),poses=[]
  for(const draw of [old,D]){const img=canvas(400*res,248*res);img.ctx.setTransform(res,0,0,res,0,0);draw.drawAgent(img.ctx,w,pal,ag,{});poses.push(hash(img.buf))}
  assert.equal(poses[0],poses[1])
 }
 const {w,ag}=fixture('climb',0);w.submerged=true;assert.equal(D.colonyAction(w,ag),false)
 w.submerged=false;w.res=3;assert.equal(D.colonyAction(w,ag),false)
 w.res=1;w.biome='Library';w.terrain[30*w.k.COLS+41]=w.k.ORE
 assert.equal(D.libraryShelfPose(w,ag),true);assert.equal(D.colonyAction(w,ag),false)
})
test('review retains all sixteen consecutive ticks and native/full page comparisons',()=>{
 const out='/tmp/xmas-dressing/anim2-test';run(BASE,out);actionBoards(BASE,out)
 assert.equal(FRAME_COUNT,16)
 for(const res of [1,2]){
  for(const name of CASES){const png=fs.readFileSync(`${out}/${name}-res${res}.png`);assert.equal(png.readUInt32BE(16),16*64*res)}
  for(const t of [0,4,8])assert.ok(fs.statSync(`${out}/actions-full-${t}-res${res}.png`).size>1000)
 }
})

test('native climbing grips meet the actual wall for fractional positions in both directions',()=>{
 for(const res of [undefined,1,2])for(const dir of [-1,1])for(const x of [39,39.25,39.5,39.75,40]){
  const {w,ag}=fixture('climb',0,dir);w.res=res;ag.x=x
  assert.equal(D.colonyClimbAlignment(w,ag),true)
  const ox=D.pageAgentX(w,ag),aligned=ox+dir*(D.climbContacts(w,ag,ox,dir).x-8)
  assert.equal(D.climbContacts(w,ag,aligned,dir).x,8)
 }
})
