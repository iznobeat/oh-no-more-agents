import {foeRoundTenSourceBefore,foeRoundTenSuccessor} from './foe-round10-reference.js'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C29's three painters and five pose/spoke/rain helpers.
export function foeRoundNineSourceBefore(source){
 source=foeRoundTenSourceBefore(source)
 reference ||= execFileSync('git',['show','3db2196c64a3188dbbb7759d76e5cf3dc7b54f75:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzSpikes','drawHzFlywheel','drawHzSprinkler']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['spikeRackPose','flywheelAngle','drawFlywheelSpokes','sprinklerPose','drawSprinklerRain'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundNineSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round9-scenes.json',import.meta.url),'utf8'))
 return foeRoundTenSuccessor(pins[previous]?.after || previous)
}
