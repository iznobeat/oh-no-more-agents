// C17 complete-frame review: before left, after right, out of season.
import fs from 'node:fs'
import path from 'node:path'
import {fileURLToPath} from 'node:url'
import {createHash} from 'node:crypto'
import {load,frame,stack,side,writePNG} from './render.js'
import {renderer} from './gag-art.js'
export function antiqueSourceBefore(source){return source.replace(/^  drawAntique(?:Hall|Stone|Garden|Life)\(ctx, w, pal\)\n/gm,'')}
export function antiqueSheets(out){
 fs.mkdirSync(out,{recursive:true})
 const source=fs.readFileSync('public/agents/Draw.js','utf8'),before=renderer(antiqueSourceBefore(source)),D=load('Draw.js'),S=load('Sim.js'),P=load('Palette.js'),pins={},random=Math.random
 Math.random=()=>0.5
 try{for(const res of[1,2]){
  const rows=[]
  for(const level of[2,22,62])for(const ticks of[350,900]){
   const opts={level,ticks,res,page:res===2},a=frame(S,before,P,opts).img,b=frame(S,D,P,opts).img,pair=side([a,b])
   pins[`${level}/${ticks}/${res}`]={before:createHash('sha256').update(a.buf).digest('hex'),after:createHash('sha256').update(b.buf).digest('hex')}
   rows.push(pair);writePNG(path.join(out,`level-${level}-${ticks}-res${res}.png`),pair,1)
  }
  writePNG(path.join(out,`full-res${res}-sheet.png`),stack(rows),1)
 }}finally{Math.random=random}
 fs.writeFileSync(path.join(out,'digests.json'),JSON.stringify(pins,null,2)+'\n')
 return pins
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))antiqueSheets(path.resolve(process.argv[2]))
