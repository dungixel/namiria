import { MAX_HP } from './constants'
import { draw } from './deck'
import { activeUnit, attackTile, grabDamage, grabReaches, isVoid, nextLivingUnit, other, respawnTile, stepOptions, throwOptions, unitsLeft } from './rules'
import type {
  Beat,
  CardType,
  Choices,
  DecisionRequest,
  GameState,
  Picks,
  PlayerId,
  ResolveYield,
  Slot,
  StrikeResult,
} from './types'

const PLAYERS: readonly PlayerId[] = [0, 1]

export interface ResolveOptions {
  /** false = don't deep-copy the state for every beat (faster; used by the bot's simulations) */
  snapshots?: boolean
}

/**
 * Resolves one full turn (2 action slots per player).
 *
 * It is a generator so that the caller can animate each Beat as it happens and answer the
 * mid-turn decisions (Step destination, Grab throw target) when they come up.
 *
 * Within a slot, both players' cards resolve in this order:
 *   1. Change   2. Step (simultaneous; same target tile = clash, both bounce back)
 *   3. Block goes up   4. Grab (ignores Block, cancels the victim's action, then throw)
 *   5. Attack / Special (simultaneous)
 */
export function* resolveTurn(
  initial: GameState,
  picks: [Picks, Picks],
  opts: ResolveOptions = {},
): Generator<ResolveYield, GameState, Choices | undefined> {
  const s: GameState = structuredClone(initial)
  const snap = (): GameState => (opts.snapshots === false ? s : structuredClone(s))
  const cards = PLAYERS.map((p) =>
    picks[p].map((i) => (i == null ? null : s.players[p].hand[i] ?? null)),
  ) as [(CardType | null)[], (CardType | null)[]]

  const finish = function* (winner: PlayerId | 'draw'): Generator<ResolveYield, GameState, Choices | undefined> {
    s.winner = winner
    yield { type: 'gameOver', winner, state: snap() } satisfies Beat
    return s
  }

  // who already had a Block stopped by a 'noDoubleBlock' attacker this turn (only then can the 2nd Block break)

  const blockedBefore: [boolean, boolean] = [false, false]

  for (const slot of [0, 1] as Slot[]) {
    const acts: [CardType | null, CardType | null] = [cards[0][slot], cards[1][slot]]
    yield { type: 'slotStart', slot, cards: acts, state: snap() }
    const held: [boolean, boolean] = [false, false]

    // ---- 1. Change ----
    const changes: { player: PlayerId; from: number; to: number }[] = []
    for (const p of PLAYERS) {
      if (acts[p] !== 'change') continue
      const pl = s.players[p]
      const from = pl.active
      const to = nextLivingUnit(pl)
      if (to === from) continue // nobody to switch to
      pl.active = to
      changes.push({ player: p, from, to })
    }
    if (changes.length) yield { type: 'change', slot, changes, state: snap() }

    // ---- 2. Step ----
    const steppers = PLAYERS.filter((p) => acts[p] === 'step')
    if (steppers.length) {
      const requests: DecisionRequest[] = steppers.map((p) => ({
        kind: 'step',
        player: p,
        options: stepOptions(s.players[p].tile, s.players[other(p)].tile, activeUnit(s, p).speed),
        default: s.players[p].tile,
      }))
      const choices = (yield { type: 'decision', requests, state: snap() }) ?? {}
      const dest: Partial<Record<PlayerId, number>> = {}
      for (const r of requests) {
        const c = choices[r.player]
        dest[r.player] = c != null && r.options.includes(c) ? c : r.default
      }
      const clash = steppers.length === 2 && dest[0] === dest[1]
      const moves = steppers.map((p) => {
        const from = s.players[p].tile
        const to = clash ? from : dest[p]!
        return { player: p, from, to, intended: dest[p]!, bounced: clash }
      })
      for (const m of moves) s.players[m.player].tile = m.to
      yield { type: 'step', slot, moves, clashTile: clash ? dest[0]! : null, state: snap() }
    }

    // ---- 3. Block ----
    const guarding: [boolean, boolean] = [acts[0] === 'block', acts[1] === 'block']
    // a 2nd Block right after a 1st one in the same turn is the one that "breaks"
    const secondBlock: [boolean, boolean] = [
      guarding[0] && slot === 1 && cards[0][0] === 'block',
      guarding[1] && slot === 1 && cards[1][0] === 'block',
    ]
    const guards = PLAYERS.filter((p) => guarding[p])
    if (guards.length) yield { type: 'guard', slot, players: guards, state: snap() }

    // ---- 4. Grab ----
    const grabbers = PLAYERS.filter((p) => acts[p] === 'grab')
    if (grabbers.length) {
      const reach = grabReaches(s.players[0].tile, s.players[1].tile)
      const clash = grabbers.length === 2 && reach
      const grabs = grabbers.map((p) => ({
        player: p,
        hit: reach && !clash,
        damage: reach && !clash ? grabDamage(activeUnit(s, p)) : 0,
      }))
      for (const g of grabs) {
        if (!g.hit) continue
        held[other(g.player)] = true // the victim loses their action; damage comes with the landing
      }
      yield { type: 'grab', slot, grabs, clash, state: snap() }

      for (const g of grabs) {
        if (!g.hit) continue
        const victimId = other(g.player)
        const victim = s.players[victimId]
        const request: DecisionRequest = {
          kind: 'throw',
          player: g.player,
          options: throwOptions(s.players[g.player].tile),
          default: victim.tile,
        }
        const choices = (yield { type: 'decision', requests: [request], state: snap() }) ?? {}
        const c = choices[g.player]
        const to = c != null && request.options.includes(c) ? c : request.default
        const from = victim.tile
        victim.tile = to
        const ringOut = isVoid(to)
        if (ringOut) victim.fallen[victim.active] = true // over the cliff: gone, no landing, no fall damage
        else victim.hp = Math.max(0, victim.hp - g.damage) // the fall hurts
        yield { type: 'throw', slot, thrower: g.player, target: victimId, from, to, damage: ringOut ? 0 : g.damage, ringOut, state: snap() }
        if (ringOut) {
          if (unitsLeft(victim) === 0) return yield* finish(g.player) // last unit gone
          victim.active = nextLivingUnit(victim)
          victim.tile = respawnTile(victimId, s.players[g.player].tile)
          yield { type: 'respawn', player: victimId, unit: victim.active, tile: victim.tile, state: snap() }
        }
      }
      const dead = PLAYERS.filter((p) => s.players[p].hp <= 0)
      if (dead.length) return yield* finish(dead.length === 2 ? 'draw' : other(dead[0]))
    }

    // ---- 5. Attack / Special (simultaneous) ----
    const strikers = PLAYERS.filter((p) => (acts[p] === 'attack' || acts[p] === 'special') && !held[p])
    if (strikers.length) {
      const results: StrikeResult[] = []
      const dmgTaken: [number, number] = [0, 0]
      const healed: [number, number] = [0, 0]
      for (const p of strikers) {
        const me = s.players[p]
        const foeId = other(p)
        const unit = activeUnit(s, p)
        if (acts[p] === 'special') {
          if (unit.special.kind === 'heal') healed[p] += unit.special.amount
          results.push({ player: p, kind: 'special', targetTile: null, outcome: 'heal', damage: 0, heal: 0 })
          continue
        }
        const target = attackTile(me.tile, s.players[foeId].tile, unit.range)
        if (target !== s.players[foeId].tile) {
          results.push({ player: p, kind: 'attack', targetTile: target, outcome: 'whiff', damage: 0, heal: 0 })
          continue
        }
        const guardUp = guarding[foeId] && !held[foeId]
        const breaks = unit.passive.kind === 'noDoubleBlock' && secondBlock[foeId] && blockedBefore[foeId]
        if (guardUp && !breaks) {
          if (unit.passive.kind === 'noDoubleBlock') blockedBefore[foeId] = true
          results.push({ player: p, kind: 'attack', targetTile: target, outcome: 'blocked', damage: 0, heal: 0 })
        } else {
          dmgTaken[foeId] += unit.power
          results.push({
            player: p,
            kind: 'attack',
            targetTile: target,
            outcome: guardUp ? 'broken' : 'hit',
            damage: unit.power,
            heal: 0,
          })
        }
      }
      // damage and healing land at the same time: hp = hp - damage + heal
      for (const p of PLAYERS) {
        const pl = s.players[p]
        const before = pl.hp
        const afterDamage = before - dmgTaken[p]
        const final = Math.max(0, Math.min(MAX_HP, afterDamage + healed[p]))
        const r = results.find((x) => x.player === p && x.kind === 'special')
        if (r) r.heal = Math.max(0, Math.min(healed[p], MAX_HP - Math.max(afterDamage, 0)))
        pl.hp = final
      }
      yield { type: 'strike', slot, results, state: snap() }

      const dead = PLAYERS.filter((p) => s.players[p].hp <= 0)
      if (dead.length) return yield* finish(dead.length === 2 ? 'draw' : other(dead[0]))
    }

    yield { type: 'slotEnd', slot, state: snap() }
  }

  // ---- end of turn: used cards are replaced; the visible "next" card drops into the hand ----
  const refills: { player: PlayerId; indexes: number[] }[] = []
  for (const p of PLAYERS) {
    const pl = s.players[p]
    const indexes = picks[p].filter((i): i is number => i != null)
    for (const i of indexes) {
      pl.hand[i] = pl.next
      pl.next = draw(s, pl)
    }
    refills.push({ player: p, indexes })
  }
  s.turn += 1
  yield { type: 'refill', refills, state: snap() }
  return s
}

// ---------- synchronous helper (bot simulations, tests, server-side refereeing) ----------

export type Policy = (req: DecisionRequest, state: GameState) => number

export function resolveSync(
  state: GameState,
  picks: [Picks, Picks],
  policy: Policy,
  opts: ResolveOptions = {},
): { state: GameState; beats: Beat[] } {
  const gen = resolveTurn(state, picks, opts)
  const beats: Beat[] = []
  let r = gen.next()
  while (!r.done) {
    const y = r.value
    if (y.type === 'decision') {
      const choices: Choices = {}
      for (const req of y.requests) choices[req.player] = policy(req, y.state)
      r = gen.next(choices)
    } else {
      beats.push(y)
      r = gen.next()
    }
  }
  return { state: r.value, beats }
}
