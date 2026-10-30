import type { CSSProperties } from 'react'
import { BOARD_SIZE, isVoid, type PlayerId } from '../engine'
import type { MatchView } from '../game/types'
import { FxLayer } from './FxLayer'
import { ARENA_END, ARENA_X, GROUND_Y, TILE_W, WORLD_W, cameraFor } from './layout'
import { UnitSprite } from './UnitSprite'

export interface Preview { tiles: number[]; tone: 'attack' | 'step' | 'grab' }

interface Props {
  view: MatchView
  preview: Preview | null
  onTile: (t: number) => void
}

/** The backdrop. `cliffs` = the real arena, with a cliff edge on each side and the void beyond; false = a plain meadow for the menu. */
export function Scenery({ cliffs = true }: { cliffs?: boolean }) {
  const GY = GROUND_Y
  // a cliff face: a short rough wall under the lip of the ground, with a few strata strokes (kept short so it stays clear of the hand)
  const face = (x: number, dir: 1 | -1) => (
    <g key={x}>
      <path d={`M${x},${GY} C${x - dir * 5},${GY + 14} ${x + dir * 3},${GY + 28} ${x - dir * 6},${GY + 42}`} stroke="var(--ink)" strokeWidth="5" />
      {[12, 26].map((dy, k) => (
        <path key={k} d={`M${x - dir * 2},${GY + dy} l${dir * (26 - k * 6)},${-8}`} stroke="var(--ink)" strokeOpacity={0.3 - k * 0.1} strokeWidth="3" />
      ))}
    </g>
  )
  return (
    <svg className="scenery" width={WORLD_W} height={GY + 140} viewBox={`0 0 ${WORLD_W} ${GY + 140}`}>
      <defs>
        <pattern id="edge-hatch" width="14" height="14" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
          <path d="M0,0 L0,14" stroke="#b23a2e" strokeOpacity=".4" strokeWidth="4" />
        </pattern>
      </defs>
      <g filter="url(#rough-soft)" fill="none" strokeLinecap="round" strokeLinejoin="round">
        {/* far mountains, like the sketch */}
        <path d="M-10,430 C60,330 150,230 215,178 C290,235 400,330 480,395 C505,365 520,345 548,325" stroke="var(--ink)" strokeOpacity=".17" strokeWidth="3" />
        <path d="M800,340 C900,260 1010,210 1085,172 C1180,260 1330,420 1420,582" stroke="var(--ink)" strokeOpacity=".17" strokeWidth="3" />
        <path d="M1235,300 C1300,260 1380,235 1440,215 C1470,260 1490,300 1520,330" stroke="var(--ink)" strokeOpacity=".12" strokeWidth="3" />
        <path d="M1560,450 C1650,350 1740,255 1810,205 C1890,275 1960,350 2040,430" stroke="var(--ink)" strokeOpacity=".15" strokeWidth="3" />
        <path d="M1660,300 C1730,262 1810,240 1880,225 C1920,265 1950,300 2000,335" stroke="var(--ink)" strokeOpacity=".1" strokeWidth="3" />
        <path d="M2010,470 C2080,380 2150,300 2240,250" stroke="var(--ink)" strokeOpacity=".13" strokeWidth="3" />
        <path d="M-10,520 C40,470 90,430 140,410" stroke="var(--ink)" strokeOpacity=".12" strokeWidth="3" />
        {/* a few light rays from the top, as in the sketch */}
        {[[300, 150, 420, 205], [380, 140, 470, 180], [1080, 150, 990, 190], [1160, 140, 1060, 200], [1700, 150, 1610, 190], [1780, 140, 1680, 200]].map((l, i) => (
          <path key={i} d={`M${l[0]},${l[1]} L${l[2]},${l[3]}`} stroke="var(--ink)" strokeOpacity=".1" strokeWidth="2.5" />
        ))}
        {cliffs ? (
          <>
            {/* the stage: ground, a cliff edge at each end, and nothing beyond */}
            <path d={`M${ARENA_X},${GY} C${ARENA_X + 500},${GY - 2} ${ARENA_END - 500},${GY + 2} ${ARENA_END},${GY}`} stroke="var(--ink)" strokeWidth="5" />
            {face(ARENA_X, 1)}
            {face(ARENA_END, -1)}
            {/* the last half tile of each side is marked as the danger zone */}
            <rect x={ARENA_X + 6} y={GY - 26} width={TILE_W * 0.45} height={24} fill="url(#edge-hatch)" stroke="none" />
            <rect x={ARENA_END - 6 - TILE_W * 0.45} y={GY - 26} width={TILE_W * 0.45} height={24} fill="url(#edge-hatch)" stroke="none" />
            {Array.from({ length: BOARD_SIZE + 1 }, (_, i) => {
              const x = ARENA_X + i * TILE_W
              return <path key={i} d={`M${x},${GY} L${x + (i % 2 ? 1 : -1)},${GY + 10}`} stroke="var(--ink)" strokeOpacity=".55" strokeWidth="3" />
            })}
          </>
        ) : (
          <path d={`M0,${GY} C500,${GY - 2} 1500,${GY + 2} ${WORLD_W},${GY}`} stroke="var(--ink)" strokeWidth="5" />
        )}
      </g>
    </svg>
  )
}

export function Stage({ view, preview, onTile }: Props) {
  const { game, units, decision } = view
  const cam = cameraFor([units[0].tile, units[1].tile, ...(decision ? decision.options : [])]) // while choosing, frame the options too
  return (
    <div className="stage">
      <div className="world" style={{ width: WORLD_W, transform: `translateX(${cam.tx}px) scale(${cam.z})` }}>
      <Scenery />

      {preview && preview.tiles.map((t) => (
        <div key={`p${t}`} className={`tile-hl preview ${preview.tone}`} style={tileStyle(t)} />
      ))}

      {decision && decision.options.map((t) => {
        const origin = decision.kind === 'step' ? game.players[0].tile : game.players[1].tile // where the mover / the thrown unit stands now
        const own = t === origin
        const off = isVoid(t) // a throw over the cliff
        const label = off ? 'RING OUT' : own ? (decision.kind === 'step' ? 'stay' : 'drop') : decision.kind === 'step' ? `${t < origin ? '←' : '→'}${Math.abs(t - origin)}` : '◎'
        return (
          <button
            key={`d${t}`}
            className={`tile-hl decision ${decision.kind} ${own ? 'own' : ''} ${off ? 'void' : ''}`}
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
