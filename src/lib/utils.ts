import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(ts: string | number) {
  return new Date(ts).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' })
}

export function safeSrc(url: string) {
  const u = String(url || '')
  if (/^https?:\/\//i.test(u) || u.startsWith('/images/') || u.startsWith('images/')) {
    return u.startsWith('images/') ? `/${u}` : u
  }
  return '/images/banner-default.svg'
}
