import type { CSSProperties } from 'react'
import { cardIcon, iconSize } from '../assets'
import type { Fx, Popup } from '../game/types'
import { GROUND_Y, tileX } from './layout'

function Star() {
  return (
    <svg viewBox="-50 -50 100 100" className="star">
      <polygon
        points="0,-46 9,-18 36,-32 22,-8 48,0 22,8 36,32 9,18 0,46 -9,18 -36,32 -22,8 -48,0 -22,-8 -36,-32 -9,-18"
        fill="var(--dmg)" fillOpacity=".78" stroke="var(--ink)" strokeWidth="3.5" strokeLinejoin="round"
      />
      <circle r="11" fill="var(--paper)" stroke="var(--ink)" strokeWidth="3" />
    </svg>
  )
}

function Puff() {
  return (
    <svg viewBox="-60 -30 120 40" className="puff">
      {[-34, 0, 34].map((x, i) => (
        <circle key={i} className={`puff-${i}`} cx={x} cy={-6} r={11} fill="none" stroke="var(--ink)" strokeWidth="3" />
      ))}
    </svg>
  )
}

function FxItem({ fx }: { fx: Fx }) {
  const x = tileX(fx.tile)
  const base = { left: x, bottom: 1000 - GROUND_Y + (fx.y ?? 0), animationDuration: `${fx.ms}ms` } as CSSProperties
  switch (fx.kind) {
    case 'fly': {
      const dx = tileX(fx.toTile!) - x
      const icon = fx.icon!
      const ratio = iconSize(icon).w / iconSize(icon).h
      return (
        <img
          src={cardIcon(icon)} alt="" className="fx fx-fly"
          style={{ ...base, height: fx.size, width: (fx.size ?? 100) * ratio, '--dx': `${dx}px`, '--rot': dx >= 0 ? '90deg' : '-90deg' } as CSSProperties}
        />
      )
    }
    case 'pop':
    case 'shake': {
      // a round paper "sticker" so the card art doesn't scribble over the sprites
      const s = fx.size ?? 80
      return (
        <div className={`fx fx-${fx.kind} sticker`} style={{ ...base, width: s, height: s }}>
          <img src={cardIcon(fx.icon!)} alt="" />
        </div>
      )
    }
    case 'sparkles': {
      const icon = fx.icon!
      const ratio = iconSize(icon).w / iconSize(icon).h
      const h = fx.size ?? 80
      return (
        <div className="fx fx-sparkles" style={{ ...base, width: h * ratio, height: h }}>
          <img src={cardIcon(icon)} alt="" />
          {[0, 1, 2, 3].map((i) => <b key={i} className={`plus plus-${i}`}>+</b>)}
        </div>
      )
    }
    case 'burst':
      return <div className="fx fx-burst" style={{ ...base, width: fx.size, height: fx.size }}><Star /></div>
    case 'dust':
      return <div className="fx fx-dust" style={base}><Puff /></div>
  }
}

export function FxLayer({ fx, popups }: { fx: Fx[]; popups: Popup[] }) {
  return (
    <>
      {fx.map((f) => <FxItem key={f.id} fx={f} />)}
      {popups.map((p) => (
        <div key={p.id} className={`popup ${p.tone}`} style={{ left: tileX(p.tile), bottom: 1000 - GROUND_Y + (p.y ?? 200) + 52 }}>
          {p.text}
        </div>
      ))}
    </>
  )
}
