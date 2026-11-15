// Native/page review: baseline left, revised right; deterministic rare poses.
import path from "node:path"
import {execFileSync} from "node:child_process"
import {fileURLToPath} from "node:url"
import {load,canvas,frame,side,stack,crop,writePNG,themeOf} from "./render.js"
import {renderer} from "./gag-art.js"
function poseWorld(S,res,state,dir,anim) {
 const w=S.generate(42,0,3),ag=Object.assign(S.spawn(w),{id:1,x:25,y:25,dir,state,anim,fade:anim,still:0,trait:"steady",special:false,fall:10,floater:true,ownBrolly:true})
 Object.assign(w,{res,ticks:120,agents:[ag],enemies:[],feed:[]})
 if(state==="saved") {ag.x=w.exit.x+1;ag.y=w.exit.y+2;if(w.mission)w.mission.done=true}
 return w
}
export function scarfFrame(D,S,P,res,state,dir,anim,mode="") {
 const w=poseWorld(S,res,state,dir,anim),ag=w.agents[0]
 w.reducedMotion=mode==="reduced"
 if(mode==="idle")ag.still=100
 if(mode==="ice") {const at=Math.floor(ag.y)*w.k.COLS+Math.floor(ag.x);w.iceAt[at]=1;w.terrain[at+w.k.COLS]=w.k.DIRT}
 const img=canvas(400*res,248*res,"#292b39"),p=P.build(themeOf("tokyo-night").theme,42)
 img.ctx.setTransform(res,0,0,res,0,0);D.drawAgent(img.ctx,w,p,ag,{})
 return crop(img,(ag.x*4-20)*res,((ag.y+1)*4-32)*res,40*res,38*res)
}
function hatchFrame(D,S,P,res,timer,ticks,reduced) {
 const w=S.generate(21,0,3);Object.assign(w,{res,ticks,releaseTimer:timer,reducedMotion:reduced})
 const img=canvas(400*res,248*res,"#292b39"),p=P.build(themeOf("tokyo-night").theme,21)
 img.ctx.setTransform(res,0,0,res,0,0);D.drawHatch(img.ctx,w,p)
 return crop(img,(w.hatch.x*4-18)*res,(w.hatch.y*4-14)*res,36*res,30*res)
}
export function round4Sheets(base,out) {
 const S=load("Sim.js"),P=load("Palette.js"),after=load("Draw.js")
 const before=renderer(execFileSync("git",["show",`${base}:public/agents/Draw.js`],{maxBuffer:4*1024*1024,stdio:["ignore","pipe","pipe"]}).toString())
 const random=Math.random;Math.random=()=>0.5
 try {for(const res of[1,2]) {
  const full=[],poses=[],hatch=[],close=[]
  for(const level of[21,42])for(const ticks of[120,350])full.push(side([before,after].map(D=>frame(S,D,P,{level,seed:3,ticks,theme:"tokyo-night",res,page:res===2}).img)))
  writePNG(path.join(out,`pole-res${res}-sheet.png`),stack(full))
  for(const ticks of[120,350])close.push(side([before,after].map(D=>{
   const {img}=frame(S,D,P,{level:42,seed:3,ticks,theme:"tokyo-night",res,page:res===2})
   return crop(img,20*res,50*res,168*res,104*res)
  })))
  writePNG(path.join(out,`crop-res${res}-sheet.png`),stack(close),2)
  for(const [state,mode]of[["walk",""],["walk","ice"],["walk","idle"],["fall",""],["saved",""],["walk","reduced"]])for(const dir of[1,-1]) {
   poses.push(side([0,4,8,12].map(anim=>side([before,after].map(D=>scarfFrame(D,S,P,res,state,dir,anim,mode))))))
  }
  writePNG(path.join(out,`colony-res${res}-sheet.png`),stack(poses),res===1?2:1)
  const w=S.generate(21,0,3)
  for(const ticks of[0,9,18,120])for(const reduced of[false,true])hatch.push(side([before,after].map(D=>hatchFrame(D,S,P,res,w.releaseInterval-3,ticks,reduced))))
  writePNG(path.join(out,`hatch-res${res}-sheet.png`),stack(hatch),2)
 }}finally{Math.random=random}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const a=process.argv.slice(2),get=(n,d)=>a.includes(n)?a[a.indexOf(n)+1]:d
 round4Sheets(get("--base","HEAD"),get("--out","/tmp/xmas-dressing/r4-review"))
}
