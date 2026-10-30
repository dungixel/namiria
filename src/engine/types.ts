// Core types of the Namiria rules engine. Pure data, no React, no browser APIs,
// so the exact same code can later run in a Supabase Edge Function to referee online matches.

export type PlayerId = 0 | 1 // 0 = you (left side), 1 = opponent (right side)
export type Slot = 0 | 1 // each turn has two action slots
export type CardType = 'attack' | 'special' | 'step' | 'block' | 'grab' | 'change'
export type UnitId = 'umiro'

export const CARD_TYPES: readonly CardType[] = ['attack', 'special', 'step', 'block', 'grab', 'change']

export interface PlayerState {
  team: UnitId[] // the 3 preselected units
  active: number // index into team
  fallen: boolean[] // team[i] was thrown off the stage (a ring-out) and is out for the match
  tile: number // 1..BOARD_SIZE
  hp: number // shared by the whole team
  hand: CardType[] // 6 cards
  next: CardType // the "7th" card, visible like in Tetris
  bag: CardType[] // draw pile (shuffled bag)
}

export interface GameState {
  turn: number
  players: [PlayerState, PlayerState]
  rng: number // mulberry32 state; keeps the whole match reproducible from a seed
  winner: PlayerId | 'draw' | null
}

/** Indexes into the player's hand, in the order they will be played. null = no action. */
export type Picks = [number | null, number | null]

// ---------- what the resolver streams out ----------

export interface DecisionRequest {
  kind: 'step' | 'throw'
  player: PlayerId // who decides
  options: number[] // tiles that may be chosen
  default: number // used on timeout
}
/** chosen tile per deciding player */
export type Choices = Partial<Record<PlayerId, number>>

export type StrikeOutcome = 'hit' | 'blocked' | 'broken' | 'whiff' | 'heal'
export interface StrikeResult {
  player: PlayerId
  kind: 'attack' | 'special'
  targetTile: number | null // tile the attack landed on (attack only)
  outcome: StrikeOutcome
  damage: number // damage dealt to the opponent
  heal: number // hp actually restored to the actor
}

interface BeatBase {
  state: GameState // snapshot AFTER this beat
}
export type Beat =
  | (BeatBase & { type: 'slotStart'; slot: Slot; cards: [CardType | null, CardType | null] })
  | (BeatBase & { type: 'change'; slot: Slot; changes: { player: PlayerId; from: number; to: number }[] })
  | (BeatBase & {
      type: 'step'
      slot: Slot
      moves: { player: PlayerId; from: number; to: number; intended: number; bounced: boolean }[]
      clashTile: number | null
    })
  | (BeatBase & { type: 'guard'; slot: Slot; players: PlayerId[] })
  | (BeatBase & {
      type: 'grab'
      slot: Slot
      grabs: { player: PlayerId; hit: boolean; damage: number }[] // damage is applied on landing (see 'throw')
      clash: boolean
    })
  | (BeatBase & { type: 'throw'; slot: Slot; thrower: PlayerId; target: PlayerId; from: number; to: number; damage: number; ringOut: boolean })
  | (BeatBase & { type: 'respawn'; player: PlayerId; unit: number; tile: number }) // next unit drops in after a ring-out
  | (BeatBase & { type: 'strike'; slot: Slot; results: StrikeResult[] })
  | (BeatBase & { type: 'slotEnd'; slot: Slot })
  | (BeatBase & { type: 'refill'; refills: { player: PlayerId; indexes: number[] }[] })
  | (BeatBase & { type: 'gameOver'; winner: PlayerId | 'draw' })

export type DecisionYield = { type: 'decision'; requests: DecisionRequest[]; state: GameState }
export type ResolveYield = Beat | DecisionYield
