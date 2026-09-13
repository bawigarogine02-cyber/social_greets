const DRAFT_KEY = 'sg_form_draft'

export interface FormDraft {
  page: string
  returnTo: string
  fields: Record<string, string | boolean>
  savedAt: number
}

export function saveFormDraft(page: string, returnTo: string, fields: Record<string, string | boolean>) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ page, returnTo, fields, savedAt: Date.now() }))
}

export function readFormDraft() {
  if (typeof window === 'undefined') return null
  try {
    return JSON.parse(window.localStorage.getItem(DRAFT_KEY) || 'null') as FormDraft | null
  } catch {
    return null
  }
}

export function clearFormDraft() {
  if (typeof window === 'undefined') return
  window.localStorage.removeItem(DRAFT_KEY)
}

export function getDraftReturnUrl() {
  return readFormDraft()?.returnTo || null
}
