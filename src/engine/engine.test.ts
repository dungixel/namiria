import { describe, expect, it } from 'vitest'
import {
  createGame, resolveSync, stepOptions, throwOptions, attackTile, respawnTile, BOARD_SIZE, LEFT_VOID, RIGHT_VOID,
  type CardType, type GameState, type Picks, type Policy, type Beat,
} from './index'

/** A match where both players hold exactly the cards we want, in the order given. */
function setup(a: CardType[], b: CardType[], tiles: [number, number] = [4, 6]): GameState {
  const s = createGame(1)
  const fill = (c: CardType[]) => [...c, ...Array<CardType>(6 - c.length).fill('change')]
  s.players[0].hand = fill(a)
  s.players[1].hand = fill(b)
  s.players[0].tile = tiles[0]
  s.players[1].tile = tiles[1]
  return s
}
const two = (x: number | null = null, y: number | null = null): Picks => [x, y]
const stay: Policy = (r) => r.default
/** policy that always picks a given tile if legal */
const goTo = (tiles: Partial<Record<0 | 1, number>>): Policy => (r) => tiles[r.player] ?? r.default
const strikes = (beats: Beat[]) => beats.filter((b) => b.type === 'strike')

describe('setup', () => {
  it('starts on tiles 4 and 6 with 20 hp, 6 cards and a visible next card', () => {
    const s = createGame(42)
    expect(s.players.map((p) => p.tile)).toEqual([4, 6])
    expect(s.players.map((p) => p.hp)).toEqual([20, 20])
    expect(s.players[0].hand).toHaveLength(6)
    expect(s.players[0].next).toBeTruthy()
  })
  it('is deterministic for a given seed', () => {
    expect(createGame(7)).toEqual(createGame(7))
    expect(createGame(7).players[0].hand).not.toEqual(createGame(8).players[0].hand)
  })
})

describe('Attack', () => {
  it('hits exactly 2 tiles away for 3 damage', () => {
    const { state } = resolveSync(setup(['attack'], ['change']), [two(0), two()], stay)
    expect(state.players[1].hp).toBe(17)
    expect(state.players[0].hp).toBe(20)
  })
  it('does NOT hit at 1 tile or 3 tiles', () => {
    for (const tiles of [[4, 5], [4, 7]] as [number, number][]) {
      const { state } = resolveSync(setup(['attack'], ['change'], tiles), [two(0), two()], stay)
      expect(state.players[1].hp).toBe(20)
    }
  })
  it('works in both directions', () => {
    const { state } = resolveSync(setup(['change'], ['attack'], [4, 6]), [two(), two(0)], stay)
    expect(state.players[0].hp).toBe(17)
    expect(attackTile(6, 4, 2)).toBe(4)
  })
  it('both attacking trade hits', () => {
    const { state } = resolveSync(setup(['attack'], ['attack']), [two(0), two(0)], stay)
    expect(state.players.map((p) => p.hp)).toEqual([17, 17])
  })
})

describe('Step', () => {
  it('moves 1 or 2 tiles either way, never through or onto the enemy', () => {
    expect(stepOptions(4, 6, 2)).toEqual([2, 3, 4, 5])
    expect(stepOptions(1, 3, 2)).toEqual([1, 2])
    expect(stepOptions(9, 8, 2)).toEqual([9])
    expect(stepOptions(5, 9, 2)).toEqual([3, 4, 5, 6, 7])
  })
  it('moves before attacks resolve: stepping away dodges an attack', () => {
    const { state } = resolveSync(setup(['attack'], ['step']), [two(0), two(0)], goTo({ 1: 8 }))
    expect(state.players[1].tile).toBe(8)
    expect(state.players[1].hp).toBe(20)
  })
  it('stepping INTO range gets you hit in the same slot', () => {
    const { state } = resolveSync(setup(['attack'], ['step'], [4, 8]), [two(0), two(0)], goTo({ 1: 6 }))
    expect(state.players[1].hp).toBe(17)
  })
  it('both stepping to the same tile clash and return to their original tiles', () => {
    const { state, beats } = resolveSync(setup(['step'], ['step']), [two(0), two(0)], goTo({ 0: 5, 1: 5 }))
    expect(state.players.map((p) => p.tile)).toEqual([4, 6])
    const step = beats.find((b) => b.type === 'step')!
    expect(step.type === 'step' && step.clashTile).toBe(5)
  })
  it('ignores illegal destinations', () => {
    const { state } = resolveSync(setup(['step'], ['change']), [two(0), two()], goTo({ 0: 6 }))
    expect(state.players[0].tile).toBe(4)
  })
})

describe('Block', () => {
  it('blocks an attack, even from behind (either side)', () => {
    const { state } = resolveSync(setup(['attack'], ['block']), [two(0), two(0)], stay)
    expect(state.players[1].hp).toBe(20)
    const r = resolveSync(setup(['block'], ['attack']), [two(0), two(0)], stay)
    expect(r.state.players[0].hp).toBe(20)
  })
  it('only lasts for its own slot', () => {
    // opponent blocks in slot 1 only; our attack in slot 2 lands
    const { state } = resolveSync(setup(['change', 'attack'], ['block']), [two(0, 1), two(0)], stay)
    expect(state.players[1].hp).toBe(17)
  })
  it("Umiro's passive: a double block breaks on the 2nd block", () => {
    // opponent blocks twice; we attack in both slots -> 1st blocked, 2nd goes through
    const { state, beats } = resolveSync(
      setup(['attack', 'attack'], ['block', 'block']),
      [two(0, 1), two(0, 1)],
      stay,
    )
    const outcomes = strikes(beats).flatMap((b) => (b.type === 'strike' ? b.results.filter((r) => r.player === 0).map((r) => r.outcome) : []))
    expect(outcomes).toEqual(['blocked', 'broken'])
    expect(state.players[1].hp).toBe(17)
  })
  it("passive only triggers if the 1st Block actually stopped something", () => {
    // we do nothing useful in slot 1 (heal), the opponent blocks twice: the 1st Block blocked nothing,
    // so our slot-2 attack is simply blocked
    const { state, beats } = resolveSync(
      setup(['special', 'attack'], ['block', 'block']),
      [two(0, 1), two(0, 1)],
      stay,
    )
    const outcomes = strikes(beats).flatMap((b) => (b.type === 'strike' ? b.results.filter((r) => r.player === 0 && r.kind === 'attack').map((r) => r.outcome) : []))
    expect(outcomes).toEqual(['blocked'])
    expect(state.players[1].hp).toBe(20)
  })
  it('a lone block (slot 2 only) still works', () => {
    const { state } = resolveSync(setup(['attack'], ['change', 'block']), [two(null, 0), two(0, 1)], stay)
    expect(state.players[1].hp).toBe(20)
  })
  it('does not stop specials', () => {
    const { state } = resolveSync(setup(['special'], ['block']), [two(0), two(0)], stay)
    expect(state.players[0].hp).toBe(20) // capped at max
  })
})

describe('Grab', () => {
  it('beats Block: 2 damage (half of power 3, rounded up) and a throw up to 2 tiles away', () => {
    const { state } = resolveSync(setup(['grab'], ['block'], [4, 5]), [two(0), two(0)], goTo({ 0: 3 }))
    expect(state.players[1].hp).toBe(18)
    expect(state.players[1].tile).toBe(3) // thrown behind the grabber
  })
  it('damage lands with the fall, not at the grab', () => {
    const { beats } = resolveSync(setup(['grab'], ['block'], [4, 5]), [two(0), two(0)], goTo({ 0: 3 }))
    const grab = beats.find((b) => b.type === 'grab')!
    const throwBeat = beats.find((b) => b.type === 'throw')!
    expect(grab.state.players[1].hp).toBe(20) // grabbed, not yet hurt
    expect(throwBeat.state.players[1].hp).toBe(18) // hurt on landing
    expect(throwBeat.type === 'throw' && throwBeat.damage).toBe(2)
  })
  it('a grab can KO on landing', () => {
    const s = setup(['grab'], ['block'], [4, 5])
    s.players[1].hp = 2
    const { state, beats } = resolveSync(s, [two(0), two(0)], goTo({ 0: 3 }))
    expect(state.winner).toBe(0)
    expect(beats.map((b) => b.type)).toContain('throw')
    expect(beats.at(-1)?.type).toBe('gameOver')
  })
  it('whiffs at range 2', () => {
    const { state } = resolveSync(setup(['grab'], ['change']), [two(0), two()], stay)
    expect(state.players[1].hp).toBe(20)
  })
  it('cancels the victim\'s attack in that slot', () => {
    const { state } = resolveSync(setup(['grab'], ['attack'], [4, 5]), [two(0), two(0)], stay)
    expect(state.players[0].hp).toBe(20)
    expect(state.players[1].hp).toBe(18)
  })
  it('target can be stepped away from (movement resolves first)', () => {
    const { state } = resolveSync(setup(['grab'], ['step'], [4, 5]), [two(0), two(0)], goTo({ 1: 7 }))
    expect(state.players[1].hp).toBe(20)
  })
  it('two grabs at the same time cancel out', () => {
    const { state } = resolveSync(setup(['grab'], ['grab'], [4, 5]), [two(0), two(0)], stay)
    expect(state.players.map((p) => p.hp)).toEqual([20, 20])
  })
  it('throw options are within 2 tiles of the grabber and on the board', () => {
    expect(throwOptions(5)).toEqual([3, 4, 6, 7])
    // next to a cliff the far side is the void tile: that is the ring-out throw
    expect(throwOptions(1)).toEqual([LEFT_VOID, 2, 3])
    expect(throwOptions(2)).toEqual([LEFT_VOID, 1, 3, 4])
    expect(throwOptions(9)).toEqual([7, 8, RIGHT_VOID])
  })
})

describe('Special', () => {
  it('heals 1 but never above 20', () => {
    let s = setup(['attack'], ['special', 'change'])
    let r = resolveSync(s, [two(0), two(0)], stay)
    expect(r.state.players[1].hp).toBe(18) // 20 - 3 + 1
    s = setup(['special'], ['change'])
    s.players[0].hp = 10
    r = resolveSync(s, [two(0), two()], stay)
    expect(r.state.players[0].hp).toBe(11)
  })
})

describe('Cliffs and ring-outs', () => {
  const offLeft = (s: GameState) => resolveSync(s, [two(0), two(0)], goTo({ 0: LEFT_VOID }))
  it('the board has 9 tiles and the units start on 4 and 6 (mirror images around tile 5)', () => {
    expect(BOARD_SIZE).toBe(9)
    const s = createGame(1)
    expect(s.players.map((p) => p.tile)).toEqual([4, 6])
    expect(4 + 6).toBe(BOARD_SIZE + 1)
  })
  it('a unit pinned at the edge can be thrown into the void: it is lost, no fall damage', () => {
    // enemy (player 1) at tile 1, we grab from tile 2 and throw them off the left cliff
    const { state, beats } = offLeft(setup(['grab'], ['block'], [2, 1]))
    const t = beats.find((b) => b.type === 'throw')!
    expect(t.type === 'throw' && t.ringOut).toBe(true)
    expect(state.players[1].fallen).toEqual([true, false, false])
    expect(state.players[1].hp).toBe(20)
  })
  it('the next unit drops in at its start tile and the match goes on', () => {
    const { state, beats } = offLeft(setup(['grab'], ['block'], [2, 1]))
    const r = beats.find((b) => b.type === 'respawn')!
    expect(r.type === 'respawn' && [r.player, r.unit, r.tile]).toEqual([1, 1, 6])
    expect(state.players[1].active).toBe(1)
    expect(state.players[1].tile).toBe(6)
    expect(state.winner).toBeNull()
  })
  it('if the enemy stands on the start tile, the new unit drops in one tile toward its own edge', () => {
    expect(respawnTile(1, 6)).toBe(7) // enemy on our start tile 6 -> tile 7
    expect(respawnTile(0, 4)).toBe(3) // enemy on our start tile 4 -> tile 3
    expect(respawnTile(1, 2)).toBe(6) // free: our start tile
  })
  it('losing the last unit loses the match', () => {
    const s = setup(['grab'], ['block'], [2, 1])
    s.players[1].fallen = [true, true, false]
    s.players[1].active = 2
    const { state, beats } = offLeft(s)
    expect(state.winner).toBe(0)
    expect(beats.at(-1)?.type).toBe('gameOver')
    expect(beats.some((b) => b.type === 'respawn')).toBe(false)
  })
  it('throwing the enemy to a normal tile still hurts on landing, with no ring-out', () => {
    const { state } = resolveSync(setup(['grab'], ['block'], [2, 1]), [two(0), two(0)], goTo({ 0: 4 }))
    expect(state.players[1].hp).toBe(18)
    expect(state.players[1].fallen).toEqual([false, false, false])
  })
  it('Change skips units that fell off', () => {
    const s = setup(['change'], ['block'])
    s.players[0].fallen = [false, true, false]
    expect(resolveSync(s, [two(0), two(0)], stay).state.players[0].active).toBe(2)
  })
  it('Change does nothing when it is the only unit left', () => {
    const s = setup(['change'], ['block'])
    s.players[0].fallen = [false, true, true]
    const { state, beats } = resolveSync(s, [two(0), two(0)], stay)
    expect(state.players[0].active).toBe(0)
    expect(beats.some((b) => b.type === 'change')).toBe(false)
  })
})

describe('Change', () => {
  it('cycles through the team', () => {
    const { state } = resolveSync(setup(['change', 'change'], ['attack']), [two(0, 1), two()], stay)
    expect(state.players[0].active).toBe(2)
  })
})

describe('Game flow', () => {
  it('KO ends the game', () => {
    const s = setup(['attack'], ['change'])
    s.players[1].hp = 3
    const { state, beats } = resolveSync(s, [two(0), two()], stay)
    expect(state.winner).toBe(0)
    expect(beats.at(-1)?.type).toBe('gameOver')
  })
  it('mutual KO is a draw', () => {
    const s = setup(['attack'], ['attack'])
    s.players[0].hp = 3
    s.players[1].hp = 3
    expect(resolveSync(s, [two(0), two(0)], stay).state.winner).toBe('draw')
  })
  it('replaces used cards with the next card and draws a new next', () => {
    const s = setup(['attack', 'step', 'block'], ['change'])
    s.players[0].next = 'grab'
    const { state } = resolveSync(s, [two(0, 2), two()], stay)
    expect(state.players[0].hand[0]).toBe('grab')
    expect(state.players[0].hand[2]).not.toBeUndefined()
    expect(state.players[0].hand[1]).toBe('step') // unused card stays
    expect(state.turn).toBe(2)
  })
  it('skipped actions simply do nothing', () => {
    const { state } = resolveSync(setup([], []), [two(), two()], stay)
    expect(state.players.map((p) => p.hp)).toEqual([20, 20])
  })
})
