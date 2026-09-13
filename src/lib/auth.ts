import { createProfile, findProfileByUsername, loadData, updateUserBan } from './db'
import { mysql, mysqlConfigured } from './mysql'
import { hashPassword } from './hash'
import { nameOk } from './guard'
import { isBlocked } from './filter'
import type { SessionUser, UserBanStatus } from './types'

const KEY = 'sg_session'

export function getSession(): SessionUser | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) as SessionUser : null
  } catch {
    return null
  }
}

export function setSession(user: SessionUser) {
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(KEY, JSON.stringify(user))
  }
  return user
}

export function logout() {
  if (typeof window !== 'undefined') {
    window.localStorage.removeItem(KEY)
  }
}

export function isAdmin(session: SessionUser | null) {
  return session?.role === 'admin'
}

export function isBanActive(user: { banStatus?: UserBanStatus; banUntil?: number | null } | undefined | null) {
  if (!user || user.banStatus === 'active' || !user.banStatus) return false
  if (user.banStatus === 'permanent') return true
  if (user.banStatus === 'temporary' && user.banUntil && user.banUntil <= Date.now()) {
    return false
  }
  return user.banStatus === 'temporary'
}

function banNotice(user: { banStatus?: UserBanStatus; banReason?: string; banUntil?: number | null } | undefined | null) {
  if (!user || user.banStatus === 'active' || !user.banStatus) return ''
  if (user.banStatus === 'permanent') {
    return `This account is permanently banned${user.banReason ? `: ${user.banReason}` : '.'}`
  }
  if (user.banStatus === 'temporary') {
    const date = user.banUntil ? new Date(user.banUntil).toLocaleString() : 'a future date'
    return `This account is temporarily banned until ${date}${user.banReason ? `. Reason: ${user.banReason}` : '.'}`
  }
  return ''
}

export async function register(username: string, password: string, display: string) {
  if (mysqlConfigured && !mysql) {
    throw new Error('MySQL is configured but the app connection object is not available. Check DB_HOST, DB_NAME, DB_USER, and DB_PASSWORD in .env.local or the legacy VITE_MYSQL_* values.')
  }
  username = String(username || '').trim().toLowerCase()
  display = String(display || username).trim()
  if (!/^[a-z0-9_]{3,20}$/.test(username)) throw new Error('Use 3-20 letters, numbers, or underscore.')
  if (password.length < 6 || password.length > 64) throw new Error('Password must be 6-64 characters.')
  const nameErr = nameOk(display)
  if (nameErr) throw new Error(nameErr)
  if (isBlocked(username) || isBlocked(display)) throw new Error('That name is not allowed.')
  const existing = await findProfileByUsername(username)
  if (existing) throw new Error('That username is taken.')
  const pass = await hashPassword(password)
  const created = {
    id: crypto.randomUUID(),
    username,
    display,
    passwordHash: pass,
    role: 'user' as const,
  }
  const user = await createProfile(created)
  if (mysqlConfigured && mysql) {
    const remote = await findProfileByUsername(username)
    if (!remote) throw new Error('Account was created but could not be verified in the database. Please try logging in.')
    return setSession({ id: remote.id, username: remote.username, display: remote.display, avatarUrl: remote.avatarUrl, role: remote.role })
  }
  return setSession({ id: user.id, username: user.username, display: user.display, avatarUrl: user.avatarUrl, role: user.role })
}

export async function login(username: string, password: string) {
  username = String(username || '').trim().toLowerCase()
  const user = await findProfileByUsername(username)
  if (!user) throw new Error('Account not found.')

  if (user.banStatus === 'temporary' && user.banUntil && user.banUntil <= Date.now()) {
    const data = await loadData(true)
    const fresh = data.users.find(u => u.username === username)
    if (fresh) {
      await updateUserBan(fresh.id, { banStatus: 'active', banReason: '', banUntil: null })
    }
  }

  const freshProfile = await findProfileByUsername(username)
  const banMessage = banNotice(freshProfile)
  if (banMessage) throw new Error(banMessage)

  const pass = await hashPassword(password)
  if (user.passwordHash !== pass) throw new Error('Wrong password.')
  return setSession({ id: user.id, username: user.username, display: user.display, avatarUrl: user.avatarUrl, role: user.role === 'admin' ? 'admin' : 'user' })
}
