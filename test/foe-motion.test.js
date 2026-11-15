import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import {execFileSync} from 'node:child_process'
import {createHash} from 'node:crypto'
import {load,canvas,themeOf,THEMES} from '../tools/render.js'
import {renderer} from '../tools/gag-art.js'
import {enemyFrame,hazardFrame,enemyFixture,hazardFixture,hazardSequence,choices,run} from '../tools/foe-strips.js'
const base='b2cfda639e17a142b4e8b280af26df5267a74bc9'
const oldSource=execFileSync('git',['show',base+':public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
const source=fs.readFileSync('public/agents/Draw.js','utf8')
const old=renderer(oldSource),D=load('Draw.js'),S=load('Sim.js'),P=load('Palette.js')
const hash=b=>createHash('sha256').update(b).digest('hex')
const specs=['icicle','servo'].map(id=>S.HAZARDS.find(s=>s.id===id))
function corpus(D){
 const sums={}
 for(const res of [1,2])for(const dir of [-1,1]){
  for(const spec of specs){
   const h=createHash('sha256')
   for(const {phase,t}of hazardSequence(spec))h.update(hazardFrame(D,spec,phase,t,res,dir).buf)
   sums[`${spec.id}/${res}/${dir}`]=h.digest('hex')
  }
  for(const state of ['aim','reload','camp']){
   const h=createHash('sha256')
   for(let t=0;t<(state==='aim'?36:80);t++)h.update(enemyFrame(D,'sniper',state,t,res,dir).buf)
   sums[`sniper-${state}/${res}/${dir}`]=h.digest('hex')
  }
 }
 return sums
}
test('C12 exact consecutive cycles retain historical digests and reviewed key poses',()=>{
 const pins=JSON.parse(fs.readFileSync('test/fixtures/foe-motion-pins.json','utf8'))
 assert.deepEqual(corpus(old),pins.before)
 assert.deepEqual(corpus(D),pins.after)
})
function difference(a,b){let n=0;for(let i=0;i<a.length;i+=3)if(a[i]!==b[i]||a[i+1]!==b[i+1]||a[i+2]!==b[i+2])n++;return n}
test('C12 preparation and follow-through make substantial native changes in both facings',()=>{
 for(const res of [1,2])for(const dir of [-1,1]){
  for(const spec of specs){
   for(const [phase,t]of [['charge',spec.charge-1],['fire',2],['rest',3]]){
    const a=hazardFrame(old,spec,phase,t,res,dir),b=hazardFrame(D,spec,phase,t,res,dir)
    assert.ok(difference(a.buf,b.buf)>=6*res*res,`${spec.id} ${phase} ${res}`)
   }
  }
  for(const [state,t]of [['aim',0],['reload',16]]){
   assert.ok(difference(enemyFrame(old,'sniper',state,t,res,dir).buf,enemyFrame(D,'sniper',state,t,res,dir).buf)>=10*res*res,`sniper ${state} ${res}`)
  }
 }
})
test('C12 release keys join their own Sim clocks and recovery ends without phantom action',()=>{
 for(const res of [1,2]){
  const w={res},g={tall:24,winding:true,progress:1}
  const last=D.iciclePose(w,{t:31},g),first=D.iciclePose(w,{t:0},{tall:24,live:true})
  assert.equal(last.drop,first.drop)
  const drops=Array.from({length:9},(_,t)=>D.iciclePose(w,{t:24+t},{tall:24,winding:true,progress:(24+t)/32}).drop)
  assert.ok(drops.every((d,i)=>!i||d>=drops[i-1]));assert.equal(drops[8],14)
  assert.ok(drops[6]>drops[3],'late charge accelerates to contact')
  assert.equal(first.drop+10,24,'first fire tick is already on the floor')
  const cock=D.servoPose(w,{t:17},g),release=D.servoPose(w,{t:0},{tall:24,live:true})
  assert.deepEqual(cock,release)
  const end=D.servoPose(w,{t:17},{tall:24,live:true}),recover=D.servoPose(w,{t:0},{tall:24,cool:1})
  assert.deepEqual(end,recover)
  for(const kind of ['icicle','servo']){
   const spec=S.HAZARDS.find(s=>s.id===kind)
   assert.equal(hash(hazardFrame(D,spec,'rest',20,res).buf),hash(hazardFrame(old,spec,'idle',20,res).buf))
  }
 }
})
function readonly(value){
 if(!value||typeof value!=='object'||ArrayBuffer.isView(value))return value
 return new Proxy(value,{get:(o,k)=>readonly(o[k]),set(){throw Error('drawing wrote world')}})
}
test('C12 drawing is pure, deterministic, bounded and uses the native/half-pixel grids',()=>{
 const random=Math.random
 try{
  Math.random=()=>{throw Error('drawing RNG')}
  for(const res of [1,2])for(const dir of [-1,1])for(const theme of Object.keys(THEMES)){
   const pal=P.build(themeOf(theme).theme,1)
   for(const spec of specs)for(const phase of ['idle','charge','fire','rest'])for(const t of [0,2,6,10,20,31]){
    const {w,h}=hazardFixture(spec,phase,t,dir);w.res=res
    const img=canvas(400*res,248*res),ctx=img.ctx,fill=ctx.fillRect.bind(ctx);let calls=0
    ctx.fillRect=(...r)=>{assert.ok(++calls<500);assert.ok(r.every(Number.isFinite));assert.ok(r.every(v=>Number.isInteger(v*res)),`${spec.id} ${r}`);fill(...r)}
    D.drawHazardKind(ctx,readonly(w),pal,readonly(h));assert.equal(ctx.globalAlpha,1)
   }
   for(const state of ['aim','reload','camp'])for(const t of [0,4,8,16,24,40,79]){
    const {w,en}=enemyFixture('sniper',state,t,dir);w.res=res
    const img=canvas(400*res,248*res);D.drawEnemy(img.ctx,readonly(w),pal,readonly(en),{})
    assert.equal(img.ctx.globalAlpha,1)
   }
  }
 }finally{Math.random=random}
})
test('C12 reduced motion holds secondary poses while the hazard phase remains readable',()=>{
 for(const res of [1,2]){
  const w={res,reducedMotion:true}
  for(const t of [0,3,9,24,79])assert.deepEqual(D.sniperLoad(w,{state:'reload',timer:t}),{rise:0,pull:0,hand:0})
  for(const t of [0,2,8,15])assert.deepEqual(D.iciclePose(w,{t},{live:true,tall:24}),{drop:14,shake:0,length:8})
  for(const t of [0,6,17])assert.deepEqual(D.servoPose(w,{t},{live:true,tall:24}),{x:0,y:22,width:8})
  assert.equal(D.iciclePose(w,{t:29},{winding:true,progress:0.9}).shake,0)
  assert.deepEqual(D.sniperLoad({res},{state:'aim',timer:4,throttled:20}),{rise:0,pull:0,hand:0})
 }
})
function replaceFunction(text,name,reference){
 const pattern=new RegExp('function '+name+'\\([^]*?\\n}\\n')
 return text.replace(pattern,reference.match(pattern)[0])
}
test('C12 scope audit restores the complete baseline by replacing only the three reviewed painters',()=>{
 let restored=source
 for(const fn of ['drawHzIcicle','drawHzServo','drawSniper','drawSniperFine','drawCastEnemyKit','drawCastMarksman'])restored=replaceFunction(restored,fn,oldSource)
 const R=renderer(restored)
 for(let level=1;level<=S.BIOMES.length;level++){
  const w=S.generate(level,0,3)
  for(let t=0;t<=400;t++){
   if(t)S.step(w)
   if(![120,350,400].includes(t))continue
   for(const res of [1,2]){
    w.res=res;const pal=P.build(themeOf('tokyo-night').theme,level)
    const draw=D=>{const img=canvas(400*res,248*res);D.drawTerrain(img.ctx,w,pal);D.drawActors(img.ctx,w,pal,{});return hash(img.buf)}
    assert.equal(draw(R),draw(old),`${level}/${t}/${res}`)
   }
  }
 }
})
test('C12 complete review tool writes native/page evidence and a timer manifest',()=>{
 const out=fs.mkdtempSync(path.join(os.tmpdir(),'foe-strips-'))
 try{
  run(base,out,{kinds:['sniper','drone'],hazards:['icicle','servo']});choices(out,old,D)
  const manifest=JSON.parse(fs.readFileSync(path.join(out,'manifest.json'),'utf8'))
  assert.equal(Object.keys(manifest.hazards).length,2)
  for(const spec of S.HAZARDS.filter(s=>s.mech==='field'))assert.ok(hazardSequence(spec).length===32&&hazardSequence(spec).every(k=>k.phase==='fire'))
  for(const spec of specs)assert.equal(manifest.hazards[spec.id].filter(k=>k.phase==='charge').length,spec.charge)
  for(const res of [1,2])for(const name of ['enemies', 'icicle-keys-1','servo-keys-1','sniper-reload-1'])assert.ok(fs.statSync(path.join(out,`${name}-res${res}.png`)).size>100)
 }finally{fs.rmSync(out,{recursive:true,force:true})}
})
export {corpus,old,D}

test('C12 every other hazard and hostile retains exact pixels',()=>{
 for(const res of [1,2])for(const dir of [-1,1]){
  for(const spec of S.HAZARDS.filter(s=>!['icicle','servo'].includes(s.id)))for(const phase of ['idle','charge','fire','rest']){
   assert.equal(hash(hazardFrame(D,spec,phase,3,res,dir).buf),hash(hazardFrame(old,spec,phase,3,res,dir).buf),`${spec.id}/${phase}/${res}/${dir}`)
  }
  for(const kind of ['gun','bouncer','operator','drone','moderator','xeno','harpoon'])for(const state of ['walk','aim','reload','brawl','hit','death']){
   assert.equal(hash(enemyFrame(D,kind,state,4,res,dir).buf),hash(enemyFrame(old,kind,state,4,res,dir).buf),`${kind}/${state}/${res}/${dir}`)
  }
 }
})
test('C12 seasonal hats keep exactly the same head anchors and paint',()=>{
 function capture(text){
  for(const name of ['drawChristmasEnemy','drawNewyearEnemy']){
   const pattern=new RegExp('function '+name+'\\([^]*?\\n}\\n')
   text=text.replace(pattern,`function ${name}(ctx,w,en,x,y){ctx.heads.push(["${name}",x,y])}\n`)
  }
  return renderer(text)
 }
 const a=capture(oldSource),b=capture(source)
 for(const res of [1,2])for(const dir of [-1,1])for(const state of ['aim','reload','camp'])for(const t of [0,4,8,16,24,40]){
  const {w,en}=enemyFixture('sniper',state,t,dir);w.res=res
  const anchors=D=>{const img=canvas(400*res,248*res);img.ctx.heads=[];D.drawEnemy(img.ctx,w,{},en,{});return img.ctx.heads}
  assert.deepEqual(anchors(a),anchors(b))
  for(const mode of ['santa','party']){
   w.season={redHats:mode}
   const paint=D=>{const img=canvas(80*res,56*res);img.ctx.setTransform(res,0,0,res,0,0);D.drawChristmasEnemy(img.ctx,w,en,28,16);D.drawNewyearEnemy(img.ctx,w,en,28,16);return hash(img.buf)}
   assert.equal(paint(D),paint(old))
  }
 }
})
