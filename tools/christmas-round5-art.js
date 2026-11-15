// Deterministic machine review: full frames and close crops, baseline left.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {load,canvas,crop,writePNG} from './render.js'
import {renderer,season,copyPixels} from './gag-art.js'
import {christmasWorld,christmasFrame} from './christmas-art.js'
const S=load('Sim.js'),D=load('Draw.js')
export const MACHINES=[['Factory','belts'],['Subway','trains'],['Harbour','trains'],['Data Center',null],['Clock Tower','gates'],['Rooftops','ziplines'],['Building Site','cranes'],['Spaceship','pads']]
export function machineWorld(name,key) {
  const api=season(fs.readFileSync('public/agents/season.js','utf8'),'?season=christmas')
  for(let level=1;level<=200;level++) {
    const w=S.generate(level,0,3)
    if(w.biome!==name || (key&&!w[key]?.length)) continue
    return christmasWorld(level,api)
  }
  throw Error('Missing machine '+name)
}
export function machineCentre(w) {
  const C=4
  if(w.biome==='Factory' || w.biome==='Data Center') return machinePaintCentre(w)
  if(w.biome==='Subway') {const g=D.subwayTrainDrawing(w,w.trains[0]);return {x:g.x,y:g.y-15}}
  if(w.biome==='Harbour') {const g=D.harbourFerryDrawing(w,w.trains[0]);return {x:g.x,y:g.y-15}}
  if(w.biome==='Clock Tower') {const b=D.clockGateDrawing(w,w.gates[0]);return {x:b.x+b.width/2,y:b.y}}
  if(w.biome==='Rooftops') {const g=D.roofLineDrawing(w,w.ziplines[0],0);return {x:g.x+g.dir*g.length/2,y:g.y}}
  if(w.biome==='Building Site') {const g=D.craneDrawing(w,w.cranes[0]);return {x:g.tipX,y:g.tipY+10}}
  if(w.biome==='Spaceship') {const p=w.pads[0];return {x:p.ax*C,y:p.ay*C-6}}
  throw Error('Unknown machine')
}
function machinePaintCentre(w) {
  var first
  D.drawChristmasMachines({save(){},restore(){},fillRect(x,y){first = {x,y}}},w)
  if(!first) throw Error('Missing visible machine')
  return first
}

export function round5Sheets(base,out) {
  const old=renderer(execFileSync('git',['show',`${base}:public/agents/Draw.js`],{maxBuffer:4e6}).toString())
  const api=season(fs.readFileSync('public/agents/season.js','utf8'),'?season=christmas')
  for(const res of[1,2]) {
    const full=canvas(800*res,MACHINES.length*248*res),close=canvas(240*res,MACHINES.length*80*res)
    for(const [i,[name,key]] of MACHINES.entries()) {
      const w=machineWorld(name,key);w.res=res;const p=machineCentre(w)
      for(const [j,draw] of [old,D].entries()) {
        const img=christmasFrame(draw,api,w,res)
        copyPixels(full,img,j*400*res,i*248*res)
        const x=Math.max(0,Math.min(280,Math.round(p.x-60))),y=Math.max(0,Math.min(168,Math.round(p.y-40)))
        copyPixels(close,crop(img,x*res,y*res,120*res,80*res),j*120*res,i*80*res)
      }
    }
    writePNG(path.join(out,`machines-full-res${res}-sheet.png`),full)
    writePNG(path.join(out,`machines-crop-res${res}-sheet.png`),close)
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))round5Sheets(process.argv[2]||'HEAD',process.argv[3]||'/tmp/xmas-dressing/r5-1')
