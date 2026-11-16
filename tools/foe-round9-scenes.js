import {ironworksCorpus} from './ironworks-art.js'
import {HAZARD_CASES,hazardSpecimen,advanceHazard} from './hazard-beat-art.js'
import {foeRoundNineSourceBefore} from './foe-round9-reference.js'
// C29: explicit predecessor/successor transitions; earlier golden files stay intact.
import fs from 'node:fs'
import cyclePins from '../test/fixtures/foe-round9-pins.json' with {type:'json'}
import {createHash} from 'node:crypto'
import {load,frame,canvas,themeOf,THEMES} from './render.js'
import {renderer,season} from './gag-art.js'
import {christmasWorld,christmasFrame} from './christmas-art.js'
import {reviewWorld,ALL_MACHINES} from './christmas-round5-art.js'
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
 for(let level=1;level<=20;level++){
 for(const mode of['none','christmas'])for(const res of[1,2]){
  const api=season(apiSource,'?season='+mode)
  record(out,`newyear/${mode}/${level}/${res}`,christmasFrame(old,api,christmasWorld(level,api),res).buf,christmasFrame(D,api,christmasWorld(level,api),res).buf)
 }
 }
 const api=season(apiSource,'?season=christmas')
 for(const [name,key]of ALL_MACHINES.filter(([n])=>n!=='North Pole'))for(const res of[1,2])for(const ticks of[120,400]){
  const w=reviewWorld(name,key);delete w.season;w.ticks=ticks
  record(out,`c6full/${name}/${res}/${ticks}`,christmasFrame(old,api,w,res).buf,christmasFrame(D,api,w,res).buf)
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
function legacyHazards(out,old,D,P){
 for(const name of HAZARD_CASES)for(const res of[undefined,1,3])for(const age of[0,4,20,40,48,60,70]){
  const paint=draw=>{const scene=hazardSpecimen(name),{w,pool,h}=scene;w.res=res;advanceHazard(scene,age);const img=canvas(800,496),pal=P.build(themeOf('tokyo-night').theme,w.level);if(pool)draw.drawPagePoolImpact(img.ctx,w,pal,pool);else draw.drawHazardKind(img.ctx,w,pal,h);return img.buf}
  out[`hazard-beats/${name}/${res}/${age}`]={before:hash(paint(old)),after:hash(paint(D))}
 }
}
function metroSnapshot(draw,S,P,resolutions){
 const h=createHash('sha256')
 for(const name of Object.keys(THEMES))for(const level of[18,38,58,78])for(const res of resolutions)for(const ticks of[0,77,240]){
  const w=S.generate(level,0,level*7919+13),pal=P.build(themeOf(name).theme,level);w.res=res;w.ticks=ticks
  const img=canvas(400,248,themeOf(name).background),ctx=img.ctx
  draw.drawBackdrop(ctx,w,pal);draw.drawTerrainMaterials(ctx,w,pal);draw.drawDecor(ctx,w,pal);draw.drawSubwayMaterials(ctx,w,pal);draw.drawSubwayMachines(ctx,w,pal)
  draw.drawAmbience(ctx,w,pal);draw.drawPits(ctx,w,pal);draw.drawExitBack(ctx,w,pal);draw.drawEnemyHatch(ctx,w,pal,{})
  for(const hz of w.hazards)draw.drawHazard(ctx,w,pal,hz,{})
  h.update(img.buf)
 }
 return h.digest('hex')
}
export function foeRoundNineScenes(){
 const source=fs.readFileSync('public/agents/Draw.js','utf8'),before=foeRoundNineSourceBefore(source)
 const S=load('Sim.js'),P=load('Palette.js'),D=renderer(source),old=renderer(before),out={},random=Math.random;Math.random=()=>0.5
 try{
  for(const[key,pin]of Object.entries(cyclePins.scenes))if(pin.before!==pin.after)out[pin.before]={label:'full/'+key,after:pin.after}
  const ironBefore=ironworksCorpus(old),ironAfter=ironworksCorpus(D)
  for(const[key,a]of Object.entries(ironBefore))out[a]={label:"ironworks/"+key,after:ironAfter[key]}
  aggregateScenes(out,source,before,S,P)
  seasonalScenes(out,old,D,fs.readFileSync('public/agents/season.js','utf8'))
  arrivalScenes(out,old,D,P)
  legacyHazards(out,old,D,P)
  for(const res of[[undefined,1],[2]]){const a=metroSnapshot(old,S,P,res),b=metroSnapshot(D,S,P,res);out[a]={label:'metro/'+res.join(','),after:b}}
 }finally{Math.random=random}
 return out
}
if(process.argv[2])fs.writeFileSync(process.argv[3],JSON.stringify(foeRoundNineScenes(),null,2)+'\n')
