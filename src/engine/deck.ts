import { nextRandom, shuffle } from './rng'
import { HAND_SIZE } from './constants'
import type { CardType, GameState, PlayerState } from './types'

/** One "bag" of cards; it is reshuffled whenever it runs out (like Tetris pieces). */
export const BAG_TEMPLATE: CardType[] = [
  'attack', 'attack', 'attack',
  'step', 'step', 'step',
  'block', 'block',
  'grab', 'grab',
  'special', 'special',
  'change',
]

export function draw(s: GameState, p: PlayerState): CardType {
  if (p.bag.length === 0) p.bag = shuffle(s, BAG_TEMPLATE)
  return p.bag.pop()!
}

export function dealHand(s: GameState, p: PlayerState): void {
  p.hand = []
  for (let i = 0; i < HAND_SIZE; i++) p.hand.push(draw(s, p))
  p.next = draw(s, p)
}

export { nextRandom }
