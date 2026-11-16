import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C25's three painters and their four pose/neck helpers.
export function foeRoundFiveSourceBefore(source){
 reference ||= execFileSync('git',['show','da0d2b8c38e9beae8062ccc4a41e4b5c821c361b:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzRockfall','drawHzScarab','drawHzSnake']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['rockLoadPose','scarabLaunchPose','snakeStrikePose','drawSnakeNeck'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundFiveSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round5-scenes.json',import.meta.url),'utf8'))
 return pins[previous]?.after || previous
}
