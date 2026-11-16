// C21 complete-frame review: before left, after right, out of season.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {load,frame,stack,side,writePNG} from './render.js'
import {renderer,season} from './gag-art.js'
import {christmasWorld,christmasFrame} from './christmas-art.js'
import {reviewWorld} from './christmas-round5-art.js'
export function karstSourceBefore(source){return source.replace(/^  (?:if \(!cavernPage\(w\)\) )?drawKarst(?:NativeVault|Vault|Stone|Garden|Life)\(ctx, w, pal\)\n/gm,'')}
export function karstSheets(out){
 fs.mkdirSync(out,{recursive:true})
 const source=fs.readFileSync('public/agents/Draw.js','utf8'),before=renderer(karstSourceBefore(source)),D=load('Draw.js'),S=load('Sim.js'),P=load('Palette.js'),pins={},random=Math.random
 Math.random=()=>0.5
 try{for(const res of[1,2]){
  const rows=[]
  for(const level of[1,41,61])for(const ticks of[350,900]){
   const opts={level,ticks,res,page:res===2},a=frame(S,before,P,opts).img,b=frame(S,D,P,opts).img,pair=side([a,b])
   pins[`${level}/${ticks}/${res}`]={before:createHash('sha256').update(a.buf).digest('hex'),after:createHash('sha256').update(b.buf).digest('hex')}
   rows.push(pair);writePNG(path.join(out,`level-${level}-${ticks}-res${res}.png`),pair,1)
  }
  writePNG(path.join(out,`full-res${res}-sheet.png`),stack(rows),1)
  karstStagedSheets(before,D,out,res)
 }}finally{Math.random=random}
 fs.writeFileSync(path.join(out,'digests.json'),JSON.stringify(pins,null,2)+'\n')
 return pins
}
function karstStagedSheets(before,D,out,res){
 const apiSource=fs.readFileSync('public/agents/season.js','utf8'),opts={level:1,res,page:res===2,ticks:120,seed:3},S=load('Sim.js'),P=load('Palette.js')
 const rows=[side([frame(S,before,P,opts).img,frame(S,D,P,opts).img])]
 for(const mode of['none','christmas']){
  const api=season(apiSource,'?season='+mode),w=christmasWorld(1,api)
  rows.push(side([christmasFrame(before,api,w,res),christmasFrame(D,api,w,res)]))
 }
 const api=season(apiSource,'?season=christmas')
 for(const ticks of[120,400]){
  const w=reviewWorld('Cavern',null);delete w.season;w.ticks=ticks
  rows.push(side([christmasFrame(before,api,w,res),christmasFrame(D,api,w,res)]))
 }
 writePNG(path.join(out,`pinned-res${res}-sheet.png`),stack(rows),1)
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))karstSheets(path.resolve(process.argv[2]))
