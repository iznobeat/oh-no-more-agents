import pins from '../test/fixtures/alpine-scenes.json' with {type:'json'}
// C16 is independently pinned by alpine-art.test. Retain earlier art rounds'
// exact predecessors and advance only the explicitly reviewed scene hashes.
export function alpineSourceBefore(source){
 return source.replace(/^  drawAlpine(?:Sky|Snow|Firs|Life)\(ctx, w, pal\)\n/gm,'')
}
export function alpineSuccessor(previous){return pins[previous]?.after || previous}
