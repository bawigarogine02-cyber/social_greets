import type { Notification } from './types'
import { visibleNotifications } from './notifications'

const KEY = 'sg_seen_notes'
const MAX_IDS = 300

function storageKey(username?: string | null) {
  return username ? `${KEY}_${username}` : `${KEY}_guest`
}

export function readSeenIds(username?: string | null) {
  try {
    const raw = localStorage.getItem(storageKey(username))
    return new Set<string>(raw ? JSON.parse(raw) as string[] : [])
  } catch {
    return new Set<string>()
  }
}

export function markNotificationsSeen(username: string | null | undefined, ids: string[]) {
  if (!ids.length) return
  const seen = readSeenIds(username)
  ids.forEach(id => seen.add(id))
  localStorage.setItem(storageKey(username), JSON.stringify([...seen].slice(-MAX_IDS)))
}

export function unreadNotifications(notifications: Notification[], username?: string | null) {
  const seen = readSeenIds(username)
  return visibleNotifications(notifications, username).filter(n => !seen.has(n.id))
}

export function unreadCount(notifications: Notification[], username?: string | null) {
  return unreadNotifications(notifications, username).length
}
