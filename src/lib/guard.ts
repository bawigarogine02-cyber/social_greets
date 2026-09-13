import { isBlocked } from './filter'
import type { AppData, Greeting } from './types'

const COOLDOWN_MS = 20000
const LAST_KEY = 'sg_last_send'
const HASH_KEY = 'sg_last_hash'

let inflight = false

function fingerprint(text: string) {
  return String(text || '').trim().toLowerCase().replace(/\s+/g, ' ')
}

export function danger(text: string, allowUrl = false) {
  const t = String(text || '')
  if (/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F\u202A-\u202E\u2066-\u2069]/.test(t)) return 'That text has hidden characters.'
  if (/<\s*\/?\s*(script|iframe|object|embed|link|meta|svg|form|img|video|audio|base|style|html|body)/i.test(t)) return 'HTML and scripts are not allowed.'
  if (/javascript\s*:|vbscript\s*:|data\s*:|file\s*:/i.test(t)) return 'That content looks unsafe.'
  if (/on(error|load|click|mouseover|focus|submit|pointer|touchstart)\s*=/i.test(t)) return 'That content looks unsafe.'
  if (!allowUrl && /(https?:\/\/|www\.|\/\/)\S+/i.test(t)) return 'Links are not allowed.'
  if (/\.(exe|bat|cmd|msi|scr|js|vbs|ps1|apk|dll|jar|iso)(\b|$)/i.test(t)) return 'That file-like text is not allowed.'
  if (/(.)\1{14,}/.test(t)) return 'That looks like spam.'
  return null
}

export function nameOk(value: string) {
  const n = String(value || '').trim().replace(/\s+/g, ' ')
  if (n.length < 2 || n.length > 40) return 'Use a name between 2 and 40 characters.'
  if (!/^[\p{L}\p{N} _.'-]+$/u.test(n)) return 'Names can only use letters, numbers, spaces, and . _ \' -'
  if (isBlocked(n)) return 'That name is not allowed.'
  return danger(n, false)
}

export function messageOk(value: string) {
  const m = String(value || '').trim()
  if (m.length < 2 || m.length > 280) return 'Write a message between 2 and 280 characters.'
  if (isBlocked(m)) return 'That greeting uses words we do not allow. Please keep it kind.'
  return danger(m, false)
}

export function waitMs() {
  const last = Number(localStorage.getItem(LAST_KEY) || 0)
  return Math.max(0, COOLDOWN_MS - (Date.now() - last))
}

export function isBusy() {
  return inflight
}

export function checkPayload(from: string, to: string, message: string, data: AppData, fromId?: string) {
  const fromErr = nameOk(from)
  if (fromErr) return fromErr
  const toErr = nameOk(to)
  if (toErr) return toErr
  const msgErr = messageOk(message)
  if (msgErr) return msgErr
  const sig = fingerprint(`${from}|${to}|${message}`)
  if (sig && localStorage.getItem(HASH_KEY) === sig) return 'That exact greeting was just sent.'
  const now = Date.now()
  const mine = (data.greetings || []).filter(g => (fromId && g.fromId === fromId) || fingerprint(g.from) === fingerprint(from))
  const last = mine.sort((a, b) => b.createdAt - a.createdAt)[0]
  if (last && now - last.createdAt < COOLDOWN_MS) return 'Please wait. Only one greeting at a time.'
  if (last && fingerprint(`${last.to}${last.message}`) === fingerprint(`${to}${message}`) && now - last.createdAt < 120000) return 'That exact greeting was just sent.'
  return null
}

export function checkSend(from: string, to: string, message: string, data: AppData, fromId?: string) {
  const fromErr = nameOk(from)
  if (fromErr) return fromErr
  const toErr = nameOk(to)
  if (toErr) return toErr
  const msgErr = messageOk(message)
  if (msgErr) return msgErr
  if (isBusy()) return 'Please wait. Only one greeting at a time.'
  const left = waitMs()
  if (left > 0) return `Please wait ${Math.ceil(left / 1000)}s before sending another greeting.`
  return checkPayload(from, to, message, data, fromId)
}

export function markSent(from: string, to: string, message: string) {
  localStorage.setItem(LAST_KEY, String(Date.now()))
  localStorage.setItem(HASH_KEY, fingerprint(`${from}|${to}|${message}`))
}

export async function oneAtATime<T>(fn: () => Promise<T>) {
  if (isBusy()) throw new Error('Please wait. Only one action at a time.')
  inflight = true
  try { return await fn() }
  finally { inflight = false }
}

export function mineGreetings(greetings: Greeting[], session: { id: string; username: string; display: string }) {
  return greetings.filter(g =>
    g.fromId === session.id ||
    g.from.toLowerCase() === session.username ||
    g.from === session.display
  )
}
