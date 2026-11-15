import test from "node:test"
import assert from "node:assert/strict"
import {createHash} from "node:crypto"
import {load,canvas,frame,themeOf} from "../tools/render.js"
import {round4Sheets} from "../tools/christmas-round4-art.js"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
const D=load("Draw.js"),S=load("Sim.js"),P=load("Palette.js")
const hash=b=>createHash("sha256").update(b).digest("hex")
function world(res=2,level=21) {return Object.assign(S.generate(level,0,3),{res,ticks:120})}
function actor(w,state="walk") {return Object.assign(S.spawn(w),{id:1,state,dir:1,x:25,y:25,anim:0,fade:0,still:0,special:false,trait:"steady"})}
function ink(w,fn) {
 const img=canvas(400*w.res,248*w.res),ctx=img.ctx,calls=[],fill=ctx.fillRect.bind(ctx)
 ctx.setTransform(w.res,0,0,w.res,0,0)
 ctx.fillRect=(...a)=>{assert.ok(calls.length<5000);assert.ok(a.every(Number.isFinite));assert.ok(a.every(n=>Number.isInteger(n*w.res)));assert.ok(a[2]>0&&a[3]>0);calls.push([...a,ctx.fillStyle]);fill(...a)}
 fn(ctx);return {digest:hash(img.buf),calls}
}
function scarf(w,ag,drop=0,idle=false) {return ink(w,c=>D.drawNorthScarf(c,w,ag,100,100,ag.dir,drop,idle))}
test("North Pole scarves are bold, striped, id-coloured, mirrored and knitted at page resolution",()=>{
 for(const res of[1,2]) {
  const w=world(res),ag=actor(w),colours=new Set()
  for(const id of[0,1,2]) {ag.id=id;const a=scarf(w,ag);colours.add(a.digest);assert.ok(a.calls.some(c=>c[4]==="#fff1da"));assert.ok(a.calls.some(c=>c[2]===2&&c[3]===2));assert.equal(a.calls.some(c=>c[2]===0.5),res===2)}
  assert.equal(colours.size,3)
  const right=scarf(w,ag);ag.dir=-1;const left=scarf(w,ag)
  for(let i=0;i<right.calls.length;i++) {const a=right.calls[i],b=left.calls[i];assert.equal(a[0]+b[0]+a[2],208);assert.equal(a[1],b[1])}
 }
})
test("scarf neck follows the supplied coarse/page body drop and stays below face and umbrella",()=>{
 for(const res of[1,2]) {
  const w=world(res),ag=actor(w)
  for(const anim of[0,2,4,6,8,10,12,14]) {
   ag.anim=anim;const m=D.agentDrawMotion(w,ag,"walk",false),a=scarf(w,ag,m.drop)
   assert.ok(a.calls.every(c=>c[1]>=107+m.drop))
   assert.equal(a.calls[0][1],107+m.drop)
  }
 }
})
test("tails stream further on surviving ice, flutter in a fall and flick on the saved fade",()=>{
 for(const res of[1,2]) {
  const w=world(res),ag=actor(w),base=D.northScarfMotion(w,ag,false)
  const at=Math.floor(ag.y)*w.k.COLS+Math.floor(ag.x);w.iceAt[at]=1;w.terrain[at+w.k.COLS]=w.k.DIRT
  assert.ok(D.northScarfMotion(w,ag,false).length>base.length)
  w.terrain[at+w.k.COLS]=0;assert.equal(D.northScarfMotion(w,ag,false).length,base.length)
  for(const state of["fall","saved"]) {
   ag.state=state;const digests=new Set()
   for(const age of[0,4,8,12]) {ag.anim=age;ag.fade=age;digests.add(scarf(w,ag).digest)}
   assert.ok(digests.size>=3)
  }
  ag.state="wait";const a=scarf(w,ag).digest;ag.anim=60;w.ticks=500;assert.equal(scarf(w,ag).digest,a)
  ag.state="walk";assert.equal(D.northScarfMotion(w,ag,true).length,0)
 }
})
test("reduced scarves hang still, and all new drawing reads the world without mutation",()=>{
 for(const res of[1,2]) {
  const w=world(res),ag=actor(w,"fall");w.reducedMotion=true
  const a=scarf(w,ag).digest;ag.anim=40;ag.fade=12;w.ticks=999;assert.equal(scarf(w,ag).digest,a)
  const snapshot=JSON.stringify(w),agBefore=JSON.stringify(ag),p=P.build(themeOf("tokyo-night").theme,21)
  Object.freeze(w);Object.freeze(ag);scarf(w,ag);ink(w,c=>D.drawHatch(c,w,p))
  assert.equal(JSON.stringify(w),snapshot);assert.equal(JSON.stringify(ag),agBefore)
 }
})
test("gift hatch keeps original mouth, footprint and opening timing at both resolutions",()=>{
 for(const res of[1,2]) {
  const w=world(res),p=P.build(themeOf("tokyo-night").theme,21),x=w.hatch.x*4,y=w.hatch.y*4
  for(const ticks of[0,9,18,120]) {
   w.ticks=ticks;const a=ink(w,c=>D.drawHatch(c,w,p))
   assert.ok(a.calls.some(c=>c[0]===x-9&&c[1]===y+2&&c[2]===18&&c[3]===3))
   assert.ok(a.calls.every(c=>c[0]>=x-16&&c[0]+c[2]<=x+16&&c[1]>=y-13&&c[1]+c[3]<=y+12))
   assert.equal(a.calls.at(-1)[1],y+2+Math.round(8*Math.sin(D.hatchOpen(w)*Math.PI/2)))
  }
  const versions=new Set()
  for(const left of[1,2,3,4,5]){w.releaseTimer=w.releaseInterval-left;versions.add(ink(w,c=>D.drawHatch(c,w,p)).digest)}
  assert.equal(versions.size,3)
  w.reducedMotion=true;assert.equal(D.northHatchShake(w),0)
  const a=ink(w,c=>D.drawHatch(c,w,p)).digest;w.releaseTimer++;assert.equal(ink(w,c=>D.drawHatch(c,w,p)).digest,a)
  w.reducedMotion=false;w.released=w.toRelease;assert.equal(D.northHatchShake(w),0)
 }
})
test("ordinary biomes retain complete baseline pixels at both scales",()=>{
 const h=createHash("sha256"),random=Math.random;Math.random=()=>0.5
 try {for(let level=1;level<=20;level++)for(const res of[1,2])for(const ticks of[120,350])h.update(frame(S,D,P,{level,seed:3,ticks,theme:"tokyo-night",res,page:res===2}).img.buf)}finally{Math.random=random}
 assert.equal(h.digest("hex"),"7bb0cef0fc82da3a4e05509b823ca24f3ee5a9262e135237859ab0ada20eb575")
})
test("round four review retains full boards, both-facing poses and hatch phases at both scales",()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),"christmas-r4-"))
 try {round4Sheets("8dc517a349da16d9fc5309422f4a6b8f8bce402d",out);for(const res of[1,2])for(const kind of["pole","colony","hatch","crop"])assert.ok(fs.statSync(path.join(out,`${kind}-res${res}-sheet.png`)).size>300)}finally{fs.rmSync(out,{recursive:true,force:true})}
})

test("scarves follow trait head offsets without painting over faces or glasses",()=>{
 for(const res of[1,2])for(const dir of[1,-1])for(const trait of Object.keys(D.TRAIT_LOOKS)) {
  const w=world(res),ag=actor(w);Object.assign(ag,{dir,trait})
  const p=P.build(themeOf("tokyo-night").theme,21)
  for(const anim of[0,4,12,28]) {
   ag.anim=anim;const drop=D.agentDrawMotion(w,ag,"walk",false).drop
   const head=ink(w,c=>D.drawAgentDryHead(c,w,p,ag,100,100,dir,p.hair,p.skin,drop))
   const cloth=scarf(w,ag,drop)
   const face=head.calls.filter(c=>[p.skin,p.eye,p.lens].includes(c[4]))
   for(const a of cloth.calls)for(const b of face)assert.ok(a[0]+a[2]<=b[0]||b[0]+b[2]<=a[0]||a[1]+a[3]<=b[1]||b[1]+b[3]<=a[1])
  }
 }
})
