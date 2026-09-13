export type Role = 'admin' | 'user'
export type UserBanStatus = 'active' | 'temporary' | 'permanent'
export type GreetingType = 'banner' | 'private'
export type FriendStatus = 'pending' | 'accepted'
export type ConversationStatus = 'pending' | 'approved' | 'declined'
export type Theme = 'joyful' | 'snow' | 'autumn'
export type NotificationKind = 'event' | 'change' | 'friend' | 'message'
export type PasswordRequestStatus = 'pending' | 'approved' | 'denied' | 'used'
export type MessageStatus = 'sent' | 'deleted'

export interface Profile {
  id: string
  username: string
  display: string
  avatarUrl?: string
  passwordHash?: string
  role: Role
  createdAt: number
  banStatus?: UserBanStatus
  banReason?: string
  banUntil?: number | null
}

export interface SessionUser {
  id: string
  username: string
  display: string
  avatarUrl?: string
  role: Role
}

export interface Greeting {
  id: string
  from: string
  to: string
  message: string
  type: GreetingType
  fromId?: string
  mediaUrl?: string
  mediaType?: 'image' | 'video'
  createdAt: number
}

export interface BannerReaction {
  emoji: string
  count: number
}

export interface BannerCommentReply {
  id: string
  author: string
  body: string
  createdAt: number
  reactions?: BannerReaction[]
  status?: 'active' | 'removed'
  removedAt?: number
  replies?: BannerCommentReply[]
}

export interface BannerComment {
  id: string
  author: string
  body: string
  createdAt: number
  reactions?: BannerReaction[]
  status?: 'active' | 'removed'
  removedAt?: number
  replies: BannerCommentReply[]
}

export interface Banner {
  id: string
  title: string
  image: string
  link: string
  reactions?: BannerReaction[]
  comments?: BannerComment[]
}

export interface Friend {
  id: string
  from: string
  to: string
  status: FriendStatus
  createdAt: number
}

export interface Conversation {
  id: string
  userA: string
  userB: string
  requestedBy: string
  status: ConversationStatus
  kind?: 'direct' | 'group'
  title?: string
  groupAvatarUrl?: string
  pinnedBy?: string[]
  blockedBy?: string[]
  members?: string[]
  createdAt: number
  updatedAt: number
}

export interface ChatMessage {
  id: string
  conversationId: string
  fromUsername: string
  body: string
  imageUrl?: string
  mediaType?: 'image' | 'video'
  status?: MessageStatus
  deletedAt?: number
  createdAt: number
}

export interface Notification {
  id: string
  kind: NotificationKind
  title: string
  message: string
  toUsername?: string | null
  actionUrl?: string
  createdAt: number
}

export interface PasswordRequest {
  id: string
  username: string
  status: PasswordRequestStatus
  createdAt: number
  approvedAt?: number
  expiresAt?: number
}

export interface SiteSettings {
  theme: Theme
  celebration: {
    enabled: boolean
    title: string
    message: string
    date: string
  }
}

export interface AppData {
  users: Profile[]
  greetings: Greeting[]
  banners: Banner[]
  friends: Friend[]
  conversations: Conversation[]
  chatMessages: ChatMessage[]
  notifications: Notification[]
  settings: SiteSettings
}
