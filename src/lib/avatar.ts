import type { Profile } from './types'

const MAX_AVATAR_BYTES = 2 * 1024 * 1024
const MAX_VIDEO_BYTES = 100 * 1024 * 1024

export function avatarInitial(name: string) {
  return String(name || '?').slice(0, 1).toUpperCase()
}

export function resolveAvatarUrl(avatarUrl?: string | null) {
  const url = String(avatarUrl || '').trim()
  if (!url) return ''
  if (url.startsWith('data:image/') || url.startsWith('http://') || url.startsWith('https://') || url.startsWith('/')) return url
  return `/images/${url.replace(/^images\//, '')}`
}

export function avatarForUser(users: Profile[], username: string, fallbackDisplay?: string) {
  const user = users.find(u => u.username === username)
  const url = resolveAvatarUrl(user?.avatarUrl)
  const label = user?.display || fallbackDisplay || username
  return { url, initial: avatarInitial(label), label }
}

export async function uploadAvatar(file: File) {
  if (!file.type.startsWith('image/')) throw new Error('Please choose an image file.')
  if (file.size > MAX_AVATAR_BYTES) throw new Error('Image must be 2 MB or smaller.')
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/uploads/avatar', { method: 'POST', body: formData })
  const result = await response.json() as { url?: string; error?: string }
  if (!response.ok || !result.url) throw new Error(result.error || 'Could not save that image.')
  return result.url
}

export async function uploadMessageImage(file: File) {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Please choose an image, GIF, or video file.')
  if (file.type.startsWith('video/') && file.size > MAX_VIDEO_BYTES) throw new Error('Video must be 100 MB or smaller.')
  const formData = new FormData()
  formData.append('file', file)
  const response = await fetch('/api/uploads/message', { method: 'POST', body: formData })
  const result = await response.json() as { url?: string; mediaType?: 'image' | 'video'; error?: string }
  if (!response.ok || !result.url) throw new Error(result.error || 'Could not save that image.')
  return { url: result.url, mediaType: result.mediaType || 'image' }
}

export async function uploadBannerMedia(file: File) {
  if (!file.type.startsWith('image/') && !file.type.startsWith('video/')) throw new Error('Please choose an image, GIF, or video file.')
  if (file.type.startsWith('video/') && file.size > MAX_VIDEO_BYTES) throw new Error('Video must be 100 MB or smaller.')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('scope', 'banner')
  const response = await fetch('/api/uploads/message', { method: 'POST', body: formData })
  const result = await response.json() as { url?: string; mediaType?: 'image' | 'video'; error?: string }
  if (!response.ok || !result.url) throw new Error(result.error || 'Could not save that banner media.')
  return { url: result.url, mediaType: result.mediaType || 'image' }
}
