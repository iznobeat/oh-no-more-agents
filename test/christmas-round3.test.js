import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {round3Sheets} from "../tools/christmas-round3-art.js"
import {createHash} from "node:crypto"
import {load,canvas,frame,themeOf,THEMES} from "../tools/render.js"
const D=load("Draw.js"),S=load("Sim.js"),P=load("Palette.js")
const hash=b=>createHash("sha256").update(b).digest("hex")
function world(level=21,res=2) {return Object.assign(S.generate(level,0,3),{res,ticks:350})}
function ink(w,fn) {
 const img=canvas(400*w.res,248*w.res),calls=[],ctx=img.ctx,fill=ctx.fillRect.bind(ctx)
 ctx.setTransform(w.res,0,0,w.res,0,0)
 ctx.fillRect=(...a)=>{assert.ok(calls.length<30000);assert.ok(a.every(Number.isFinite));assert.ok(a.every(n=>Number.isInteger(n*w.res)));assert.ok(a[2]>0&&a[3]>0);calls.push([...a,ctx.fillStyle]);fill(...a)}
 fn(ctx);return {digest:hash(img.buf),calls}
}
function pal(w,name="tokyo-night") {return P.build(themeOf(name).theme,w.level)}
function arrival(res=2) {
 const w=world(21,res),e=w.exit
 w.saved=1;w.agents=[{x:e.x+1,y:e.y+1,state:"saved",fade:0}];if(w.mission)w.mission.done=true
 return w
}
test("packed snow is static, palette coloured, readable at both scales and read only in every theme",()=>{
 for(const res of[1,2])for(const theme of Object.keys(THEMES)) {
  const w=world(42,res),p=pal(w,theme),before=JSON.stringify(w)
  const a=ink(w,c=>D.drawNorthSnowMass(c,w,p));assert.ok(a.calls.length>1500)
  const colours=new Set([...Object.values(p),D.NP_ICE])
  assert.ok(a.calls.every(c=>colours.has(c[4])))
  w.ticks=999;assert.equal(ink(w,c=>D.drawNorthSnowMass(c,w,p)).digest,a.digest)
  w.ticks=350;assert.equal(JSON.stringify(w),before)
 }
})
test("snow depth cache follows excavation and every painted pixel stays in surviving packed snow",()=>{
 const w=world(),p=pal(w),a=D.northSnowDepths(w)
 assert.equal(D.northSnowDepths(w),a)
 for(const res of[1,2]) {
  w.res=res
  const {calls}=ink(w,c=>D.drawNorthSnowMass(c,w,p))
  for(const [x,y,width,height] of calls)for(const [xx,yy]of[[x,y],[x+width-0.5,y+height-0.5]])assert.equal(w.terrain[Math.floor(yy/4)*w.k.COLS+Math.floor(xx/4)],w.k.DIRT)
 }
 const at=w.terrain.findIndex((m,i)=>m===w.k.DIRT&&a.top[i]>3)
 w.terrain[at]=0;w.terrainVersion++
 assert.notEqual(D.northSnowDepths(w),a)
 assert.equal(D.northSnowDepths(w).top[at],0)
 w.terrain=new Uint8Array(w.terrain);assert.notEqual(D.northSnowDepths(w),a)
 ink(w,c=>D.drawNorthSnowMass(c,w,p))
})
test("report roofs and wreaths dress only the North Pole or named Christmas season",()=>{
 for(const res of[1,2])for(const level of[1,21])for(const season of[undefined,{name:"christmas"},{name:"other"}]) {
  const w=world(level,res);w.season=season
  const expected=level===21||season?.name==="christmas"
  assert.equal(D.christmasReport(w),expected)
  const out=ink(w,c=>D.drawChristmasHome(c,w,30,40))
  assert.equal(out.calls.length>0,expected)
  if(expected)assert.ok(out.calls.some(c=>c[4]==="#246f43"))
 }
})
test("report lights chase slowly, flakes drift in margins, reduced motion freezes all new paint",()=>{
 for(const res of[1,2]) {
  const w=world(1,res);w.season={name:"christmas"}
  const draw=()=>ink(w,c=>D.drawChristmasReport(c,w,24,70,352,100))
  w.ticks=0;const a=draw();w.ticks=72;assert.notEqual(draw().digest,a.digest)
  w.reducedMotion=true;const b=draw();w.ticks=400;assert.equal(draw().digest,b.digest)
  assert.ok(b.calls.some(c=>c[2]===2&&c[3]===3))
  const snapshot=JSON.stringify(w);draw();assert.equal(JSON.stringify(w),snapshot)
  delete w.season;assert.equal(draw().calls.length,0)
 }
})
test("workshop arrival uses existing saved fade for less than a second at both resolutions",()=>{
 for(const res of[1,2]) {
  const w=arrival(res),digests=new Set()
  for(const fade of[0,3,8,14]) {
   w.agents[0].fade=fade;const before=JSON.stringify(w)
   const a=ink(w,c=>D.drawNorthWorkshopArrival(c,w));assert.ok(a.calls.length>2);digests.add(a.digest)
   assert.equal(JSON.stringify(w),before)
  }
  assert.equal(digests.size,4)
  w.agents[0].fade=15;assert.equal(ink(w,c=>D.drawNorthWorkshopArrival(c,w)).calls.length,0)
  w.agents[0].fade=-1;assert.equal(D.northWorkshopArrival(w),null)
 }
})
test("workshop reduced motion is only a still glow, with no flakes or rising star",()=>{
 for(const res of[1,2]) {
  const w=arrival(res);w.reducedMotion=true
  const a=ink(w,c=>D.drawNorthWorkshopArrival(c,w));assert.equal(a.calls.length,2)
  w.agents[0].fade=10;assert.equal(ink(w,c=>D.drawNorthWorkshopArrival(c,w)).digest,a.digest)
  w.agents[0].gone=true;assert.equal(D.northWorkshopArrival(w),null)
  w.agents[0].gone=false;w.agents[0].state="walk";assert.equal(D.northWorkshopArrival(w),null)
  w.agents[0].state="saved";w.agents[0].x=0;assert.equal(D.northWorkshopArrival(w),null)
  w.agents[0].x=w.exit.x+1;w.mission={done:false};assert.equal(D.northWorkshopArrival(w),null)
  w.mission.done=true;w.saved=0;assert.equal(D.northWorkshopArrival(w),null)
  w.saved=1;w.exit=null;assert.equal(D.northWorkshopArrival(w),null)
 }
})
test("ordinary out of season frames remain byte identical, including report cards",()=>{
 const h=createHash("sha256"),random=Math.random;Math.random=()=>0.5
 try {
  for(let level=1;level<=20;level++)for(const res of[1,2])for(const ticks of[350,900]) {
   h.update(frame(S,D,P,{level,seed:3,ticks,theme:"tokyo-night",res,page:res===2}).img.buf)
   const w=world(level,res),p=pal(w)
   assert.equal(ink(w,c=>{D.drawNorthSnowMass(c,w,p);D.drawNorthWorkshopArrival(c,w);D.drawChristmasReport(c,w,24,70,352,100)}).calls.length,0)
  }
 }finally{Math.random=random}
 assert.equal(h.digest("hex"),"df78032197e98bd7540b9e9aabfbb66bd4479ef0e429448b6437da15f931e270")
})

test("review retains before/after full frames, report cards and timed arrival strips at both resolutions",()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),"christmas-r3-"))
 try {
  round3Sheets("c20cb93faf374861d553f1906e590450f94f5040",out)
  for(const res of[1,2])for(const kind of["pole","report","arrival"])assert.ok(fs.statSync(path.join(out,`${kind}-res${res}-sheet.png`)).size>300)
 } finally {fs.rmSync(out,{recursive:true,force:true})}
})
