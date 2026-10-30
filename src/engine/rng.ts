// mulberry32, with the state stored inside GameState so that every draw is reproducible.
import type { GameState } from './types'

export function nextRandom(s: { rng: number }): number {
  s.rng = (s.rng + 0x6d2b79f5) >>> 0
  let t = s.rng
  t = Math.imul(t ^ (t >>> 15), t | 1)
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296
}

export function shuffle<T>(s: Pick<GameState, 'rng'>, arr: T[]): T[] {
  const a = arr.slice()
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(s) * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}
