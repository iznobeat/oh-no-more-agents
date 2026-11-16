// node tools/foe-strips.js BASE /tmp/xmas-dressing/foes-N
// Timer-by-timer art review. Rows retain native pixels; no simulation changes.
import fs from 'node:fs'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {fileURLToPath} from 'node:url'
import {load,canvas,crop,writePNG,themeOf} from './render.js'
import {renderer,copyPixels} from './gag-art.js'
const S=load('Sim.js'),P=load('Palette.js'),BASE=S.generate(1,0,3)
export const KINDS=['gun','bouncer','sniper','operator','drone','moderator','xeno','harpoon']
// Cross-product poses are intentional stress fixtures; operate/fly/hunt cover
// the non-shooting enemies' actual behaviours as well. No new Sim states.
export const STATES=['walk','aim','reload','brawl','hit','death','camp','operate','fly','hunt','sated']
export function enemyFixture(kind,state,t,dir=1){
 const w={...BASE}
 Object.assign(w,{res:1,ticks:400+t,agents:[],enemies:[],particles:[],feed:[],reducedMotion:false})
 const en={id:4,kind:kind==='moderator'?'gun':kind,boss:kind==='moderator',x:40,y:30,dir,state,anim:t,timer:t,
  hp:3,maxHp:3,shotFor:0,throttled:0,lineTo:46,lineY:28,targetId:0,touchCool:0}
 if(state==='reload')en.shotFor=Math.max(0,8-t)
 if(state==='hit')Object.assign(en,{state:'recover',hurtAt:400})
 if(state==='death')Object.assign(en,{gone:true,diedAt:400,diedBy:'shot'})
 if(state==='brawl')en.brawlFor=Math.max(0,28-t)
 if(state==='hunt'||state==='sated')Object.assign(en,{state:'walk',targetId:1,touchCool:state==='sated'?60-t:0})
 if(state==='fly'){en.targetId=1;w.agents=[{id:1,x:en.x+4-t/16,y:en.y+2,state:'walk'}]}
 w.enemies=[en];return{w,en}
}
export function hazardFixture(spec,phase,t,dir=1){
 const w={...BASE}
 Object.assign(w,{res:1,ticks:400+t,agents:[],enemies:[],particles:[],feed:[],reducedMotion:false})
 const h={kind:spec.id,phase,t,fired:phase==='rest'?1:0,dir,known:true,throttled:0,lineTo:46,lineY:28,
  zx0:40,zx1:40+spec.w-1,zy0:25,zy1:25+spec.h-1,mount:spec.mount,name:spec.name,reach:spec.reach}
 return{w,h}
}
export function enemyFrame(D,kind,state,t,res,dir=1){
 const {w,en}=enemyFixture(kind,state,t,dir);w.res=res
 const img=canvas(64*res,56*res,'#1a1b26');img.ctx.setTransform(res,0,0,res,0,0)
 img.ctx.translate(28-en.x*4,40-(en.y+1)*4)
 const pal=P.build(themeOf('tokyo-night').theme,1)
 if(state==='death')D.drawEnemyDefeat(img.ctx,w,pal,en)
 else D.drawEnemy(img.ctx,w,pal,en,{})
 return img
}
export function hazardFrame(D,spec,phase,t,res,dir=1,width=64){
 const {w,h}=hazardFixture(spec,phase,t,dir);w.res=res
 const img=canvas(width*res,56*res,'#1a1b26');img.ctx.setTransform(res,0,0,res,0,0)
 img.ctx.translate(width/2-(h.zx0+h.zx1+1)*2,8-h.zy0*4)
 D.drawHazardKind(img.ctx,w,P.build(themeOf('tokyo-night').theme,1),h)
 return img
}
function enemySequence(kind,state){
 const span=state==='aim'?(kind==='sniper'?36:kind==='harpoon'?46:8):state==='death'?40:state==='brawl'?28:state==='reload'?80:state==='operate'?180:32
 return Array.from({length:span},(_,t)=>({state,t}))
}
export function hazardSequence(spec){
 if(spec.mech==='field')return Array.from({length:32},(_,t)=>({phase:'fire',t}))
 const spans=[['idle',12],['charge',spec.charge],['fire',spec.fire],['rest',spec.rest]]
 return spans.flatMap(([phase,n])=>Array.from({length:n},(_,t)=>({phase,t})))
}
function strip(file,sequence,draw,old,now,res,width=64){
 const rows=Math.ceil(sequence.length/16),out=canvas(16*width*res,rows*2*56*res,'#1a1b26')
 for(const [j,D]of [old,now].entries())for(const [i,key]of sequence.entries())
  copyPixels(out,draw(D,key),i%16*width*res,(Math.floor(i/16)*2+j)*56*res)
 writePNG(file,out)
}
export function run(base,out,options={}){
 fs.mkdirSync(out,{recursive:true})
 const old=renderer(execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()),now=load('Draw.js')
 const manifest={base,rows:'each 16-tick window: before above after; consecutive left to right; idle sampled for 12 ticks, fields live for 32',enemies:{},hazards:{}}
 enemyStrips(out,old,now,manifest,options.kinds)
 hazardStrips(out,old,now,manifest,S.HAZARDS.filter(s=>!options.hazards || options.hazards.includes(s.id)))
 overview(out,now);enemyContacts(out,now)
 choices(out,old,now);boards(out,old,now);pairs(out,old,now);roundTwoReview(out,old,now);roundThreeReview(out,old,now);roundFourReview(out,old,now);roundFiveReview(out,old,now);roundSixReview(out,old,now);roundSevenReview(out,old,now);roundEightReview(out,old,now);roundNineReview(out,old,now);roundTenReview(out,old,now);roundElevenReview(out,old,now);roundTwelveReview(out,old,now);roundThirteenReview(out,old,now)
 fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2))
}
export function enemyStrips(out,old,now,manifest,kinds=KINDS){
 for(const kind of kinds)for(const state of STATES){
  const seq=enemySequence(kind,state);manifest.enemies[kind+'-'+state]=seq
  for(const res of [1,2])strip(path.join(out,`${kind}-${state}-res${res}.png`),seq,(D,k)=>enemyFrame(D,kind,k.state,k.t,res),old,now,res)
 }
}
export function hazardStrips(out,old,now,manifest,specs=S.HAZARDS){
 for(const spec of specs){
  const seq=hazardSequence(spec);manifest.hazards[spec.id]=seq
  for(const res of [1,2])strip(path.join(out,`${spec.id}-cycle-res${res}.png`),seq,(D,k)=>hazardFrame(D,spec,k.phase,k.t,res,1,128),old,now,res,128)
 }
}
export function overview(out,D){
 const keys=[['idle',0],['charge',0],['charge',0.5],['charge',0.9],['fire',0],['fire',0.5],['rest',0],['rest',0.12]]
 for(const res of [1,2])for(let start=0;start<S.HAZARDS.length;start+=8){
  const sheet=canvas(8*64*res,8*56*res,'#1a1b26')
  for(const [i,spec]of S.HAZARDS.slice(start,start+8).entries())for(const [j,[phase,p]]of keys.entries()){
   const span=phase==='charge'?spec.charge:phase==='fire'?spec.fire:spec.rest
   copyPixels(sheet,hazardFrame(D,spec,phase,Math.floor(p*span),res),j*64*res,i*56*res)
  }
  writePNG(path.join(out,`hazards-${start}-res${res}.png`),sheet)
 }
 for(const res of [1,2]){
  const sheet=canvas(8*64*res,KINDS.length*56*res,'#1a1b26')
  const keys=[['walk',0],['walk',6],['aim',0],['aim',6],['reload',4],['brawl',8],['hit',3],['death',12]]
  for(const [i,kind]of KINDS.entries())for(const [j,[state,t]]of keys.entries())
   copyPixels(sheet,enemyFrame(D,kind,state,t,res),j*64*res,i*56*res)
  writePNG(path.join(out,`enemies-res${res}.png`),sheet)
 }
}

// Eight consecutive frames of every hostile fixture, at actual display pixels.
export function enemyContacts(out,D){
 for(const res of [1,2])for(const kind of KINDS){
  const img=canvas(8*40*res,STATES.length*40*res,'#1a1b26')
  for(const [y,state]of STATES.entries())for(let t=0;t<8;t++)
   copyPixels(img,crop(enemyFrame(D,kind,state,t,res),8*res,4*res,40*res,40*res),t*40*res,y*40*res)
  writePNG(path.join(out,`${kind}-contact-res${res}.png`),img)
 }
}

export function choices(out,old,now){
 fs.mkdirSync(out,{recursive:true})
 for(const res of [1,2]){
  for(const name of ['icicle','servo']){
   const spec=S.HAZARDS.find(s=>s.id===name)
   strip(path.join(out,`${name}-cycle-res${res}.png`),hazardSequence(spec),(D,k)=>hazardFrame(D,spec,k.phase,k.t,res,1,128),old,now,res,128)
   const keys=[['idle',0],['charge',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-1],['fire',0],['fire',2],['fire',4],['fire',6],['fire',10],['fire',spec.fire-1],['rest',0],['rest',3],['rest',6],['rest',9],['rest',12],['rest',spec.rest-1]]
   for(const dir of [1,-1])strip(path.join(out,`${name}-keys-${dir}-res${res}.png`),keys,(D,k)=>hazardFrame(D,spec,k[0],k[1],res,dir),old,now,res)
  }
  for(const state of ['aim','reload'])for(const dir of [1,-1])strip(path.join(out,`sniper-${state}-${dir}-res${res}.png`),enemySequence('sniper',state),(D,k)=>enemyFrame(D,'sniper',k.state,k.t,res,dir),old,now,res)
 }
}

// Complete quiet boards at actual display size. Staged art, not claimed rescues.
export function boards(out,old,now){
 for(const res of [1,2])for(const phase of ['charge','fire','rest'])for(const season of ['none','christmas','newyear']){
  const {w,en}=enemyFixture('sniper',phase==='charge'?'aim':'reload',phase==='charge'?6:16)
  w.res=res;en.x=26;en.lineTo=32
  w.season={name:season,redHats:season==='christmas'?'santa':season==='newyear'?'party':undefined}
  w.hazards=['icicle','servo'].map((id,i)=>{
   const spec=S.HAZARDS.find(s=>s.id===id),t=phase==='charge'?spec.charge-1:phase==='fire'?2:3
   const {h}=hazardFixture(spec,phase,t)
   h.zx0+=i*24;h.zx1+=i*24;return h
  })
  w.hazard=null;w.terrain=w.terrain.slice()
  for(let y=20;y<=31;y++)for(let x=20;x<=76;x++)w.terrain[y*w.k.COLS+x]=y===31?w.k.DIRT:w.k.EMPTY
  const pair=canvas(800*res,248*res),pal=P.build(themeOf('tokyo-night').theme,1)
  for(const [j,D]of [old,now].entries()){
   const img=canvas(400*res,248*res)
   D.drawTerrain(img.ctx,w,pal);D.drawActors(img.ctx,w,pal,{})
   copyPixels(pair,img,j*400*res,0)
  }
  writePNG(path.join(out,`${season}-${phase}-full-res${res}.png`),pair)
 }
}

// Eight representative keys, before left / after right, both facings.
export function pairs(out,old,now){
 for(const res of [1,2])for(const name of ['icicle','servo','sniper']){
  const spec=name==='sniper'?null:S.HAZARDS.find(s=>s.id===name)
  const keys=spec?[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-1],['fire',0],['fire',2],['fire',6],['rest',0],['rest',6]]:
   [['aim',0],['aim',6],['aim',18],['aim',35],['reload',0],['reload',8],['reload',16],['reload',24]]
  const img=canvas(16*48*res,2*48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [row,dir]of [1,-1].entries())for(const [i,[phase,t]]of keys.entries()){
   const frame=spec?hazardFrame(D,spec,phase,t,res,dir):enemyFrame(D,'sniper',phase,t,res,dir)
   copyPixels(img,crop(frame,8*res,0,48*res,48*res),(j*8+i)*48*res,row*48*res)
  }
  writePNG(path.join(out,`${name}-compare-res${res}.png`),img)
 }
}

export const ROUND_TWO=['beartrap','pendulum','snowball']
// Compact before-left / after-right keys; the cycle files retain every tick.
export function roundTwoReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_TWO){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-2],['charge',spec.charge-1],['fire',0],['fire',4],['rest',0],['rest',6]]
  const pair=canvas(16*48*res,48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,crop(hazardFrame(D,spec,phase,t,res),8*res,0,48*res,48*res),(j*8+i)*48*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now)
}
export function roundTwoBoards(out,old,now,names=ROUND_TWO,prefix="round2"){
 for(const res of [1,2])for(const phase of ['charge','fire','rest'])for(const season of ['none','christmas','newyear']){
  const {w}=enemyFixture('gun','walk',4)
  w.res=res;w.season={name:season,redHats:season==='christmas'?'santa':season==='newyear'?'party':undefined}
  w.enemies=KINDS.map((kind,i)=>({...enemyFixture(kind,'walk',4).en,x:12+i*10,y:18}))
  w.hazards=names.map((id,i)=>{
   const spec=S.HAZARDS.find(s=>s.id===id),{h}=hazardFixture(spec,phase,phase==='charge'?spec.charge-2:phase==='fire'?2:3)
   h.zx0=26+i*22;h.zx1=h.zx0+spec.w-1;h.zy0=31-spec.h;h.zy1=30;return h
  })
  w.hazard=null;w.terrain=w.terrain.slice()
  for(let y=14;y<32;y++)for(let x=8;x<96;x++)w.terrain[y*w.k.COLS+x]=y===19||y===31?w.k.DIRT:w.k.EMPTY
  const pair=canvas(800*res,248*res),pal=P.build(themeOf('tokyo-night').theme,1)
  for(const [j,D]of [old,now].entries()){
   const img=canvas(400*res,248*res)
   D.drawTerrain(img.ctx,w,pal);D.drawActors(img.ctx,w,pal,{})
   copyPixels(pair,img,j*400*res,0)
  }
  writePNG(path.join(out,`${prefix}-${season}-${phase}-full-res${res}.png`),pair)
 }
}

export const ROUND_THREE=['piston','stamper','echobat']
export function roundThreeReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_THREE){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-4],['charge',spec.charge-1],['fire',0],['fire',3],['rest',0],['rest',6]]
  const pair=canvas(16*48*res,48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,crop(hazardFrame(D,spec,phase,t,res),8*res,0,48*res,48*res),(j*8+i)*48*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_THREE,'round3')
}


export function compactHazardStrip(out,old,now,spec,res){
 const seq=hazardSequence(spec),sheet=canvas(8*40*res,Math.ceil(seq.length/8)*80*res,'#1a1b26')
 for(const [j,D]of [old,now].entries())for(const [i,{phase,t}]of seq.entries())
  copyPixels(sheet,crop(hazardFrame(D,spec,phase,t,res),12*res,4*res,40*res,40*res),i%8*40*res,(Math.floor(i/8)*80+j*40)*res)
 writePNG(path.join(out,`${spec.id}-compact-res${res}.png`),sheet)
}



export const ROUND_FOUR=['crusher','scorpion','spores']
export function roundFourReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_FOUR){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-4],['charge',spec.charge-1],['fire',0],['fire',3],['rest',0],['rest',6]]
  const pair=canvas(16*48*res,48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,crop(hazardFrame(D,spec,phase,t,res),8*res,0,48*res,48*res),(j*8+i)*48*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_FOUR,'round4')
}

export const ROUND_FIVE=['rockfall','scarab','snake']
export function roundFiveReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_FIVE){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-4],['charge',spec.charge-1],['fire',0],['fire',3],['rest',0],['rest',6]]
  const pair=canvas(16*48*res,48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,crop(hazardFrame(D,spec,phase,t,res),8*res,0,48*res,48*res),(j*8+i)*48*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_FIVE,'round5')
}

export const ROUND_SIX=['molten','airlock','steamvent']
export function roundSixReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_SIX){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-4],['charge',spec.charge-1],['fire',0],['fire',3],['rest',0],['rest',6]]
  const pair=canvas(16*48*res,48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,crop(hazardFrame(D,spec,phase,t,res),8*res,0,48*res,48*res),(j*8+i)*48*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_SIX,'round6')
}
export const ROUND_SEVEN=['geyser','frostjet','shark']
export function roundSevenReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_SEVEN){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-4],['charge',spec.charge-1],['fire',0],['fire',3],['rest',0],['rest',6]]
  const pair=canvas(16*48*res,48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,crop(hazardFrame(D,spec,phase,t,res),8*res,0,48*res,48*res),(j*8+i)*48*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_SEVEN,'round7')
}


export const ROUND_EIGHT=['vinelock','blackice','shredder']
export function roundEightReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_EIGHT){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-4],['charge',spec.charge-1],['fire',0],['fire',3],['rest',0],['rest',6]]
  const pair=canvas(16*48*res,48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,crop(hazardFrame(D,spec,phase,t,res),8*res,0,48*res,48*res),(j*8+i)*48*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_EIGHT,'round8')
}

export const ROUND_NINE=['spikes','flywheel','sprinkler']
export function roundNineReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_NINE){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',Math.floor(spec.charge/2)],['charge',spec.charge-4],['charge',spec.charge-1],['fire',0],['fire',3],['rest',0],['rest',6]]
  const pair=canvas(16*48*res,48*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,crop(hazardFrame(D,spec,phase,t,res),8*res,0,48*res,48*res),(j*8+i)*48*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_NINE,'round9')
}

export const ROUND_TEN=['turret','darts','flame']
export function roundTenReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_TEN){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',8],['charge',spec.charge-1],['fire',0],['fire',3],['fire',spec.fire-1],['rest',0],['rest',6]]
  const pair=canvas(16*64*res,56*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,hazardFrame(D,spec,phase,t,res),(j*8+i)*64*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_TEN,'round10')
}
export const ROUND_ELEVEN=['sawblade','tesla','lasergrid']
export function roundElevenReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_ELEVEN){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',8],['charge',spec.charge-1],['fire',0],['fire',3],['fire',spec.fire-1],['rest',0],['rest',6]]
  const pair=canvas(16*64*res,56*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,hazardFrame(D,spec,phase,t,res),(j*8+i)*64*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_ELEVEN,'round11')
}
export const ROUND_TWELVE=['sniper','grinder','sweeper']
export function roundTwelveReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_TWELVE){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',8],['charge',spec.charge-1],['fire',0],['fire',3],['fire',spec.fire-1],['rest',0],['rest',6]]
  const pair=canvas(16*64*res,56*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,hazardFrame(D,spec,phase,t,res),(j*8+i)*64*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_TWELVE,'round12')
}
export const ROUND_THIRTEEN=['gun','sentry','tripwire']
export function roundThirteenReview(out,old,now){
 for(const res of [1,2])for(const name of ROUND_THIRTEEN){
  const spec=S.HAZARDS.find(s=>s.id===name)
  compactHazardStrip(out,old,now,spec,res)
  const keys=[['idle',0],['charge',8],['charge',spec.charge-1],['fire',0],['fire',3],['fire',spec.fire-1],['rest',0],['rest',6]]
  const pair=canvas(16*64*res,56*res,'#1a1b26')
  for(const [j,D]of [old,now].entries())for(const [i,[phase,t]]of keys.entries())
   copyPixels(pair,hazardFrame(D,spec,phase,t,res),(j*8+i)*64*res,0)
  writePNG(path.join(out,`${name}-compare-res${res}.png`),pair)
 }
 roundTwoBoards(out,old,now,ROUND_THIRTEEN,'round13')
}

if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))run(process.argv[2]||'HEAD',process.argv[3]||'/tmp/xmas-dressing/foes-0')
