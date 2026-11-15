import fs from 'node:fs'
import {ironworksSourceBefore} from './ironworks-reference.js'
import {execFileSync} from 'node:child_process'
import {renderer} from './gag-art.js'
// Reconstruct a reviewed historical renderer without dropping any assertions.
// C12's broad scope pins still run against the original three C13 painters;
// C13 independently pins their old and new complete cycles and audits scope.
export function restoreFoeRoundTwo(source,reference){
 source=restoreFoeRoundThree(source,reference)
 for(const name of ['drawHzBeartrap','drawHzPendulum','drawHzSnowball']){
  const pattern=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(pattern,reference.match(pattern)[0])
 }
 const fine=/  beartrap: (?:function \([^]*?\n  },|drawTrapFine,)\n/
 const swing=/function hzSwing\([^]*?\n}\n/
 return source.replace(fine,reference.match(fine)[0])+reference.match(swing)[0]
}

// Preserve C12/C13 assertions against their exact historical three painters.
// C14 separately pins these complete cycles and audits the whole-board scope.
export function restoreFoeRoundThree(source,reference){
 source=ironworksSourceBefore(source)
 for(const name of ['drawHzPiston','drawHzStamper','drawHzEchobat']){
  const pattern=new RegExp('function '+name+'\\([^]*?\\n}\\n')
  source=source.replace(pattern,reference.match(pattern)[0])
 }
 return source
}

// Keep earlier exact pins in force before asserting the deliberate C14 step.
export function foeRoundThreeBefore(source=fs.readFileSync('public/agents/Draw.js','utf8')){
 const reference=execFileSync('git',['show','dc0a9a6f30b7e37ab9b69a3acff10ba865a292a3:public/agents/Draw.js'],{maxBuffer:4<<20}).toString()
 return renderer(restoreFoeRoundThree(source,reference))
}
