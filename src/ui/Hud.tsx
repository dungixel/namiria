import { useState } from 'react'
import { MAX_HP, UNITS, THROW_RANGE, type PlayerState } from '../engine'
import type { Decision, Phase } from '../game/types'

const BAR = 'M8,10 L508,3 L536,74 L16,84 Z'
const TAB = 'M10,78 L236,73 L246,120 L16,126 Z'

interface BarProps {
  side: 0 | 1
  player: PlayerState
  label: string
}

export function HpBar({ side, player, label }: BarProps) {
  const [showInfo, setShowInfo] = useState(false)
  const unit = UNITS[player.team[player.active]]
  const pct = (Math.max(0, player.hp) / MAX_HP) * 100
  const mirror = side === 1 ? 'scaleX(-1)' : undefined
  return (
    <div className={`hp hp-${side}`} onMouseEnter={() => setShowInfo(true)} onMouseLeave={() => setShowInfo(false)}>
      <svg viewBox="0 0 548 132" className="hp-svg" style={{ transform: mirror }}>
        <g filter="url(#rough)"><path d={BAR} fill="var(--paper-2)" /></g>
      </svg>
      <div className="hp-fills" style={{ transform: mirror }}>
        <div className="hp-ghost" style={{ width: `${pct}%` }} />
        <div className="hp-fill" style={{ width: `${pct}%` }} />
      </div>
      <svg viewBox="0 0 548 132" className="hp-svg" style={{ transform: mirror }}>
        <g filter="url(#rough)" strokeLinejoin="round">
          <path d={BAR} fill="none" stroke="var(--ink)" strokeWidth="5" />
          <path d={TAB} fill="var(--paper)" stroke="var(--ink)" strokeWidth="4.5" />
        </g>
      </svg>
      <div className="hp-num"><b>{Math.max(0, player.hp)}</b><span>/{MAX_HP}</span></div>
      <div className="hp-tab">
        <span className="who">{label}</span>
        <span className="uname">{unit.name}</span>
        <span className="pips">
          {player.team.map((_, i) => <i key={i} className={player.fallen[i] ? 'lost' : i === player.active ? 'on' : ''} title={player.fallen[i] ? 'Fell off the stage' : undefined} />)}
        </span>
      </div>
      {showInfo && (
        <div className="unit-info">
          <h4>{unit.name}</h4>
          <ul>
            <li><b>Power</b> {unit.power}</li>
            <li><b>Range</b> {unit.range}</li>
            <li><b>Speed</b> {unit.speed}</li>
          </ul>
          <p><b>Special</b> {unit.special.text}</p>
          <p><b>Passive</b> {unit.passive.text}</p>
          <p className="muted">Grab: {Math.ceil(unit.power / 2)} dmg, throw up to {THROW_RANGE} tiles.</p>
        </div>
      )}
    </div>
  )
}

export function Timer({ phase, seconds, turn, decision }: { phase: Phase; seconds: number; turn: number; decision: Decision | null }) {
  const live = phase === 'planning' || decision != null
  const urgent = live && seconds <= 5
  return (
    <div className={`timer ${urgent ? 'urgent' : ''} ${live ? '' : 'idle'}`}>
      <div className="timer-num">{live ? seconds : '·'}</div>
      <div className="timer-sub">{decision ? (decision.kind === 'step' ? 'STEP!' : 'THROW!') : `TURN ${turn}`}</div>
    </div>
  )
}
