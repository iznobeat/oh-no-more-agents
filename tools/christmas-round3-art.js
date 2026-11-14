// Native/page full frames and rare arrivals, before on the left of each row.
import path from "node:path"
import {execFileSync} from "node:child_process"
import {fileURLToPath} from "node:url"
import {load,canvas,frame,side,stack,crop,writePNG,themeOf} from "./render.js"
import {renderer} from "./gag-art.js"
export function round3Sheets(base,out) {
 const S=load("Sim.js"),P=load("Palette.js"),after=load("Draw.js")
 const before=renderer(execFileSync("git",["show",`${base}:public/agents/Draw.js`],{maxBuffer:4*1024*1024,stdio:["ignore","pipe","pipe"]}).toString())
 const random=Math.random;Math.random=()=>0.5
 try {
  for(const res of[1,2]) {
   const rows=[]
   for(const level of[21,42])for(const ticks of[350,900]) {
    rows.push(side([before,after].map(D=>frame(S,D,P,{level,seed:3,ticks,theme:"tokyo-night",res,page:res===2}).img)))
   }
   writePNG(path.join(out,`pole-res${res}-sheet.png`),stack(rows))
   const report=[],arrival=[]
   for(const motion of[false,true])for(const age of[0,4,10,15]) {
    report.push(side([before,after].map(D=>{
     const w=S.generate(1,0,3);Object.assign(w,{res,season:{name:"christmas"},saved:12,toRelease:16,doneTicks:80,ticks:age*18,reducedMotion:motion})
     const img=canvas(400*res,248*res,"#1a1b26"),pal=P.build(themeOf("tokyo-night").theme,1)
     img.ctx.setTransform(res,0,0,res,0,0);D.drawLevelResults(img.ctx,w,pal);return img
    })))
    arrival.push(side([before,after].map(D=>{
     const w=S.generate(21,0,3),e=w.exit
     Object.assign(w,{res,saved:1,ticks:350,reducedMotion:motion,agents:[{id:0,x:e.x+1,y:e.y+1,state:"saved",fade:age}]});if(w.mission)w.mission.done=true
     const pal=P.build(themeOf("tokyo-night").theme,21),img=canvas(400*res,248*res)
     D.drawTerrain(img.ctx,w,pal);D.drawExitGlow(img.ctx,w,pal);D.drawExitWelcome(img.ctx,w,pal)
     if(D.drawNorthWorkshopArrival)D.drawNorthWorkshopArrival(img.ctx,w)
     return crop(img,(e.x*4-10)*res,(e.y*4-5)*res,(e.w*4+20)*res,(e.h*4+15)*res)
    })))
   }
   writePNG(path.join(out,`report-res${res}-sheet.png`),stack(report))
   writePNG(path.join(out,`arrival-res${res}-sheet.png`),stack(arrival))
  }
 } finally {Math.random=random}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)) {
 const a=process.argv.slice(2),get=(n,d)=>a.includes(n)?a[a.indexOf(n)+1]:d
 round3Sheets(get("--base","HEAD"),get("--out","/tmp/xmas-dressing/r3-review"))
}
