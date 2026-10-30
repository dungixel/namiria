import type { CardType, GameState, Picks, PlayerId } from '../engine'
import type { Pose } from '../assets'

/** Purely visual state of one unit on the stage (the rules state lives in GameState). */
export interface UnitVis {
  tile: number // can be fractional while lunging / bouncing
  pose: Pose
  lift: number // px above the ground
  liftMs: number
  liftEase: 'out' | 'in'
  moveMs: number
  hurt: number // bump to retrigger the hit-shake
  swap: number // bump on unit change
  guard: boolean
  ko: boolean
  gone: boolean // thrown off the stage: not drawn until the next unit drops in
  cheer: boolean
}

export type FxKind = 'fly' | 'pop' | 'burst' | 'dust' | 'sparkles' | 'shake'
export interface Fx {
  id: number
  kind: FxKind
  tile: number
  toTile?: number
  icon?: CardType
  ms: number
  y?: number // px above ground
  size?: number
}
export interface Popup {
  id: number
  tile: number
  text: string
  tone: 'dmg' | 'heal' | 'info' | 'block'
  y?: number
}

export interface CenterCard {
  type: CardType
  key: number
  fromIndex: number // which hand slot it flew in from
}

export interface Decision {
  kind: 'step' | 'throw'
  options: number[]
  secondsLeft: number
}

export type Phase = 'intro' | 'planning' | 'resolving' | 'over'

export interface MatchView {
  phase: Phase
  game: GameState // the state currently SHOWN (advances beat by beat while animating)
  timeLeft: number
  picks: Picks
  locked: boolean
  foeLocked: boolean
  spent: [number[], number[]] // hand slots whose card is already sitting in the middle
  fresh: [number[], number[]] // hand slots that were just dealt (for the deal-in animation)
  center: [CenterCard | null, CenterCard | null]
  units: [UnitVis, UnitVis]
  fx: Fx[]
  popups: Popup[]
  decision: Decision | null
  banner: string | null
  hint: string
  slot: 0 | 1 | null
  winner: PlayerId | 'draw' | null
}
