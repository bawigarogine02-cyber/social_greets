import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { ChevronDown, ImagePlus, MoreVertical, Pin, Settings, UserPlus, X } from 'lucide-react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Dialog, DialogContent } from '@/components/ui/dialog'
import { UserAvatar } from '@/components/UserAvatar'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import {
  canSendMessages, conversationLabel, conversationsForUser, findConversation, isBlocked,
  isRecipient, lastMessagePreview, messagesForConversation, otherParticipant,
} from '@/lib/conversations'
import { addGroupMember, createGroup, deleteChatMessage, removeGroupMember, requestConversation, respondToConversation, sendChatMessage, undoDeleteChatMessage, updateConversationSettings, updateGroupProfile } from '@/lib/db'
import { oneAtATime } from '@/lib/guard'
import { uploadAvatar, uploadMessageImage } from '@/lib/avatar'
import { publicProfiles } from '@/lib/users'
import { formatDate } from '@/lib/utils'

const inFlightConversationRequests = new Set<string>()

export function InboxPage() {
  const { session } = useAuth()
  const { data, refresh } = useData()
  const [params, setParams] = useSearchParams()
  const [draft, setDraft] = useState('')
  const [busy, setBusy] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [groupTitle, setGroupTitle] = useState('')
  const [groupMembers, setGroupMembers] = useState<string[]>([])
  const [showScrollDown, setShowScrollDown] = useState(false)
  const [groupAvatarBusy, setGroupAvatarBusy] = useState(false)
  const [groupMembersOpen, setGroupMembersOpen] = useState(false)
  const [groupSettingsOpen, setGroupSettingsOpen] = useState(false)
  const [groupSettingsTitle, setGroupSettingsTitle] = useState('')
  const [privateSettingsOpen, setPrivateSettingsOpen] = useState(false)
  const [messageImageBusy, setMessageImageBusy] = useState(false)
  const [previewMedia, setPreviewMedia] = useState<{ url: string; type: 'image' | 'video' } | null>(null)
  const scrollRef = useRef<HTMLDivElement>(null)
  const groupAvatarRef = useRef<HTMLInputElement>(null)
  const messageImageRef = useRef<HTMLInputElement>(null)

  const withUser = params.get('with') || ''
  const groupId = params.get('group') || ''
  const selectedOther = withUser.trim().toLowerCase()

  useEffect(() => {
    if (!session || !selectedOther || selectedOther === session.username || groupId) return

    const requestKey = `${session.username}:${selectedOther}`
    if (inFlightConversationRequests.has(requestKey)) return
    inFlightConversationRequests.add(requestKey)

    requestConversation(session.username, selectedOther)
      .then(() => refresh(true))
      .catch(err => {
        toast.error(err instanceof Error ? err.message : 'Could not start conversation')
      })
      .finally(() => {
        inFlightConversationRequests.delete(requestKey)
      })
  }, [session, selectedOther, groupId, refresh])

  const active = useMemo(() => {
    if (!session || !data) return null
    if (groupId) return data.conversations.find(conversation => conversation.id === groupId) || null
    if (!selectedOther) return null
    return findConversation(data.conversations, session.username, selectedOther)
  }, [data, session, selectedOther, groupId])

  useEffect(() => {
    if (!session || !active) return
    try {
      const raw = localStorage.getItem(`sg_seen_chats_${session.username}`)
      const seen = raw ? JSON.parse(raw) as Record<string, number> : {}
      seen[active.id] = Date.now()
      localStorage.setItem(`sg_seen_chats_${session.username}`, JSON.stringify(seen))
    } catch {
      // Ignore storage issues for chat read markers.
    }
  }, [session, active])

  const myConversations = useMemo(() => {
    if (!session || !data) return []
    return conversationsForUser(data.conversations, session.username)
      .slice()
      .sort((a, b) => b.updatedAt - a.updatedAt)
  }, [data, session])

  const thread = useMemo(() => {
    if (!data || !active) return []
    return messagesForConversation(data.chatMessages, active.id)
  }, [data, active])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
    setShowScrollDown(false)
  }, [active?.id])

  useEffect(() => {
    const element = scrollRef.current
    if (!element) return
    const distanceFromBottom = element.scrollHeight - element.scrollTop - element.clientHeight
    if (distanceFromBottom < 80) {
      element.scrollTo({ top: element.scrollHeight, behavior: 'smooth' })
      setShowScrollDown(false)
    } else if (thread.length) {
      setShowScrollDown(true)
    }
  }, [thread.length])

  const updateScrollButton = () => {
    const element = scrollRef.current
    if (!element) return
    setShowScrollDown(element.scrollHeight - element.scrollTop - element.clientHeight >= 80)
  }

  const scrollToLatest = () => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    setShowScrollDown(false)
  }

  if (!session || !data) return null

  const people = publicProfiles(data.users).filter(u => u.username !== session.username)
  const otherName = active ? conversationLabel(active, data.users, session.username) : ''

  const openChat = (username: string) => {
    setParams({ with: username })
    setPickerOpen(false)
  }

  const openGroup = (id: string) => {
    setParams({ group: id })
    setPickerOpen(false)
  }

  const toggleGroupMember = (username: string) => {
    setGroupMembers(current => current.includes(username)
      ? current.filter(member => member !== username)
      : [...current, username])
  }

  const createNewGroup = async () => {
    if (!session) return
    setBusy(true)
    try {
      const group = await oneAtATime(() => createGroup(session.username, groupTitle, groupMembers))
      setGroupTitle('')
      setGroupMembers([])
      await refresh(true)
      openGroup(group.id)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not create group')
    } finally {
      setBusy(false)
    }
  }

  const respond = async (approved: boolean) => {
    if (!active) return
    setBusy(true)
    try {
      await oneAtATime(() => respondToConversation(session.username, otherParticipant(active, session.username), approved))
      toast.success(approved ? 'Conversation approved' : 'Conversation declined')
      await refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update conversation')
    } finally {
      setBusy(false)
    }
  }

  const send = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!active || !canSendMessages(active)) return
    setBusy(true)
    try {
      await oneAtATime(() => sendChatMessage(session.username, active.id, draft))
      setDraft('')
      void refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send message')
    } finally {
      setBusy(false)
    }
  }

  const sendImage = async (file?: File | null) => {
    if (!file || !active || !canSendMessages(active) || isBlocked(active, session.username)) return
    setMessageImageBusy(true)
    try {
      const media = await uploadMessageImage(file)
      await oneAtATime(() => sendChatMessage(session.username, active.id, '', media.url, media.mediaType))
      await refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not send image')
    } finally {
      setMessageImageBusy(false)
      if (messageImageRef.current) messageImageRef.current.value = ''
    }
  }

  const removeMessage = async (messageId: string, deleted: boolean) => {
    setBusy(true)
    try {
      if (deleted) {
        await oneAtATime(() => undoDeleteChatMessage(session.username, messageId))
        toast.success('Message restored')
      } else {
        await oneAtATime(() => deleteChatMessage(session.username, messageId))
        toast.success('Message deleted')
      }
      await refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update message')
    } finally {
      setBusy(false)
    }
  }

  const togglePin = async () => {
    if (!active) return
    await oneAtATime(() => updateConversationSettings(active.id, session.username, { pinned: !active.pinnedBy?.includes(session.username) }))
    await refresh(true)
    setPrivateSettingsOpen(false)
  }

  const toggleBlock = async () => {
    if (!active) return
    await oneAtATime(() => updateConversationSettings(active.id, session.username, { blocked: !active.blockedBy?.includes(session.username) }))
    await refresh(true)
    setPrivateSettingsOpen(false)
  }

  const changeGroupAvatar = async (file?: File | null) => {
    if (!file || !active || active.kind !== 'group') return
    setGroupAvatarBusy(true)
    try {
      const groupAvatarUrl = await uploadAvatar(file)
      await updateGroupProfile(active.id, session.username, { groupAvatarUrl })
      await refresh(true)
      toast.success('Group profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update group profile')
    } finally {
      setGroupAvatarBusy(false)
      if (groupAvatarRef.current) groupAvatarRef.current.value = ''
    }
  }

  const saveGroupSettings = async () => {
    if (!active || active.kind !== 'group') return
    setBusy(true)
    try {
      await oneAtATime(() => updateGroupProfile(active.id, session.username, { title: groupSettingsTitle }))
      await refresh(true)
      setGroupSettingsOpen(false)
      toast.success('Group settings updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update group settings')
    } finally {
      setBusy(false)
    }
  }

  const addMember = async (username: string) => {
    if (!active || active.kind !== 'group') return
    setBusy(true)
    try {
      await oneAtATime(() => addGroupMember(active.id, session.username, username))
      await refresh(true)
      toast.success('Member added')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not add member')
    } finally {
      setBusy(false)
    }
  }

  const kickMember = async (username: string) => {
    if (!active || active.kind !== 'group' || !window.confirm(`Remove @${username} from this group?`)) return
    setBusy(true)
    try {
      await oneAtATime(() => removeGroupMember(active.id, session.username, username))
      await refresh(true)
      toast.success('Member removed')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not remove member')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Messages</h1>
      <Card className="h-[min(720px,calc(100vh-180px))] min-h-130 overflow-hidden">
        <div className="flex h-full min-h-0 flex-col md:flex-row">
          <aside className="w-full border-b md:w-80 md:border-b-0 md:border-r">
            <div className="flex items-center justify-between border-b p-3">
              <strong className="text-sm">Chats</strong>
              <Button size="sm" variant="outline" onClick={() => setPickerOpen(v => !v)}>New</Button>
            </div>
            {pickerOpen && (
              <div className="max-h-72 overflow-auto border-b p-2">
                <p className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Direct message</p>
                {people.length ? people.map(u => (
                  <button key={u.id} type="button" onClick={() => openChat(u.username)} className="flex w-full rounded-md px-2 py-2 text-left text-sm hover:bg-accent">
                    {u.display || u.username}
                    <span className="ml-auto text-xs text-muted-foreground">@{u.username}</span>
                  </button>
                )) : <p className="p-2 text-sm text-muted-foreground">No users to message.</p>}
                <div className="mt-2 border-t pt-2">
                  <p className="px-2 pb-1 text-xs font-semibold uppercase text-muted-foreground">Create group</p>
                  <input value={groupTitle} onChange={event => setGroupTitle(event.target.value)} placeholder="Group name" className="mb-2 h-9 w-full rounded-md border bg-background px-2 text-sm" />
                  <div className="space-y-1">
                    {people.map(user => (
                      <label key={user.id} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-accent">
                        <input type="checkbox" checked={groupMembers.includes(user.username)} onChange={() => toggleGroupMember(user.username)} />
                        <span className="truncate">{user.display || user.username}</span>
                      </label>
                    ))}
                  </div>
                  <Button type="button" size="sm" className="mt-2 w-full" disabled={busy || !groupTitle.trim() || !groupMembers.length} onClick={createNewGroup}>Create group</Button>
                </div>
              </div>
            )}
            <div id="inboxList" className="max-h-105 overflow-auto">
              {myConversations.length ? myConversations.map(conv => {
                const other = otherParticipant(conv, session.username)
                const selected = conv.kind === 'group' ? conv.id === groupId : other === selectedOther
                const pending = conv.status === 'pending'
                const chatLabel = conversationLabel(conv, data.users, session.username)
                const chatProfile = conv.kind === 'group'
                  ? { avatarUrl: conv.groupAvatarUrl, name: chatLabel }
                  : (() => {
                      const user = data.users.find(profile => profile.username === other)
                      return { avatarUrl: user?.avatarUrl, name: user?.display || other }
                    })()
                return (
                  <button key={conv.id} type="button" onClick={() => conv.kind === 'group' ? openGroup(conv.id) : openChat(other)} className={`flex w-full items-center gap-3 border-b px-3 py-3 text-left transition hover:bg-accent ${selected ? 'bg-accent' : ''}`}>
                    <UserAvatar src={chatProfile.avatarUrl} name={chatProfile.name} size="sm" className="shrink-0" />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="truncate font-medium">{chatLabel}</span>
                        {pending && <span className="shrink-0 text-[10px] uppercase text-primary">{isRecipient(conv, session.username) ? 'Approve' : 'Pending'}</span>}
                        {conv.status === 'declined' && <span className="shrink-0 text-[10px] uppercase text-muted-foreground">Declined</span>}
                      </div>
                      <span className="block truncate text-xs text-muted-foreground">{lastMessagePreview(data.chatMessages, conv.id)}</span>
                    </div>
                  </button>
                )
              }) : <p className="p-4 text-sm text-muted-foreground">No conversations yet. Start one with New.</p>}
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            {!active ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center text-muted-foreground">
                <p>Select a chat or start a new conversation.</p>
                <Button asChild variant="outline" size="sm"><Link to="/users">Find people</Link></Button>
              </div>
            ) : (
              <>
                <div className="flex items-center gap-3 border-b px-4 py-3">
                  {active.kind === 'group' && <UserAvatar src={active.groupAvatarUrl} name={otherName} size="md" />}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-semibold">{otherName}</h2>
                    <p className="text-xs text-muted-foreground">{active.kind === 'group' ? `${active.members?.length || 0} members` : `@${otherParticipant(active, session.username)}`}</p>
                  </div>
                  {active.kind === 'group' && (
                    <div className="relative flex items-center gap-1">
                      <Button type="button" size="icon" variant="ghost" title="Add group member" aria-label="Add group member" disabled={busy} onClick={() => setGroupMembersOpen(value => !value)}>
                        <UserPlus className="h-4 w-4" />
                      </Button>
                      {active.requestedBy === session.username && (
                        <Button type="button" size="icon" variant="ghost" title="Group settings" aria-label="Group settings" onClick={() => { setGroupSettingsTitle(active.title || ''); setGroupSettingsOpen(value => !value); setGroupMembersOpen(false) }}>
                          <Settings className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  )}
                  {active.kind !== 'group' && (
                    <div className="relative">
                      <Button type="button" size="icon" variant="ghost" title="Conversation settings" aria-label="Conversation settings" onClick={() => setPrivateSettingsOpen(value => !value)}><MoreVertical className="h-4 w-4" /></Button>
                      {privateSettingsOpen && <div className="absolute right-0 top-10 z-20 w-44 rounded-md border bg-popover p-1 shadow-lg"><Button type="button" variant="ghost" className="w-full justify-start" onClick={togglePin}><Pin className="h-4 w-4" /> {active.pinnedBy?.includes(session.username) ? 'Unpin chat' : 'Pin chat'}</Button><Button type="button" variant="ghost" className="w-full justify-start" onClick={toggleBlock}><X className="h-4 w-4" /> {isBlocked(active, session.username) ? 'Unblock person' : 'Block person'}</Button></div>}
                    </div>
                  )}
                </div>

                {active.kind === 'group' && groupMembersOpen && (
                  <div className="border-b bg-muted/30 p-3">
                    <div className="mb-2 flex items-center justify-between">
                      <strong className="text-sm">Add member</strong>
                      <Button type="button" size="icon" variant="ghost" aria-label="Close add member panel" onClick={() => setGroupMembersOpen(false)}><X className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {people.filter(user => !active.members?.includes(user.username)).map(user => (
                        <Button key={user.id} type="button" size="sm" variant="outline" disabled={busy} onClick={() => addMember(user.username)}>
                          <UserPlus className="h-3.5 w-3.5" /> {user.display || user.username}
                        </Button>
                      ))}
                      {!people.some(user => !active.members?.includes(user.username)) && <span className="text-sm text-muted-foreground">Everyone is already in this group.</span>}
                    </div>
                  </div>
                )}

                {active.kind === 'group' && groupSettingsOpen && (
                  <div className="border-b bg-muted/30 p-3">
                    <div className="mb-3 flex items-center justify-between">
                      <strong className="text-sm">Group settings</strong>
                      <Button type="button" size="icon" variant="ghost" aria-label="Close group settings" onClick={() => setGroupSettingsOpen(false)}><X className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex flex-wrap items-end gap-3">
                      <label className="min-w-48 flex-1 text-sm font-medium">Group name
                        <input value={groupSettingsTitle} onChange={event => setGroupSettingsTitle(event.target.value)} maxLength={60} className="mt-1 h-9 w-full rounded-md border bg-background px-2 font-normal" />
                      </label>
                      <Button type="button" variant="outline" disabled={groupAvatarBusy} onClick={() => groupAvatarRef.current?.click()}>{groupAvatarBusy ? 'Saving...' : 'Change avatar'}</Button>
                      <Button type="button" disabled={busy} onClick={saveGroupSettings}>Save</Button>
                    </div>
                    <div className="mt-4 border-t pt-3">
                      <p className="mb-2 text-sm font-medium">Members</p>
                      <div className="space-y-2">
                        {active.members?.map(username => {
                          const member = data.users.find(user => user.username === username)
                          return <div key={username} className="flex items-center gap-2 text-sm"><UserAvatar src={member?.avatarUrl} name={member?.display || username} size="sm" /><span className="flex-1">{member?.display || username}{username === active.requestedBy && <span className="ml-2 text-xs text-primary">Admin</span>}</span>{username !== active.requestedBy && <Button type="button" size="sm" variant="destructive" disabled={busy} onClick={() => kickMember(username)}>Kick</Button>}</div>
                        })}
                      </div>
                    </div>
                    <input ref={groupAvatarRef} type="file" accept="image/*" className="hidden" onChange={event => changeGroupAvatar(event.target.files?.[0])} />
                  </div>
                )}

                {isRecipient(active, session.username) && (
                  <div className="border-b bg-primary/5 px-4 py-4">
                    <p className="text-sm"><strong>{otherName}</strong> wants to have a conversation with you. Do you want to proceed?</p>
                    <div className="mt-3 flex gap-2">
                      <Button size="sm" disabled={busy} onClick={() => respond(true)}>Yes, proceed</Button>
                      <Button size="sm" variant="outline" disabled={busy} onClick={() => respond(false)}>No thanks</Button>
                    </div>
                  </div>
                )}

                {active.status === 'pending' && active.requestedBy === session.username && (
                  <div className="border-b bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
                    Waiting for {otherName} to approve this conversation.
                  </div>
                )}

                {active.status === 'declined' && (
                  <div className="border-b bg-muted/40 px-4 py-4 text-sm text-muted-foreground">
                    This conversation was declined. Messaging is not available.
                  </div>
                )}

                <div ref={scrollRef} id="sentList" onScroll={updateScrollButton} className="relative min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {thread.length ? thread.map(m => {
                    const mine = m.fromUsername === session.username
                    const sender = data.users.find(user => user.username === m.fromUsername)
                    const senderName = sender?.display || m.fromUsername
                    const mediaType = m.mediaType === 'video' ? 'video' : 'image'
                    const deleted = m.status === 'deleted'
                    return (
                      <div key={m.id} className={`flex items-end gap-2 ${mine ? 'justify-end' : 'justify-start'}`}>
                        {!mine && <UserAvatar src={sender?.avatarUrl} name={senderName} size="sm" className="shrink-0" />}
                        <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${deleted ? 'border border-dashed bg-muted/60 text-muted-foreground' : mine ? 'bg-primary text-primary-foreground' : 'bg-muted'}`}>
                          {!deleted && m.imageUrl && (
                            <button type="button" className="block w-full overflow-hidden rounded-lg text-left" onClick={() => setPreviewMedia({ url: m.imageUrl!, type: mediaType })}>
                              {mediaType === 'video' ? (
                                <video src={m.imageUrl} controls className="mb-2 max-h-64 max-w-full rounded-lg" />
                              ) : (
                                <img src={m.imageUrl} alt="Sent image" className="mb-2 max-h-64 max-w-full rounded-lg object-contain" />
                              )}
                            </button>
                          )}
                          {deleted ? (
                            <div className="space-y-2">
                              <p>{mine ? 'You deleted this message.' : 'This message was removed.'}</p>
                              {mine && (
                                <Button type="button" size="sm" variant="secondary" className="h-7 px-2 text-xs" disabled={busy} onClick={() => removeMessage(m.id, true)}>
                                  Undo
                                </Button>
                              )}
                            </div>
                          ) : (
                            m.body && <p>{m.body}</p>
                          )}
                          <div className={`mt-2 flex items-center justify-between gap-2 text-[10px] ${mine ? 'text-primary-foreground/80' : 'text-muted-foreground'}`}>
                            <span>{formatDate(m.createdAt)}</span>
                            {!deleted && mine && (
                              <Button type="button" size="sm" variant="ghost" className="h-6 px-1.5 text-[10px] text-current" disabled={busy} onClick={() => removeMessage(m.id, false)}>
                                Delete
                              </Button>
                            )}
                          </div>
                        </div>
                        {mine && <UserAvatar src={sender?.avatarUrl || session.avatarUrl} name={senderName} size="sm" className="shrink-0" />}
                      </div>
                    )
                  }) : <p className="text-center text-sm text-muted-foreground">{canSendMessages(active) ? 'Say hello!' : 'Messages appear here after approval.'}</p>}
                  {showScrollDown && (
                    <Button
                      type="button"
                      size="icon"
                      variant="secondary"
                      title="Scroll to newest message"
                      aria-label="Scroll to newest message"
                      onClick={scrollToLatest}
                      className="sticky bottom-2 left-1/2 z-10 -ml-5 rounded-full border shadow-md"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  )}
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

                {canSendMessages(active) && (
                  <form onSubmit={send} className="flex gap-2 border-t p-3">
                    <Button type="button" size="icon" variant="outline" title="Send image or video" aria-label="Send image or video" disabled={busy || messageImageBusy || isBlocked(active, session.username)} onClick={() => messageImageRef.current?.click()}><ImagePlus className="h-4 w-4" /></Button>
                    <input ref={messageImageRef} type="file" accept="image/*,video/*" className="hidden" onChange={event => sendImage(event.target.files?.[0])} />
                    <Textarea value={draft} onChange={e => setDraft(e.target.value)} placeholder="Write a message…" rows={2} className="min-h-11 resize-none" />
                    <Button type="submit" disabled={busy || !draft.trim() || isBlocked(active, session.username)}>Send</Button>
                  </form>
                )}
              </>
            )}
          </main>
        </div>
      </Card>
    </div>
  )
}
