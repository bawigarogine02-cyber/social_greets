import { mysql, mysqlConfigured } from './mysql'
import { hashPassword } from './hash'
import { receiverWantedConversation } from './users'
import { findConversation, pairUsers } from './conversations'
import { messageOk } from './guard'
import type {
  AppData, Banner, BannerComment, BannerCommentReply, BannerReaction, ChatMessage, Conversation, Friend, Greeting, Notification, Profile, SiteSettings, Theme, UserBanStatus,
} from './types'

const LOCAL_KEY = 'sg_db'
const LOCAL_PASSWORD_REQUESTS_KEY = 'sg_password_requests'

function emptySettings(): SiteSettings {
  return {
    theme: 'joyful',
    celebration: { enabled: false, title: '', message: '', date: '' },
  }
}

function empty(): AppData {
  return {
    users: [],
    greetings: [],
    banners: [],
    friends: [],
    conversations: [],
    chatMessages: [],
    notifications: [],
    settings: emptySettings(),
  }
}

function mapProfile(row: Record<string, unknown>): Profile {
  const banStatus = String(row.ban_status || row.banStatus || 'active')
  const status = banStatus === 'temporary' || banStatus === 'permanent' ? banStatus : 'active'
  const banUntil = row.ban_until != null ? Number(row.ban_until) : row.banUntil != null ? Number(row.banUntil) : null
  return {
    id: String(row.id),
    username: String(row.username),
    display: String(row.display),
    avatarUrl: row.avatar_url ? String(row.avatar_url) : undefined,
    passwordHash: row.password_hash ? String(row.password_hash) : undefined,
    role: row.role === 'admin' ? 'admin' : 'user',
    createdAt: new Date(String(row.created_at || Date.now())).getTime(),
    banStatus: status,
    banReason: row.ban_reason ? String(row.ban_reason) : row.banReason ? String(row.banReason) : undefined,
    banUntil: status === 'temporary' && Number.isFinite(banUntil) ? banUntil : null,
  }
}

function profileFromRow(row: Record<string, unknown> | null | undefined): Profile | undefined {
  if (!row || !row.username || row.id == null) return undefined
  return mapProfile(row)
}

function mapGreeting(row: Record<string, unknown>): Greeting {
  return {
    id: String(row.id),
    from: String(row.from_name),
    to: String(row.to_username),
    message: String(row.message),
    type: row.type === 'private' ? 'private' : 'banner',
    fromId: row.from_id ? String(row.from_id) : undefined,
    mediaUrl: row.media_url ? String(row.media_url) : undefined,
    mediaType: row.media_type === 'video' ? 'video' : row.media_url ? 'image' : undefined,
    createdAt: new Date(String(row.created_at)).getTime(),
  }
}

function mapBanner(row: Record<string, unknown>): Banner {
  const mapReactionList = (value: unknown): BannerReaction[] => Array.isArray(value)
    ? (value as Record<string, unknown>[]).map(item => ({ emoji: String(item.emoji || '✨'), count: Number(item.count || 0) }))
    : []

  const mapReply = (item: Record<string, unknown>): BannerCommentReply => ({
    id: String(item.id || crypto.randomUUID()),
    author: String(item.author || 'Guest'),
    body: String(item.body || ''),
    createdAt: Number(item.createdAt || Date.now()),
    reactions: mapReactionList(item.reactions),
    status: item.status === 'removed' ? 'removed' : 'active',
    removedAt: item.removedAt ? Number(item.removedAt) : undefined,
    replies: Array.isArray(item.replies)
      ? (item.replies as Record<string, unknown>[]).map(mapReply)
      : [],
  })

  return {
    id: String(row.id),
    title: String(row.title),
    image: String(row.image),
    link: String(row.link || '/greet'),
    reactions: mapReactionList(row.reactions).length ? mapReactionList(row.reactions) : [
      { emoji: '❤️', count: 1 },
      { emoji: '👏', count: 1 },
      { emoji: '🎉', count: 0 },
    ],
    comments: Array.isArray(row.comments)
      ? (row.comments as Record<string, unknown>[]).map(item => ({
          id: String(item.id || crypto.randomUUID()),
          author: String(item.author || 'Guest'),
          body: String(item.body || ''),
          createdAt: Number(item.createdAt || Date.now()),
          reactions: mapReactionList(item.reactions),
          status: item.status === 'removed' ? 'removed' : 'active',
          removedAt: item.removedAt ? Number(item.removedAt) : undefined,
          replies: Array.isArray(item.replies)
            ? (item.replies as Record<string, unknown>[]).map(mapReply)
            : [],
        }))
      : [
        { id: 'first-comment', author: 'Team', body: 'Welcome to Social Greetings!', createdAt: Date.now(), reactions: [], status: 'active', replies: [] },
      ],
  }
}

function mapFriend(row: Record<string, unknown>): Friend {
  return {
    id: String(row.id),
    from: String(row.from_username),
    to: String(row.to_username),
    status: row.status === 'accepted' ? 'accepted' : 'pending',
    createdAt: new Date(String(row.created_at)).getTime(),
  }
}

function mapConversation(row: Record<string, unknown>): Conversation {
  const members = Array.isArray(row.member_usernames)
    ? row.member_usernames.map(String)
    : undefined
  return {
    id: String(row.id),
    userA: String(row.user_a),
    userB: String(row.user_b),
    requestedBy: String(row.requested_by),
    status: row.status === 'approved' ? 'approved' : row.status === 'declined' ? 'declined' : 'pending',
    kind: row.kind === 'group' ? 'group' : 'direct',
    title: row.group_name ? String(row.group_name) : undefined,
    groupAvatarUrl: row.group_avatar_url ? String(row.group_avatar_url) : undefined,
    pinnedBy: Array.isArray(row.pinned_by) ? row.pinned_by.map(String) : undefined,
    blockedBy: Array.isArray(row.blocked_by) ? row.blocked_by.map(String) : undefined,
    members,
    createdAt: new Date(String(row.created_at)).getTime(),
    updatedAt: new Date(String(row.updated_at)).getTime(),
  }
}

function mapChatMessage(row: Record<string, unknown>): ChatMessage {
  const status = row.status === 'deleted' ? 'deleted' : 'sent'
  return {
    id: String(row.id),
    conversationId: String(row.conversation_id),
    fromUsername: String(row.from_username),
    body: String(row.body),
    imageUrl: row.image_url ? String(row.image_url) : undefined,
    mediaType: row.media_type === 'video' ? 'video' : row.image_url ? 'image' : undefined,
    status,
    deletedAt: row.deleted_at ? new Date(String(row.deleted_at)).getTime() : undefined,
    createdAt: new Date(String(row.created_at)).getTime(),
  }
}

function mapNotification(row: Record<string, unknown>): Notification {
  const kind = String(row.kind)
  return {
    id: String(row.id),
    kind: kind === 'event' ? 'event' : kind === 'friend' ? 'friend' : kind === 'message' ? 'message' : 'change',
    title: String(row.title),
    message: String(row.message),
    toUsername: row.to_username ? String(row.to_username) : null,
    actionUrl: row.action_url ? String(row.action_url) : undefined,
    createdAt: new Date(String(row.created_at)).getTime(),
  }
}

function mapSettings(row: Record<string, unknown> | null): SiteSettings {
  if (!row) return emptySettings()
  const title = String(row.celebration_title || '')
  return {
    theme: (['joyful', 'snow', 'autumn'].includes(String(row.theme)) ? row.theme : 'joyful') as Theme,
    celebration: {
      enabled: !!title,
      title,
      message: String(row.celebration_message || ''),
      date: String(row.celebration_date || ''),
    },
  }
}

async function seedLocal(): Promise<AppData> {
  const { hashPassword } = await import('./hash')
  const now = Date.now()
  return {
    users: [
      { id: 'u-admin', username: 'riogen02', display: 'Admin', passwordHash: await hashPassword('roginemy@123'), role: 'admin', createdAt: now, banStatus: 'active' },
      { id: 'u-demo', username: 'demo', display: 'Demo Friend', passwordHash: await hashPassword('demo123'), role: 'user', createdAt: now, banStatus: 'active' },
    ],
    greetings: [
      { id: 'g1', from: 'Team', to: 'Everyone', message: 'Welcome to Social Greetings! Send a smile today.', type: 'banner', createdAt: now - 86400000 },
    ],
    banners: [{ id: 'b1', title: 'Share a joyful greeting', image: '/images/banner-default.svg', link: '/greet' }],
    friends: [],
    conversations: [],
    chatMessages: [],
    notifications: [{ id: 'n1', kind: 'change', title: 'Site is live', message: 'Social Greetings is ready. Be kind and have fun!', createdAt: now }],
    settings: emptySettings(),
  }
}

function readLocal(): AppData {
  try {
    const raw = localStorage.getItem(LOCAL_KEY)
    if (!raw) return empty()
    const parsed = JSON.parse(raw) as AppData
    return { ...empty(), ...parsed, settings: { ...emptySettings(), ...parsed.settings } }
  } catch {
    return empty()
  }
}

function writeLocal(data: AppData) {
  localStorage.setItem(LOCAL_KEY, JSON.stringify(data))
}

type PasswordRequestRow = { id: string; username: string; status: 'pending' | 'approved' | 'denied' | 'used'; createdAt: number; approvedAt?: number; expiresAt?: number }

function localPasswordRequests(): PasswordRequestRow[] {
  try { return JSON.parse(localStorage.getItem(LOCAL_PASSWORD_REQUESTS_KEY) || '[]') as PasswordRequestRow[] } catch { return [] }
}

function writeLocalPasswordRequests(rows: PasswordRequestRow[]) {
  localStorage.setItem(LOCAL_PASSWORD_REQUESTS_KEY, JSON.stringify(rows))
}

export async function requestPasswordChange(username: string) {
  const normalized = String(username || '').trim().toLowerCase()
  const data = await loadData(true)
  const user = data.users.find(item => item.username === normalized)
  if (!user) throw new Error('Account not found.')
  if (!mysql) {
    const requests = localPasswordRequests()
    if (requests.some(item => item.username === normalized && item.status === 'pending')) throw new Error('A password request is already pending.')
    requests.push({ id: crypto.randomUUID(), username: normalized, status: 'pending', createdAt: Date.now() })
    writeLocalPasswordRequests(requests)
    return
  }
  const { data: pending, error: lookupError } = await mysql.from('password_requests').select('*').eq('username', normalized).eq('status', 'pending').maybeSingle()
  if (lookupError) throw new Error(mysqlErrorMessage(lookupError))
  if (pending) throw new Error('A password request is already pending.')
  const { error } = await mysql.from('password_requests').insert({ id: crypto.randomUUID(), username: normalized, status: 'pending' })
  if (error) throw new Error(mysqlErrorMessage(error))
}

export async function listPasswordRequests() {
  if (!mysql) return localPasswordRequests().sort((a, b) => b.createdAt - a.createdAt)
  const { data, error } = await mysql.from('password_requests').select('*').order('created_at', { ascending: false })
  if (error) throw new Error(mysqlErrorMessage(error))
  return (data || []).map((row: Record<string, unknown>) => ({
    id: String(row.id), username: String(row.username), status: String(row.status) as PasswordRequestRow['status'],
    createdAt: new Date(String(row.created_at)).getTime(), approvedAt: row.approved_at ? new Date(String(row.approved_at)).getTime() : undefined,
    expiresAt: row.key_expires_at ? new Date(String(row.key_expires_at)).getTime() : undefined,
  }))
}

export async function approvePasswordRequest(requestId: string) {
  const key = crypto.randomUUID()
  const keyHash = await hashPassword(key)
  const expiresAt = Date.now() + 30 * 60 * 1000
  if (!mysql) {
    const requests = localPasswordRequests()
    const request = requests.find(item => item.id === requestId)
    if (!request || request.status !== 'pending') throw new Error('Password request is no longer pending.')
    request.status = 'approved'; request.approvedAt = Date.now(); request.expiresAt = expiresAt
    writeLocalPasswordRequests(requests)
    await addNotification({ kind: 'change', title: 'Password change approved', message: 'Your password change request was approved.', toUsername: request.username, actionUrl: `/change-password?key=${encodeURIComponent(key)}` })
    return
  }
  const { data: request, error: lookupError } = await mysql.from('password_requests').select('*').eq('id', requestId).maybeSingle()
  if (lookupError) throw new Error(mysqlErrorMessage(lookupError))
  if (!request || request.status !== 'pending') throw new Error('Password request is no longer pending.')
  const { error } = await mysql.from('password_requests').update({ status: 'approved', change_key_hash: keyHash, key_expires_at: new Date(expiresAt).toISOString(), approved_at: new Date().toISOString() }).eq('id', requestId)
  if (error) throw new Error(mysqlErrorMessage(error))
  await addNotification({ kind: 'change', title: 'Password change approved', message: 'Your password change request was approved.', toUsername: String(request.username), actionUrl: `/change-password?key=${encodeURIComponent(key)}` })
}

export async function denyPasswordRequest(requestId: string) {
  if (!mysql) {
    const requests = localPasswordRequests()
    const request = requests.find(item => item.id === requestId)
    if (!request || request.status !== 'pending') throw new Error('Password request is no longer pending.')
    request.status = 'denied'; writeLocalPasswordRequests(requests); return
  }
  const { error } = await mysql.from('password_requests').update({ status: 'denied' }).eq('id', requestId).eq('status', 'pending')
  if (error) throw new Error(mysqlErrorMessage(error))
}

export async function changePasswordWithKey(key: string, password: string) {
  if (password.length < 6 || password.length > 64) throw new Error('Password must be 6-64 characters.')
  const keyHash = await hashPassword(key)
  if (!mysql) throw new Error('Password changes require the database connection.')
  const { data: request, error: requestError } = await mysql.from('password_requests').select('*').eq('change_key_hash', keyHash).eq('status', 'approved').maybeSingle()
  if (requestError) throw new Error(mysqlErrorMessage(requestError))
  if (!request || !request.key_expires_at || new Date(String(request.key_expires_at)).getTime() < Date.now()) throw new Error('This password change link is invalid or expired.')
  const passwordHash = await hashPassword(password)
  const { error: profileError } = await mysql.from('profiles').update({ password_hash: passwordHash }).eq('username', String(request.username))
  if (profileError) throw new Error(mysqlErrorMessage(profileError))
  const { error } = await mysql.from('password_requests').update({ status: 'used', used_at: new Date().toISOString() }).eq('id', String(request.id)).eq('status', 'approved')
  if (error) throw new Error(mysqlErrorMessage(error))
}

const PERMISSIONS_HELP = 'Run the full mysql/003_permissions.sql file in your MySQL server, then restart npm run dev.'

function mysqlErrorMessage(error: { message: string; code?: string }) {
  if (error.code === '23505') return 'That username is taken.'
  if (error.code === '42501' || error.message.includes('permission denied')) {
    return `Database permission error. ${PERMISSIONS_HELP}`
  }
  return error.message || 'Database save failed.'
}

async function fetchProfiles() {
  if (!mysql) return []
  const { data, error } = await mysql.from('profiles').select('*').order('created_at')
  if (!error) return (data || []).map(mapProfile)
  const { data: rpcData, error: rpcError } = await mysql.rpc('list_profiles')
  if (!rpcError && rpcData) return (rpcData as Record<string, unknown>[]).map(mapProfile)
  throw error || rpcError
}

async function syncMissingProfiles(remote: AppData): Promise<AppData> {
  if (!mysql) return remote
  const local = readLocal()
  const known = new Set(remote.users.map(u => u.username))
  for (const user of local.users) {
    if (known.has(user.username) || !user.passwordHash) continue
    const { data, error } = await mysql.from('profiles').insert({
      id: /^[0-9a-f-]{36}$/i.test(user.id) ? user.id : crypto.randomUUID(),
      username: user.username,
      display: user.display,
      password_hash: user.passwordHash,
      role: user.role === 'admin' ? 'admin' : 'user',
    }).select('*').single()
    if (!error && data) {
      remote.users.push(mapProfile(data))
      known.add(user.username)
    }
  }
  return remote
}

function defaultBanner(id: string): Banner {
  return {
    id,
    title: 'Bannered greeting',
    image: '/images/banner-default.svg',
    link: '/greet',
    reactions: [
      { emoji: '❤️', count: 1 },
      { emoji: '👏', count: 2 },
      { emoji: '🎉', count: 0 },
    ],
    comments: [],
  }
}

function ensureBanner(data: AppData, bannerId: string): Banner {
  let banner = data.banners.find(item => item.id === bannerId)
  if (!banner) {
    banner = defaultBanner(bannerId)
    data.banners.push(banner)
  }
  banner.reactions ||= [
    { emoji: '❤️', count: 1 },
    { emoji: '👏', count: 2 },
    { emoji: '🎉', count: 0 },
  ]
  banner.comments ||= []
  return banner
}

export async function addBannerReaction(bannerId: string, emoji: string) {
  if (mysql) {
    const { data: existing, error: lookupError } = await mysql.from('banners').select('*').eq('id', bannerId).maybeSingle()
    if (lookupError) throw new Error(mysqlErrorMessage(lookupError))
    const banner = existing ? mapBanner(existing) : defaultBanner(bannerId)
    const reactions = banner.reactions || []
    const found = reactions.find(item => item.emoji === emoji)
    if (found) found.count += 1
    else reactions.push({ emoji, count: 1 })
    const { data: saved, error } = await mysql.from('banners').upsert({
      id: bannerId,
      title: banner.title,
      image: banner.image,
      link: banner.link,
      reactions,
      comments: banner.comments || [],
    }).select('*').single()
    if (error) throw new Error(mysqlErrorMessage(error))
    clearCache()
    return saved ? mapBanner(saved) : { ...banner, reactions }
  }
  const data = readLocal()
  const banner = ensureBanner(data, bannerId)
  banner.reactions ||= []
  const found = banner.reactions.find(item => item.emoji === emoji)
  if (found) found.count += 1
  else banner.reactions.push({ emoji, count: 1 })
  writeLocal(data)
  clearCache()
  return banner
}

export async function addBannerComment(bannerId: string, author: string, body: string) {
  const trimmed = String(body || '').trim()
  if (!trimmed) throw new Error('Comment cannot be empty.')
  if (mysql) {
    const { data: existing, error: lookupError } = await mysql.from('banners').select('*').eq('id', bannerId).maybeSingle()
    if (lookupError) throw new Error(mysqlErrorMessage(lookupError))
    const banner = existing ? mapBanner(existing) : defaultBanner(bannerId)
    const entry = { id: crypto.randomUUID(), author: String(author || 'Guest'), body: trimmed, createdAt: Date.now(), reactions: [], status: 'active' as const, replies: [] }
    const { error } = await mysql.from('banners').upsert({
      id: bannerId,
      title: banner.title,
      image: banner.image,
      link: banner.link,
      reactions: banner.reactions || [],
      comments: [entry, ...(banner.comments || [])],
    })
    if (error) throw new Error(mysqlErrorMessage(error))
    clearCache()
    return entry
  }
  const data = readLocal()
  const banner = ensureBanner(data, bannerId)
  banner.comments ||= []
  const entry = { id: crypto.randomUUID(), author: String(author || 'Guest'), body: trimmed, createdAt: Date.now(), reactions: [], status: 'active' as const, replies: [] }
  banner.comments.unshift(entry)
  writeLocal(data)
  clearCache()
  return entry
}

function findReplyTarget(comment: BannerComment, replyId?: string): BannerCommentReply | undefined {
  if (!replyId) return undefined

  const findNested = (items: BannerCommentReply[] | undefined): BannerCommentReply | undefined => {
    if (!items) return undefined
    for (const item of items) {
      if (item.id === replyId) return item
      const nested = findNested(item.replies)
      if (nested) return nested
    }
    return undefined
  }

  return findNested(comment.replies)
}

export async function addBannerCommentReaction(bannerId: string, commentId: string, emoji: string, replyId?: string) {
  const trimmed = String(emoji || '').trim()
  if (!trimmed) throw new Error('Reaction cannot be empty.')
  if (mysql) {
    const { data: existing, error: lookupError } = await mysql.from('banners').select('*').eq('id', bannerId).maybeSingle()
    if (lookupError) throw new Error(mysqlErrorMessage(lookupError))
    const banner = existing ? mapBanner(existing) : defaultBanner(bannerId)
    const comment = (banner.comments || []).find(item => item.id === commentId)
    if (!comment) throw new Error('Comment not found.')
    const target = replyId ? findReplyTarget(comment, replyId) : comment
    if (!target) throw new Error('Target not found.')
    target.reactions ||= []
    const existingReaction = target.reactions.find(item => item.emoji === emoji)
    if (existingReaction) existingReaction.count += 1
    else target.reactions.push({ emoji, count: 1 })
    const { error } = await mysql.from('banners').update({ comments: banner.comments || [] }).eq('id', bannerId)
    if (error) throw new Error(mysqlErrorMessage(error))
    clearCache()
    return target
  }

  const data = readLocal()
  const banner = ensureBanner(data, bannerId)
  const comment = (banner.comments || []).find(item => item.id === commentId)
  if (!comment) throw new Error('Comment not found.')
  const target = replyId ? findReplyTarget(comment, replyId) : comment
  if (!target) throw new Error('Target not found.')
  target.reactions ||= []
  const existingReaction = target.reactions.find(item => item.emoji === emoji)
  if (existingReaction) existingReaction.count += 1
  else target.reactions.push({ emoji, count: 1 })
  writeLocal(data)
  clearCache()
  return target
}

function insertReplyIntoThread(replies: BannerCommentReply[] | undefined, targetId: string, entry: BannerCommentReply): BannerCommentReply[] {
  const list = replies || []
  return list.map(reply => {
    if (reply.id === targetId) {
      return { ...reply, replies: [...(reply.replies || []), entry] }
    }
    if (reply.replies && reply.replies.length) {
      return { ...reply, replies: insertReplyIntoThread(reply.replies, targetId, entry) }
    }
    return reply
  })
}

export async function addBannerReply(bannerId: string, commentId: string, author: string, body: string, replyId?: string) {
  const trimmed = String(body || '').trim()
  if (!trimmed) throw new Error('Reply cannot be empty.')
  const entry = { id: crypto.randomUUID(), author: String(author || 'Guest'), body: trimmed, createdAt: Date.now(), reactions: [], status: 'active' as const, replies: [] }
  if (mysql) {
    const { data: existing, error: lookupError } = await mysql.from('banners').select('*').eq('id', bannerId).maybeSingle()
    if (lookupError) throw new Error(mysqlErrorMessage(lookupError))
    const banner = existing ? mapBanner(existing) : defaultBanner(bannerId)
    const comment = (banner.comments || []).find(item => item.id === commentId)
    if (!comment) throw new Error('Comment not found.')
    if (replyId) {
      comment.replies = insertReplyIntoThread(comment.replies, replyId, entry)
    } else {
      comment.replies = [...(comment.replies || []), entry]
    }
    const { error } = await mysql.from('banners').update({ comments: banner.comments || [] }).eq('id', bannerId)
    if (error) throw new Error(mysqlErrorMessage(error))
    clearCache()
    return entry
  }
  const data = readLocal()
  const banner = ensureBanner(data, bannerId)
  banner.comments ||= []
  const comment = (banner.comments || []).find(item => item.id === commentId)
  if (!comment) throw new Error('Comment not found.')
  if (replyId) {
    comment.replies = insertReplyIntoThread(comment.replies, replyId, entry)
  } else {
    comment.replies = [...(comment.replies || []), entry]
  }
  writeLocal(data)
  clearCache()
  return entry
}

export async function removeBannerComment(bannerId: string, commentId: string, author: string) {
  const data = readLocal()
  const banner = ensureBanner(data, bannerId)
  const comment = (banner.comments || []).find(item => item.id === commentId)
  if (!comment) throw new Error('Comment not found.')
  if (comment.author !== author) throw new Error('You can only remove your own comment.')
  if (comment.status === 'removed') return comment
  comment.status = 'removed'
  comment.removedAt = Date.now()
  if (mysql) {
    const { data: existing, error: lookupError } = await mysql.from('banners').select('*').eq('id', bannerId).maybeSingle()
    if (lookupError) throw new Error(mysqlErrorMessage(lookupError))
    const live = existing ? mapBanner(existing) : defaultBanner(bannerId)
    const target = (live.comments || []).find(item => item.id === commentId)
    if (!target) throw new Error('Comment not found.')
    target.status = 'removed'
    target.removedAt = Date.now()
    const { error } = await mysql.from('banners').update({ comments: live.comments || [] }).eq('id', bannerId)
    if (error) throw new Error(mysqlErrorMessage(error))
    clearCache()
    return target
  }
  writeLocal(data)
  clearCache()
  return comment
}

async function fetchRemote(): Promise<AppData> {
  if (!mysql) return readLocal()
  const [profiles, greetings, banners, friends, conversations, chatMessages, notifications, settings] = await Promise.all([
    fetchProfiles().then(users => ({ data: users, error: null as null })).catch(error => ({ data: null, error })),
    mysql.from('greetings').select('*').order('created_at', { ascending: false }),
    mysql.from('banners').select('*').order('created_at'),
    mysql.from('friends').select('*').order('created_at', { ascending: false }),
    mysql.from('conversations').select('*').order('updated_at', { ascending: false }),
    mysql.from('chat_messages').select('*').order('created_at'),
    mysql.from('notifications').select('*').order('created_at', { ascending: false }),
    mysql.from('site_settings').select('*').eq('id', 1).maybeSingle(),
  ])
  if (profiles.error) throw new Error(mysqlErrorMessage(profiles.error))
  if (greetings.error) throw greetings.error
  if (banners.error) throw banners.error
  if (friends.error) throw friends.error
  if (conversations.error && conversations.error.code !== '42P01') throw conversations.error
  if (chatMessages.error && chatMessages.error.code !== '42P01') throw chatMessages.error
  if (notifications.error) throw notifications.error
  if (settings.error) throw settings.error
  return {
    users: profiles.data || [],
    greetings: (greetings.data || []).map(mapGreeting),
    banners: (banners.data || []).map(mapBanner),
    friends: (friends.data || []).map(mapFriend),
    conversations: (conversations.data || []).map(mapConversation),
    chatMessages: (chatMessages.data || []).map(mapChatMessage),
    notifications: (notifications.data || []).map(mapNotification),
    settings: mapSettings(settings.data),
  }
}

let cache: AppData | null = null
let loadPromise: Promise<AppData> | null = null
let busy = 0

export function isDbBusy() {
  return busy > 0
}

async function withBusy<T>(fn: () => Promise<T>) {
  busy++
  try { return await fn() }
  finally { busy-- }
}

export function clearCache() {
  cache = null
}

export async function loadData(force = false): Promise<AppData> {
  if (cache && !force) return cache
  if (loadPromise) return loadPromise
  const run = async () => {
    if (mysqlConfigured) {
      cache = await syncMissingProfiles(await fetchRemote())
      writeLocal(cache)
      return cache
    }
    let local = readLocal()
    if (!local.users.length) {
      local = await seedLocal()
      writeLocal(local)
    }
    cache = local
    return cache
  }
  const pending = withBusy(run)
  loadPromise = pending
  try {
    return await pending
  } finally {
    if (loadPromise === pending) loadPromise = null
  }
}

export async function createProfile(profile: Omit<Profile, 'createdAt'> & { passwordHash: string }): Promise<Profile> {
  if (mysqlConfigured && !mysql) {
    throw new Error('MySQL is configured but not connected. Check DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD in .env.local or the legacy VITE_MYSQL_* values.')
  }

  if (!mysql) {
    const data = readLocal()
    if (data.users.some(u => u.username === profile.username)) throw new Error('That username is taken.')
    const created = { ...profile, createdAt: Date.now() }
    data.users.push(created)
    writeLocal(data)
    clearCache()
    return created
  }

  const { data: rpcData, error: rpcError } = await mysql.rpc('register_profile', {
    p_id: profile.id,
    p_username: profile.username,
    p_display: profile.display,
    p_password_hash: profile.passwordHash,
  })

  const fromRpc = profileFromRow(rpcData as Record<string, unknown> | null)
  if (!rpcError && fromRpc) {
    clearCache()
    return fromRpc
  }

  if (rpcError && rpcError.code !== 'PGRST202') {
    throw new Error(mysqlErrorMessage(rpcError))
  }

  const { data: existing, error: lookupError } = await mysql
    .from('profiles')
    .select('username')
    .eq('username', profile.username)
    .maybeSingle()
  if (lookupError) throw new Error(mysqlErrorMessage(lookupError))
  if (existing) throw new Error('That username is taken.')

  const { data, error } = await mysql.from('profiles').insert({
    id: profile.id,
    username: profile.username,
    display: profile.display,
    password_hash: profile.passwordHash,
    role: profile.role,
  }).select('*').single()

  if (error) throw new Error(mysqlErrorMessage(error))
  if (!data) throw new Error('Account could not be saved. Please try again.')

  const created = mapProfile(data)
  clearCache()
  return created
}

export async function updateUserBan(userId: string, patch: { banStatus?: UserBanStatus; banReason?: string; banUntil?: number | null }) {
  const data = await loadData()
  const user = data.users.find(u => u.id === userId)
  if (!user) throw new Error('Profile not found.')

  const nextStatus = patch.banStatus || 'active'
  const nextReason = patch.banReason?.trim() || ''
  const nextUntil = nextStatus === 'temporary' ? (patch.banUntil ?? Date.now() + 86400000) : null

  if (!mysql) {
    const local = readLocal()
    local.users = local.users.map(u => {
      if (u.id !== userId) return u
      return {
        ...u,
        banStatus: nextStatus,
        banReason: nextStatus === 'active' ? undefined : nextReason,
        banUntil: nextStatus === 'temporary' ? nextUntil : null,
      }
    })
    writeLocal(local)
    clearCache()
    return local.users.find(u => u.id === userId)!
  }

  const payload: Record<string, string | number | null> = {
    ban_status: nextStatus,
    ban_reason: nextStatus === 'active' ? null : nextReason,
    ban_until: nextStatus === 'temporary' ? nextUntil : null,
  }
  const { data: saved, error } = await mysql.from('profiles').update(payload).eq('id', userId).select('*').single()
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return mapProfile(saved)
}

export async function updateProfile(userId: string, patch: { display?: string; avatarUrl?: string | null }) {
  const data = await loadData()
  const user = data.users.find(u => u.id === userId)
  if (!user) throw new Error('Profile not found.')
  const nextDisplay = patch.display !== undefined ? String(patch.display).trim() : user.display
  const nextAvatar = patch.avatarUrl !== undefined ? (patch.avatarUrl ? String(patch.avatarUrl) : undefined) : user.avatarUrl
  if (!nextDisplay) throw new Error('Display name is required.')

  if (!mysql) {
    const local = readLocal()
    local.users = local.users.map(u => u.id === userId ? { ...u, display: nextDisplay, avatarUrl: nextAvatar } : u)
    writeLocal(local)
    clearCache()
    return local.users.find(u => u.id === userId)!
  }

  const payload: Record<string, string | null> = { display: nextDisplay }
  if (patch.avatarUrl !== undefined) payload.avatar_url = nextAvatar || null
  const { data: saved, error } = await mysql.from('profiles').update(payload).eq('id', userId).select('*').single()
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return mapProfile(saved)
}

export async function findProfileByUsername(username: string) {
  username = String(username || '').trim().toLowerCase()
  if (mysql) {
    const { data: rpcData, error: rpcError } = await mysql.rpc('find_profile', { p_username: username })
    const rpcRow = Array.isArray(rpcData) ? rpcData[0] : rpcData
    const fromRpc = profileFromRow(rpcRow as Record<string, unknown> | null)
    if (!rpcError && fromRpc) return fromRpc
    if (rpcError && rpcError.code !== 'PGRST202') throw new Error(mysqlErrorMessage(rpcError))
    const { data, error } = await mysql.from('profiles').select('*').eq('username', username).maybeSingle()
    if (error) throw new Error(mysqlErrorMessage(error))
    return profileFromRow(data)
  }
  const data = readLocal()
  return data.users.find(u => u.username === username)
}

async function notifyPrivateMessage(greeting: Omit<Greeting, 'id' | 'createdAt'>) {
  if (greeting.type !== 'private' || !greeting.fromId) return
  const data = await loadData(true)
  const sender = data.users.find(u => u.id === greeting.fromId)
  if (!sender) return
  if (!receiverWantedConversation(data.friends, data.greetings, data.users, greeting.to, sender.username)) return
  const preview = greeting.message.length > 80 ? `${greeting.message.slice(0, 80)}…` : greeting.message
  await addNotification({
    kind: 'message',
    title: 'New private message',
    message: `${greeting.from} sent you a private greeting: “${preview}” Open your inbox to reply.`,
    toUsername: greeting.to,
  })
}

export async function addGreeting(greeting: Omit<Greeting, 'id' | 'createdAt'>) {
  let row: Greeting
  if (!mysql) {
    const data = readLocal()
    row = { ...greeting, id: crypto.randomUUID(), createdAt: Date.now() }
    data.greetings.unshift(row)
    writeLocal(data)
    clearCache()
  } else {
    const { data, error } = await mysql.from('greetings').insert({
      from_name: greeting.from,
      from_id: greeting.fromId || null,
      to_username: greeting.to,
      message: greeting.message,
      type: greeting.type,
      media_url: greeting.mediaUrl || null,
      media_type: greeting.mediaType || null,
    }).select('*').single()
    if (error) throw error
    clearCache()
    row = mapGreeting(data)
  }
  if (greeting.type === 'private') await notifyPrivateMessage(greeting)
  return row
}

export async function deleteGreeting(id: string) {
  if (!mysql) {
    const data = readLocal()
    data.greetings = data.greetings.filter(g => g.id !== id)
    writeLocal(data)
    clearCache()
    return
  }
  const { error } = await mysql.from('greetings').delete().eq('id', id)
  if (error) throw error
  clearCache()
}

export async function upsertFriend(action: 'add' | 'accept' | 'remove', me: string, other: string) {
  const before = await loadData(true)
  const actorLabel = before.users.find(u => u.username === me)?.display || me
  const relation = before.friends.find(x => (x.from === me && x.to === other) || (x.from === other && x.to === me))
  const isDecline = action === 'remove' && relation?.status === 'pending' && relation.from === other && relation.to === me

  if (action === 'add' && relation) {
    if (relation.status === 'accepted') throw new Error('You are already friends.')
    if (relation.from === me) throw new Error('A friend request is already pending.')
    throw new Error('This user has already sent you a friend request.')
  }

  const mutateLocal = () => {
    const data = readLocal()
    data.friends = data.friends || []
    if (action === 'add') {
      if (data.friends.some(f => (f.from === me && f.to === other) || (f.from === other && f.to === me))) {
        throw new Error('Already added.')
      }
      data.friends.push({ id: crypto.randomUUID(), from: me, to: other, status: 'pending', createdAt: Date.now() })
    }
    if (action === 'accept') {
      const f = data.friends.find(x => x.status === 'pending' && x.from === other && x.to === me)
      if (!f) throw new Error('Request not found.')
      f.status = 'accepted'
    }
    if (action === 'remove') {
      data.friends = data.friends.filter(x => !((x.from === me && x.to === other) || (x.from === other && x.to === me)))
    }
    writeLocal(data)
    clearCache()
  }

  if (!mysql) mutateLocal()
  else {
    if (action === 'add') {
      const { error } = await mysql.from('friends').insert({ from_username: me, to_username: other, status: 'pending' })
      if (error) throw error
    }
    if (action === 'accept') {
      const { error } = await mysql.from('friends').update({ status: 'accepted' }).eq('from_username', other).eq('to_username', me).eq('status', 'pending')
      if (error) throw error
    }
    if (action === 'remove') {
      const { error } = await mysql.from('friends').delete().or(`and(from_username.eq.${me},to_username.eq.${other}),and(from_username.eq.${other},to_username.eq.${me})`)
      if (error) throw error
    }
    clearCache()
  }

  if (action === 'accept') {
    await addNotification({
      kind: 'friend',
      title: 'Friend request accepted',
      message: `${actorLabel} accepted your friend request.`,
      toUsername: other,
    })
  }
  if (action === 'add') {
    await addNotification({
      kind: 'friend',
      title: 'New friend request',
      message: `${actorLabel} sent you a friend request.`,
      toUsername: other,
    })
  }
  if (isDecline) {
    await addNotification({
      kind: 'friend',
      title: 'Friend request declined',
      message: `${actorLabel} declined your friend request.`,
      toUsername: other,
    })
  }
}

export async function addBanner(banner: Omit<Banner, 'id'>) {
  if (!mysql) {
    const data = readLocal()
    const row = { ...banner, id: crypto.randomUUID() }
    data.banners.push(row)
    writeLocal(data)
    clearCache()
    return row
  }
  const { error } = await mysql.from('banners').insert({ title: banner.title, image: banner.image, link: banner.link })
  if (error) throw error
  clearCache()
}

export async function deleteBanner(id: string) {
  if (!mysql) {
    const data = readLocal()
    data.banners = data.banners.filter(b => b.id !== id)
    writeLocal(data)
    clearCache()
    return
  }
  const { error } = await mysql.from('banners').delete().eq('id', id)
  if (error) throw error
  clearCache()
}

export async function addNotification(note: Omit<Notification, 'id' | 'createdAt'>) {
  if (!mysql) {
    const data = readLocal()
    data.notifications.unshift({ ...note, id: crypto.randomUUID(), createdAt: Date.now() })
    writeLocal(data)
    clearCache()
    return
  }
  const { error } = await mysql.from('notifications').insert({
    kind: note.kind,
    title: note.title,
    message: note.message,
    to_username: note.toUsername || null,
    action_url: note.actionUrl || null,
  })
  if (error) throw error
  clearCache()
}

export async function updateSettings(patch: Partial<{ theme: Theme; celebration: SiteSettings['celebration'] }>) {
  if (!mysql) {
    const data = readLocal()
    if (patch.theme) data.settings.theme = patch.theme
    if (patch.celebration) data.settings.celebration = { ...data.settings.celebration, ...patch.celebration, enabled: !!patch.celebration.title }
    writeLocal(data)
    clearCache()
    return
  }
  const payload: Record<string, string> = {}
  if (patch.theme) payload.theme = patch.theme
  if (patch.celebration) {
    payload.celebration_title = patch.celebration.title
    payload.celebration_message = patch.celebration.message
    payload.celebration_date = patch.celebration.date
  }
  const { error } = await mysql.from('site_settings').update(payload).eq('id', 1)
  if (error) throw error
  clearCache()
}

export async function requestConversation(me: string, other: string) {
  if (me === other) throw new Error('You cannot message yourself.')
  const [userA, userB] = pairUsers(me, other)
  const data = await loadData(true)
  const actor = data.users.find(u => u.username === me)
  const actorLabel = actor?.display || me
  let conv = findConversation(data.conversations, me, other)

  const saveConversation = async (row: Conversation) => {
    if (!mysql) {
      const local = readLocal()
      local.conversations = local.conversations.filter(c => c.id !== row.id)
      local.conversations.unshift(row)
      writeLocal(local)
      clearCache()
      return row
    }
    const { data: saved, error } = await mysql.from('conversations').upsert({
      id: row.id,
      user_a: row.userA,
      user_b: row.userB,
      requested_by: row.requestedBy,
      status: row.status,
      updated_at: new Date(row.updatedAt).toISOString(),
    }).select('*').single()
    if (error) throw new Error(mysqlErrorMessage(error))
    clearCache()
    return mapConversation(saved)
  }

  if (conv?.status === 'approved') return conv
  if (conv?.status === 'pending') return conv
  if (conv?.status === 'declined' && conv.requestedBy !== me) return conv

  const now = Date.now()
  const isNew = !conv
  conv = {
    id: conv?.id || crypto.randomUUID(),
    userA,
    userB,
    requestedBy: me,
    status: 'pending',
    createdAt: conv?.createdAt || now,
    updatedAt: now,
  }

  try {
    const saved = await saveConversation(conv)
    if (isNew) {
      await addNotification({
        kind: 'message',
        title: 'Conversation request',
        message: `${actorLabel} wants to have a conversation with you. Open Messages to respond.`,
        toUsername: other,
      })
    }
    return saved
  } catch (error) {
    const dupMessage = error instanceof Error ? error.message : String(error ?? '')
    if (/duplicate|already exists|1062|23505/i.test(dupMessage)) {
      const refreshed = await loadData(true)
      const existing = findConversation(refreshed.conversations, me, other)
      if (existing) return existing
    }
    throw error
  }
}

export async function createGroup(me: string, title: string, members: string[]) {
  const name = String(title || '').trim()
  const selected = [...new Set([me, ...members.map(member => String(member).trim().toLowerCase())])]
  if (name.length < 2 || name.length > 60) throw new Error('Group name must be between 2 and 60 characters.')
  if (selected.length < 2) throw new Error('Choose at least one other person for the group.')
  const data = await loadData()
  const knownUsers = new Set(data.users.map(user => user.username))
  if (selected.some(member => !knownUsers.has(member))) throw new Error('One or more selected users could not be found.')
  const now = Date.now()
  const row: Conversation = {
    id: crypto.randomUUID(),
    userA: '',
    userB: '',
    requestedBy: me,
    status: 'approved',
    kind: 'group',
    title: name,
    groupAvatarUrl: undefined,
    members: selected,
    createdAt: now,
    updatedAt: now,
  }

  if (!mysql) {
    const local = readLocal()
    local.conversations.unshift(row)
    writeLocal(local)
    clearCache()
    return row
  }

  const { data: saved, error } = await mysql.from('conversations').insert({
    id: row.id,
    user_a: `group:${row.id}`,
    user_b: `members:${row.id}`,
    requested_by: me,
    status: 'approved',
    kind: 'group',
    group_name: name,
    group_avatar_url: null,
    member_usernames: selected,
    updated_at: new Date(now).toISOString(),
  }).select('*').single()
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return saved ? mapConversation(saved) : row
}

export async function updateGroupProfile(groupId: string, me: string, patch: { title?: string; groupAvatarUrl?: string | null }) {
  const data = await loadData(true)
  const group = data.conversations.find(conversation => conversation.id === groupId && conversation.kind === 'group')
  if (!group || !group.members?.includes(me)) throw new Error('You are not a member of this group.')

  const nextTitle = patch.title !== undefined ? String(patch.title).trim() : group.title || 'Group'
  if (nextTitle.length < 2 || nextTitle.length > 60) throw new Error('Group name must be between 2 and 60 characters.')
  const nextAvatar = patch.groupAvatarUrl !== undefined ? (patch.groupAvatarUrl || undefined) : group.groupAvatarUrl
  const updated = { ...group, title: nextTitle, groupAvatarUrl: nextAvatar, updatedAt: Date.now() }

  if (!mysql) {
    const local = readLocal()
    local.conversations = local.conversations.map(conversation => conversation.id === groupId ? updated : conversation)
    writeLocal(local)
    clearCache()
    return updated
  }

  const { data: saved, error } = await mysql.from('conversations').update({
    group_name: nextTitle,
    group_avatar_url: nextAvatar || null,
    updated_at: new Date(updated.updatedAt).toISOString(),
  }).eq('id', groupId).select('*').single()
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return saved ? mapConversation(saved) : updated
}

export async function addGroupMember(groupId: string, me: string, username: string) {
  const data = await loadData(true)
  const group = data.conversations.find(conversation => conversation.id === groupId && conversation.kind === 'group')
  const member = String(username || '').trim().toLowerCase()
  if (!group || !group.members?.includes(me)) throw new Error('You are not a member of this group.')
  if (!data.users.some(user => user.username === member)) throw new Error('User not found.')
  if (group.members.includes(member)) throw new Error('That user is already in the group.')
  const members = [...group.members, member]

  if (!mysql) {
    const local = readLocal()
    local.conversations = local.conversations.map(conversation => conversation.id === groupId ? { ...conversation, members, updatedAt: Date.now() } : conversation)
    writeLocal(local)
    clearCache()
    return local.conversations.find(conversation => conversation.id === groupId)!
  }

  const { data: saved, error } = await mysql.from('conversations').update({
    member_usernames: members,
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select('*').single()
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return saved ? mapConversation(saved) : { ...group, members }
}

export async function removeGroupMember(groupId: string, me: string, username: string) {
  const data = await loadData(true)
  const group = data.conversations.find(conversation => conversation.id === groupId && conversation.kind === 'group')
  const member = String(username || '').trim().toLowerCase()
  if (!group || group.requestedBy !== me) throw new Error('Only the group admin can remove members.')
  if (member === group.requestedBy) throw new Error('The group admin cannot be removed.')
  if (!group.members?.includes(member)) throw new Error('That user is not in the group.')
  const members = group.members.filter(current => current !== member)

  if (!mysql) {
    const local = readLocal()
    local.conversations = local.conversations.map(conversation => conversation.id === groupId ? { ...conversation, members, updatedAt: Date.now() } : conversation)
    writeLocal(local)
    clearCache()
    return local.conversations.find(conversation => conversation.id === groupId)!
  }

  const { data: saved, error } = await mysql.from('conversations').update({
    member_usernames: members,
    updated_at: new Date().toISOString(),
  }).eq('id', groupId).select('*').single()
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return saved ? mapConversation(saved) : { ...group, members }
}

export async function updateConversationSettings(conversationId: string, me: string, patch: { pinned?: boolean; blocked?: boolean }) {
  const data = await loadData(true)
  const conversation = data.conversations.find(item => item.id === conversationId)
  const allowed = conversation && (conversation.kind === 'group' ? conversation.members?.includes(me) : conversation.userA === me || conversation.userB === me)
  if (!conversation || !allowed) throw new Error('You are not part of this conversation.')
  const pinnedBy = new Set(conversation.pinnedBy || [])
  const blockedBy = new Set(conversation.blockedBy || [])
  if (patch.pinned !== undefined) patch.pinned ? pinnedBy.add(me) : pinnedBy.delete(me)
  if (patch.blocked !== undefined) patch.blocked ? blockedBy.add(me) : blockedBy.delete(me)
  const updated = { ...conversation, pinnedBy: [...pinnedBy], blockedBy: [...blockedBy], updatedAt: Date.now() }

  if (!mysql) {
    const local = readLocal()
    local.conversations = local.conversations.map(item => item.id === conversationId ? updated : item)
    writeLocal(local)
    clearCache()
    return updated
  }
  const { data: saved, error } = await mysql.from('conversations').update({
    pinned_by: updated.pinnedBy,
    blocked_by: updated.blockedBy,
    updated_at: new Date(updated.updatedAt).toISOString(),
  }).eq('id', conversationId).select('*').single()
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return saved ? mapConversation(saved) : updated
}

export async function respondToConversation(me: string, other: string, approved: boolean) {
  const data = await loadData()
  const conv = findConversation(data.conversations, me, other)
  if (!conv || conv.status !== 'pending') throw new Error('No pending conversation request.')
  if (conv.requestedBy === me) throw new Error('Wait for the other person to respond.')
  const actorLabel = data.users.find(u => u.username === me)?.display || me
  const now = Date.now()
  const updated: Conversation = { ...conv, status: approved ? 'approved' : 'declined', updatedAt: now }

  if (!mysql) {
    const local = readLocal()
    local.conversations = local.conversations.map(c => c.id === updated.id ? updated : c)
    writeLocal(local)
    clearCache()
  } else {
    const { error } = await mysql.from('conversations').update({
      status: updated.status,
      updated_at: new Date(now).toISOString(),
    }).eq('id', updated.id)
    if (error) throw new Error(mysqlErrorMessage(error))
    clearCache()
  }

  await addNotification({
    kind: 'message',
    title: approved ? 'Conversation approved' : 'Conversation declined',
    message: approved
      ? `${actorLabel} approved your conversation request. You can chat now.`
      : `${actorLabel} declined your conversation request.`,
    toUsername: conv.requestedBy,
  })
  return updated
}

export async function sendChatMessage(me: string, conversationId: string, body: string, imageUrl?: string, mediaType?: 'image' | 'video') {
  const trimmed = String(body || '').trim()
  if (!trimmed && !imageUrl) throw new Error('Write a message or choose an image.')
  if (trimmed) {
    const msgErr = messageOk(trimmed)
    if (msgErr) throw new Error(msgErr)
  }
  const data = await loadData()
  const conv = data.conversations.find(c => c.id === conversationId)
  if (!conv) throw new Error('Conversation not found.')
  const isMember = conv.kind === 'group' ? conv.members?.includes(me) : conv.userA === me || conv.userB === me
  if (!isMember) throw new Error('You are not part of this conversation.')
  if (conv.status !== 'approved') throw new Error('This conversation is not approved yet.')
  if (conv.blockedBy?.includes(me)) throw new Error('You blocked this conversation.')
  const now = Date.now()
  const row: ChatMessage = { id: crypto.randomUUID(), conversationId, fromUsername: me, body: trimmed, imageUrl, mediaType, status: 'sent', createdAt: now }

  if (!mysql) {
    const local = readLocal()
    local.chatMessages.push(row)
    local.conversations = local.conversations.map(c => c.id === conversationId ? { ...c, updatedAt: now } : c)
    writeLocal(local)
    clearCache()
  } else {
    const { data: savedMessage, error: msgError } = await mysql.from('chat_messages').insert({
      conversation_id: conversationId,
      from_username: me,
      body: trimmed,
      image_url: imageUrl || null,
      media_type: mediaType || null,
      status: 'sent',
      deleted_by_username: null,
      deleted_at: null,
    }).select('*').single()
    if (msgError) throw new Error(mysqlErrorMessage(msgError))
    if (savedMessage) Object.assign(row, mapChatMessage(savedMessage))
    void mysql.from('conversations').update({
      updated_at: new Date(now).toISOString(),
    }).eq('id', conversationId).then((result: { error?: { message?: string } | null } = {}) => {
      if (result.error) console.warn('Conversation timestamp could not be updated:', result.error)
    })
    clearCache()
  }

  const sender = data.users.find(u => u.username === me)
  const other = conv.userA === me ? conv.userB : conv.userA
  const preview = trimmed.length > 80 ? `${trimmed.slice(0, 80)}…` : trimmed
  void addNotification({
    kind: 'message',
    title: 'New message',
    message: `${sender?.display || me}: “${preview}”`,
    toUsername: other,
  }).catch(error => console.warn('Message notification could not be saved:', error))
  return row
}

export async function deleteChatMessage(me: string, messageId: string) {
  const data = await loadData()
  const message = data.chatMessages.find(item => item.id === messageId)
  if (!message) throw new Error('Message not found.')
  if (message.fromUsername !== me) throw new Error('You can only delete your own message.')
  if (message.status === 'deleted') return message

  const updated: ChatMessage = { ...message, status: 'deleted', deletedAt: Date.now() }
  const now = Date.now()

  if (!mysql) {
    const local = readLocal()
    local.chatMessages = local.chatMessages.map(item => item.id === messageId ? updated : item)
    local.conversations = local.conversations.map(c => c.id === message.conversationId ? { ...c, updatedAt: now } : c)
    writeLocal(local)
    clearCache()
    return updated
  }

  const { error } = await mysql.from('chat_messages').update({
    status: 'deleted',
    deleted_by_username: me,
    deleted_at: new Date(now).toISOString(),
  }).eq('id', messageId)
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return updated
}

export async function undoDeleteChatMessage(me: string, messageId: string) {
  const data = await loadData()
  const message = data.chatMessages.find(item => item.id === messageId)
  if (!message) throw new Error('Message not found.')
  if (message.fromUsername !== me) throw new Error('You can only undo your own deleted message.')
  if (message.status !== 'deleted') return message

  const updated: ChatMessage = { ...message, status: 'sent', deletedAt: undefined }
  const now = Date.now()

  if (!mysql) {
    const local = readLocal()
    local.chatMessages = local.chatMessages.map(item => item.id === messageId ? updated : item)
    local.conversations = local.conversations.map(c => c.id === message.conversationId ? { ...c, updatedAt: now } : c)
    writeLocal(local)
    clearCache()
    return updated
  }

  const { error } = await mysql.from('chat_messages').update({
    status: 'sent',
    deleted_by_username: null,
    deleted_at: null,
  }).eq('id', messageId)
  if (error) throw new Error(mysqlErrorMessage(error))
  clearCache()
  return updated
}

export async function resetDatabase() {
  if (!mysql) {
    localStorage.removeItem(LOCAL_KEY)
    clearCache()
    const seeded = await seedLocal()
    writeLocal(seeded)
    clearCache()
    return
  }
  const { error } = await mysql.rpc('reset_social_greetings')
  if (error) throw error
  clearCache()
}

export { mysqlConfigured }
