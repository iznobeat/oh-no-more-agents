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
export const ALL_MACHINES=[...MACHINES,['Mail Room','pads'],['Library','librarians'],['Jungle','ladders'],['Desert',null],['Cavern','sinkholes'],['Ice Cave','frozen'],['Foundry','ladders'],['Trench',null],['The Cloud',null],['Skyscraper','lifts'],['Ruins',null],['Frost',null],['North Pole',null]]
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
  if(w.biome==='Skyscraper') {const l=w.lifts.find(l=>!l.stairs);return {x:l.mid*4,y:l.car*4-25}}
  if(w.biome==='Ice Cave') {const f=w.frozen.find(f=>f.thawedAt<0)||w.frozen[0];return {x:f.x*4,y:f.y*4-12}}
  return machinePaintCentre(w)
}
function machinePaintCentre(w) {
  var first
  D.drawChristmasMachines({save(){},restore(){},fillRect(x,y){first = {x,y}}},w)
  if(!first) return {x:200,y:120}
  return first
}

export function reviewWorld(name,key) {
  const api=season(fs.readFileSync('public/agents/season.js','utf8'),'?season=christmas')
  for(let level=1;level<=200;level++) {
    const w=S.generate(level,0,3)
    if(w.biome!==name || (key&&!w[key]?.length)) continue
    const live=christmasWorld(level,api)
    if(name==='Ruins'&&(!live.boulder||live.boulder.state==='done')) continue
    if(name==='Ice Cave'&&!live.frozen.some(f=>f.thawedAt<0)) continue
    if(name==='Jungle'&&!live.ladders.some(l=>l.vine)) continue
    if(name==='Foundry'&&!live.ladders.some(l=>l.chain)) continue
    return live
  }
  throw Error('Missing live machine '+name)
}
export function round5Sheets(base,out) {
  const old=renderer(execFileSync('git',['show',`${base}:public/agents/Draw.js`],{maxBuffer:4e6}).toString())
  const api=season(fs.readFileSync('public/agents/season.js','utf8'),'?season=christmas')
  for(const res of[1,2]) {
    const full=canvas(800*res,ALL_MACHINES.length*248*res),close=canvas(240*res,ALL_MACHINES.length*80*res)
    for(const [i,[name,key]] of ALL_MACHINES.entries()) {
      const w=reviewWorld(name,key);w.res=res;const p=machineCentre(w)
      for(const [j,draw] of [old,D].entries()) {
        const img=christmasFrame(draw,api,w,res)
        writePNG(path.join(out,`${name.replaceAll(' ','-')}-${j ? 'after' : 'before'}-res${res}.png`),img)
        copyPixels(full,img,j*400*res,i*248*res)
        const x=Math.max(0,Math.min(280,Math.round(p.x-60))),y=Math.max(0,Math.min(168,Math.round(p.y-40)))
        copyPixels(close,crop(img,x*res,y*res,120*res,80*res),j*120*res,i*80*res)
      }
    }
    for(let row=0;row<ALL_MACHINES.length;row+=5) {
      const height=Math.min(5,ALL_MACHINES.length-row)*248*res
      writePNG(path.join(out,`machines-full-res${res}-part${1+row/5}.png`),crop(full,0,row*248*res,800*res,height))
    }
    writePNG(path.join(out,`machines-full-res${res}-sheet.png`),full)
    writePNG(path.join(out,`machines-crop-res${res}-sheet.png`),close)
  }
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))round5Sheets(process.argv[2]||'HEAD',process.argv[3]||'/tmp/xmas-dressing/r5-1')
