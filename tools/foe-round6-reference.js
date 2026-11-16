import {foeRoundSevenSourceBefore,foeRoundSevenSuccessor} from './foe-round7-reference.js'
import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C26's three painters and their phase-clock helpers.
export function foeRoundSixSourceBefore(source){
 source=foeRoundSevenSourceBefore(source)
 reference ||= execFileSync('git',['show','1d4172d5c8db9023f96fc6a7b5d34bb8bdc03b76:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzMolten','drawHzAirlock','drawHzSteamvent']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['moltenDropPose','airlockGap','steamVentPose'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundSixSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round6-scenes.json',import.meta.url),'utf8'))
 return foeRoundSevenSuccessor(pins[previous]?.after || previous)
}
