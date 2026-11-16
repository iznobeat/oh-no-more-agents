import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C27's five painters and five phase/plume helpers.
export function foeRoundSevenSourceBefore(source){
 reference ||= execFileSync('git',['show','0a817f23c0c323d43ebbe0e7936d4d4b544e31b4:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzGeyser','drawHzFrostjet','drawHzShark','drawSharkJaw','drawSharkFins']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['geyserPose','drawGeyserPlume','frostJetPose','drawFrostJetPlume','sharkAttackPose'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundSevenSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round7-scenes.json',import.meta.url),'utf8'))
 return pins[previous]?.after || previous
}
