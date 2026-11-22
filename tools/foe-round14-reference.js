import {execFileSync} from 'node:child_process'
import fs from 'node:fs'
let reference
// Remove later winter-biome hooks before reconstituting the original C34 baseline.
export function foeRoundFourteenSourceBefore(source){
 source=source.replace(/\n\/\/ Winter biome additions\n[\s\S]*?\n\/\/ End winter biome additions\n/,'')
 source=source.replace('  if (w.biome === "Winter Market" || w.biome === "Aurora Ridge") return drawWinterSnow(ctx, w)\n','')
 source=source.replace('  if (w.biome === "Aurora Ridge") drawRidgeLife(ctx, w, pal)\n','')
 source=source.replace('  if (m.kind === "lantern") return drawMarketMission(ctx, w, pal)\n','')
 source=source.replace('  var skiers = m.id === "skiers"\n','')
 source=source.replace('    if (!skiers && drawMissionEscort','    if (drawMissionEscort')
 source=source.replace('    if (skiers) drawRidgeSkier(ctx, w, pal, t, x, y)\n    else drawMissionSubject','    drawMissionSubject')
 source=source.replace('// Look at the next trail sample and support under the current feet: a leader\n// climbing now may still have a follower on the floor below.','// The trail stores positions and direction, not movement states. Look at its\n// next sample and support under the current feet, never the leader\'s *current*\n// state: a leader climbing now may still have a follower on the floor below.')
 source=source.replace('  var at = w.mission.id === "skiers" ? ridgeSkierNotice(w.mission).at : w.mission.openedAt\n  return Math.max(0, 1 - (w.ticks - at) / 45)','  return Math.max(0, 1 - (w.ticks - w.mission.openedAt) / 45)')
 source=source.replace('  if (w.mission.id === "skiers") text = w.mission.done ? ridgeSkierNotice(w.mission).text : "ESCORT SKIERS TO SHELTER"\n','')
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
