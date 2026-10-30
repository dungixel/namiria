import { BOARD_SIZE, GRAB_RANGE, LEFT_VOID, RIGHT_VOID, START_TILES, THROW_RANGE, MAX_HP } from './constants'
import { dealHand } from './deck'
import { DEFAULT_TEAM, UNITS, type UnitDef } from './units'
import type { GameState, PlayerId, PlayerState, UnitId } from './types'

export const other = (p: PlayerId): PlayerId => (p === 0 ? 1 : 0)

export function activeUnit(s: GameState, p: PlayerId): UnitDef {
  const pl = s.players[p]
  return UNITS[pl.team[pl.active]]
}

const freshPlayer = (team: UnitId[], tile: number): PlayerState => ({
  team: team.slice(),
  active: 0,
  fallen: team.map(() => false),
  tile,
  hp: MAX_HP,
  hand: [],
  next: 'attack',
  bag: [],
})

export function createGame(seed: number, teams: [UnitId[], UnitId[]] = [DEFAULT_TEAM, DEFAULT_TEAM]): GameState {
  const s: GameState = {
    turn: 1,
    rng: seed >>> 0,
    winner: null,
    players: [freshPlayer(teams[0], START_TILES[0]), freshPlayer(teams[1], START_TILES[1])],
  }
  dealHand(s, s.players[0])
  dealHand(s, s.players[1])
  return s
}

/** Tiles a Step can end on: 1..speed tiles either way, never through/onto the enemy. Own tile = stay. */
export function stepOptions(tile: number, enemyTile: number, speed: number): number[] {
  const out = [tile]
  for (const dir of [-1, 1]) {
    for (let d = 1; d <= speed; d++) {
      const t = tile + dir * d
      if (t < 1 || t > BOARD_SIZE) break
      if (t === enemyTile) break // can't land on or walk past the enemy
      out.push(t)
    }
  }
  return out.sort((a, b) => a - b)
}

/**
 * Where a grabbed unit may be thrown: up to THROW_RANGE tiles from the grabber, on either side.
 * Reaching past the end of the stage is allowed: that is the void tile (LEFT_VOID / RIGHT_VOID), a ring-out.
 */
export function throwOptions(grabberTile: number): number[] {
  const out = new Set<number>()
  for (let d = -THROW_RANGE; d <= THROW_RANGE; d++) {
    if (d === 0) continue
    const t = grabberTile + d
    out.add(t < 1 ? LEFT_VOID : t > BOARD_SIZE ? RIGHT_VOID : t)
  }
  return [...out].sort((a, b) => a - b)
}

export const isVoid = (tile: number): boolean => tile < 1 || tile > BOARD_SIZE
export const unitsLeft = (pl: PlayerState): number => pl.fallen.filter((f) => !f).length

/** The next living unit after the active one (the active unit itself if it is the only one left). */
export function nextLivingUnit(pl: PlayerState): number {
  for (let i = 1; i <= pl.team.length; i++) {
    const idx = (pl.active + i) % pl.team.length
    if (!pl.fallen[idx]) return idx
  }
  return pl.active
}

/** Where a fresh unit drops in: its start tile, or one step toward its own edge if the enemy stands there. */
export function respawnTile(p: PlayerId, enemyTile: number): number {
  const start = START_TILES[p]
  return enemyTile === start ? start + (p === 0 ? -1 : 1) : start
}

/** Attacks go toward the enemy and reach exactly `range` tiles. */
export function attackTile(attackerTile: number, enemyTile: number, range: number): number {
  return attackerTile + Math.sign(enemyTile - attackerTile) * range
}

export const grabReaches = (a: number, b: number): boolean => Math.abs(a - b) === GRAB_RANGE
export const grabDamage = (u: UnitDef): number => Math.ceil(u.power / 2)
