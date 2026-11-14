import test from "node:test"
import assert from "node:assert/strict"
import fs from "node:fs"
import {createHash} from "node:crypto"
import {load,canvas} from "../tools/render.js"
import {season} from "../tools/gag-art.js"
const S=load("Sim.js"), source=fs.readFileSync(new URL("../public/agents/season.js",import.meta.url),"utf8")
const api=season(source,"?season=christmas")
const digest=buf=>createHash("sha256").update(buf).digest("hex")
function props(w) {
  // Isolate the props from the existing snow and gift.
  const snow=api.SEASONS.christmas.snow,gift=api.SEASONS.christmas.gift
  api.SEASONS.christmas.snow=0;api.SEASONS.christmas.gift=false
  const img=canvas(800,496), list=[],ctx=img.ctx
  ctx.setTransform(w.res||1,0,0,w.res||1,0,0)
  const fill=ctx.fillRect.bind(ctx)
  ctx.fillRect=(...a)=>{assert.ok(list.length<6000);list.push(a);fill(...a)}
  try{api.paint(ctx,w)}finally{api.SEASONS.christmas.snow=snow;api.SEASONS.christmas.gift=gift}
  return {list,hash:digest(img.buf)}
}
function overlaps(a,b){return a[0]<b.x+b.width&&a[0]+a[2]>b.x&&a[1]<b.y+b.height&&a[1]+a[3]>b.y}
test("cached Christmas props exist in every biome, with an unknown-biome default and North Pole opt-out",()=>{
 for(let level=1;level<=S.BIOMES.length;level++){
  const w=S.generate(level,0,3);api.dress(w)
  if(w.biome==="North Pole"){assert.equal(w.seasonProps.length,0);continue}
  assert.ok(w.seasonProps.length>0,w.biome)
  assert.ok(w.seasonProps.some(p=>p.kind==="wreath"),w.biome+" wreath")
  const cached=w.seasonProps;props(w);w.ticks+=100;api.dress(w);assert.equal(w.seasonProps,cached)
 }
 for(const biome of["Future Biome","North Pole"]){const w=S.generate(1,0,3);w.biome=biome;api.dress(w);assert.equal(w.seasonProps.length===0,biome==="North Pole")}
})
test("new prop pixels preserve agents, umbrellas, enemies, hazard zones and exit faces at both resolutions",()=>{
 for(let level=1;level<=S.BIOMES.length;level++)for(const res of[1,2]){
  const w=S.generate(level,0,3);w.res=res;api.dress(w)
  const c=w.k.CELL,e=w.exit,boxes=[{x:e.x*c-7,y:e.y*c-7,width:e.w*c+14,height:e.h*c+14}]
  for(const h of w.hazards)boxes.push({x:h.zx0*c-3,y:h.zy0*c-3,width:(h.zx1-h.zx0+1)*c+6,height:(h.zy1-h.zy0+1)*c+6})
  // Force a floater directly into every cached prop, including the wreath.
  for(const p of w.seasonProps){
   const ag={x:(p.x+p.width/2)/c,y:(p.y+p.height)/c-1,id:999,floater:true,state:"fall"}
   w.agents=[ag]
   const b={x:ag.x*c-13,y:(ag.y+1)*c-37,width:26,height:37}
   for(const call of props(w).list)assert.ok(!overlaps(call,b),w.biome+" floater")
  }
  w.agents=[]
  for(const call of props(w).list){assert.ok(call.every(n=>Number.isFinite(n)&&n*res===Math.round(n*res)));for(const b of boxes)assert.ok(!overlaps(call,b),w.biome)}
  for(const p of w.seasonProps){w.enemies=[{x:(p.x+p.width/2)/c,y:(p.y+p.height)/c-1}];for(const call of props(w).list)assert.ok(!overlaps(call,p),w.biome+" enemy")}
 }
})
test("prop chase, wreath glint and snowman head are tick-pure; reduced motion freezes all three",()=>{
 const w=S.generate(1,0,3);w.agents=[];w.enemies=[];api.dress(w)
 assert.ok(w.seasonProps.some(p=>p.kind==="lights"));assert.ok(w.seasonProps.some(p=>p.kind==="snowman"))
 for(const p of w.seasonProps.filter(p=>p.kind!=="lights").slice(0,2).concat(w.seasonProps.filter(p=>p.kind==="lights").slice(0,1))){
  const all=w.seasonProps;w.seasonProps=[p]
  const hashes=new Set()
  for(const t of[0,9,24,42,64]){w.ticks=t;const a=props(w).hash;assert.equal(props(w).hash,a);hashes.add(a)}
  assert.ok(hashes.size>1,p.kind)
  w.reducedMotion=true;const a=props(w).hash;w.ticks+=115;assert.equal(props(w).hash,a);w.reducedMotion=false;w.seasonProps=all
 }
 const random=Math.random;Math.random=()=>{throw Error("render RNG")};try{props(w)}finally{Math.random=random}
})
test("new dressing skips plates and outages, disappears with support and stays absent without season",()=>{
 const w=S.generate(1,0,3);api.dress(w);w.done=true;assert.equal(props(w).list.length,0)
 w.done=false;w.outage={at:0,len:10};assert.equal(props(w).list.length,0)
 w.outage=null;w.seasonProps=w.seasonProps.filter(p=>p.kind!=="wreath");w.terrain.fill(w.k.EMPTY);assert.equal(props(w).list.length,0)
 w.season=null;assert.equal(props(w).list.length,0)
})
