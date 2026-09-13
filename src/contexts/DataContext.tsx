'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { loadData } from '@/lib/db'
import { mysqlConfigured } from '@/lib/mysql'
import type { AppData } from '@/lib/types'

interface DataContextValue {
  data: AppData | null
  loading: boolean
  error: string | null
  refresh: (force?: boolean) => Promise<AppData | null>
  mysqlReady: boolean
}

const DataContext = createContext<DataContextValue | null>(null)

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState<AppData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const lastRefreshRef = useRef(0)

  const refresh = useCallback(async (force = false) => {
    setLoading(true)
    try {
      const next = await loadData(force)
      setData(next)
      setError(null)
      return next
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Could not load database'
      setError(message)
      console.warn(err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void refresh(true)

    const onFocus = () => {
      const now = Date.now()
      if (now - lastRefreshRef.current > 15000) {
        lastRefreshRef.current = now
        void refresh(true)
      }
    }

    const socketUrl = `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}/_realtime`
    let socket: WebSocket | null = null

    try {
      socket = new WebSocket(socketUrl)
      socket.onmessage = (event) => {
        try {
          const payload = JSON.parse(event.data)
          if (payload?.type === 'refresh') {
            lastRefreshRef.current = Date.now()
            void refresh(true)
          }
        } catch {
          // Ignore malformed realtime payloads.
        }
      }
    } catch {
      // Ignore websocket startup failures; the app still works without it.
    }

    window.addEventListener('focus', onFocus)
    return () => {
      socket?.close()
      window.removeEventListener('focus', onFocus)
    }
  }, [refresh])

  const value = useMemo(() => ({
    data,
    loading,
    error,
    refresh,
    mysqlReady: mysqlConfigured,
  }), [data, loading, error, refresh])

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>
}

export function useData() {
  const ctx = useContext(DataContext)
  if (!ctx) throw new Error('useData must be used within DataProvider')
  return ctx
}
