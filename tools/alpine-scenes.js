// Reproduce every historical aggregate or Frost scene advanced by C16.
import fs from 'node:fs'
import {antiqueSourceBefore} from './antique-art.js'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,frame,canvas,themeOf} from './render.js'
import {renderer,season} from './gag-art.js'
import {christmasWorld,christmasFrame} from './christmas-art.js'
import {reviewWorld} from './christmas-round5-art.js'
import {arrivalWorld,welcomeFrame} from './exit-welcome.js'
const hash=b=>createHash('sha256').update(b).digest('hex')
function record(out,label,before,after){
 const a=hash(before),b=hash(after)
 if(a!==b)out[a]={label,after:b}
}
function aggregates(S,P,draw,ticks){
 const h=createHash('sha256')
 for(let level=1;level<=20;level++)for(const res of[1,2])for(const tick of ticks)
  h.update(frame(S,draw,P,{level,seed:3,ticks:tick,res,page:res===2}).img.buf)
 return h.digest('hex')
}
function aggregateScenes(out,source,before,S,P){
 const disabled='\ncolonyWalking=function(){return false};colonyShortFall=function(){return false};colonyNativeHome=function(){return false};'
 for(const ticks of[[350,900],[120,350]])for(const [name,tail]of[['aggregates',''],['disabled',disabled]]){
  const a=aggregates(S,P,renderer(before+tail),ticks),b=aggregates(S,P,renderer(source+tail),ticks)
  out[a]={label:name+'/'+ticks.join(','),after:b}
 }
}
function seasonalScenes(out,old,D,apiSource){
 for(const mode of['none','christmas'])for(const res of[1,2]){
  const api=season(apiSource,'?season='+mode),w=christmasWorld(3,api)
  record(out,`newyear/${mode}/3/${res}`,christmasFrame(old,api,w,res).buf,christmasFrame(D,api,w,res).buf)
 }
 const api=season(apiSource,'?season=christmas')
 for(const res of[1,2])for(const ticks of[120,400]){
  const w=reviewWorld('Frost',null);delete w.season;w.ticks=ticks
  record(out,`c6full/Frost/${res}/${ticks}`,christmasFrame(old,api,w,res).buf,christmasFrame(D,api,w,res).buf)
 }
}
function arrivalScenes(out,old,D,P){
 const sums=[old,D].map(draw=>{
  const h=createHash('sha256')
  for(let level=1;level<=20;level++){
   const w=arrivalWorld(level,3,1),at=w.ticks,a=w.agents.find(a=>!a.gone&&a.state==='saved'),cache={}
   for(const age of[0,4,10,15]){w.ticks=at+age;a.fade=age;h.update(welcomeFrame(draw,w,cache).buf)}
  }
  return h.digest('hex')
 })
 out[sums[0]]={label:'exitNative',after:sums[1]}
 const office=[old,D].map(draw=>{
  const h=createHash('sha256')
  for(let level=1;level<=20;level++){
   const w=arrivalWorld(level);w.iceAt=null
   for(const res of[undefined,1,3]){
    w.res=res;const img=canvas(400*(res||1),248*(res||1))
    draw.drawActors(img.ctx,w,P.build(themeOf('tokyo-night').theme,level),{intro:false,feed:false});h.update(img.buf)
   }
  }
  return h.digest('hex')
 })
 out[office[0]]={label:'office',after:office[1]}
}
export function alpineScenes(base){
 const source=antiqueSourceBefore(fs.readFileSync('public/agents/Draw.js','utf8')),before=execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 const S=load('Sim.js'),P=load('Palette.js'),D=renderer(source),old=renderer(before),out={},random=Math.random;Math.random=()=>0.5
 try{
  aggregateScenes(out,source,before,S,P)
  seasonalScenes(out,old,D,fs.readFileSync('public/agents/season.js','utf8'))
  arrivalScenes(out,old,D,P)
 }finally{Math.random=random}
 return out
}
if(process.argv[2])fs.writeFileSync(process.argv[3],JSON.stringify(alpineScenes(process.argv[2]),null,2)+'\n')
