import { useEffect, useState } from 'react'
import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { addBannerComment, addBannerCommentReaction, addBannerReaction, addBannerReply, removeBannerComment } from '@/lib/db'
import { formatDate } from '@/lib/utils'
import { useData } from '@/contexts/DataContext'
import { useAuth } from '@/contexts/AuthContext'
import type { Banner, BannerComment, BannerCommentReply, Greeting } from '@/lib/types'

export function GreetingCard({ greeting }: { greeting: Greeting }) {
  const initial = String(greeting.from || '?').slice(0, 1).toUpperCase()
  const { data } = useData()
  const { session } = useAuth()
  const [comment, setComment] = useState('')
  const [replyDrafts, setReplyDrafts] = useState<Record<string, string>>({})
  const [replyingTo, setReplyingTo] = useState<string | null>(null)
  const [expandedReplies, setExpandedReplies] = useState<Record<string, boolean>>({})
  const authorName = session?.display || session?.username || 'Guest'
  const defaultBanner: Banner = {
    id: greeting.id,
    title: greeting.message,
    image: '/images/banner-default.svg',
    link: '/greet',
    reactions: [
      { emoji: '❤️', count: 1 },
      { emoji: '👏', count: 2 },
      { emoji: '🎉', count: 0 },
    ],
    comments: [],
  }

  const [banner, setBanner] = useState<Banner>(() => {
    const stored = data?.banners.find(item => item.id === greeting.id)
    return stored || defaultBanner
  })

  useEffect(() => {
    const stored = data?.banners.find(item => item.id === greeting.id)
    if (stored) setBanner(stored)
  }, [data, greeting.id])

  async function react(emoji: string) {
    try {
      const updated = await addBannerReaction(banner.id, emoji)
      setBanner(updated)
    } catch {
      // local-only fallback; keep UI usable
    }
  }

  async function commentBanner() {
    if (!comment.trim()) return
    try {
      const entry = await addBannerComment(banner.id, authorName, comment.trim())
      const nextComment = { id: entry.id, author: entry.author, body: entry.body, createdAt: entry.createdAt, replies: [] }
      setBanner(current => ({ ...current, comments: [nextComment, ...(current.comments || [])] }))
      setComment('')
    } catch {
      // local-only fallback
    }
  }

  function insertReplyAtTarget(replies: BannerCommentReply[] | undefined, targetId: string, reply: BannerCommentReply): BannerCommentReply[] {
    return (replies || []).map(item => {
      if (item.id === targetId) {
        return { ...item, replies: [...(item.replies || []), reply] }
      }
      if ((item.replies || []).length) {
        return { ...item, replies: insertReplyAtTarget(item.replies, targetId, reply) }
      }
      return item
    })
  }

  async function replyTo(commentId: string, targetReplyId?: string) {
    const draftKey = targetReplyId || commentId
    const body = (replyDrafts[draftKey] || '').trim()
    if (!body) return
    try {
      const replyEntry = await addBannerReply(banner.id, commentId, authorName, body, targetReplyId)
      const reply = { id: replyEntry.id, author: replyEntry.author, body: replyEntry.body, createdAt: replyEntry.createdAt, reactions: [], status: 'active' as const, replies: [] }
      setBanner(current => ({
        ...current,
        comments: (current.comments || []).map(c => {
          if (c.id !== commentId) return c
          if (targetReplyId) {
            return { ...c, replies: insertReplyAtTarget(c.replies, targetReplyId, reply) }
          }
          return { ...c, replies: [...(c.replies || []), reply] }
        }),
      }))
      setReplyDrafts({ ...replyDrafts, [draftKey]: '' })
      setReplyingTo(null)
      setExpandedReplies(current => ({ ...current, [targetReplyId || commentId]: true }))
    } catch {
      // local-only fallback
    }
  }

  function mergeReactedList(list: { emoji: string; count: number }[] | undefined, emoji: string) {
    const current = list || []
    const existing = current.find(item => item.emoji === emoji)
    const merged = existing
      ? current.map(item => item.emoji === emoji ? { ...item, count: item.count + 1 } : item)
      : [...current, { emoji, count: 1 }]
    return merged
  }

  function addReactionToReplyTree(replies: BannerCommentReply[] | undefined, targetId: string, emoji: string): BannerCommentReply[] {
    return (replies || []).map(reply => {
      if (reply.id === targetId) {
        return { ...reply, reactions: mergeReactedList(reply.reactions, emoji) }
      }
      if ((reply.replies || []).length) {
        return { ...reply, replies: addReactionToReplyTree(reply.replies, targetId, emoji) }
      }
      return reply
    })
  }

  async function reactToComment(commentId: string, emoji: string, replyId?: string) {
    try {
      await addBannerCommentReaction(banner.id, commentId, emoji, replyId)
      const stored = data?.banners.find(item => item.id === greeting.id)
      setBanner(stored || banner)
      setBanner(current => ({
        ...current,
        comments: (current.comments || []).map(comment => {
          if (comment.id !== commentId) return comment
          if (replyId) {
            return {
              ...comment,
              replies: addReactionToReplyTree(comment.replies, replyId, emoji),
            }
          }
          return { ...comment, reactions: mergeReactedList(comment.reactions, emoji) }
        }),
      }))
    } catch {
      // local-only fallback
    }
  }

  async function removeComment(commentId: string) {
    if (!session) return
    try {
      await removeBannerComment(banner.id, commentId, authorName)
      const stored = data?.banners.find(item => item.id === greeting.id)
      setBanner(stored || banner)
    } catch {
      // local-only fallback
    }
  }

  function renderReplies(items: BannerCommentReply[] | undefined, parentCommentId: string) {
    if (!items || !items.length) return null
    return (
      <div className="mt-2 space-y-2 border-l pl-3">
        {items.map((r: BannerCommentReply) => {
          const replyCount = (r.replies || []).filter(item => item.status !== 'removed').length
          const nested = r.status === 'removed'
          return (
            <div key={r.id} className="rounded-md bg-muted p-2">
              {nested ? (
                <p className="text-xs italic text-muted-foreground">This reply was removed by the user.</p>
              ) : (
                <>
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-[11px] font-semibold">{r.author}</span>
                    <span className="text-[10px] text-muted-foreground">{formatDate(r.createdAt)}</span>
                  </div>
                  <p className="mt-1 text-xs">{r.body}</p>
                  <div className="mt-2 flex flex-wrap gap-1">
                    {['❤️', '👍', '🎉'].map(emoji => (
                      <button key={`${r.id}-${emoji}`} type="button" className="rounded-full border px-2 py-0.5 text-[9px]" onClick={() => reactToComment(parentCommentId, emoji, r.id)}>
                        {emoji} {(r.reactions || []).find(item => item.emoji === emoji)?.count || 0}
                      </button>
                    ))}
                  </div>
                  <button type="button" className="mt-2 text-[10px] font-semibold text-primary" onClick={() => setReplyingTo(replyingTo === r.id ? null : r.id)}>Reply</button>
                  {replyingTo === r.id && (
                    <div className="mt-2 flex gap-2">
                      <input value={replyDrafts[r.id] || ''} onChange={e => setReplyDrafts({ ...replyDrafts, [r.id]: e.target.value })} className="flex-1 rounded-lg border px-2 py-1 text-xs" placeholder="Write a reply..." />
                      <button type="button" className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold" onClick={() => replyTo(parentCommentId, r.id)}>Send</button>
                    </div>
                  )}
                  {replyCount > 0 && (
                    <button type="button" className="mt-2 inline-flex items-center gap-2 text-[10px] font-semibold text-primary" onClick={() => setExpandedReplies(current => ({ ...current, [r.id]: !(current[r.id] ?? false) }))}>
                      {(expandedReplies[r.id] ?? false) ? 'Hide' : 'Show'} replies <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] text-primary">{replyCount}</span>
                    </button>
                  )}
                  {(expandedReplies[r.id] ?? false) && renderReplies(r.replies, parentCommentId)}
                </>
              )}
            </div>
          )
        })}
      </div>
    )
  }

  return (
    <Card className="overflow-hidden shadow-sm">
      <CardContent className="p-0">
        <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">{initial}</div>
            <div>
              <h4 className="font-semibold leading-tight">{greeting.from}</h4>
              <p className="text-xs text-muted-foreground">to {greeting.to} · {formatDate(greeting.createdAt)}</p>
            </div>
          </div>
          <Badge variant={greeting.type === 'private' ? 'private' : 'secondary'}>{greeting.type === 'private' ? 'Private' : 'Bannered'}</Badge>
        </div>
        <div className="px-4 py-4">
          <p className="text-[15px] leading-relaxed">{greeting.message}</p>
          {greeting.mediaUrl && (greeting.mediaType === 'video'
            ? <video src={greeting.mediaUrl} controls className="mt-3 max-h-[520px] w-full rounded-lg object-contain" />
            : <img src={greeting.mediaUrl} alt="Banner media" className="mt-3 max-h-[520px] w-full rounded-lg object-contain" />)}
        </div>
        <div className="flex items-center justify-between border-t px-4 py-2 text-xs text-muted-foreground">
          <span>{(banner.comments || []).length} {(banner.comments || []).length === 1 ? 'comment' : 'comments'}</span>
          <span>{(banner.reactions || []).reduce((total, item) => total + item.count, 0)} reactions</span>
        </div>
        <div className="flex flex-wrap gap-1 border-t px-3 py-2">
          {(banner.reactions || []).map(item => (
            <button key={item.emoji} type="button" className="flex-1 rounded-md px-2 py-2 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-foreground" onClick={() => react(item.emoji)}>
              <span>{item.emoji}</span><span className="ml-1">{item.count}</span>
            </button>
          ))}
        </div>
        <div className="border-t bg-muted/20 px-4 py-3">
          <div className="mb-2 text-sm font-semibold">Comments</div>
          <div className="flex gap-2">
            <input value={comment} onChange={e => setComment(e.target.value)} className="min-w-0 flex-1 rounded-full border bg-background px-4 py-2 text-sm" placeholder="Write a comment..." />
            <button type="button" className="rounded-full bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground" onClick={commentBanner}>Post</button>
          </div>
          {(banner.comments || []).map((c: BannerComment) => {
            const commentReactions = c.reactions || []
            const activeReplies = (c.replies || []).filter(r => r.status !== 'removed')
            const showReplies = expandedReplies[c.id] ?? false
            return (
              <div key={c.id} className="mt-3 rounded-lg bg-background p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-semibold">{c.author}</span>
                  <span className="text-[10px] text-muted-foreground">{formatDate(c.createdAt)}</span>
                </div>
                {c.status === 'removed' ? (
                  <p className="mt-2 text-sm italic text-muted-foreground">This comment was removed by the user.</p>
                ) : (
                  <>
                    <p className="mt-1 text-sm">{c.body}</p>
                    <div className="mt-2 flex flex-wrap gap-1">
                      {['❤️', '👍', '🎉'].map(emoji => (
                        <button key={emoji} type="button" className="rounded-full border px-2 py-1 text-[10px]" onClick={() => reactToComment(c.id, emoji)}>
                          {emoji} {commentReactions.find(item => item.emoji === emoji)?.count || 0}
                        </button>
                      ))}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <button type="button" className="text-[11px] font-semibold text-primary" onClick={() => setReplyingTo(replyingTo === c.id ? null : c.id)}>Reply</button>
                      {session && session.display === c.author && (
                        <button type="button" className="text-[11px] font-semibold text-destructive" onClick={() => removeComment(c.id)}>Remove</button>
                      )}
                    </div>
                  </>
                )}

                {replyingTo === c.id && c.status !== 'removed' && (
                  <div className="mt-2 flex gap-2">
                    <input value={replyDrafts[c.id] || ''} onChange={e => setReplyDrafts({ ...replyDrafts, [c.id]: e.target.value })} className="flex-1 rounded-lg border px-2 py-1 text-xs" placeholder="Write a reply..." />
                    <button type="button" className="rounded-lg bg-secondary px-2 py-1 text-xs font-semibold" onClick={() => replyTo(c.id)}>Send</button>
                  </div>
                )}

                {(activeReplies.length > 0 || c.status !== 'removed') && (
                  <button type="button" className="mt-2 inline-flex items-center gap-2 text-[11px] font-semibold text-primary" onClick={() => setExpandedReplies(current => ({ ...current, [c.id]: !showReplies }))}>
                    {showReplies ? 'Hide' : 'Show'} replies {activeReplies.length > 0 && <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary">{activeReplies.length}</span>}
                  </button>
                )}

                {showReplies && renderReplies(activeReplies, c.id)}
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
