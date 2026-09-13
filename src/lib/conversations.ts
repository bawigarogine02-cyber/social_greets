import type { ChatMessage, Conversation, Profile } from './types'

export function pairUsers(a: string, b: string): [string, string] {
  return a < b ? [a, b] : [b, a]
}

export function findConversation(conversations: Conversation[], me: string, other: string) {
  const [userA, userB] = pairUsers(me, other)
  return conversations.find(c => c.userA === userA && c.userB === userB)
}

export function conversationsForUser(conversations: Conversation[], me: string) {
  return conversations
    .filter(c => c.kind === 'group' ? c.members?.includes(me) : c.userA === me || c.userB === me)
    .sort((a, b) => Number(b.pinnedBy?.includes(me)) - Number(a.pinnedBy?.includes(me)) || b.updatedAt - a.updatedAt)
}

export function otherParticipant(conv: Conversation, me: string) {
  if (conv.kind === 'group') return conv.title || 'Group conversation'
  return conv.userA === me ? conv.userB : conv.userA
}

export function isRecipient(conv: Conversation, me: string) {
  return conv.status === 'pending' && conv.requestedBy !== me
}

export function canSendMessages(conv: Conversation) {
  return conv.status === 'approved'
}

export function isBlocked(conv: Conversation, me: string) {
  return conv.blockedBy?.includes(me) || false
}

export function conversationLabel(conv: Conversation, users: Profile[], me: string) {
  if (conv.kind === 'group') return conv.title || 'Group conversation'
  return displayName(users, otherParticipant(conv, me))
}

export function messagesForConversation(messages: ChatMessage[], conversationId: string) {
  return messages.filter(m => m.conversationId === conversationId).sort((a, b) => a.createdAt - b.createdAt)
}

export function displayName(users: Profile[], username: string) {
  return users.find(u => u.username === username)?.display || username
}

export function lastMessagePreview(messages: ChatMessage[], conversationId: string) {
  const list = messagesForConversation(messages, conversationId)
  const last = list[list.length - 1]
  if (!last) return 'No messages yet'
  if (last.status === 'deleted') return 'Message deleted'
  if (last.imageUrl && !last.body) return 'Image'
  return last.body.length > 48 ? `${last.body.slice(0, 48)}…` : last.body
}
