import type { UnitId } from './types'

export interface UnitDef {
  id: UnitId
  name: string
  power: number // damage of Attack (Grab deals ceil(power / 2))
  range: number // Attack only reaches a tile EXACTLY this far away
  speed: number // Step moves 1..speed tiles, either direction
  special: { kind: 'heal'; amount: number; text: string }
  passive: { kind: 'noDoubleBlock'; text: string }
}

export const UNITS: Record<UnitId, UnitDef> = {
  umiro: {
    id: 'umiro',
    name: 'Umiro',
    power: 3,
    range: 2,
    speed: 2,
    special: { kind: 'heal', amount: 1, text: 'Heals 1 HP.' },
    passive: { kind: 'noDoubleBlock', text: "Can't be blocked twice: if a Block already stopped his attack this turn, a 2nd Block breaks." },
  },
}

export const DEFAULT_TEAM: UnitId[] = ['umiro', 'umiro', 'umiro']
