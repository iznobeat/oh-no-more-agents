// Full-frame native/page Frost review, before on the left. Also retain the
// complete out-of-season catalogue in seven-board parts for visual selection.
// node tools/alpine-art.js <before-ref> /tmp/xmas-dressing/biome2-3/review
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,frame,canvas,themeOf,stack,side,writePNG} from './render.js'
import {renderer} from './gag-art.js'
const hash=b=>createHash('sha256').update(b).digest('hex')
export function alpineCorpus(D){
 const S=load('Sim.js'),P=load('Palette.js'),pins={},random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[3,23,43])for(const ticks of[350,900])pins[`${level}/${ticks}/${res}`]=hash(frame(S,D,P,{level,ticks,res,page:res===2}).img.buf)}finally{Math.random=random}
 return pins
}
function alpineComparisons(S,P,before,after,out,res){
 const rows=[]
 for(const level of[3,23,43])for(const ticks of[350,900]){
  const opts={level,ticks,res,page:res===2},pair=side([frame(S,before,P,opts).img,frame(S,after,P,opts).img])
  rows.push(pair)
  for(const scale of[1,2])writePNG(path.join(out,`level-${level}-${ticks}-res${res}${scale===2?'-2x':''}.png`),pair,scale)
 }
 for(const scale of[1,2])writePNG(path.join(out,`full-res${res}-sheet${scale===2?'-2x':''}.png`),stack(rows),scale)
}
function alpineReduced(S,P,D,out,res){
 const rows=[]
 for(const level of[3,23,43]){
  const opts={level,ticks:350,res,page:res===2},normal=frame(S,D,P,opts),w=normal.world
  w.reducedMotion=true
  const img=canvas(normal.img.W,normal.img.H),pal=P.build(themeOf('tokyo-night').theme,level)
  D.drawTerrain(img.ctx,w,pal)
  D.drawActors(img.ctx,w,pal,res===2?{labels:false,intro:false,feed:false}:{labels:false})
  const pair=side([normal.img,img]);rows.push(pair)
  writePNG(path.join(out,`reduced-level-${level}-res${res}-2x.png`),pair,2)
 }
 for(const scale of[1,2])writePNG(path.join(out,`reduced-motion-res${res}-sheet${scale===2?'-2x':''}.png`),stack(rows),scale)
}
function alpineCatalogue(S,P,D,out,res){
 for(let group=0;group<3;group++){
  const boards=[]
  for(let level=group*7+1;level<=group*7+7;level++)boards.push(frame(S,D,P,{level,ticks:350,res,page:res===2}).img)
  writePNG(path.join(out,`catalogue-${group+1}-res${res}.png`),stack(boards),1)
 }
}
export function alpineSheets(base,out){
 const before=renderer(execFileSync('git',['show',`${base}:public/agents/Draw.js`],{maxBuffer:4<<20}).toString())
 const S=load('Sim.js'),P=load('Palette.js'),D=load('Draw.js'),random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2]){alpineComparisons(S,P,before,D,out,res);alpineCatalogue(S,P,D,out,res);alpineReduced(S,P,D,out,res)}}finally{Math.random=random}
 return {before:alpineCorpus(before),after:alpineCorpus(D)}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const pins=alpineSheets(process.argv[2],path.resolve(process.argv[3]))
 fs.writeFileSync(path.join(path.resolve(process.argv[3]),'digests.json'),JSON.stringify(pins,null,2)+'\n')
 console.log(path.resolve(process.argv[3]))
}
