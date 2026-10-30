import type { CSSProperties } from 'react'
import { BOARD_SIZE, type PlayerId } from '../engine'
import type { MatchView } from '../game/types'
import { FxLayer } from './FxLayer'
import { ARENA_X, GROUND_Y, TILE_W, WORLD_W, cameraFor } from './layout'
import { UnitSprite } from './UnitSprite'

export interface Preview { tiles: number[]; tone: 'attack' | 'step' | 'grab' }

interface Props {
  view: MatchView
  preview: Preview | null
  onTile: (t: number) => void
}

export function Scenery() {
  return (
    <svg className="scenery" width={WORLD_W} height={GROUND_Y + 14} viewBox={`0 0 ${WORLD_W} ${GROUND_Y + 14}`}>
      <g filter="url(#rough-soft)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* far mountains, like the sketch */}
        <path d="M-10,430 C60,330 150,230 215,178 C290,235 400,330 480,395 C505,365 520,345 548,325" stroke="var(--ink)" strokeOpacity=".17" strokeWidth="3" />
        <path d="M800,340 C900,260 1010,210 1085,172 C1180,260 1330,420 1420,582" stroke="var(--ink)" strokeOpacity=".17" strokeWidth="3" />
        <path d="M1235,300 C1300,260 1380,235 1440,215 C1470,260 1490,300 1520,330" stroke="var(--ink)" strokeOpacity=".12" strokeWidth="3" />
        <path d="M1560,450 C1650,350 1740,255 1810,205 C1890,275 1960,350 2040,430" stroke="var(--ink)" strokeOpacity=".15" strokeWidth="3" />
        <path d="M1660,300 C1730,262 1810,240 1880,225 C1920,265 1950,300 2000,335" stroke="var(--ink)" strokeOpacity=".1" strokeWidth="3" />
        {/* a few light rays from the top, as in the sketch */}
        {[[300, 150, 420, 205], [380, 140, 470, 180], [1080, 150, 990, 190], [1160, 140, 1060, 200], [1700, 150, 1610, 190], [1780, 140, 1680, 200]].map((l, i) => (
          <path key={i} d={`M${l[0]},${l[1]} L${l[2]},${l[3]}`} stroke="var(--ink)" strokeOpacity=".1" strokeWidth="2.5" />
        ))}
        {/* ground */}
        <path d={`M0,${GROUND_Y} C500,${GROUND_Y - 2} 1500,${GROUND_Y + 2} ${WORLD_W},${GROUND_Y}`} stroke="var(--ink)" strokeWidth="5" />
        {Array.from({ length: BOARD_SIZE + 1 }, (_, i) => {
          const x = ARENA_X + i * TILE_W
          return <path key={i} d={`M${x},${GROUND_Y} L${x + (i % 2 ? 1 : -1)},${GROUND_Y + 10}`} stroke="var(--ink)" strokeOpacity=".55" strokeWidth="3" />
        })}
      </g>
    </svg>
  )
}

export function Stage({ view, preview, onTile }: Props) {
  const { game, units, decision } = view
  const cam = cameraFor([units[0].tile, units[1].tile, ...(decision ? decision.options : [])]) // while choosing, frame the options too
  return (
    <div className="stage">
      <div className="world" style={{ transform: `translateX(${cam.tx}px) scale(${cam.z})` }}>
      <Scenery />

      {preview && preview.tiles.map((t) => (
        <div key={`p${t}`} className={`tile-hl preview ${preview.tone}`} style={tileStyle(t)} />
      ))}

      {decision && decision.options.map((t) => {
        const origin = decision.kind === 'step' ? game.players[0].tile : game.players[1].tile // where the mover / the thrown unit stands now
        const own = t === origin
        const label = own ? (decision.kind === 'step' ? 'stay' : 'drop') : decision.kind === 'step' ? `${t < origin ? '←' : '→'}${Math.abs(t - origin)}` : '◎'
        return (
          <button
            key={`d${t}`}
            className={`tile-hl decision ${decision.kind} ${own ? 'own' : ''}`}
            style={tileStyle(t)}
            onClick={() => onTile(t)}
            aria-label={`tile ${t}`}
          >
            <span>{label}</span>
          </button>
        )
      })}

      {([0, 1] as PlayerId[]).map((p) => (
        <UnitSprite
          key={p}
          player={p}
          unitId={game.players[p].team[game.players[p].active]}
          vis={units[p]}
          foeTile={units[p === 0 ? 1 : 0].tile}
          label={p === 0 ? 'YOU' : 'BOT'}
        />
      ))}

      <FxLayer fx={view.fx} popups={view.popups} />
      </div>
      {view.banner && <div key={view.banner} className="banner">{view.banner}</div>}
    </div>
  )
}

function tileStyle(t: number): CSSProperties {
  return { left: ARENA_X + (t - 1) * TILE_W + 5, width: TILE_W - 10, bottom: 1000 - GROUND_Y }
}
