import {foeRoundThirteenSourceBefore,foeRoundThirteenSuccessor} from './foe-round13-reference.js'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C32's three painters and six carriage/roller/sight helpers.
export function foeRoundTwelveSourceBefore(source){
 source=foeRoundThirteenSourceBefore(source)
 reference ||= execFileSync('git',['show','3310a0986421a92f1007154eed93028ac2654d15:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzSniper','drawHzSweeper','drawHzGrinder']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['mountedSniperSlide','drawMountedSniperSight','sweeperCarriage','grinderRollerPose','drawGrinderRoller','drawGrinderIdle'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundTwelveSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round12-scenes.json',import.meta.url),'utf8'))
 return foeRoundThirteenSuccessor(pins[previous]?.after || previous)
}
