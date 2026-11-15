import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {renderer} from '../tools/gag-art.js'
import {load,canvas,themeOf,THEMES} from '../tools/render.js'
import {fixture,frame,run,liveScene,liveBoards,CASES} from '../tools/skill-strips.js'
const D=load('Draw.js'),P=load('Palette.js'),S=load('Sim.js')
const beforeDraw=renderer(execFileSync('git',['show','0cc98ea614e6a2752eeafe3bb10a47f8cb0a7b7b:public/agents/Draw.js'],{maxBuffer:4e6}).toString())
const hash=b=>createHash('sha256').update(b).digest('hex')
for(const name of ['build','bash','dig'])test(name+': full native and page cycles visibly change, repeat and freeze under reduced motion',()=>{
 for(const res of [1,2])for(const dir of [-1,1]){
  const n=D.COLONY_WORK[name].length,frames=[]
  for(let t=0;t<n;t++)frames.push(hash(frame(D,name,t,res,dir).buf))
  assert.equal(new Set(frames).size,n,'every consecutive key pose reads')
  assert.equal(hash(frame(D,name,0,res,dir).buf),hash(frame(D,name,n,res,dir).buf))
  const {w,ag}=fixture(name,0,dir);w.res=res;w.reducedMotion=true
  const pal=P.build(themeOf('tokyo-night').theme,1),digests=[]
  for(let t=0;t<n;t++){
   ag.timer=t;ag.anim=t;w.ticks=400+t
   const img=canvas(100*res,100*res);img.ctx.setTransform(res,0,0,res,0,0)
   D.drawColonyWorkBody(img.ctx,w,pal,ag,40,40,dir,pal.robe)
   D.drawColonyWorkTool(img.ctx,w,pal,ag,40,40,dir)
   digests.push(hash(img.buf))
  }
  assert.equal(new Set(digests).size,1)
 }
})
test('work contact matches Sim intervals, with a released brick and a lifted steel recovery',()=>{
 assert.equal(D.COLONY_WORK.build.length,S.BUILD_INTERVAL)
 assert.equal(D.COLONY_WORK.bash.length,S.BASH_INTERVAL)
 assert.equal(D.COLONY_WORK.dig.length,S.DIG_INTERVAL)
 for(const name of ['bash','dig']){
  const {w,ag}=fixture(name,0),row=D.colonyWorkPose(w,ag)
  assert.equal(row[1],name==='bash'?9:15)
  ag.timer=4;assert.ok(D.colonyWorkPose(w,ag)[1]<row[1])
 }
})
test('work painters use only existing colours, aligned rectangles, bounded calls and no world writes or RNG',()=>{
 const random=Math.random
 try{
  for(const theme of Object.keys(THEMES))for(const res of [1,2])for(const name of ['build','bash','dig'])for(const dir of [-1,1]){
   Math.random=random
   const {w,ag}=fixture(name,4,dir);w.res=res
   Math.random=()=>{throw Error('draw RNG')}
   const pal=P.build(themeOf(theme).theme,1),before=hash(JSON.stringify(w)),img=canvas(100,100)
   let calls=0;img.ctx.fillRect=(...r)=>{
    assert.ok(++calls<100);assert.ok(r.every(Number.isFinite));assert.ok(r.every(v=>Number.isInteger(v*(res===2?2:1))))
    assert.ok(Object.values(pal).includes(img.ctx.fillStyle))
   }
   img.ctx.fillStyle='#abcdef';img.ctx.globalAlpha=0.7
   D.drawColonyWorkTool(img.ctx,w,pal,ag,40,40,dir)
   assert.equal(img.ctx.fillStyle,'#abcdef');assert.equal(img.ctx.globalAlpha,0.7)
   D.drawColonyWorkBody(img.ctx,w,pal,ag,40,40,dir,pal.robe)
   assert.equal(hash(JSON.stringify(w)),before)
  }
 }finally{Math.random=random}
})
test('specials, underwater and immutable share art keep their established work poses',()=>{
 for(const name of ['build','bash','dig'])for(const fields of [{res:3},{submerged:true},{special:'builder'}]){
  const {w,ag}=fixture(name,0);Object.assign(w,fields);if(fields.special)ag.special=fields.special
  assert.equal(D.colonyWorking(w,ag),false)
 }
})
test('work painting preserves complete umbrella-parry frames in both facings and resolutions',()=>{
 for(const name of ['build','bash','dig'])for(const res of [1,2])for(const dir of [-1,1]){
  const {w,ag}=fixture(name,4,dir);w.res=res;ag.brollyFor=12;ag.brollyDir=dir
  const pal=P.build(themeOf('tokyo-night').theme,1),digests=[]
  for(const draw of [beforeDraw,D]){
   const img=canvas(200*res,160*res);img.ctx.setTransform(res,0,0,res,0,0)
   draw.drawAgent(img.ctx,w,pal,ag,{})
   digests.push(hash(img.buf))
  }
  assert.equal(digests[0],digests[1])
 }
})
test('the ten other C8 actions retain exact pixels or their deliberately reviewed C9 pins',()=>{
 const pins=JSON.parse(fs.readFileSync(new URL('./fixtures/colony-action-pins.json',import.meta.url),'utf8'))
 for(const name of CASES.filter(n=>!['build','bash','dig'].includes(n)))for(const res of [1,2])for(const dir of [-1,1])for(let t=0;t<12;t++){
  const before=hash(frame(beforeDraw,name,t,res,dir).buf),pin=pins[name]?.frames[`${res}/${dir}/${t}`]
  if(pin)assert.equal(before,pin.before,'historical '+`${name}/${res}/${dir}/${t}`)
  assert.equal(hash(frame(D,name,t,res,dir).buf),pin?pin.after:before,`${name}/${res}/${dir}/${t}`)
 }
})
test('review tool retains every action, real gameplay boards and reproducible strip pixels',()=>{
 const out='/tmp/xmas-dressing/anim-test'
 run('HEAD',out);liveBoards('HEAD',out)
 assert.equal(CASES.length,13)
 for(const name of CASES)for(const res of [1,2])assert.ok(fs.statSync(`${out}/${name}-res${res}.png`).size>100)
 for(const name of ['build','bash','dig']){
  assert.ok(liveScene(name).w.agents.some(a=>a.state===name))
  assert.ok(fs.statSync(`${out}/${name}-full-res1.png`).size>100)
 }
})
