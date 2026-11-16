// C21: explicit transitions for the reviewed Cavern scenery; retain all prior pins.
import fs from 'node:fs'
import {karstSourceBefore} from './karst-art.js'
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
  const api=season(apiSource,'?season='+mode),w=christmasWorld(1,api)
  record(out,`newyear/${mode}/1/${res}`,christmasFrame(old,api,w,res).buf,christmasFrame(D,api,w,res).buf)
 }
 const api=season(apiSource,'?season=christmas')
 karstCast(out,old,D,api)
 for(const res of[1,2])for(const ticks of[120,400]){
  const w=reviewWorld('Cavern',null);delete w.season;w.ticks=ticks
  record(out,`c6full/Cavern/${res}/${ticks}`,christmasFrame(old,api,w,res).buf,christmasFrame(D,api,w,res).buf)
 }
}
function karstCast(out,old,D,api){
 const P=load('Palette.js')
 for(const res of[1,2]){
  const w=reviewWorld('Cavern',null);w.res=res
  const pal=P.build(themeOf('tokyo-night').theme,w.level);api.tint(pal)
  const mask=canvas(400*res,248*res,'#00000000');mask.ctx.setTransform(res,0,0,res,0,0)
  D.drawActorColony(mask.ctx,w,pal,{})
  const sums=[old,D].map(draw=>{
   const img=christmasFrame(draw,api,w,res).buf,h=createHash('sha256')
   for(let i=0;i<mask.buf.length;i+=4)if(mask.buf[i+3]===255)h.update(img.subarray(i,i+4))
   return h.digest('hex')
  })
  if(sums[0]!==sums[1])out[sums[0]]={label:'c6cast/Cavern/'+res,after:sums[1]}
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
export function karstScenes(){
 const source=fs.readFileSync('public/agents/Draw.js','utf8'),before=karstSourceBefore(source)
 const S=load('Sim.js'),P=load('Palette.js'),D=load('Draw.js'),old=renderer(before),out={},random=Math.random;Math.random=()=>0.5
 try{
  for(const ticks of[120,350,900]){
   const opts={level:1,res:2,page:true,ticks,seed:3}
   record(out,'c21full/1/2/'+ticks,frame(S,old,P,opts).img.buf,frame(S,D,P,opts).img.buf)
  }
  aggregateScenes(out,source,before,S,P)
  seasonalScenes(out,old,D,fs.readFileSync('public/agents/season.js','utf8'))
  arrivalScenes(out,old,D,P)
  karstReportScenes(out,old,D,fs.readFileSync('public/agents/season.js','utf8'))
  karstWhoScenes(out,old,D,S,P)
 }finally{Math.random=random}
 return out
}
if(process.argv[2])fs.writeFileSync(process.argv[3],JSON.stringify(karstScenes(),null,2)+'\n')

// These historical ledgers include Cavern scenery behind reports, and live
// machinery in actor-only WHO scenes. Keep their original text-aware hashes.
function karstReportScenes(out,old,D,apiSource) {
 for(const mode of['none','christmas'])for(const res of[1,2]) {
  const api=season(apiSource,'?season='+mode),w=christmasWorld(1,api)
  w.done=true;w.doneTicks=30
  record(out,`report/${mode}/1/${res}`,christmasFrame(old,api,w,res).buf,christmasFrame(D,api,w,res).buf)
 }
}
function karstWhoPixels(draw,w,labels,P) {
 const img=canvas(400*(w.res||1),248*(w.res||1)),text=[]
 img.ctx.fillText=(...a)=>text.push([img.ctx.font,img.ctx.fillStyle,img.ctx.globalAlpha,...a])
 const pal=P.build(themeOf('tokyo-night').theme,w.level)
 if(w.res===2&&!labels)draw.drawActorColony(img.ctx,w,pal,{labels})
 else draw.drawActors(img.ctx,w,pal,{intro:false,feed:false,labels})
 return Buffer.concat([img.buf,Buffer.from(JSON.stringify(text))])
}
function karstWhoScenes(out,old,D,S,P) {
 const random=Math.random;Math.random=()=>0.25
 try {
  const w=S.generate(1,0,3);w.res=2
  for(let n=0;n<200&&!w.done;n++)S.step(w)
  for(const res of[undefined,1,2,3])for(const labels of[false,true]) {
   if(res===2&&labels)continue
   w.res=res
   record(out,`who/1/${res??'default'}/${labels}`,karstWhoPixels(old,w,labels,P),karstWhoPixels(D,w,labels,P))
  }
 }finally{Math.random=random}
}
