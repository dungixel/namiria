import { describe, expect, it } from 'vitest'
import { createGame, resolveSync } from '../engine'
import { botDecide, chooseBotPicks } from './bot'

describe('bot', () => {
  it('always returns two different valid hand indexes', () => {
    for (let seed = 1; seed < 15; seed++) {
      const s = createGame(seed)
      const p = chooseBotPicks(s, 1)
      expect(p[0]).not.toBe(p[1])
      expect(p.every((i) => i != null && i >= 0 && i < 6)).toBe(true)
    }
  })
  it('can play a whole match against itself without breaking', () => {
    let s = createGame(99)
    let turns = 0
    while (s.winner == null && turns < 60) {
      s = resolveSync(s, [chooseBotPicks(s, 0, 6), chooseBotPicks(s, 1, 6)], botDecide).state
      turns++
    }
    expect(turns).toBeGreaterThan(0)
    expect(s.players[0].hp <= 20 && s.players[1].hp <= 20).toBe(true)
  })
  it('is fast enough to think inside a frame budget', () => {
    const s = createGame(5)
    const t = performance.now()
    chooseBotPicks(s, 1)
    expect(performance.now() - t).toBeLessThan(400)
  })
})
