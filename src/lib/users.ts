import type { Friend, Greeting, Profile } from './types'

export const HIDDEN_USERNAMES = new Set(['riogen02', 'demo', 'admin'])

export function isHiddenUser(username: string) {
  return HIDDEN_USERNAMES.has(username.toLowerCase())
}

export function publicProfiles(users: Profile[]) {
  return users.filter(u => !isHiddenUser(u.username))
}

export function isPublicGreeting(greeting: Greeting, users: Profile[]) {
  if (greeting.type !== 'banner') return false
  if (greeting.fromId) {
    const sender = users.find(u => u.id === greeting.fromId)
    if (sender && isHiddenUser(sender.username)) return false
  }
  const sender = users.find(u =>
    u.username.toLowerCase() === greeting.from.toLowerCase() ||
    u.display.toLowerCase() === greeting.from.toLowerCase()
  )
  if (sender && isHiddenUser(sender.username)) return false
  return true
}

export function areFriends(friends: Friend[], userA: string, userB: string) {
  return friends.some(f =>
    f.status === 'accepted' &&
    ((f.from === userA && f.to === userB) || (f.from === userB && f.to === userA))
  )
}

export function receiverWantedConversation(friends: Friend[], greetings: Greeting[], users: Profile[], receiver: string, sender: string) {
  if (areFriends(friends, receiver, sender)) return true
  if (friends.some(f => f.status === 'pending' && f.from === receiver && f.to === sender)) return true
  return greetings.some(g => {
    if (g.type !== 'private' || g.to.toLowerCase() !== sender.toLowerCase()) return false
    const fromUser = g.fromId ? users.find(u => u.id === g.fromId) : undefined
    const fromUsername = fromUser?.username.toLowerCase() ?? g.from.toLowerCase()
    return fromUsername === receiver.toLowerCase()
  })
}

export function publicBannerGreetings(greetings: Greeting[], users: Profile[]) {
  return greetings
    .filter(g => g.type === 'banner')
    .filter(g => isPublicGreeting(g, users))
    .sort((a, b) => b.createdAt - a.createdAt)
}
