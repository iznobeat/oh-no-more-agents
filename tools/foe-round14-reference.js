import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Restore only C34's three painters and six fan/brace/pressure helpers.
export function foeRoundFourteenSourceBefore(source){
 reference ||= execFileSync('git',['show','fe891415d168b38bc8110e47977b9b396e0a46d4:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 for(const name of ['drawHzHotaisle','drawHzPolisher','drawHzVent']){
  const re=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(re,reference.match(re)[0])
 }
 for(const name of ['hotAisleShutter','drawHotAisleBlast','polisherBrace','drawPolisherPad','ventPressurePose','drawVentBubbles'])
  source=source.replace(new RegExp('function '+name+'\\([^]*?\\n}\\n\\n'),'')
 return source
}
export function foeRoundFourteenSuccessor(previous){
 const pins=JSON.parse(fs.readFileSync(new URL('../test/fixtures/foe-round14-scenes.json',import.meta.url),'utf8'))
 return pins[previous]?.after || previous
}
