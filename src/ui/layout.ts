// The game is drawn on a fixed 1500x1000 canvas (same 3:2 ratio as the Game UI mockup)
// and scaled to fit the browser window.
import { BOARD_SIZE } from '../engine'

export const W = 1500
export const H = 1000
export const GROUND_Y = 582 // the line the units stand on

// The arena is wider than the screen (like a Smash stage); a camera follows the fighters.
export const ARENA_X = 60
export const TILE_W = 190
export const WORLD_W = ARENA_X * 2 + BOARD_SIZE * TILE_W // 2020
export const tileX = (tile: number): number => ARENA_X + (tile - 0.5) * TILE_W

const CAM_PAD = 240 // keep this much screen space around the two fighters
const Z_MIN = 0.75 // zoomed all the way out the whole stage fits
const Z_MAX = 1.15 // zoomed in when they are close together

/** Camera framing every tile in `tiles` (fighters, plus step/throw options while choosing; may be fractional): zoom + horizontal shift. */
export function cameraFor(tiles: number[]): { z: number; tx: number } {
  const xs = tiles.map(tileX)
  const lo = Math.min(...xs)
  const hi = Math.max(...xs)
  const span = Math.max(hi - lo, 1)
  const z = Math.min(Z_MAX, Math.max(Z_MIN, (W - 2 * CAM_PAD) / span))
  const half = W / (2 * z) // half of the visible world width
  const left = Math.min(Math.max((lo + hi) / 2 - half, 0), WORLD_W - 2 * half)
  return { z, tx: -z * left }
}

export const CARD_W = 118
export const CARD_H = 155
export const NEXT_W = 84
export const NEXT_H = 110
export const SLOT_W = 126
export const SLOT_H = 164

/** top-left of hand slot i (0..5) for each side; 3 columns x 2 rows */
export function handSlot(side: 0 | 1, i: number): { x: number; y: number } {
  const col = i % 3
  const row = Math.floor(i / 3)
  const baseX = side === 0 ? 180 : W - 180 - CARD_W
  const dir = side === 0 ? 1 : -1
  return { x: baseX + dir * col * (CARD_W + 14), y: 622 + row * (CARD_H + 14) }
}
export const nextSlot = (side: 0 | 1) => ({ x: side === 0 ? 58 : W - 58 - NEXT_W, y: 722 })

/** the dark placeholders in the middle where played cards land */
export const centerSlot = (side: 0 | 1) => ({ x: side === 0 ? 618 : 756, y: 718 })
