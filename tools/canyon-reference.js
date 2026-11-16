import pins from '../test/fixtures/canyon-scenes.json' with {type:'json'}
// C20 advances only the explicitly reviewed Desert scenery scenes.
export function canyonSuccessor(previous){return pins[previous]?.after || previous}
