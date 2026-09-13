import type { Notification } from './types'

export function visibleNotifications(notifications: Notification[], username?: string | null) {
  return notifications.filter(n => !n.toUsername || (!!username && n.toUsername === username))
}

export function globalNotifications(notifications: Notification[]) {
  return notifications.filter(n => !n.toUsername)
}

export function notificationLabel(kind: Notification['kind']) {
  if (kind === 'event') return 'Event'
  if (kind === 'friend') return 'Friend'
  if (kind === 'message') return 'Message'
  return 'Update'
}

export const PERSONAL_NOTIFICATION_KINDS = new Set<Notification['kind']>(['friend', 'message'])
