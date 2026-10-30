import manifest from './assets/manifest.json'
import type { CardType, UnitId } from './engine'

export type Pose = 'idle' | 'attack' | 'special' | 'step' | 'block' | 'grab'
export const POSES: readonly Pose[] = ['idle', 'attack', 'special', 'step', 'block', 'grab']

const spriteUrls = import.meta.glob('./assets/sprites/*/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const cardUrls = import.meta.glob('./assets/cards/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>
const iconUrls = import.meta.glob('./assets/icons/*.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>

/** design pixels per sprite pixel; every pose uses the same factor so poses keep their relative size */
export const SPRITE_K = 0.38

export function sprite(unit: UnitId, pose: Pose) {
  const url = spriteUrls[`./assets/sprites/${unit}/${pose}.webp`]
  const m = (manifest.sprites as Record<string, { w: number; h: number }>)[`${unit}/${pose}`]
  return { url, w: m.w * SPRITE_K, h: m.h * SPRITE_K }
}
export const cardImg = (c: CardType): string => cardUrls[`./assets/cards/${c}.webp`]
export const cardIcon = (c: CardType): string => iconUrls[`./assets/icons/${c}.webp`]
export const iconSize = (c: CardType) => (manifest.icons as Record<string, { w: number; h: number }>)[c]
export const FAVICON = 'favicon.png'

/** every image the game needs, for preloading */
export const allImages = (): string[] => [...Object.values(spriteUrls), ...Object.values(cardUrls), ...Object.values(iconUrls)]
