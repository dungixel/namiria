import type { CSSProperties } from 'react'
import { cardIcon, cardImg } from '../assets'
import type { CardType } from '../engine'
import { CARD_H, CARD_W, SLOT_H, SLOT_W, handSlot, nextSlot, centerSlot } from './layout'

export function CardBack({ small }: { small?: boolean }) {
  return (
    <div className={`card-back ${small ? 'small' : ''}`}>
      <img src={cardIcon('special')} alt="" draggable={false} />
    </div>
  )
}

/** A card lying in the dark placeholder in the middle. */
export function PlayedCard({ side, type, fromIndex }: { side: 0 | 1; type: CardType; fromIndex: number }) {
  const slot = centerSlot(side)
  const from = handSlot(side, fromIndex)
  const dx = from.x + CARD_W / 2 - (slot.x + SLOT_W / 2)
  const dy = from.y + CARD_H / 2 - (slot.y + SLOT_H / 2)
  const style = { left: slot.x, top: slot.y, width: SLOT_W, height: SLOT_H, '--fx': `${dx}px`, '--fy': `${dy}px` } as CSSProperties
  return (
    <div className={`played ${side === 1 ? 'foe' : 'mine'}`} style={style}>
      <div className="played-inner">
        <div className="flip">
          <div className="side back"><CardBack /></div>
          <div className="side front"><img src={cardImg(type)} alt={type} draggable={false} /></div>
        </div>
      </div>
    </div>
  )
}

export function CenterPlaceholders() {
  return (
    <>
      {[0, 1].map((s) => {
        const p = centerSlot(s as 0 | 1)
        return <div key={s} className="placeholder" style={{ left: p.x, top: p.y, width: SLOT_W, height: SLOT_H }} />
      })}
    </>
  )
}

export function NextCard({ side, type, hidden, turn }: { side: 0 | 1; type: CardType; hidden: boolean; turn: number }) {
  const p = nextSlot(side)
  return (
    <div className="next" style={{ left: p.x, top: p.y }}>
      <div key={`${turn}-${type}`} className="next-card">
        {hidden ? <CardBack small /> : <img src={cardImg(type)} alt={`next: ${type}`} draggable={false} />}
      </div>
      <span className="next-label">NEXT</span>
    </div>
  )
}
