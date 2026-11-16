import {canyonSuccessor} from './canyon-reference.js'
import pins from '../test/fixtures/mill-scenes.json' with {type:'json'}
// C19 advances only independently reviewed Factory scenery digests.
export function millSuccessor(previous){return canyonSuccessor(pins[previous]?.after || previous)}
