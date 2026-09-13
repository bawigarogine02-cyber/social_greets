const blocked = [
  'nigger', 'nigga', 'niggaz', 'niggers', 'niggah', 'nigg',
  'faggot', 'faggots', 'fag', 'fags',
  'retard', 'retarded', 'retards',
  'kike', 'spic', 'chink', 'gook', 'coon', 'wetback', 'paki',
  'tranny', 'shemale', 'troon',
  'cunt', 'cunts',
  'kys', 'kill yourself', 'kill himself', 'kill herself',
]

const leet: Record<string, string> = { '0': 'o', '1': 'i', '3': 'e', '4': 'a', '5': 's', '7': 't', '8': 'b', '@': 'a', '$': 's', '!': 'i' }

function normalize(text: string) {
  return String(text || '').toLowerCase().replace(/[0134578@$!]/g, ch => leet[ch] || ch)
}

function compact(text: string) {
  return normalize(text).replace(/[^a-z]+/g, '')
}

function words(text: string) {
  return normalize(text).split(/[^a-z]+/).filter(Boolean)
}

export function isBlocked(text: string) {
  const list = words(text)
  if (list.includes('ts')) return true
  if (blocked.some(w => list.includes(w))) return true
  const glued = compact(text)
  return blocked.some(w => {
    const key = w.replace(/\s+/g, '')
    return key.length >= 5 && glued.includes(key)
  })
}
