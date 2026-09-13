'use client'

import { useEffect, useState } from 'react'
import { useTheme } from '@/contexts/ThemeContext'

type Particle = {
  id: number
  left: number
  duration: number
  delay: number
  opacity: number
  mark: string
  color: string
  size: number
}

export function ThemeFx() {
  const { theme } = useTheme()
  const [particles, setParticles] = useState<Particle[]>([])

  useEffect(() => {
    const count = theme === 'joyful' ? 18 : theme === 'snow' ? 46 : 28
    const marks = theme === 'snow' ? ['❄', '❅', '✦'] : theme === 'autumn' ? ['🍁', '🍂', '🍃'] : ['✦', '❤', '●']
    const colors = ['#ffd93d', '#ff6b9d', '#4ecdc4', '#4d96ff', '#fff']

    setParticles(
      Array.from({ length: count }, (_, i) => ({
        id: i,
        left: (i * 17.3) % 100,
        duration: 7 + ((i * 3.7) % 10),
        delay: -((i * 2.9) % 10),
        opacity: 0.45 + ((i * 11) % 50) / 100,
        mark: marks[i % marks.length],
        color: colors[i % colors.length],
        size: 6 + ((i * 7) % 8),
      }))
    )
  }, [theme])

  if (!particles.length) return null

  return (
    <div id="fx" className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      {particles.map(p => (
        <span
          key={p.id}
          className={`fx-particle ${theme === 'snow' ? 'snow-particle' : ''}`}
          style={{
            left: `${p.left}vw`,
            animationDuration: `${p.duration}s`,
            animationDelay: `${p.delay}s`,
            opacity: p.opacity,
            ...(theme === 'joyful'
              ? { background: p.color, width: p.size, height: p.size, borderRadius: '9999px' }
              : theme === 'snow'
                ? { color: '#f4fbff', fontSize: `${p.size + 10}px`, textShadow: '0 0 8px rgba(190, 230, 255, 0.95)' }
                : { fontSize: '16px' }),
          }}
        >
          {theme === 'joyful' ? '' : p.mark}
        </span>
      ))}
    </div>
  )
}
