import { useEffect, useRef } from 'react'
import { POSES, sprite } from '../assets'
import type { PlayerId } from '../engine'
import type { UnitVis } from '../game/types'
import { tileX } from './layout'

interface Props {
  player: PlayerId
  unitId: 'umiro'
  vis: UnitVis
  foeTile: number
  label: string
}

export function UnitSprite({ player, unitId, vis, foeTile, label }: Props) {
  // the art natively faces left; face the enemy
  const faceRight = vis.tile <= foeTile
  const body = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (vis.hurt === 0 || !body.current) return
    body.current.animate(
      [
        { transform: 'translateX(0)', filter: 'drop-shadow(0 0 0 rgba(178,58,46,0))' },
        { transform: 'translateX(-14px) rotate(-3deg)', filter: 'drop-shadow(0 0 14px rgba(200,50,40,0.95)) contrast(1.15)' },
        { transform: 'translateX(11px) rotate(2deg)', filter: 'drop-shadow(0 0 10px rgba(200,50,40,0.8))' },
        { transform: 'translateX(-7px)', filter: 'drop-shadow(0 0 5px rgba(200,50,40,0.4))' },
        { transform: 'translateX(0)', filter: 'drop-shadow(0 0 0 rgba(178,58,46,0))' },
      ],
      { duration: 420, easing: 'ease-out' },
    )
  }, [vis.hurt])

  useEffect(() => {
    if (vis.swap === 0 || !body.current) return
    body.current.animate(
      [{ opacity: 1, transform: 'scale(1)' }, { opacity: 0.1, transform: 'scale(0.82, 1.1)' }, { opacity: 1, transform: 'scale(1)' }],
      { duration: 650, easing: 'ease-in-out' },
    )
  }, [vis.swap])

  const acting = vis.pose !== 'idle'
  const rot = vis.ko ? (faceRight ? -82 : 82) : 0
  const idleH = sprite(unitId, 'idle').h

  return (
    <div
      className={`unit p${player} ${vis.ko ? 'ko' : ''}`}
      hidden={vis.gone}
      style={{
        transform: `translateX(${tileX(vis.tile)}px)`,
        transitionDuration: `${vis.moveMs}ms`,
        zIndex: acting ? 30 : 20,
      }}
    >
      <div className="shadow" />
      <div
        className="lift"
        style={{
          transform: `translateY(${-vis.lift}px)`,
          transitionDuration: `${vis.liftMs}ms`,
          transitionTimingFunction: vis.liftEase === 'out' ? 'cubic-bezier(.2,.7,.3,1)' : 'cubic-bezier(.7,0,.9,.4)',
        }}
      >
        <div className={`breath ${vis.pose === 'idle' && !vis.ko ? 'on' : ''}`}>
          <div ref={body} className="body" style={{ transform: rot ? `rotate(${rot}deg)` : undefined, transition: 'transform 600ms cubic-bezier(.3,1.4,.5,1), opacity 600ms', opacity: vis.ko ? 0.7 : 1 }}>
            <div className="flipper" style={{ transform: `scaleX(${faceRight ? -1 : 1})` }}>
              {POSES.map((pose) => {
                const s = sprite(unitId, pose)
                return (
                  <img
                    key={pose}
                    src={s.url}
                    alt=""
                    draggable={false}
                    className={pose === vis.pose ? 'on' : ''}
                    style={{ width: s.w, height: s.h, marginLeft: -s.w / 2 }}
                  />
                )
              })}
            </div>
          </div>
        </div>
      </div>
      {!vis.ko && (
        <div className="tag" style={{ bottom: idleH + 18 }}>
          <span>{label}</span>
        </div>
      )}
    </div>
  )
}

