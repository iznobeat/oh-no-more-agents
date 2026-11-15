import {alpineSuccessor} from '../tools/alpine-reference.js'
import ironPins from './fixtures/ironworks-scenes.json' with {type:'json'}
import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import os from 'node:os'
import path from 'node:path'
import {run} from '../tools/newyear-art.js'
import {createHash} from 'node:crypto'
import {load,canvas} from '../tools/render.js'
import {season,renderer} from '../tools/gag-art.js'
import {christmasWorld,christmasFrame} from '../tools/christmas-art.js'
import {foeRoundThreeBefore} from '../tools/foe-reference.js'
const source=fs.readFileSync('public/agents/season.js','utf8'),api=season(source,'?season=newyear')
const D=load('Draw.js'),S=load('Sim.js'),base='dd5138c91fe8ca616141abe025ce4799f9598652'
const oldD=renderer(execFileSync('git',['show',`${base}:public/agents/Draw.js`],{maxBuffer:4e6}).toString())
const oldSource=execFileSync('git',['show',`${base}:public/agents/season.js`],{maxBuffer:4e6}).toString()
const workPins=JSON.parse(fs.readFileSync(new URL('./fixtures/colony-work-pins.json',import.meta.url),'utf8'))
const hash=b=>createHash('sha256').update(b).digest('hex')
function calls(w) {
  const out=[],ctx={save(){},restore(){},fillRect(...r){assert.ok(out.length<2000);out.push([...r,this.fillStyle,this.globalAlpha])}}
  api.paint(ctx,w);return out
}
function world(){return christmasWorld(5,api)}
const foeBefore=foeRoundThreeBefore(),foePins=JSON.parse(fs.readFileSync('test/fixtures/foe-round3-scenes.json','utf8'))

test('New Year wraps Dec 31–Jan 1 only, with strict previews and Christmas separation',()=>{
  for(let year=2024;year<2032;year++) {
    for(const [m,d,expect]of [[11,26,'christmas'],[11,27,null],[11,30,null],[11,31,'newyear'],[0,1,'newyear'],[0,2,null]])assert.equal(api.pick('',new Date(year,m,d)),expect)
  }
  assert.equal(api.pick('?season=newyear',new Date(2026,5,1)),'newyear')
  assert.equal(api.pick('?season=none',new Date(2026,11,31)),null)
  assert.equal(api.pick('?season=NEWYEAR',new Date(2026,5,1)),null)
})
test('all biomes retain exact Christmas and out-of-season full frames at both resolutions',()=>{
  for(const mode of ['none','christmas']) {
    const a=season(oldSource,`?season=${mode}`),b=season(source,`?season=${mode}`)
    for(let level=1;level<=S.BIOMES.length;level++)for(const res of[1,2]) {
      const wa=christmasWorld(level,a),wb=christmasWorld(level,b)
      const pin=workPins.newyear[`${mode}/${level}/${res}`],before=hash(christmasFrame(oldD,a,wa,res).buf)
      if(pin)assert.equal(before,pin.before,'historical '+`${mode} ${level} ${res}`)
      const historical=hash(christmasFrame(foeBefore,b,christmasWorld(level,b),res).buf),review=foePins.newyear[`${mode}/${level}/${res}`]
      assert.equal(historical,pin?pin.after:before,'before C14 '+`${mode} ${level} ${res}`)
      if(review)assert.equal(historical,review.before)
      const iron=ironPins.newyear[`${mode}/${level}/${res}`],prior=review?review.after:historical
      if(iron)assert.equal(iron.before,prior)
      assert.equal(hash(christmasFrame(D,b,wb,res).buf),alpineSuccessor(iron?iron.after:prior),`${mode} ${level} ${res}`)
      if(level===1 || level===21){
        wa.done=wb.done=true;wa.doneTicks=wb.doneTicks=30
        const report=JSON.parse(fs.readFileSync(new URL('./fixtures/colony-last-pins.json',import.meta.url),'utf8')).reports[`${mode}/${level}/${res}`]
        assert.equal(hash(christmasFrame(oldD,a,wa,res).buf),report.before)
        assert.equal(hash(christmasFrame(D,b,wb,res).buf),report.after)
      }
    }
  }
})
test('rockets rise, rings expand and fade, density rises with home count; motion freezes',()=>{
  const w=world();w.ticks=64
  const a=calls(w);assert.ok(a.length>10)
  w.ticks=70;assert.notEqual(JSON.stringify(calls(w)),JSON.stringify(a))
  w.reducedMotion=true;w.ticks=100;const still=calls(w);w.ticks=800;assert.deepEqual(calls(w),still)
  w.saved=w.toRelease-1;assert.ok(calls(w).length>still.length)
  for(const res of[1,2]){w.res=res;const c=calls(w);assert.ok(c.every(r=>r.slice(0,4).every(n=>Number.isInteger(n*res))))}
})
test('fireworks exclude terrain, hazard tells, actor/umbrella boxes, enemies, scenery and portal',()=>{
  const w=world();w.ticks=64;w.res=2
  const r=calls(w);assert.ok(r.length)
  for(const [x,y,sz]of r) {
    assert.ok(x>=1 && y>=2)
    for(let yy=Math.floor(y/4);yy<=Math.floor((y+sz-0.5)/4);yy++)for(let xx=Math.floor(x/4);xx<=Math.floor((x+sz-0.5)/4);xx++)assert.equal(w.terrain[yy*w.k.COLS+xx],w.k.EMPTY)
  }
  w.hazards=[{zx0:0,zx1:1000,zy0:0,zy1:1000}];assert.equal(calls(w).length,0)
  w.hazards=[];w.terrain.fill(w.k.DIRT);assert.equal(calls(w).length,0)
})
test('arrival confetti is bounded, expires, and final arrival is larger; plates and blackout suppress it',()=>{
  const w=world();w.ticks=70;w.saved++;calls(w)
  assert.equal(w.season.arrivals.length,1);assert.equal(w.season.arrivals[0].last,false)
  w.ticks++;w.saved=w.toRelease;calls(w);assert.equal(w.season.arrivals.at(-1).last,true)
  w.ticks+=80;calls(w);assert.equal(w.season.arrivals.length,0)
  w.done=true;assert.equal(calls(w).length,0)
  w.done=false;w.outage={at:w.ticks,len:10};assert.equal(calls(w).length,0)
})
test('paint writes only season fields and never consumes randomness or changes simulation',()=>{
  const w=world(),strip=w=>JSON.stringify(w,(k,v)=>k.startsWith('season')?undefined:v),before=strip(w)
  for(let i=0;i<6;i++)calls(w)
  assert.equal(hash(strip(w)),hash(before))
  const a=S.generate(5,0,3),b=S.generate(5,0,3);api.dress(b)
  const random=Math.random
  try { Math.random=()=>0.5;for(let i=0;i<600;i++){S.step(a);S.step(b);if(i%20===0)calls(b)} } finally {Math.random=random}
  assert.equal(hash(strip(a)),hash(strip(b)))
})
test('party cones follow the exact Santa anchors and add fine stripes; red team and report streamers opt in',()=>{
  const w=world();w.res=2
  const img=canvas(800,496),before=hash(img.buf)
  D.drawNewyearHat(img.ctx,w,{id:2},100,80,-1,3);assert.notEqual(hash(img.buf),before)
  for(const kind of['guard','sniper','operator','drone','xeno'])D.drawNewyearEnemy(img.ctx,w,{kind,dir:1,id:2,state:'aim'},100,80)
  D.drawNewyearReport(img.ctx,w,30,30,272)
  const blank=canvas(800,496);D.drawNewyearReport(blank.ctx,{season:{name:'christmas'}},30,30,272);assert.equal(hash(blank.buf),before)
})

test('a final homecoming survives the report transition while every report pixel stays protected',()=>{
  const w=world();w.res=2;w.ticks=500;w.saved=w.toRelease;w.done=true;w.doneTicks=30
  const img=christmasFrame(D,api,w,2),box=w.season.reportBox
  assert.ok(box && w.season.arrivals.at(-1).last)
  w.ticks+=45
  const r=calls(w)
  assert.ok(r.length>0,'confetti remains visible outside the report')
  for(const [x,y,width,height]of r)assert.ok(x+width<=box.x || x>=box.x+box.width || y+height<=box.y || y>=box.y+box.height)
})
test('living faces and umbrellas, enemies, missions and the portal exclude all celebratory paint',()=>{
  const w=world();w.ticks=64
  const original=calls(w);assert.ok(original.length)
  const [x,y]=original[0]
  const cover=()=>calls(w).some(([xx,yy,ww,hh])=>xx<x+2 && xx+ww>x && yy<y+2 && yy+hh>y)
  const agents=w.agents,enemies=w.enemies,mission=w.mission,exit=w.exit,decor=w.decor
  w.agents=[{id:99,x:(x+1)/4,y:(y+8)/4-1,floater:true,state:'fall'}];assert.equal(cover(),false);w.agents=agents
  w.enemies=[{x:(x+1)/4,y:(y+8)/4-1}];assert.equal(cover(),false);w.enemies=enemies
  w.mission={targets:[{x:(x+1)/4,y:(y+8)/4-1}]};assert.equal(cover(),false);w.mission=mission
  w.exit={x:x/4,y:y/4,w:2,h:2};assert.equal(cover(),false);w.exit=exit
  w.decor=[{x:x/4,y:y/4}];assert.equal(cover(),false);w.decor=decor
})
test('the review harness retains full-frame pairs and crops across every biome and both resolutions',()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'newyear-art-'))
  try {
    run(base,out)
    for(const name of ['full-res1-sheet.png','full-res2-sheet.png','crops-res1-sheet.png','crops-res2-sheet.png','red-team-sheet.png','celebrations-res1-sheet.png','celebrations-res2-sheet.png'])assert.ok(fs.statSync(path.join(out,name)).size>100)
  } finally {fs.rmSync(out,{recursive:true,force:true})}
})
