import { useEffect, useState } from 'react'
import { allImages } from '../assets'
import { GameFrame } from './GameFrame'
import { Menu } from './Menu'
import { Match } from './Match'
import { SketchDefs } from './SketchDefs'

export function App() {
  // later: 'lobby' | 'deck' | 'online' screens
  const [screen, setScreen] = useState<'menu' | 'match'>('menu')
  const [matchId, setMatchId] = useState(0)

  useEffect(() => {
    // warm the cache so poses / cards never pop in
    for (const src of allImages()) {
      const img = new Image()
      img.src = src
      void img.decode?.().catch(() => {})
    }
  }, [])

  return (
    <GameFrame>
      <SketchDefs />
      {screen === 'menu' ? (
        <Menu onPlay={() => { setMatchId((n) => n + 1); setScreen('match') }} />
      ) : (
        <Match key={matchId} onRestart={() => setMatchId((n) => n + 1)} onExit={() => setScreen('menu')} />
      )}
    </GameFrame>
  )
}
