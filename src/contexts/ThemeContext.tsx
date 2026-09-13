'use client'

import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useData } from './DataContext'
import type { Theme } from '@/lib/types'

interface ThemeContextValue {
  theme: Theme
  look: string
  setTheme: (theme: Theme, look?: string) => void
}

const ThemeContext = createContext<ThemeContextValue | null>(null)

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { data } = useData()
  const [theme, setThemeState] = useState<Theme>(() => {
    if (typeof window === 'undefined') return 'joyful'
    return (window.localStorage.getItem('sg_theme') as Theme) || 'joyful'
  })
  const [look, setLook] = useState(() => {
    if (typeof window === 'undefined') return 'joyful'
    return window.localStorage.getItem('sg_look') || 'joyful'
  })

  useEffect(() => {
    if (typeof window === 'undefined') return
    if (data?.settings.theme) {
      const saved = window.localStorage.getItem('sg_theme') as Theme | null
      if (!saved) setThemeState(data.settings.theme)
    }
  }, [data?.settings.theme])

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.setAttribute('data-theme', theme)
    }
  }, [theme])

  const setTheme = (next: Theme, nextLook?: string) => {
    setThemeState(next)
    const picked = nextLook || next
    setLook(picked)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('sg_theme', next)
      window.localStorage.setItem('sg_look', picked)
    }
  }

  const value = useMemo(() => ({ theme, look, setTheme }), [theme, look])
  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider')
  return ctx
}
