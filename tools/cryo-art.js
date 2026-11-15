import {millSourceBefore} from './mill-art.js'
// C18 complete-frame review: before left, after right, out of season.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {load,frame,stack,side,writePNG} from './render.js'
import {renderer,season} from './gag-art.js'
import {christmasWorld,christmasFrame} from './christmas-art.js'
import {reviewWorld} from './christmas-round5-art.js'
export function cryoSourceBefore(source){return millSourceBefore(source).replace(/^  drawCryo(?:Vault|Facets|Garden|Life)\(ctx, w, pal\)\n/gm,'')}
export function cryoSheets(out){
 fs.mkdirSync(out,{recursive:true})
 const source=millSourceBefore(fs.readFileSync('public/agents/Draw.js','utf8')),before=renderer(cryoSourceBefore(source)),D=renderer(source),S=load('Sim.js'),P=load('Palette.js'),pins={},random=Math.random
 Math.random=()=>0.5
 try{for(const res of[1,2]){
  const rows=[]
  for(const level of[6,26,46])for(const ticks of[350,900]){
   const opts={level,ticks,res,page:res===2},a=frame(S,before,P,opts).img,b=frame(S,D,P,opts).img,pair=side([a,b])
   pins[`${level}/${ticks}/${res}`]={before:createHash('sha256').update(a.buf).digest('hex'),after:createHash('sha256').update(b.buf).digest('hex')}
   rows.push(pair);writePNG(path.join(out,`level-${level}-${ticks}-res${res}.png`),pair,1)
  }
  writePNG(path.join(out,`full-res${res}-sheet.png`),stack(rows),1)
  cryoStagedSheets(before,D,out,res)
 }}finally{Math.random=random}
 fs.writeFileSync(path.join(out,'digests.json'),JSON.stringify(pins,null,2)+'\n')
 return pins
}
function cryoStagedSheets(before,D,out,res){
 const apiSource=fs.readFileSync('public/agents/season.js','utf8'),rows=[]
 for(const mode of['none','christmas']){
  const api=season(apiSource,'?season='+mode),w=christmasWorld(6,api)
  rows.push(side([christmasFrame(before,api,w,res),christmasFrame(D,api,w,res)]))
 }
 const api=season(apiSource,'?season=christmas')
 for(const ticks of[120,400]){
  const w=reviewWorld('Ice Cave',null);delete w.season;w.ticks=ticks
  rows.push(side([christmasFrame(before,api,w,res),christmasFrame(D,api,w,res)]))
 }
 writePNG(path.join(out,`pinned-res${res}-sheet.png`),stack(rows),1)
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))cryoSheets(path.resolve(process.argv[2]))
