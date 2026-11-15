// Deterministic full-frame before/after review, at native and page resolution.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {load,canvas,crop,writePNG,themeOf} from './render.js'
import {season,renderer,copyPixels,doublePixels} from './gag-art.js'
import {christmasWorld,christmasFrame} from './christmas-art.js'
import {TEAM,teamPose} from './christmas-team-art.js'
const S=load('Sim.js')
export function run(base,out) {
  const source=f=>execFileSync('git',['show',`${base}:public/agents/${f}`],{maxBuffer:4e6}).toString()
  const old=renderer(source('Draw.js')),D=load('Draw.js'),text=fs.readFileSync('public/agents/season.js','utf8')
  const apis=[season(source('season.js'),'?season=none'),season(text,'?season=newyear')]
  fs.mkdirSync(out,{recursive:true})
  for(const res of [1,2]) {
    const sheets=[],details=canvas(800, S.BIOMES.length*160)
    for(let level=1;level<=S.BIOMES.length;level++) {
      const row=canvas(800*res,248*res)
      for(let v=0;v<2;v++) {
        const w=christmasWorld(level,apis[v]);w.ticks=450
        const img=christmasFrame(v?D:old,apis[v],w,res)
        copyPixels(row,img,v*400*res,0)
        writePNG(path.join(out,`${level}-${v?'after':'before'}-res${res}.png`),img)
        const close=crop(img,0,16*res,200*res,80*res)
        copyPixels(details,res===1?doublePixels(close):close,v*400,(level-1)*160)
      }
      sheets.push(row)
    }
    const full=canvas(800*res,S.BIOMES.length*248*res)
    for(let i=0;i<sheets.length;i++)copyPixels(full,sheets[i],0,i*248*res)
    writePNG(path.join(out,`full-res${res}-sheet.png`),full)
    for(let p=0;p<Math.ceil(sheets.length/5);p++)writePNG(path.join(out,`full-res${res}-part${p+1}.png`),crop(full,0,p*5*248*res,800*res,Math.min(5,sheets.length-p*5)*248*res))
    writePNG(path.join(out,`crops-res${res}-sheet.png`),details)
  }
  details(D,apis[1],out)
}
export function details(D,api,out) {
  const team=canvas(768,TEAM.length*80)
  for(let row=0;row<TEAM.length;row++)for(const res of[1,2])for(const v of[0,1])for(const dir of[-1,1]) {
    const p=teamPose(D,TEAM[row],res,dir,4,false)
    if(v){p.w.season={redHats:'party'};p.img.ctx.fillStyle='#24283b';p.img.ctx.fillRect(0,0,32,40);D.drawEnemy(p.img.ctx,p.w,load('Palette.js').build(themeOf('tokyo-night').theme,1),p.en,{})}
    copyPixels(team,res===1?doublePixels(p.img):p.img,(res-1)*384+v*192+(dir===1?64:0),row*80)
  }
  writePNG(path.join(out,'red-team-sheet.png'),team)
  for(const res of[1,2]) {
    const sheet=canvas(800*res,4*248*res)
    for(let n=0;n<4;n++)for(let v=0;v<2;v++) {
      const plain=season(fs.readFileSync('public/agents/season.js','utf8'),'?season=none'),s=v?api:plain,w=christmasWorld(n===3?5:3,s)
      w.ticks=480
      if(n===0)w.ticks=410
      if(n===1 || n===2) {
        if(v){api.paint(canvas(400,248).ctx,w);w.saved=n===2?w.toRelease:w.saved+1;api.paint(canvas(400,248).ctx,w)}
        w.ticks+=20
      }
      if(n===3){if(v)api.paint(canvas(400,248).ctx,w);w.saved=w.toRelease;for(const a of w.agents){a.gone=true;a.state='saved'};w.done=true;w.doneTicks=30;if(v)api.paint(canvas(400,248).ctx,w);w.ticks+=45}
      const img=christmasFrame(D,s,w,res)
      copyPixels(sheet,img,v*400*res,n*248*res)
    }
    writePNG(path.join(out,`celebrations-res${res}-sheet.png`),sheet)
  }
}
if(process.argv[1]?.endsWith('newyear-art.js'))run(process.argv[2]||'HEAD',process.argv[3]||'/tmp/xmas-dressing/ny-1')
