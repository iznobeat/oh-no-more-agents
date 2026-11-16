import pins from '../test/fixtures/karst-scenes.json' with {type:'json'}
// C21 advances only the explicitly reviewed Cavern scenery scenes.
export function karstSuccessor(previous){return pins[previous]?.after || previous}
