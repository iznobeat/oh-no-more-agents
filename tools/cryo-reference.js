import {millSuccessor} from './mill-reference.js'
import pins from '../test/fixtures/cryo-scenes.json' with {type:'json'}
// C18 retains each historical scene before advancing its reviewed Ice Cave art.
export function cryoSuccessor(previous){return millSuccessor(pins[previous]?.after || previous)}
