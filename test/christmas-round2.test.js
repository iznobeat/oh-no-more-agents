import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import os from "node:os"
import path from "node:path"
import {createHash} from "node:crypto"
import {load,canvas,frame,themeOf} from "../tools/render.js"
import {season} from "../tools/gag-art.js"
import {TEAM,teamPose,teamSheet} from "../tools/christmas-team-art.js"
const D=load("Draw.js"), S=load("Sim.js"), P=load("Palette.js")
const api=season(fs.readFileSync(new URL("../public/agents/season.js",import.meta.url),"utf8"),"?season=christmas")
const hash=b=>createHash("sha256").update(b).digest("hex")
function record(fn,res=2) {
 const img=canvas(800,496),ctx=img.ctx,calls=[],fill=ctx.fillRect.bind(ctx)
 ctx.setTransform(res,0,0,res,0,0)
 ctx.fillRect=(...a)=>{assert.ok(calls.length<6000,"bounded paint");assert.ok(a.every(Number.isFinite));assert.ok(a.every(v=>Number.isInteger(v*res)),"art grid");assert.ok(a[2]>0&&a[3]>0);calls.push([...a,ctx.fillStyle,ctx.globalAlpha]);fill(...a)}
 fn(ctx);return{calls,digest:hash(img.buf)}
}
function north(level=21){const w=S.generate(level,0,3);Object.assign(w,{res:2,ticks:400});return w}

test("dense swags find safe undersides in all twenty ordinary biomes, with a visible wire and broad chase",()=>{
 let total=0
 for(let level=1;level<=20;level++){
  const w=S.generate(level,0,3);api.dress(w)
  const lights=w.seasonProps.filter(p=>p.kind==="lights");assert.ok(lights.length>0,w.biome);total+=lights.length
  for(const res of[1,2]){
   Object.assign(w,{res,agents:[],enemies:[],ticks:0,seasonProps:lights.slice(0,1)})
   const snow=api.SEASONS.christmas.snow,gift=api.SEASONS.christmas.gift
   api.SEASONS.christmas.snow=0;api.SEASONS.christmas.gift=false
   try{
    const a=record(ctx=>api.paint(ctx,w),res);w.ticks=7;const b=record(ctx=>api.paint(ctx,w),res)
    assert.notEqual(a.digest,b.digest,"one bulb advances each seven ticks")
    assert.ok(a.calls.some(c=>c[4]==="#50876a"&&c[2]>=3),"visible wire")
    assert.ok(a.calls.filter(c=>c[2]===2&&c[3]===3).length>=7,"seven full-pixel bulbs")
    if(res===2)assert.ok(a.calls.some(c=>c[2]===3&&c[3]===4&&c[5]<1),"half-pixel glow halo")
   }finally{api.SEASONS.christmas.snow=snow;api.SEASONS.christmas.gift=gift}
  }
 }
 assert.ok(total>=150,`${total} swags; round one had 76 on these layouts`)
})

test("all red-team silhouettes get visible seasonal kit at native and page resolution, including the North Pole",()=>{
 for(const kind of TEAM)for(const res of[1,2])for(const dir of[-1,1])for(const phase of[0,4,10]){
  const plain=teamPose(D,kind,res,dir,phase,false),dressed=teamPose(D,kind,res,dir,phase,true)
  assert.notEqual(hash(plain.img.buf),hash(dressed.img.buf),`${kind}:${res}:${dir}:${phase}`)
 }
 const w=north();api.dress(w);assert.equal(w.season.hats,null);assert.ok(D.christmasRedTeam(w))
 assert.ok(D.christmasRedTeam({season:{hats:"santa"}}));assert.ok(!D.christmasRedTeam({season:{hats:"other"}}))
 // Baked from the pre-round renderer: no season changes neither resolution.
 const h=createHash("sha256")
 for(const kind of TEAM)for(const res of[1,2])for(const dir of[-1,1])for(const phase of[0,4,10])h.update(teamPose(D,kind,res,dir,phase,false).img.buf)
 assert.equal(h.digest("hex"),"ebcfe2d9114ca92bd630d7443cbf6dabcd371dcae40b71ef0ed6f18c13fc6327")
})

test("caps ride the guard march and the bouncer's nod and neck motion; crowns retain holly",()=>{
 const pal=P.build(themeOf("tokyo-night").theme,1),w=S.generate(1,0,3)
 Object.assign(w,{res:2,season:{redHats:"santa"},agents:[]})
 const en={id:0,kind:"gun",dir:1,x:20,y:30,anim:0,state:"walk",hp:3}
 const caps=[]
 for(const anim of[0,4]){en.anim=anim;w.ticks=100;const r=record(ctx=>D.drawEnemy(ctx,w,pal,en,{}));caps.push(r.calls.filter(c=>c[4]==="#d42a3c")[0][1])}
 assert.equal(caps[0]-caps[1],1,"cap rises with the guard's head")
 en.kind="bouncer";en.anim=0
 const origins=[]
 for(const ticks of[0,12,640,648]){w.ticks=ticks;const gag=D.bouncerGag(w,en),r=record(ctx=>D.drawEnemy(ctx,w,pal,en,{}));const cap=r.calls.find(c=>c[4]==="#d42a3c");origins.push(cap.slice(0,2));assert.equal(cap[0],76+1+(gag?gag.hx:0));assert.equal(cap[1],108-1-4+(gag?gag.hy:0))}
 assert.ok(new Set(origins.map(JSON.stringify)).size>1)
 en.kind="gun";en.boss=true;w.ticks=40
 const crown=record(ctx=>D.drawEnemy(ctx,w,pal,en,{}));assert.ok(crown.calls.some(c=>c[4]==="#246f43"));assert.ok(!crown.calls.some(c=>c[4]==="#d42a3c"))
 for(const res of[1,2]){w.res=res;assert.ok(record(ctx=>D.drawChristmasAntlers(ctx,w,50,50,-1),res).calls.length>5)}
})

test("North Pole native frames pin the reviewed snow texture (re-pinned for the elves, LOG 455, the ponds, 457, the snow, C3, and scarves/gift hatch, C4)",()=>{
 const random=Math.random,h=createHash("sha256");Math.random=()=>0.5
 try{for(const level of[21,42])h.update(frame(S,D,P,{level,seed:3,ticks:240,res:1,theme:"tokyo-night"}).img.buf)}finally{Math.random=random}
 assert.equal(h.digest("hex"),"5917bd2859a2dc77f937d78a47c6bf84cf12d020be753eb9aa2dbf9c4d1a3c05")
})

test("village windows switch occasionally, smoke moves, glints sparkle and reduced motion holds every new pixel",()=>{
 for(const level of[21,42]){
  const w=north(level),scene=D.northPageLayout(w);assert.equal(D.northPageLayout(w),scene);assert.ok(scene.houses.length>5);assert.ok(scene.caps.length>5)
  const before=JSON.stringify(w),sets=[new Set(),new Set(),new Set()]
  for(const ticks of[7,20,60,...Array.from({length:9},(_,i)=>i*180)]){
   w.ticks=ticks
   for(const [i,fn]of[D.drawNorthWindows,D.drawNorthSmoke].entries())sets[i].add(record(ctx=>{for(const b of scene.houses)fn(ctx,w,b,ticks,[])}).digest)
   sets[2].add(record(ctx=>{for(const b of scene.caps)D.drawNorthSparkle(ctx,w,b,ticks)}).digest)
   record(ctx=>D.drawNorthLife(ctx,w));record(ctx=>D.drawNorthVillagePage(ctx,w));record(ctx=>D.drawNorthAurora(ctx,w))
  }
  for(const s of sets)assert.ok(s.size>1)
  w.reducedMotion=true;w.ticks=20;const a=record(ctx=>D.drawNorthLife(ctx,w));w.ticks=600;assert.equal(record(ctx=>D.drawNorthLife(ctx,w)).digest,a.digest)
  w.ticks=400;delete w.reducedMotion;assert.equal(JSON.stringify(w),before,"drawing never writes to the world")
  w.res=1;assert.equal(record(ctx=>D.drawNorthLife(ctx,w),1).calls.length,0);assert.equal(record(ctx=>D.drawNorthVillagePage(ctx,w),1).calls.length,0)
 }
})

test("live village paint clips all terrain and protected decor; page deer and sleigh details stay on the half-pixel grid",()=>{
 const w=north(),b=D.northPageLayout(w).houses[0]
 w.terrain.fill(w.k.ROCK)
 assert.equal(record(ctx=>D.drawNorthWindows(ctx,w,b,0,[])).calls.length,0)
 assert.equal(record(ctx=>D.drawNorthSmoke(ctx,w,b,0,[])).calls.length,0)
 w.terrain.fill(w.k.EMPTY)
 const cap={x:40,y:40,row:10,col:10,seed:0}
 w.terrain[10*w.k.COLS+10]=w.k.BRICK
 assert.equal(record(ctx=>D.drawNorthSparkle(ctx,w,cap,5)).calls.length,0,"built brick is not fresh snow")
 const box={x:b.x-20,y:b.y-30,width:80,height:80}
 assert.equal(record(ctx=>D.drawNorthWindows(ctx,w,b,0,[box])).calls.length,0)
 assert.equal(record(ctx=>D.drawNorthSmoke(ctx,w,b,0,[box])).calls.length,0)
 for(const dir of[-1,1])for(const t of[0,3]){
  record(ctx=>D.drawSleighFine(ctx,50,50,dir));record(ctx=>D.drawSleighDeerFine(ctx,50,50,dir,t));record(ctx=>D.drawReindeerFine(ctx,50,50,dir))
 }
 record(ctx=>D.drawNorthDoorLight(ctx,w))
})

test("red-team review command retains a bounded side-by-side sheet at both resolutions",()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),"christmas-team-"))
 try{const img=teamSheet("HEAD",out);assert.equal(img.W,1536);assert.equal(img.H,640);assert.ok(fs.statSync(path.join(out,"red-team-sheet.png")).size>1000)}finally{fs.rmSync(out,{recursive:true,force:true})}
})
