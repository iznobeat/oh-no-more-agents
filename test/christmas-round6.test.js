import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,themeOf} from '../tools/render.js'
import {renderer,season} from '../tools/gag-art.js'
import {christmasFrame} from '../tools/christmas-art.js'
import {ALL_MACHINES,reviewWorld} from '../tools/christmas-round5-art.js'
const D=load('Draw.js'),P=load('Palette.js')
const base=renderer(execFileSync('git',['show','c8b27d0632e84e91e240f580d8028596b1fd63e9:public/agents/Draw.js'],{maxBuffer:4e6}).toString())
const api=season(fs.readFileSync('public/agents/season.js','utf8'),'?season=christmas')
const changed=ALL_MACHINES.filter(([n])=>!['Factory','Subway','Harbour','Building Site','Frost','North Pole'].includes(n))
const workPins=JSON.parse(fs.readFileSync(new URL('./fixtures/colony-work-pins.json',import.meta.url),'utf8'))
const digest=b=>createHash('sha256').update(b).digest('hex')
function additions(w) {
  const img=canvas(400*w.res,248*w.res);img.ctx.setTransform(w.res,0,0,w.res,0,0)
  D.drawChristmasMachines(img.ctx,w)
  if(w.biome==='Ice Cave') for(const f of w.frozen)if(f.thawedAt<0)D.drawChristmasFrozenHat(img.ctx,w,f)
  if(w.biome==='Skyscraper')for(const l of w.lifts)if(!l.stairs)D.drawChristmasLiftCar(img.ctx,w,l)
  return digest(img.buf)
}
test('round six changes survive complete native and page frames in all fifteen requested biomes',()=>{
  assert.equal(changed.length,15)
  for(const [name,key]of changed)for(const res of[1,2]) {
    const w=reviewWorld(name,key),a=christmasFrame(base,api,w,res).buf,b=christmasFrame(D,api,w,res).buf
    let pixels=0
    for(let i=0;i<a.length;i+=4)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])pixels++
    assert.ok(pixels>=40*res*res,`${name} res ${res}: only ${pixels} visible changed pixels`)
  }
})
test('every ordinary full frame remains byte-identical out of season',()=>{
  for(const [name,key]of ALL_MACHINES.filter(([n])=>n!=='North Pole'))for(const res of[1,2]) {
    const w=reviewWorld(name,key);delete w.season
    for(const ticks of[120,400]) {
      w.ticks=ticks
      const pin=workPins.c6full[`${name}/${res}/${ticks}`],before=digest(christmasFrame(base,api,w,res).buf)
      if(pin)assert.equal(before,pin.before,name+' historical pin')
      assert.equal(digest(christmasFrame(D,api,w,res).buf),pin?pin.after:before,name)
    }
  }
})
test('all new Christmas painters are deterministic, read only and still under reduced motion',()=>{
  for(const [name,key]of changed)for(const res of[1,2]) {
    const w=reviewWorld(name,key);Object.assign(w,{res,reducedMotion:true})
    const before=JSON.stringify(w),a=additions(w)
    assert.equal(JSON.stringify(w),before,name)
    for(const ticks of[0,19,81,700]) {w.ticks=ticks;assert.equal(additions(w),a,name)}
  }
})
test('new kit opts out for absent and non-Christmas seasons',()=>{
  for(const [name,key]of changed) {
    const w=reviewWorld(name,key);w.res=1
    const empty=digest(canvas(400,248).buf)
    for(const season of[undefined,{}, {name:'summer'}]) {w.season=season;assert.equal(additions(w),empty,name)}
  }
})
test('new fixture paint stays in surviving air and outside scenery, hazard and exit reservations',()=>{
  for(const [name,key]of changed) {
    const w=reviewWorld(name,key);w.res=2
    const boxes=D.christmasMachineReservations(w),calls=[]
    D.drawChristmasMachines({save(){},restore(){},fillRect(...r){assert.ok(calls.length<3000);calls.push(r)}},w)
    for(const r of calls) {
      assert.ok(r.every(Number.isFinite)&&r.every(n=>Number.isInteger(n*2)),name)
      assert.ok(D.christmasClear(boxes,...r),name)
      assert.ok(D.mechanismAir(w,r[0],r[1])&&D.mechanismAir(w,r[0]+r[2]-0.5,r[1]+r[3]-0.5),name)
    }
    w.terrain.fill(w.k.DIRT);w.terrainVersion++
    let count=0;D.drawChristmasMachines({save(){},restore(){},fillRect(){count++}},w)
    assert.equal(count,0,name)
  }
})
test('opaque live faces, bodies and umbrellas keep their exact pixels in all new full frames',()=>{
  for(const [name,key]of changed)for(const res of[1,2]) {
    const w=reviewWorld(name,key);w.res=res
    const pal=P.build(themeOf('tokyo-night').theme,w.level);api.tint(pal)
    const mask=canvas(400*res,248*res,'#00000000');mask.ctx.setTransform(res,0,0,res,0,0)
    D.drawActorColony(mask.ctx,w,pal,{})
    const before=christmasFrame(base,api,w,res).buf,after=christmasFrame(D,api,w,res).buf
    const a=createHash('sha256'),b=createHash('sha256')
    for(let i=0;i<mask.buf.length;i+=4)if(mask.buf[i+3]===255){a.update(before.subarray(i,i+4));b.update(after.subarray(i,i+4))}
    const pin=workPins.c6cast[`${name}/${res}`],oldHash=a.digest('hex')
    if(pin)assert.equal(oldHash,pin.before,name+' historical cast pin')
    assert.equal(b.digest('hex'),pin?pin.after:oldHash,name)
  }
})
test('frozen colleagues lose their hat when thawed and lift wreaths follow the real car',()=>{
  const w=reviewWorld('Ice Cave','frozen');w.res=1
  const f=w.frozen.find(f=>f.thawedAt<0),pal=P.build(themeOf('tokyo-night').theme,w.level)
  f.thawedAt=0;w.ticks=400
  const a=canvas(400,248),b=canvas(400,248)
  D.drawFrozen(a.ctx,w,pal,f);base.drawFrozen(b.ctx,w,pal,f)
  assert.equal(digest(a.buf),digest(b.buf))
  const tower=reviewWorld('Skyscraper','lifts'),l=tower.lifts.find(l=>!l.stairs)
  const record=()=>{const out=[];D.drawChristmasLiftCar({fillRect(...r){out.push(r)}},tower,l);return out}
  const c=record();l.car+=3;const d=record()
  for(let i=0;i<c.length;i++){assert.equal(d[i][0],c[i][0]);assert.equal(d[i][1]-c[i][1],12)}
})
test('letter cargo travels beside the tube capsule window and holds a still reduced-motion pose',()=>{
  const w=reviewWorld('Mail Room','pads');w.res=2
  w.terrain.fill(w.k.EMPTY);w.hazards=[];w.decor=[];w.mission=null
  const route=[{x:100,y:100},{x:100,y:80},{x:200,y:80},{x:200,y:120}]
  const paint=age=>{
    const img=canvas(400,248),rects=[]
    img.ctx.fillRect=(...r)=>rects.push(r)
    D.drawChristmasTubeLetter(img.ctx,w,route,age)
    return rects
  }
  const seen=new Set()
  for(let age=0;age<8;age++) {
    const pos=D.tubePosition(route,age/7),rects=paint(age)
    assert.ok(rects.length>0)
    for(const [x,y,width,height]of rects) {
      assert.ok(pos.horizontal ? y>pos.y+3 : x>pos.x+3,'cargo leaves the passenger window intact')
      assert.ok(width>0&&height>0)
    }
    seen.add(JSON.stringify(rects))
  }
  assert.ok(seen.size>1)
  w.reducedMotion=true;const still=JSON.stringify(paint(0))
  for(const age of[2,5,7])assert.equal(JSON.stringify(paint(age)),still)
  for(const age of[-1,8,20])assert.equal(paint(age).length,0)
  w.season=undefined;assert.equal(paint(3).length,0)
})
