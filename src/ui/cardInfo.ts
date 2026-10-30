import { GRAB_RANGE, THROW_RANGE, grabDamage, type CardType, type UnitDef } from '../engine'

export const CARD_NAMES: Record<CardType, string> = {
  attack: 'Attack', special: 'Special', step: 'Step', block: 'Block', grab: 'Grab', change: 'Change',
}

export function cardText(c: CardType, u: UnitDef): string {
  switch (c) {
    case 'attack': return `Hits the tile exactly ${u.range} away for ${u.power} damage. Nothing happens if the enemy isn't there.`
    case 'special': return `${u.name}: ${u.special.text}`
    case 'step': return `Move 1–${u.speed} tiles left or right. You choose the tile when it plays.`
    case 'block': return 'Stops any attack this action, even from behind. Does not stop specials.'
    case 'grab': return `Seize an enemy ${GRAB_RANGE} tile away: ${grabDamage(u)} damage, ignores Block. Then throw them up to ${THROW_RANGE} tiles.`
    case 'change': return 'Switch to the next unit of your team.'
  }
}
