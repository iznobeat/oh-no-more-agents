import fs from 'node:fs'
import {renderer} from './gag-art.js'
// Retain historical assertions before the separately pinned C15 art step.
// Four hooks are the complete scope; ironworks-art.test audits every biome.
export function ironworksSourceBefore(source){
 return source.replace(/^  drawIronworks(?:Hall|Brick|Kilns|Life)\(ctx, w, pal\)\n/gm,'')
}
export function ironworksBefore(source=fs.readFileSync('public/agents/Draw.js','utf8')){
 return renderer(ironworksSourceBefore(source))
}
