export const BOARD_SIZE = 9 // tiles 1..9; the centre is tile 5, so 4 and 6 are mirror images
export const START_TILES: [number, number] = [4, 6]
// Beyond tile 1 and tile BOARD_SIZE the stage ends in a cliff. A unit thrown over the edge lands on one of
// these two "void" tiles and is lost (a ring-out).
export const LEFT_VOID = 0
export const RIGHT_VOID = BOARD_SIZE + 1
export const MAX_HP = 20
export const HAND_SIZE = 6
export const GRAB_RANGE = 1 // grab needs the enemy exactly 1 tile away
export const THROW_RANGE = 2 // a grabbed unit can be thrown at most 2 tiles away from the grabber
export const TURN_SECONDS = 30
export const DECISION_SECONDS = 10 // time to pick a Step destination / a throw target
