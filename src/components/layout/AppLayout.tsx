'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom'
import { Bell, LogOut, UserPlus } from 'lucide-react'
import { ChatBubbleStack } from '@/components/chat/ChatBubbleStack'
import { UserAvatar } from '@/components/UserAvatar'
import { toast } from 'sonner'
import { notificationLabel, PERSONAL_NOTIFICATION_KINDS, visibleNotifications } from '@/lib/notifications'
import { markNotificationsSeen, readSeenIds, unreadCount } from '@/lib/seenNotifications'
import { ThemeFx } from './ThemeFx'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useTheme } from '@/contexts/ThemeContext'
import { formatDate, safeSrc } from '@/lib/utils'
import type { Theme } from '@/lib/types'
import { publicBannerGreetings } from '@/lib/users'

const navItems = [
  { to: '/', label: 'Home', icon: '/images/icon-home.svg' },
  { to: '/wall', label: 'Wall', icon: '/images/icon-wall.svg' },
  { to: '/greet', label: 'Create', icon: '/images/icon-create.svg' },
  { to: '/users', label: 'Users', icon: '/images/icon-users.svg', auth: true },
  { to: '/inbox', label: 'Inbox', icon: '/images/icon-inbox.svg', auth: true },
  { to: '/admin', label: 'Admin', icon: '/images/icon-admin.svg', admin: true },
]

const looks: { theme: Theme; look: string; title: string; src: string }[] = [
  { theme: 'joyful', look: 'joyful', title: 'Joyful', src: '/images/look-joyful.svg' },
  { theme: 'snow', look: 'snow', title: 'Snow Flakes', src: '/images/look-snow.svg' },
  { theme: 'autumn', look: 'autumn', title: 'Autumn', src: '/images/look-autumn.svg' },
  { theme: 'joyful', look: 'default', title: 'Default', src: '/images/look-default.svg' },
]

export function AppLayout() {
  const { session, logout, isAdmin } = useAuth()
  const { data, error: dbError } = useData()
  const { look, setTheme } = useTheme()
  const navigate = useNavigate()
  const [notifyOpen, setNotifyOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [seenTick, setSeenTick] = useState(0)
  const bellRef = useRef<HTMLButtonElement>(null)
  const dropRef = useRef<HTMLDivElement>(null)

  const requestCount = useMemo(() => {
    if (!session) return 0
    return (data?.friends || []).filter(f => f.status === 'pending' && f.to === session.username).length
  }, [data?.friends, session])

  const unreadChatCount = useMemo(() => {
    if (!session || !data) return 0
    try {
      const raw = localStorage.getItem(`sg_seen_chats_${session.username}`)
      const seenMap = raw ? JSON.parse(raw) as Record<string, number> : {}
      const ids = new Set<string>()
      for (const message of data.chatMessages) {
        if (message.fromUsername === session.username) continue
        const last = data.chatMessages.filter(item => item.conversationId === message.conversationId).sort((a, b) => b.createdAt - a.createdAt)[0]
        if (!last || last.id !== message.id) continue
        if ((seenMap[message.conversationId] || 0) < last.createdAt) ids.add(message.conversationId)
      }
      return ids.size
    } catch {
      return 0
    }
  }, [data, session])

  const notes = useMemo(() => visibleNotifications(data?.notifications || [], session?.username).slice().sort((a, b) => b.createdAt - a.createdAt), [data?.notifications, session?.username])
  const unreadNotes = useMemo(() => {
    void seenTick
    return unreadCount(data?.notifications || [], session?.username)
  }, [data?.notifications, session?.username, seenTick])
  const toastedNotes = useRef<Set<string>>(new Set())

  useEffect(() => {
    if (!session || !data) return
    const seen = readSeenIds(session.username)
    notes.filter(n => PERSONAL_NOTIFICATION_KINDS.has(n.kind) && !seen.has(n.id)).forEach(n => {
      if (toastedNotes.current.has(n.id)) return
      toastedNotes.current.add(n.id)
      toast.info(n.title, { description: n.message })
    })
  }, [notes, session, data])

  useEffect(() => {
    if (!notifyOpen || !notes.length) return
    markNotificationsSeen(session?.username, notes.map(n => n.id))
    setSeenTick(t => t + 1)
  }, [notifyOpen, notes, session?.username])
  const banner = useMemo(() => {
    const list = data?.banners || []
    if (!list.length) return null
    return list[Math.floor(Date.now() / 12000) % list.length]
  }, [data?.banners])
  const latestBannerGreeting = useMemo(() => {
    if (!data) return undefined
    return publicBannerGreetings(data.greetings, data.users)[0]
  }, [data])

  useEffect(() => {
    if (!notifyOpen || !bellRef.current || !dropRef.current) return
    const r = bellRef.current.getBoundingClientRect()
    const drop = dropRef.current
    const pad = 12
    const w = drop.offsetWidth || 360
    const h = drop.offsetHeight || 320
    let top = Math.round(r.top)
    let left = Math.round(r.right + 10)
    if (left + w > window.innerWidth - pad) left = Math.round(r.left - w - 10)
    if (left < pad) left = pad
    if (top + h > window.innerHeight - pad) top = Math.max(pad, window.innerHeight - h - pad)
    drop.style.top = `${top}px`
    drop.style.left = `${left}px`
  }, [notifyOpen])

  useEffect(() => {
    const close = (e: MouseEvent) => {
      if (!notifyOpen) return
      const t = e.target as Node
      if (bellRef.current?.contains(t) || dropRef.current?.contains(t)) return
      setNotifyOpen(false)
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [notifyOpen])

  return (
    <div className="relative min-h-screen">
      <ThemeFx />
      <div id="banner" className="fixed inset-y-0 left-0 z-40 hidden w-[88px] border-r bg-card/95 backdrop-blur md:block">
        <div className="wrapper flex h-full flex-col items-center py-4">
          <div className="banner_con flex h-full w-full flex-col items-center">
            <Link to="/" className="logo mb-6 flex flex-col items-center gap-2 text-center">
              <figure><img src="/images/logo.svg" alt="Social Greetings logo" className="h-10 w-10" /></figure>
              <span className="text-[10px] font-semibold leading-tight">Social Greetings</span>
            </Link>
            <nav id="mainnav" className="flex flex-1 flex-col items-center gap-2">
              {navItems.map(item => {
                if (item.auth && !session) return null
                if (item.admin && !isAdmin) return null
                return (
                  <NavLink key={item.to} to={item.to} className={({ isActive }) => `relative flex w-full flex-col items-center gap-1 rounded-lg px-2 py-3 text-[11px] transition hover:bg-accent ${isActive ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground'}`}>
                    <figure className="relative">
                      <img src={item.icon} alt="" className="sidebar-icon h-6 w-6" />
                      {item.to === '/users' && requestCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">{requestCount}</span>}
                      {item.to === '/inbox' && unreadChatCount > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">{unreadChatCount}</span>}
                    </figure>
                    <span>{item.label}</span>
                  </NavLink>
                )
              })}
              {session && (
                <NavLink to="/profile" className={({ isActive }) => `flex w-full flex-col items-center gap-1 rounded-lg px-2 py-3 text-[11px] transition hover:bg-accent ${isActive ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground'}`}>
                  <UserAvatar src={session.avatarUrl} name={session.display || session.username} size="sm" />
                  <span>Profile</span>
                </NavLink>
              )}
              {session ? (
                <button type="button" ref={bellRef} onClick={() => setNotifyOpen(v => !v)} className={`relative flex w-full flex-col items-center gap-1 rounded-lg px-2 py-3 text-[11px] transition hover:bg-accent ${notifyOpen ? 'bg-accent font-semibold text-primary' : 'text-muted-foreground'}`}>
                  <figure className="relative">
                    <Bell className="sidebar-icon-svg h-6 w-6" />
                    {unreadNotes > 0 && <span className="absolute -right-2 -top-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-destructive px-1 text-[10px] text-white">{unreadNotes}</span>}
                  </figure>
                  <span>Notices</span>
                </button>
              ) : (
                <NavLink to="/login" className="flex w-full flex-col items-center gap-1 rounded-lg px-2 py-3 text-[11px] text-muted-foreground transition hover:bg-accent">
                  <figure><img src="/images/icon-login.svg" alt="" className="sidebar-icon h-6 w-6" /></figure>
                  <span>Login</span>
                </NavLink>
              )}
              {session && (
                <button type="button" onClick={() => setLogoutOpen(true)} className="flex w-full flex-col items-center gap-1 rounded-lg px-2 py-3 text-[11px] text-muted-foreground transition hover:bg-accent">
                  <LogOut className="sidebar-icon-svg h-6 w-6" />
                  <span>Logout</span>
                </button>
              )}
            </nav>
            <div className="theme_bar mt-4 flex flex-col items-center gap-2">
              <span className="text-[10px] text-muted-foreground">Look</span>
              {looks.map(item => (
                <button key={item.look} type="button" title={item.title} aria-label={item.title} onClick={() => setTheme(item.theme, item.look)} className={`rounded-lg p-1 transition ${look === item.look ? 'ring-2 ring-primary' : 'opacity-70 hover:opacity-100'}`}>
                  <figure><img src={item.src} alt={item.title} className="sidebar-icon h-7 w-7" /></figure>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div ref={dropRef} id="notifyDrop" className={`notify_drop fixed z-50 w-[min(360px,calc(100vw-24px))] rounded-xl border bg-popover shadow-xl ${notifyOpen ? 'block' : 'hidden'}`}>
        <div className="notify_head border-b px-4 py-3"><h4 className="font-semibold">Notices</h4></div>
        <div id="noteList" className="note_list max-h-80 overflow-auto p-3">
          {notes.length ? notes.map(n => {
            void seenTick
            const unread = !readSeenIds(session?.username).has(n.id)
            return (
            <article key={n.id} className={`note_item mb-3 rounded-lg border p-3 last:mb-0 ${unread ? 'border-primary/40 bg-primary/5' : 'opacity-80'}`}>
              <strong>{n.title}</strong>
              <div className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
                <Badge variant="outline">{notificationLabel(n.kind)}</Badge>
                <span>{formatDate(n.createdAt)}</span>
              </div>
              <p className="mt-2 text-sm">{n.message}</p>
              {n.actionUrl && <Link to={n.actionUrl} onClick={() => setNotifyOpen(false)} className="mt-3 inline-flex text-sm font-semibold text-primary underline">Change password</Link>}
              {n.kind === 'friend' && n.title === 'New friend request' && (
                <Button type="button" size="sm" className="mt-3" onClick={() => { setNotifyOpen(false); navigate('/users?requests=1') }}>
                  View request
                </Button>
              )}
            </article>
          )}) : <p className="note_empty text-sm text-muted-foreground">No notices yet.</p>}
        </div>
      </div>

      <div className="md:pl-[88px]">
        {dbError && (
          <div className="border-b border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            <strong>Database error:</strong> {dbError}
          </div>
        )}
        <div id="middle" className="border-b bg-card/70">
          <div className="wrapper mx-auto max-w-6xl px-4 py-3">
            <div className="middle_con flex flex-col gap-3">
              <div id="promoBanners">
                {banner && (
                  <Link to={banner.link.startsWith('javascript:') ? '/greet' : banner.link} className="promo_slide block overflow-hidden rounded-xl border">
                    <figure className="min-h-40 bg-card sm:min-h-48"><img src={safeSrc(banner.image)} alt={banner.title} className="h-auto min-h-40 w-full object-contain sm:min-h-48" /></figure>
                  </Link>
                )}
              </div>
              <div id="liveGreetBanner">
                {latestBannerGreeting && (
                  <div className="live_greet rounded-lg border bg-accent/40 px-4 py-3 text-sm">
                    <Badge variant="secondary" className="mr-2">Bannered</Badge>
                    <strong>To {latestBannerGreeting.to}</strong> from {latestBannerGreeting.from} — {latestBannerGreeting.message}
                  </div>
                )}
              </div>
              <nav className="subnav flex gap-2">
                <Button asChild variant="outline" size="sm"><Link to="/greet">New Greeting</Link></Button>
                {session && <Button asChild variant="outline" size="sm"><Link to="/inbox">Messages</Link></Button>}
              </nav>
            </div>
          </div>
        </div>

        <div id="main" className="relative z-10">
          <div className="wrapper mx-auto max-w-6xl px-4 py-6">
            <Outlet />
          </div>
        </div>

        <div id="bottom1" className="border-t bg-card/50">
          <div className="wrapper mx-auto max-w-6xl px-4 py-8">
            <div className="btm1_con">
              <div className="btm1_info mb-6 text-center">
                <h2 className="text-xl font-semibold">Why people love it here</h2>
                <p className="mt-2 text-muted-foreground">Kind words, playful themes, and a wall that keeps the good vibes rolling.</p>
              </div>
              <div className="btm1_boxes grid gap-4 md:grid-cols-3">
                <section className="rounded-xl border bg-background p-4 text-center"><figure className="mb-3 flex justify-center"><img src="/images/feature-send.svg" alt="" className="h-12 w-12" /></figure><h3 className="font-semibold">Send smiles</h3><p className="mt-1 text-sm text-muted-foreground">Banner a public hello or send a private note.</p></section>
                <section className="rounded-xl border bg-background p-4 text-center"><figure className="mb-3 flex justify-center"><img src="/images/feature-friends.svg" alt="" className="h-12 w-12" /></figure><h3 className="font-semibold">Find friends</h3><p className="mt-1 text-sm text-muted-foreground">Connect and greet the people you care about.</p></section>
                <section className="rounded-xl border bg-background p-4 text-center"><figure className="mb-3 flex justify-center"><img src="/images/feature-themes.svg" alt="" className="h-12 w-12" /></figure><h3 className="font-semibold">Pick a look</h3><p className="mt-1 text-sm text-muted-foreground">Joyful sparks, snow, or autumn leaves.</p></section>
              </div>
            </div>
          </div>
        </div>

        <div id="footer" className="border-t py-4 text-center text-sm text-muted-foreground">
          <div className="wrapper mx-auto max-w-6xl px-4">Social Greetings · Be kind online</div>
        </div>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 flex border-t bg-card/95 backdrop-blur md:hidden">
        {navItems.filter(i => !i.admin).slice(0, session ? 4 : 3).map(item => {
          if (item.auth && !session) return null
          return (
            <NavLink key={item.to} to={item.to} className={({ isActive }) => `flex flex-1 flex-col items-center gap-1 py-2 text-[10px] ${isActive ? 'text-primary' : 'text-muted-foreground'}`}>
              <img src={item.icon} alt="" className="h-5 w-5" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
        {!session ? (
          <NavLink to="/register" className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground">
            <UserPlus className="h-5 w-5" />
            <span>Join</span>
          </NavLink>
        ) : (
          <NavLink to="/profile" className="flex flex-1 flex-col items-center gap-1 py-2 text-[10px] text-muted-foreground">
            <UserAvatar src={session.avatarUrl} name={session.display || session.username} size="sm" className="h-5 w-5 text-[10px]" />
            <span>Profile</span>
          </NavLink>
        )}
      </nav>

      {session && <ChatBubbleStack />}

      {!session && (
        <Card className="fixed bottom-16 right-4 z-30 hidden max-w-xs p-3 text-sm shadow-lg md:block">
          <p className="mb-2">Sign up to send greetings and connect with friends.</p>
          <Button size="sm" onClick={() => navigate('/register')}>Create account</Button>
        </Card>
      )}

      <ConfirmDialog
        open={logoutOpen}
        title="Log out?"
        message="You will need to sign in again to view your inbox and private greetings."
        okText="Log out"
        cancelText="Stay logged in"
        destructive
        onCancel={() => setLogoutOpen(false)}
        onConfirm={() => { logout(); setLogoutOpen(false); toast.success('Logged out'); navigate('/login') }}
      />
    </div>
  )
}
