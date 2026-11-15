import test from 'node:test'
import assert from 'node:assert/strict'
import {createHash} from 'node:crypto'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {load,canvas,frame,themeOf} from '../tools/render.js'
import {MACHINES,machineWorld,round5Sheets} from '../tools/christmas-round5-art.js'
import {renderer,season} from '../tools/gag-art.js'
import {christmasFrame} from '../tools/christmas-art.js'
import {foeRoundThreeBefore} from '../tools/foe-reference.js'
const D=load('Draw.js'),S=load('Sim.js'),P=load('Palette.js')
const hash=b=>createHash('sha256').update(b).digest('hex')
function ink(w) {
  const img=canvas(400*w.res,248*w.res),calls=[],ctx=img.ctx
  ctx.setTransform(w.res,0,0,w.res,0,0)
  const fill=ctx.fillRect.bind(ctx)
  ctx.fillRect=(...a)=>{assert.ok(calls.length<4000);assert.ok(a.every(Number.isFinite));assert.ok(a.every(n=>Number.isInteger(n*w.res)));assert.ok(a[2]>0&&a[3]>0);calls.push([...a,ctx.fillStyle]);fill(...a)}
  D.drawChristmasMachines(ctx,w)
  return {calls,digest:hash(img.buf)}
}
const foeBefore=foeRoundThreeBefore(),foePins=JSON.parse(fs.readFileSync('test/fixtures/foe-round3-scenes.json','utf8'))

test('eight Christmas machines paint bold native and page kit without touching their worlds',()=>{
  for(const [name,key]of MACHINES)for(const res of[1,2]) {
    const w=machineWorld(name,key);w.res=res;const before=JSON.stringify(w)
    Object.freeze(w);const a=ink(w)
    assert.ok(a.calls.length>=6,name+' must remain visible')
    assert.ok(a.calls.some(c=>['#ff5769','#b92e46','#73e58b','#ffdc85','#ff4059','#ff5364','#ffd45c'].includes(c[4])),name)
    assert.equal(JSON.stringify(w),before)
    assert.equal(ink(w).digest,a.digest)
  }
})
test('machine kit is absent with no season, other seasons and at the North Pole',()=>{
  for(const [name,key]of MACHINES)for(const res of[1,2]) {
    const w=machineWorld(name,key);w.res=res
    for(const season of[undefined,{}, {name:'summer',hats:'santa'}]) {w.season=season;assert.equal(ink(w).calls.length,0)}
  }
  const w=S.generate(21,0,3);w.res=2;w.season={name:'christmas'};assert.equal(ink(w).calls.length,0)
})
test('ordinary out of season frames remain byte identical across every biome and resolution',()=>{
  const historical=createHash('sha256'),h=createHash('sha256'),random=Math.random;Math.random=()=>0.5
 try {for(let level=1;level<=20;level++)for(const res of[1,2])for(const ticks of[120,350]){
  h.update(frame(S,D,P,{level,seed:3,ticks,theme:'tokyo-night',res,page:res===2}).img.buf)
  historical.update(frame(S,foeBefore,P,{level,seed:3,ticks,theme:'tokyo-night',res,page:res===2}).img.buf)
 }}finally{Math.random=random}
  // Same C11 live-colony review and exact C10 scope audit as round four.
  assert.equal(historical.digest('hex'),'6cd8b9ef1425b025a89f0baa8e61c6f101688eb783620ab3c35b9687e2fc9e4b')
 assert.equal(h.digest('hex'),foePins.aggregates['120,350'].after)
})
test('new machine animation is still with reduced motion at both resolutions',()=>{
  for(const [name,key]of MACHINES)for(const res of[1,2]) {
    const w=machineWorld(name,key);Object.assign(w,{res,reducedMotion:true})
    const a=ink(w).digest
    for(const tick of[0,19,81,700]) {w.ticks=tick;assert.equal(ink(w).digest,a,name)}
  }
})
test('machine chase, belt parcels and transporter stars animate from ticks only',()=>{
  for(const [name,key]of MACHINES.filter(([n])=>['Factory','Data Center','Spaceship','Subway','Harbour','Rooftops'].includes(n))) {
    const w=machineWorld(name,key);w.res=2;const seen=new Set()
    for(const ticks of[0,8,16,24,32]) {w.ticks=ticks;seen.add(ink(w).digest)}
    assert.ok(seen.size>1,name)
  }
})
test('machine ink respects existing scenery, hazard zones, exit and current terrain',()=>{
  for(const [name,key]of MACHINES) {
    const w=machineWorld(name,key);w.res=2
    const boxes=D.christmasMachineReservations(w)
    for(const c of ink(w).calls) {
      assert.ok(D.christmasClear(boxes,...c.slice(0,4)),name)
      assert.ok(D.mechanismAir(w,c[0],c[1])&&D.mechanismAir(w,c[0]+c[2]-0.5,c[1]+c[3]-0.5),name)
    }
    w.terrain.fill(w.k.DIRT);w.terrainVersion++
    assert.equal(ink(w).calls.length,0,name)
  }
})
test('opaque colony faces and umbrellas retain their exact pixels over the new kit',()=>{
  const old=renderer(fs.readFileSync('public/agents/Draw.js','utf8').replace('  drawChristmasMachines(ctx, w)\n',''))
  const api=season(fs.readFileSync('public/agents/season.js','utf8'),'?season=christmas')
  for(const [name,key]of MACHINES)for(const res of[1,2]) {
    const w=machineWorld(name,key);w.res=res
    const p=P.build(themeOf('tokyo-night').theme,w.level);api.tint(p)
    const mask=canvas(400*res,248*res,'#00000000');mask.ctx.setTransform(res,0,0,res,0,0)
    D.drawActorColony(mask.ctx,w,p,{})
    const before=christmasFrame(old,api,w,res).buf,after=christmasFrame(D,api,w,res).buf
    const a=createHash('sha256'),b=createHash('sha256');let pixels=0
    for(let i=0;i<mask.buf.length;i+=4)if(mask.buf[i+3]===255) {a.update(before.subarray(i,i+4));b.update(after.subarray(i,i+4));pixels++}
    assert.ok(pixels>0);assert.equal(a.digest('hex'),b.digest('hex'),name)
  }
})
test('round five review retains before and after full boards and machine crops at both scales',()=>{
  const out=fs.mkdtempSync(path.join(os.tmpdir(),'christmas-r5-'))
  try {round5Sheets('9262e34d61654b51d19192adab347eb134293352',out);for(const res of[1,2])for(const kind of['full','crop'])assert.ok(fs.statSync(path.join(out,`machines-${kind}-res${res}-sheet.png`)).size>300)}finally{fs.rmSync(out,{recursive:true,force:true})}
})
test('Christmas kit follows real train and crane positions, and belt parcels never overlap',()=>{
  function calls(fn,w) {
    const out=[],ctx={clear:()=>true,fillRect(...r){out.push(r)}}
    fn(ctx,w);return out
  }
  for(const res of[1,2]) {
    const train=machineWorld('Subway','trains');train.res=res
    const a=calls(D.drawChristmasMetro,train);train.trains[0].x+=3
    const b=calls(D.drawChristmasMetro,train)
    assert.equal(a.length,b.length)
    for(let i=0;i<a.length;i++) {assert.equal(b[i][0]-a[i][0],12);assert.equal(b[i][1],a[i][1])}
    const site=machineWorld('Building Site','cranes');site.res=res;site.cranes=site.cranes.slice(0,1)
    const c=calls(D.drawChristmasCranes,site);site.cranes[0].hookX+=3
    const d=calls(D.drawChristmasCranes,site)
    for(let i=0;i<c.length;i++)assert.equal(d[i][0]-c[i][0],12)
    const factory=machineWorld('Factory','belts');factory.res=res
    for(const ticks of[0,8,24,400,999]) {
      factory.ticks=ticks
      const parcels=calls(D.drawChristmasBelts,factory).filter(r=>r[2]===8&&r[3]===7)
      for(let i=0;i<parcels.length;i++)for(let j=i+1;j<parcels.length;j++)if(parcels[i][1]===parcels[j][1])assert.ok(Math.abs(parcels[i][0]-parcels[j][0])>=11)
    }
  }
})
