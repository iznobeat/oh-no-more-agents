import pins from '../test/fixtures/orbital-scenes.json' with {type:'json'}
// C22 advances only the explicitly reviewed Spaceship scenery.
export function orbitalSuccessor(previous){return pins[previous]?.after || previous}
