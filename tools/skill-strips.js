// Consecutive timer fixtures, both facings, native and page resolution.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {load,canvas,crop,writePNG,themeOf} from './render.js'
import {renderer,copyPixels} from './gag-art.js'
const S=load('Sim.js'), P=load('Palette.js')
export const FRAME_COUNT=16
export const CASES=['walk','fall','float','climb','build','bash','dig','mine','block','bomb','explode','splat','saved']
export function fixture(name,t,dir=1){
 const w=S.generate(1,0,3)
 Object.assign(w,{res:1,ticks:400+t,agents:[],enemies:[],particles:[],feed:[],reducedMotion:false})
 const ag=Object.assign(S.spawn(w),{id:5,x:40,y:30,dir,state:name,trait:'steady',special:false,anim:t,timer:t,still:0,ownBrolly:true})
 if(['build','bash','dig'].includes(name))ag.timer=t%(name==='dig'?7:6)
 if(name==='float')Object.assign(ag,{state:'fall',floater:true,fall:3+t/8})
 if(name==='fall')Object.assign(ag,{floater:false,fall:5+t/8})
 if(name==='mine')Object.assign(ag,{state:'walk',mineCool:150-t})
 if(name==='bomb')ag.fuse=30-t
 if(name==='saved')ag.fade=t
 if(name==='explode'||name==='splat')Object.assign(ag,{gone:true,state:'dead',diedAt:400,diedBy:name==='explode'?'boom':'splat'})
 w.agents=[ag];return{w,ag}
}
export function frame(D,name,t,res,dir=1){
 const {w,ag}=fixture(name,t,dir);w.res=res
 const pal=P.build(themeOf('tokyo-night').theme,1),img=canvas(64*res,52*res,'#1a1b26')
 img.ctx.setTransform(res,0,0,res,0,0)
 img.ctx.translate(28-ag.x*4,36-(ag.y+1)*4)
 // One full sprite frame, unscaled art pixels, on a quiet floor.
 img.ctx.fillStyle=pal.dirtShade;img.ctx.fillRect(ag.x*4-28,(ag.y+1)*4,64,2)
 if(name==='explode')D.drawBlast(img.ctx,w,pal,{x:ag.x,y:ag.y-1,r:S.BOMB_RADIUS,t:400})
 if(ag.gone)D.drawDeath(img.ctx,w,pal,ag)
 else D.drawAgent(img.ctx,w,pal,ag,{})
 return img
}
export function run(base,out){
 fs.mkdirSync(out,{recursive:true})
 const old=renderer(execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()),now=load('Draw.js')
 for(const res of [1,2]){
  const all=canvas(FRAME_COUNT*64*res,CASES.length*4*52*res,'#1a1b26')
  for(const [i,name]of CASES.entries()){
   const strip=canvas(FRAME_COUNT*64*res,4*52*res,'#1a1b26')
   for(const [j,D]of [old,now].entries())for(const [k,dir]of [1,-1].entries())for(let t=0;t<FRAME_COUNT;t++)
    copyPixels(strip,frame(D,name,t,res,dir),t*64*res,(j*2+k)*52*res)
   writePNG(path.join(out,`${name}-res${res}.png`),strip)
   const paired=canvas(2*FRAME_COUNT*64*res,2*52*res)
   copyPixels(paired,crop(strip,0,0,FRAME_COUNT*64*res,2*52*res),0,0)
   copyPixels(paired,crop(strip,0,2*52*res,FRAME_COUNT*64*res,2*52*res),FRAME_COUNT*64*res,0)
   writePNG(path.join(out,`${name}-compare-res${res}.png`),paired)
   copyPixels(all,strip,0,i*4*52*res)
  }
  writePNG(path.join(out,`all-res${res}.png`),all)
 }
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify({base,cases:CASES,rows:'before right, before left, after right, after left',frames:'16 consecutive ticks, left to right'},null,2))
}


// Natural, unedited gameplay frames for full-board review at true display size.
export function liveScene(name){
 for(let level=1;level<=18;level++){
  const w=S.generate(level,0,3)
  for(let t=0;t<1800&&!w.done;t++){
   S.step(w)
   const ag=w.agents.find(a=>!a.gone&&!a.special&&!a.brollyFor&&a.state===name&&a.timer===0)
   if(ag)return{w,id:ag.id}
  }
 }
 throw Error('No natural '+name)
}
export function liveBoards(base,out){
 const old=renderer(execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()),now=load('Draw.js')
 for(const name of ['build','bash','dig']){
  const {w}=liveScene(name),pal=P.build(themeOf('tokyo-night').theme,w.level)
  for(const res of [1,2]){
   w.res=res
   const pair=canvas(800*res,248*res)
   for(const [j,D]of [old,now].entries()){
    const img=canvas(400*res,248*res)
    D.drawTerrain(img.ctx,w,pal);D.drawActors(img.ctx,w,pal,{})
    copyPixels(pair,img,j*400*res,0)
   }
   writePNG(path.join(out,`${name}-full-res${res}.png`),pair)
  }
 }
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const base=process.argv[2]||'HEAD',out=process.argv[3]||'/tmp/xmas-dressing/anim-0'
 run(base,out);liveBoards(base,out);actionBoards(base,out);balanceBoards(base,out)
}

// A quiet, complete board with the three reviewed actions, not enlarged crops.
// Fixture carving is only here; neither renderer ever writes to this world.
export function actionBoards(base,out) {
 const old=renderer(execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()),now=load('Draw.js')
 for(const res of [1,2])for(const t of [0,4,8]){
  const {w}=fixture('climb',t);w.res=res;w.agents=[]
  for(let y=20;y<=31;y++)for(let x=31;x<=67;x++)w.terrain[y*w.k.COLS+x]=y===31?w.k.DIRT:w.k.EMPTY
  for(let y=25;y<=30;y++)w.terrain[y*w.k.COLS+41]=w.k.DIRT
  for(const [i,name]of ['climb','bomb','splat'].entries()){
   const {ag}=fixture(name,t);ag.x=40+i*12;w.agents.push(ag)
  }
  const pal=P.build(themeOf('tokyo-night').theme,1),pair=canvas(800*res,248*res)
  for(const [j,D]of [old,now].entries()){
   const img=canvas(400*res,248*res)
   D.drawTerrain(img.ctx,w,pal);D.drawActors(img.ctx,w,pal,{})
   copyPixels(pair,img,j*400*res,0)
  }
  writePNG(path.join(out,`actions-full-${t}-res${res}.png`),pair)
 }
}

// Round-three review: compact native strips and complete staged boards.
export function balanceBoards(base,out) {
 const old=renderer(execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()),now=load('Draw.js')
 fs.mkdirSync(out,{recursive:true})
 for(const res of [1,2]) {
  for(const name of ['mine','block','float']) {
   const strip=canvas(16*24*res,4*36*res)
   for(const [j,D]of [old,now].entries())for(const [k,dir]of [1,-1].entries())for(let t=0;t<16;t++)
    copyPixels(strip,crop(frame(D,name,t,res,dir),16*res,4*res,24*res,36*res),t*24*res,(j*2+k)*36*res)
   writePNG(path.join(out,`${name}-compact-res${res}.png`),strip)
  }
  for(const t of [0,2,4,6,10,14]) {
   const {w}=fixture('block',t);w.res=res;w.agents=[];w.wind=0
   for(let y=20;y<=31;y++)for(let x=25;x<=76;x++)w.terrain[y*w.k.COLS+x]=y===31?w.k.DIRT:w.k.EMPTY
   for(const [i,name]of ['mine','block','float'].entries()) {
    const {ag}=fixture(name,t);ag.x=34+i*16;if(name==='float')ag.y=27
    w.agents.push(ag)
   }
   w.mines=[{x:34,y:31,fuse:90-t}]
   const pal=P.build(themeOf('tokyo-night').theme,1),pair=canvas(800*res,248*res)
   for(const [j,D]of [old,now].entries()) {
    const img=canvas(400*res,248*res)
    D.drawTerrain(img.ctx,w,pal);D.drawActors(img.ctx,w,pal,{})
    copyPixels(pair,img,j*400*res,0)
   }
   writePNG(path.join(out,`balance-full-${t}-res${res}.png`),pair)
  }
 }
}
