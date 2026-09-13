import { useEffect, useMemo, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { ImagePlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { Textarea } from '@/components/ui/textarea'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useChatBubbles } from '@/contexts/ChatBubbleContext'
import { useData } from '@/contexts/DataContext'
import { avatarForUser, uploadMessageImage } from '@/lib/avatar'
import { canSendMessages, displayName, messagesForConversation, otherParticipant } from '@/lib/conversations'
import { deleteChatMessage, sendChatMessage, undoDeleteChatMessage } from '@/lib/db'
import { oneAtATime } from '@/lib/guard'
import { formatDate } from '@/lib/utils'

const MAX_BUBBLES = 5

function ChatBubbleItem({ conversationId, expanded, onExpand, onClose }: {
  conversationId: string
  expanded: boolean
  onExpand: () => void
  onClose: () => void
}) {
  const { session } = useAuth()
  const { data, refresh } = useData()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [imageBusy, setImageBusy] = useState(false)
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)

  const conv = data?.conversations.find(c => c.id === conversationId)
  const other = conv && session ? otherParticipant(conv, session.username) : ''
  const thread = useMemo(() => data && conv ? messagesForConversation(data.chatMessages, conv.id) : [], [data, conv])

  const removeMessage = async (messageId: string, deleted: boolean) => {
    if (!session) return
    try {
      if (deleted) {
        await oneAtATime(() => undoDeleteChatMessage(session.username, messageId))
      } else {
        await oneAtATime(() => deleteChatMessage(session.username, messageId))
      }
      await refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update message')
    }
  }

  const avatar = conv?.kind === 'group'
    ? { url: conv.groupAvatarUrl || '', initial: (conv.title || 'Group').slice(0, 1).toUpperCase(), label: conv.title || 'Group conversation' }
    : data && other
      ? avatarForUser(data.users, other)
      : { url: '', initial: '?', label: other }

  useEffect(() => {
    if (!expanded) return
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [thread.length, expanded])

  if (!session || !data || !conv || !canSendMessages(conv)) return null

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!draft.trim()) return
    setBusy(true)
    try {
      await oneAtATime(() => sendChatMessage(session.username, conv.id, draft))
      setDraft('')
      void refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send message')
    } finally {
      setBusy(false)
    }
  }

  const sendImage = async (file?: File | null) => {
    if (!file) return
    setImageBusy(true)
    try {
      const media = await uploadMessageImage(file)
      await oneAtATime(() => sendChatMessage(session.username, conv.id, '', media.url, media.mediaType))
      await refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send image')
    } finally {
      setImageBusy(false)
      if (imageRef.current) imageRef.current.value = ''
    }
  }

  if (!expanded) {
    return (
      <div className="chat_bubble_min flex w-[240px] items-center gap-2 rounded-full border bg-card px-2 py-1.5 shadow-lg">
        <button type="button" onClick={onExpand} className="flex min-w-0 flex-1 items-center gap-2 text-left">
          <UserAvatar src={avatar.url} name={avatar.label} size="sm" />
          <span className="truncate text-sm font-medium">{displayName(data.users, other)}</span>
        </button>
        <button type="button" aria-label="Close chat" onClick={onClose} className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
    )
  }

  return (
    <div className="chat_bubble_expanded flex h-[360px] w-[min(320px,calc(100vw-32px))] flex-col overflow-hidden rounded-xl border bg-card shadow-xl">
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <UserAvatar src={avatar.url} name={avatar.label} size="sm" />
        <button type="button" onClick={onExpand} className="min-w-0 flex-1 text-left">
          <p className="truncate text-sm font-semibold">{displayName(data.users, other)}</p>
          <p className="truncate text-[10px] text-muted-foreground">
            {conv.kind === 'group' ? `${conv.members?.length || 0} members` : `@${other}`}
          </p>
        </button>
        <button type="button" aria-label="Close chat" onClick={onClose} className="rounded-full p-1 text-muted-foreground transition hover:bg-accent hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div ref={scrollRef} className="flex-1 space-y-2 overflow-auto p-3">
        {thread.length ? thread.map(m => {
          const mine = m.fromUsername === session.username
          const mediaType = m.mediaType === 'video' ? 'video' : 'image'
          const deleted = m.status === 'deleted'
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${deleted ? 'border border-dashed bg-muted/60 text-muted-foreground' : mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                {!deleted && m.imageUrl && (
                  <button type="button" className="block w-full overflow-hidden rounded-lg text-left" onClick={() => setPreviewMedia({ url: m.imageUrl!, type: mediaType })}>
                    {mediaType === 'video' ? (
                      <video src={m.imageUrl} controls className="mb-2 max-h-48 max-w-full rounded-lg object-contain" />
                    ) : (
                      <img src={m.imageUrl} alt="Sent image" className="mb-2 max-h-48 max-w-full rounded-lg object-contain" />
                    )}
                  </button>
                )}
                {deleted ? (
                  <div className="space-y-2">
                    <p>{mine ? 'You deleted this message.' : 'This message was removed.'}</p>
                    {mine && (
                      <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-[10px]" onClick={() => removeMessage(m.id, true)}>
                        Undo
                      </Button>
                    )}
                  </div>
                ) : (
                  m.body && <p>{m.body}</p>
                )}
                <div className={`mt-1 flex items-center justify-between gap-2 text-[10px] ${mine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                  <span>{formatDate(m.createdAt)}</span>
                  {!deleted && mine && (
                    <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-current" onClick={() => removeMessage(m.id, false)}>
                      Delete
                    </Button>
                  )}
                </div>
              </div>
            </div>
          )
        }) : <p className="text-center text-xs text-muted-foreground">Say hello!</p>}
      </div>
      <Dialog open={!!previewMedia} onOpenChange={open => { if (!open) setPreviewMedia(null) }}>
        <DialogContent className="max-h-[90vh] max-w-[90vw] overflow-hidden border-0 bg-black/90 p-2 text-white shadow-2xl">
          {previewMedia && (
            previewMedia.type === 'video' ? (
              <video src={previewMedia.url} controls autoPlay className="max-h-[80vh] max-w-[85vw] rounded-lg" />
            ) : (
              <img src={previewMedia.url} alt="Full-size media" className="max-h-[80vh] max-w-[85vw] rounded-lg object-contain" />
            )
          )}
        </DialogContent>
      </Dialog>
      <form onSubmit={send} className="flex gap-2 border-t p-2">
        <Button type="button" size="icon" variant="outline" title="Send image or video" aria-label="Send image or video" disabled={busy || imageBusy} onClick={() => imageRef.current?.click()}><ImagePlus className="h-4 w-4" /></Button>
        <input ref={imageRef} type="file" accept="image/*,video/*" className="hidden" onChange={event => sendImage(event.target.files?.[0])} />
        <Textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message…" rows={1} className="min-h-[36px] resize-none text-sm" />
        <Button type="submit" size="sm" disabled={busy || !draft.trim()}>Send</Button>
      </form>
    </div>
  )
}

export function ChatBubbleStack() {
  const { session } = useAuth()
  const { data } = useData()
  const { expandedId, setExpandedId, visibleConversations, closeBubble } = useChatBubbles()

  const stack = useMemo(() => {
    if (!session || !data) return []
    return visibleConversations
      .filter(c => c.status === 'approved' && data.chatMessages.some(m => m.conversationId === c.id))
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [visibleConversations, session, data])

  if (!session || !stack.length) return null

  const shown = stack.slice(0, MAX_BUBBLES)
  const hidden = stack.length - shown.length

  return (
    <div id="chatBubbleStack" className="chat_bubble_stack fixed bottom-20 right-3 z-50 flex flex-col-reverse items-end gap-2 md:bottom-6 md:right-6">
      {hidden > 0 && (
        <Button asChild variant="secondary" size="sm" className="rounded-full shadow-md">
          <Link to="/inbox">+{hidden} more in Inbox</Link>
        </Button>
      )}
      {shown.map(conv => (
        <ChatBubbleItem
          key={conv.id}
          conversationId={conv.id}
          expanded={expandedId === conv.id}
          onExpand={() => setExpandedId(expandedId === conv.id ? null : conv.id)}
          onClose={() => closeBubble(conv.id)}
        />
      ))}
    </div>
  )
}
