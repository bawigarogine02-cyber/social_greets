'use client'

import { createContext, useContext, useMemo, useState, type ReactNode } from 'react'
import { getSession, logout as clearSession, isAdmin, setSession as persistSession } from '@/lib/auth'
import type { SessionUser } from '@/lib/types'

interface AuthContextValue {
  session: SessionUser | null
  setSession: (user: SessionUser | null) => void
  logout: () => void
  isAdmin: boolean
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSessionState] = useState<SessionUser | null>(() => getSession())
  const value = useMemo(() => ({
    session,
    setSession: (user: SessionUser | null) => {
      if (user) persistSession(user)
      else clearSession()
      setSessionState(user)
    },
    logout: () => { clearSession(); setSessionState(null) },
    isAdmin: isAdmin(session),
  }), [session])
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
