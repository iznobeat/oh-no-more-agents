import {karstSuccessor} from './karst-reference.js'
import pins from '../test/fixtures/canyon-scenes.json' with {type:'json'}
// C20 advances only the explicitly reviewed Desert scenery scenes.
export function canyonSuccessor(previous){return karstSuccessor(pins[previous]?.after || previous)}
