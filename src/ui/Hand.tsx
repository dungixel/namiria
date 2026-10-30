import type { CSSProperties } from 'react'
import { cardImg } from '../assets'
import type { CardType, Picks } from '../engine'
import { CARD_H, CARD_W, handSlot } from './layout'

interface Props {
  side: 0 | 1
  cards: CardType[]
  picks?: Picks // only for your own hand
  spent: number[]
  fresh: number[]
  interactive: boolean
  onPick?: (i: number) => void
  onHover?: (c: CardType | null) => void
}

export function Hand({ side, cards, picks, spent, fresh, interactive, onPick, onHover }: Props) {
  return (
    <>
      {cards.map((type, i) => {
        const pos = handSlot(side, i)
        const base = { left: pos.x, top: pos.y, width: CARD_W, height: CARD_H } as CSSProperties
        if (spent.includes(i)) return <div key={i} className="slot-empty" style={base} />
        const order = picks ? picks.indexOf(i) : -1
        const tilt = ((i * 7) % 5) - 2 // a little hand-placed wobble
        const cls = ['card', side === 1 ? 'foe' : 'mine', interactive ? 'live' : '', order >= 0 ? 'picked' : '', fresh.includes(i) ? 'deal' : '']
        const style = { ...base, '--tilt': `${tilt * 0.6}deg`, '--deal-delay': `${fresh.indexOf(i) * 120}ms` } as CSSProperties
        if (side === 1) {
          // the opponent's hand is public too (only WHICH cards they picked is secret)
          return (
            <div
              key={`${i}-${fresh.includes(i)}`}
              className={cls.join(' ')}
              style={style}
              onMouseEnter={() => onHover?.(type)}
              onMouseLeave={() => onHover?.(null)}
            >
              <img src={cardImg(type)} alt="" draggable={false} />
            </div>
          )
        }
        return (
          <button
            key={`${i}-${fresh.includes(i)}`}
            className={cls.join(' ')}
            style={style}
            disabled={!interactive}
            onClick={() => onPick?.(i)}
            onMouseEnter={() => onHover?.(type)}
            onMouseLeave={() => onHover?.(null)}
            onFocus={() => onHover?.(type)}
            onBlur={() => onHover?.(null)}
            aria-label={`${type} card`}
          >
            <img src={cardImg(type)} alt="" draggable={false} />
            {order >= 0 && <span className="badge">{order + 1}</span>}
            <span className="hotkey">{i + 1}</span>
          </button>
        )
      })}
    </>
  )
}
