import { useEffect, useState, type ReactNode } from 'react'
import { H, W } from './layout'

/** Fixed 1500x1000 canvas, scaled to fit the window (letterboxed with the paper colour). */
export function GameFrame({ children }: { children: ReactNode }) {
  const [scale, setScale] = useState(1)
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H))
    fit()
    window.addEventListener('resize', fit)
    return () => window.removeEventListener('resize', fit)
  }, [])
  return (
    <div className="viewport">
      <div className="frame" style={{ width: W, height: H, transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  )
}
