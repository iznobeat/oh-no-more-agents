// Both facings and three motion phases, before/after at native and page res.
// node tools/christmas-team-art.js --base main --out /tmp/xmas-dressing/r2-1
import fs from "node:fs"
import path from "node:path"
import {execFileSync} from "node:child_process"
import {fileURLToPath} from "node:url"
import {load,canvas,writePNG,themeOf} from "./render.js"
import {renderer,copyPixels,doublePixels} from "./gag-art.js"
const S=load("Sim.js"), P=load("Palette.js")
export const TEAM=["gun","bouncer","moderator","sniper","sniper-camp","operator","drone","xeno"]
export function teamPose(D,kind,res,dir,phase,dressed=true) {
  const w=S.generate(1,0,3), pal=P.build(themeOf("tokyo-night").theme,1)
  Object.assign(w,{res,ticks:phase,agents:[],season:dressed?{redHats:"santa"}:null})
  const en={id:0,kind:kind.split("-")[0],boss:kind==="moderator",state:kind==="sniper-camp"?"camp":"walk",x:4,y:7,dir,anim:phase,timer:0,hp:3,maxHp:3}
  if(en.boss)en.kind="gun"
  const img=canvas(32*res,40*res,"#24283b")
  img.ctx.setTransform(res,0,0,res,0,0)
  D.drawEnemy(img.ctx,w,pal,en,{})
  return {img,w,en}
}
export function teamSheet(base,out) {
  const old=renderer(execFileSync("git",["show",`${base}:public/agents/Draw.js`],{maxBuffer:4*1024*1024,stdio:["ignore","pipe","pipe"]}).toString()),now=load("Draw.js")
  const sheet=canvas(1536,TEAM.length*80,"#24283b")
  for(let row=0;row<TEAM.length;row++)for(const res of[1,2])for(const [tag,D]of[[0,old],[1,now]]) {
    let pose=0
    for(const dir of[-1,1])for(const phase of[0,4,10]) {
      const {img}=teamPose(D,TEAM[row],res,dir,phase)
      copyPixels(sheet,res===1?doublePixels(img):img,(res-1)*768+tag*384+pose++*64,row*80)
    }
  }
  fs.mkdirSync(out,{recursive:true})
  writePNG(path.join(out,"red-team-sheet.png"),sheet)
  return sheet
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const args=process.argv.slice(2),get=(key,fallback)=>args.includes(key)?args[args.indexOf(key)+1]:fallback
 teamSheet(get("--base","main"),get("--out","/tmp/christmas-team"))
}
