import fs from 'node:fs'
import {execFileSync} from 'node:child_process'
let reference
// Reconstruct the exact C22-era hostile painters for the historical art chain.
// C24 pins both sides independently, including full boards and seasonal riders.
export function foeRoundFourSourceBefore(source){
 reference ||= execFileSync('git',['show','d7b0d333e0ae77e1f43c23b17c3990b9e7119952:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzCrusher','drawHzScorpion','drawHzSpores']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['scorpionTailPose','drawScorpionTail','sporePodPose','drawSporeDrift'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n'),'')
 return source.replace('// The sting remains attached throughout the held coil, release and recoil.\n','')
  .replace('// Swell, hold the seam under tension, split and exhale, then close.\n','')
}

export function foeRoundFourSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round4-scenes.json',import.meta.url),'utf8'))
 return pins[previous]?.after || previous
}
