import foePins from '../test/fixtures/foe-round4-scenes.json' with {type:'json'}
import pins from '../test/fixtures/orbital-scenes.json' with {type:'json'}
// C22 advances only the explicitly reviewed Spaceship scenery.
export function orbitalSuccessor(previous){const prior=pins[previous]?.after || previous;return foePins[prior]?.after || prior}
