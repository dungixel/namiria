import { useEffect } from 'react'
import { cardImg, sprite } from '../assets'
import { CARD_TYPES } from '../engine'
import { Scenery } from './Stage'

function Frog({ x, flip }: { x: number; flip?: boolean }) {
  const s = sprite('umiro', 'idle')
  return (
    <div className="menu-frog" style={{ left: x }}>
      <div className="shadow" />
      <div className="breath on">
        <img src={s.url} alt="Umiro" draggable={false} style={{ width: s.w, height: s.h, marginLeft: -s.w / 2, transform: `scaleX(${flip ? -1 : 1})` }} />
      </div>
    </div>
  )
}

export function Menu({ onPlay }: { onPlay: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') onPlay() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onPlay])
  return (
    <div className="menu">
      <div className="stage"><Scenery cliffs={false} /></div>
      <Frog x={395} flip />
      <Frog x={1105} />
      <h1 className="logo">Namiria</h1>
      <p className="tagline">a turn-based card duel</p>
      <button className="play" onClick={onPlay}>Play</button>
      <div className="menu-cards">
        {CARD_TYPES.map((c, i) => (
          <img key={c} src={cardImg(c)} alt="" draggable={false} style={{ transform: `rotate(${(i - 2.5) * 3.5}deg) translateY(${Math.abs(i - 2.5) * 6}px)` }} />
        ))}
      </div>
      <p className="menu-foot">Vs. bot · 20 HP each · 30 s per turn</p>
      <p className="menu-version">v{__APP_VERSION__} · built {__BUILD_TIME__}</p>
    </div>
  )
}
