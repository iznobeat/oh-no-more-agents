import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C28's three painters and four pose/roller helpers.
export function foeRoundEightSourceBefore(source){
 reference ||= execFileSync('git',['show','087a129d4c2a18b3c37e4d1cc3dc63e051066f62:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzVinelock','drawHzBlackice','drawHzShredder']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['vineLockPose','blackIcePose','shredderPose','drawShredderRollers'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundEightSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round8-scenes.json',import.meta.url),'utf8'))
 return pins[previous]?.after || previous
}
