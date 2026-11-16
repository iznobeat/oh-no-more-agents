import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C33's three painters and six barrel/shutter/tension helpers.
export function foeRoundThirteenSourceBefore(source){
 reference ||= execFileSync('git',['show','abd55d1a61a798af3cecd8444ac6a81cbc5e359f:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzGun','drawHzSentry','drawHzTripwire']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['sprayerBarrelDrop','drawSprayerRounds','sentryShutterOpen','drawSentryBeam','tripwireTension','drawTripwireCoil'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 source=source.replace('Math.floor((w.reducedMotion ? 0 : w.ticks) / 12)', 'Math.floor(w.ticks / 12)')
 source=source.replace('Math.floor((w.reducedMotion ? 0 : w.ticks) / 24)', 'Math.floor(w.ticks / 24)')
 return source
}
export function foeRoundThirteenSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round13-scenes.json',import.meta.url),'utf8'))
 return pins[previous]?.after || previous
}
