import { useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { MatchController } from '../game/MatchController'
import { UNITS, activeUnit, attackTile, stepOptions, BOARD_SIZE, type CardType } from '../engine'
import { CARD_NAMES, cardText } from './cardInfo'
import { CenterPlaceholders, NextCard, PlayedCard } from './CardViews'
import { Hand } from './Hand'
import { HpBar, Timer } from './Hud'
import { Stage, type Preview } from './Stage'

export function Match({ onRestart, onExit }: { onRestart: () => void; onExit: () => void }) {
  // created inside an effect so React StrictMode's mount/unmount/mount never reuses a disposed controller
  const [ctl, setCtl] = useState<MatchController | null>(null)
  useEffect(() => {
    const c = new MatchController()
    if (import.meta.env.DEV) (window as unknown as { __match?: MatchController }).__match = c
    setCtl(c)
    c.start()
    return () => c.dispose()
  }, [])
  if (!ctl) return null
  return <MatchScreen ctl={ctl} onRestart={onRestart} onExit={onExit} />
}

function MatchScreen({ ctl, onRestart, onExit }: { ctl: MatchController; onRestart: () => void; onExit: () => void }) {
  const view = useSyncExternalStore(ctl.subscribe, ctl.getView)
  const [hoverMine, setHoverMine] = useState<CardType | null>(null)
  const [hoverFoe, setHoverFoe] = useState<CardType | null>(null)
  const hover = hoverMine
  const { game } = view
  const me = game.players[0]
  const foe = game.players[1]
  const canPick = view.phase === 'planning' && !view.locked

  // keyboard: 1-6 pick the cards
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const n = Number(e.key)
      if (n >= 1 && n <= 6) ctl.selectCard(n - 1)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [ctl])

  const preview: Preview | null = useMemo(() => {
    if (!hover || !canPick) return null
    const u = activeUnit(game, 0)
    const foeTile = game.players[1].tile
    const myTile = game.players[0].tile
    if (hover === 'attack') {
      const t = attackTile(myTile, foeTile, u.range)
      return t >= 1 && t <= BOARD_SIZE ? { tiles: [t], tone: 'attack' } : null
    }
    if (hover === 'step') return { tiles: stepOptions(myTile, foeTile, u.speed).filter((t) => t !== myTile), tone: 'step' }
    if (hover === 'grab') return { tiles: [myTile + Math.sign(foeTile - myTile)], tone: 'grab' }
    return null
  }, [hover, canPick, game])

  const unit = UNITS[me.team[me.active]]
  const foeUnit = UNITS[foe.team[foe.active]]
  const status = view.phase === 'over' ? { title: '', text: view.hint }
    : hoverMine ? { title: CARD_NAMES[hoverMine], text: cardText(hoverMine, unit) }
    : hoverFoe ? { title: `Bot: ${CARD_NAMES[hoverFoe]}`, text: cardText(hoverFoe, foeUnit) }
    : { title: '', text: view.hint }

  return (
    <div className="match">
      <Stage view={view} preview={preview} onTile={(t) => ctl.chooseTile(t)} />

      <HpBar side={0} player={me} label="YOU" />
      <HpBar side={1} player={foe} label="BOT" />
      <Timer phase={view.phase} seconds={view.timeLeft} turn={game.turn} decision={view.decision} />

      <div className={`status ${view.decision ? 'alert' : ''}`}>
        {status.title && <h3>{status.title}</h3>}
        <p>{status.text}</p>
        {view.phase === 'planning' && !hoverMine && !hoverFoe && (
          <small>{view.foeLocked ? 'Opponent is ready' : 'Opponent is thinking…'}</small>
        )}
      </div>

      <CenterPlaceholders />
      <Hand
        side={0}
        cards={me.hand}
        picks={view.picks}
        spent={view.spent[0]}
        fresh={view.fresh[0]}
        interactive={canPick}
        onPick={(i) => ctl.selectCard(i)}
        onHover={setHoverMine}
      />
      <Hand side={1} cards={foe.hand} spent={view.spent[1]} fresh={view.fresh[1]} interactive={false} onHover={setHoverFoe} />
      <NextCard side={0} type={me.next} hidden={false} turn={game.turn} />
      <NextCard side={1} type={foe.next} hidden={false} turn={game.turn} />
      {view.center.map((c, side) => c && <PlayedCard key={c.key} side={side as 0 | 1} type={c.type} fromIndex={c.fromIndex} />)}

      {view.phase === 'over' && (
        <div className="over">
          <div className="over-card">
            <h2>{view.winner === 'draw' ? 'Draw' : view.winner === 0 ? 'Victory!' : 'Defeat'}</h2>
            <p>{view.winner === 'draw' ? 'Both Umiros went down together.' : view.winner === 0 ? 'The bot has been outplayed.' : 'The bot got you this time.'}</p>
            <div className="over-btns">
              <button className="btn" onClick={onRestart}>Play again</button>
              <button className="btn ghost" onClick={onExit}>Menu</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
