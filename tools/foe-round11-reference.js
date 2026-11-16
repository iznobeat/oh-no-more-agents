import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C31's three painters and six wheel/head/emitter helpers.
export function foeRoundElevenSourceBefore(source){
 reference ||= execFileSync('git',['show','d651079124e24abe2f5190df0b6affeb18cae971:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzSawblade','drawHzTesla','drawHzLasergrid']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['sawbladePose','drawSawTeeth','teslaHeadLift','drawTeslaCharge','laserEmitterDrop','drawLaserColumn'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundElevenSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round11-scenes.json',import.meta.url),'utf8'))
 return pins[previous]?.after || previous
}
