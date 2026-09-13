import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from './AuthContext'
import { useData } from './DataContext'
import { conversationsForUser, otherParticipant } from '@/lib/conversations'

const CLOSED_KEY = 'sg_closed_bubbles'

function readClosed(username?: string | null) {
  if (typeof window === 'undefined') return new Set<string>()
  try {
    const raw = window.localStorage.getItem(`${CLOSED_KEY}_${username || 'guest'}`)
    return new Set<string>(raw ? JSON.parse(raw) as string[] : [])
  } catch {
    return new Set<string>()
  }
}

function writeClosed(username: string | null | undefined, ids: Set<string>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(`${CLOSED_KEY}_${username || 'guest'}`, JSON.stringify([...ids]))
}

interface ChatBubbleContextValue {
  expandedId: string | null
  setExpandedId: (id: string | null) => void
  visibleConversations: ReturnType<typeof conversationsForUser>
  closeBubble: (conversationId: string) => void
  openBubble: (conversationId: string) => void
}

const ChatBubbleContext = createContext<ChatBubbleContextValue | null>(null)

export function ChatBubbleProvider({ children }: { children: ReactNode }) {
  const { session } = useAuth()
  const { data } = useData()
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [closedIds, setClosedIds] = useState<Set<string>>(() => readClosed(session?.username))
  const [lastMsgTick, setLastMsgTick] = useState(0)

  useEffect(() => {
    setClosedIds(readClosed(session?.username))
  }, [session?.username])

  useEffect(() => {
    if (!session || !data) return
    const latest = data.chatMessages[data.chatMessages.length - 1]
    if (!latest) return
    const conv = data.conversations.find(c => c.id === latest.conversationId)
    if (!conv || conv.status !== 'approved') return
    const other = otherParticipant(conv, session.username)
    if (latest.fromUsername === other) {
      setClosedIds(prev => {
        if (!prev.has(conv.id)) return prev
        const next = new Set(prev)
        next.delete(conv.id)
        writeClosed(session.username, next)
        return next
      })
      setExpandedId(conv.id)
    }
    setLastMsgTick(t => t + 1)
  }, [data?.chatMessages.length, session, data])

  const approved = useMemo(() => {
    if (!session || !data) return []
    return conversationsForUser(data.conversations, session.username).filter(c => c.status === 'approved')
  }, [data, session])

  const visibleConversations = useMemo(() => {
    void lastMsgTick
    return approved.filter(c => !closedIds.has(c.id))
  }, [approved, closedIds, lastMsgTick])

  const closeBubble = useCallback((conversationId: string) => {
    setClosedIds(prev => {
      const next = new Set(prev)
      next.add(conversationId)
      writeClosed(session?.username, next)
      return next
    })
    setExpandedId(id => (id === conversationId ? null : id))
  }, [session?.username])

  const openBubble = useCallback((conversationId: string) => {
    setClosedIds(prev => {
      if (!prev.has(conversationId)) return prev
      const next = new Set(prev)
      next.delete(conversationId)
      writeClosed(session?.username, next)
      return next
    })
    setExpandedId(conversationId)
  }, [session?.username])

  const value = useMemo(() => ({
    expandedId,
    setExpandedId,
    visibleConversations,
    closeBubble,
    openBubble,
  }), [expandedId, visibleConversations, closeBubble, openBubble])

  const fallback = useMemo(() => ({
    expandedId: null as string | null,
    setExpandedId: () => {},
    visibleConversations: [] as ReturnType<typeof conversationsForUser>,
    closeBubble: () => {},
    openBubble: () => {},
  }), [])

  return <ChatBubbleContext.Provider value={session ? value : fallback}>{children}</ChatBubbleContext.Provider>
}

export function useChatBubbles() {
  const ctx = useContext(ChatBubbleContext)
  if (!ctx) throw new Error('useChatBubbles must be used within ChatBubbleProvider')
  return ctx
}
