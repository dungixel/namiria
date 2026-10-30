// A small Monte-Carlo bot. Hands are public in Namiria, so it knows your cards, but not which two
// you picked. It imagines what you might do (random pair from your real hand), simulates the turn
// with the real rules engine for each of its own options, and plays what works out best on average.
import {
  BOARD_SIZE, MAX_HP, activeUnit, resolveSync, other,
  type DecisionRequest, type GameState, type Picks, type PlayerId,
} from '../engine'

const rand = Math.random

/** Step / throw decisions (also used inside the simulations). */
export function botDecide(req: DecisionRequest, state: GameState): number {
  const me = state.players[req.player]
  const foe = state.players[other(req.player)]
  let best = req.default
  let bestScore = -Infinity
  for (const tile of req.options) {
    let score = rand() * 1.2 // keep it unpredictable
    if (req.kind === 'step') {
      // A Step slot has no attack of its own, so the point of moving is (1) not to stand where the
      // enemy's attack/grab lands, and (2) to be well placed for the next action. Hands are public.
      const foeId = other(req.player)
      const d = Math.abs(tile - foe.tile)
      if (foe.hand.includes('attack') && d === activeUnit(state, foeId).range) score -= 0.8
      if (foe.hand.includes('grab') && d === 1) score -= 0.7
      if (me.hand.includes('attack') && d === activeUnit(state, req.player).range) score += 0.8
      if (tile === me.tile) score -= 0.4 // a whole Step card spent standing still
      if (tile === 1 || tile === BOARD_SIZE) score -= 0.7
    } else {
      // throwing the enemy: line up our range-2 attack, pin them against a wall, keep our back free
      const d = Math.abs(tile - me.tile)
      score += d === 2 ? 1 : 0
      if (tile === 1 || tile === BOARD_SIZE) score += 0.7
      if (me.tile === 1 || me.tile === BOARD_SIZE) score -= 0.2
    }
    if (score > bestScore) { bestScore = score; best = tile }
  }
  return best
}

function randomPicks(): Picks {
  const a = Math.floor(rand() * 6)
  let b = Math.floor(rand() * 5)
  if (b >= a) b++
  return [a, b]
}

function score(s: GameState, me: PlayerId, before: GameState): number {
  if (s.winner === me) return 100
  if (s.winner === other(me)) return -100
  const foe = other(me)
  const lost = before.players[me].hp - s.players[me].hp
  const dealt = before.players[foe].hp - s.players[foe].hp
  // being aggressive is worth a bit more than being safe, otherwise everyone just blocks forever
  const edge = [1, BOARD_SIZE].includes(s.players[me].tile) ? -0.4 : 0
  const range = Math.abs(s.players[me].tile - s.players[foe].tile) === 2 ? 1.4 : 0
  return 1.7 * dealt - lost + edge + range + (s.players[me].hp / MAX_HP) * 0.3
}

export function chooseBotPicks(state: GameState, me: PlayerId, samples = 24): Picks {
  const hand = state.players[me].hand
  const candidates: Picks[] = []
  for (let i = 0; i < hand.length; i++) for (let j = 0; j < hand.length; j++) if (i !== j) candidates.push([i, j])

  // imagine some opponents: their hand is public, which two cards they chose is not
  const worlds = Array.from({ length: samples }, () => ({ world: state, foePicks: randomPicks() }))

  const scored = candidates.map((c) => {
    let total = 0
    for (const { world, foePicks } of worlds) {
      const picks = (me === 0 ? [c, foePicks] : [foePicks, c]) as [Picks, Picks]
      const { state: end } = resolveSync(world, picks, botDecide, { snapshots: false })
      total += score(end, me, state)
    }
    return { picks: c, value: total / samples }
  })
  scored.sort((a, b) => b.value - a.value)

  const r = rand()
  const choice = r < 0.65 ? scored[0] : r < 0.88 ? scored[1] : scored[2]
  return choice.picks
}
