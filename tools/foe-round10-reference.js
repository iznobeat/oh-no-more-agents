import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C30's three painters and seven pose/lamp/volley/cone helpers.
export function foeRoundTenSourceBefore(source){
 reference ||= execFileSync('git',['show','71ab84a324a134b0251aa916b5312ee88dc9f990:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzTurret','drawHzDarts','drawHzFlame']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['twinTurretSpread','twinTurretDrop','mountedLamp','dartRackLength','drawDartVolley','flameValvePose','drawFlameCone'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundTenSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round10-scenes.json',import.meta.url),'utf8'))
 return pins[previous]?.after || previous
}
