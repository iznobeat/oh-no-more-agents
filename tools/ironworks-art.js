// Full-frame native/page Foundry review, before on the left. Also retain the
// complete out-of-season catalogue in seven-board parts for visual selection.
// node tools/ironworks-art.js <before-ref> /tmp/xmas-dressing/biome-4/review
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,frame,stack,side,writePNG} from './render.js'
import {renderer} from './gag-art.js'
const hash=b=>createHash('sha256').update(b).digest('hex')
export function ironworksCorpus(D){
 const S=load('Sim.js'),P=load('Palette.js'),pins={},random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2])for(const level of[4,24,44])for(const ticks of[350,900])pins[`${level}/${ticks}/${res}`]=hash(frame(S,D,P,{level,ticks,res,page:res===2}).img.buf)}finally{Math.random=random}
 return pins
}
function ironworksComparisons(S,P,before,after,out,res){
 const rows=[]
 for(const level of[4,24,44])for(const ticks of[350,900]){
  const opts={level,ticks,res,page:res===2},pair=side([frame(S,before,P,opts).img,frame(S,after,P,opts).img])
  rows.push(pair);writePNG(path.join(out,`level-${level}-${ticks}-res${res}.png`),pair,1)
 }
 writePNG(path.join(out,`full-res${res}-sheet.png`),stack(rows),1)
}
function ironworksCatalogue(S,P,D,out,res){
 for(let group=0;group<3;group++){
  const boards=[]
  for(let level=group*7+1;level<=group*7+7;level++)boards.push(frame(S,D,P,{level,ticks:350,res,page:res===2}).img)
  writePNG(path.join(out,`catalogue-${group+1}-res${res}.png`),stack(boards),1)
 }
}
export function ironworksSheets(base,out){
 const before=renderer(execFileSync('git',['show',`${base}:public/agents/Draw.js`],{maxBuffer:4<<20}).toString())
 const S=load('Sim.js'),P=load('Palette.js'),D=load('Draw.js'),random=Math.random;Math.random=()=>0.5
 try{for(const res of[1,2]){ironworksComparisons(S,P,before,D,out,res);ironworksCatalogue(S,P,D,out,res)}}finally{Math.random=random}
 return {before:ironworksCorpus(before),after:ironworksCorpus(D)}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const pins=ironworksSheets(process.argv[2],path.resolve(process.argv[3]))
 fs.writeFileSync(path.join(path.resolve(process.argv[3]),'digests.json'),JSON.stringify(pins,null,2)+'\n')
 console.log(path.resolve(process.argv[3]))
}
