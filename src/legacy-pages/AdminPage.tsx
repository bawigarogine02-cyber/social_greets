import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { useTheme } from '@/contexts/ThemeContext'
import { addBanner, addNotification, approvePasswordRequest, deleteBanner, deleteGreeting, denyPasswordRequest, listPasswordRequests, resetDatabase, updateSettings, updateUserBan } from '@/lib/db'
import { mysqlConfigured } from '@/lib/mysql'
import { danger } from '@/lib/guard'
import { isBlocked } from '@/lib/filter'
import { safeSrc } from '@/lib/utils'
import type { Theme, UserBanStatus } from '@/lib/types'

export function AdminPage() {
  const { logout } = useAuth()
  const { data, refresh } = useData()
  const { setTheme } = useTheme()
  const navigate = useNavigate()
  const [resetOpen, setResetOpen] = useState(false)
  const [theme, setThemeValue] = useState<Theme>('joyful')
  const [celeTitle, setCeleTitle] = useState('')
  const [celeMessage, setCeleMessage] = useState('')
  const [celeDate, setCeleDate] = useState('')
  const [bannerTitle, setBannerTitle] = useState('')
  const [bannerImage, setBannerImage] = useState('')
  const [bannerLink, setBannerLink] = useState('/greet')
  const [noteTitle, setNoteTitle] = useState('')
  const [noteMessage, setNoteMessage] = useState('')
  const [noteKind, setNoteKind] = useState<'event' | 'change'>('change')
  const [banStatusByUser, setBanStatusByUser] = useState<Record<string, UserBanStatus>>({})
  const [banReasonByUser, setBanReasonByUser] = useState<Record<string, string>>({})
  const [banUntilByUser, setBanUntilByUser] = useState<Record<string, string>>({})
  const [passwordRequests, setPasswordRequests] = useState<{ id: string; username: string; status: string; createdAt: number }[]>([])

  useEffect(() => {
    if (!data) return
    setThemeValue(data.settings.theme)
    setCeleTitle(data.settings.celebration.title)
    setCeleMessage(data.settings.celebration.message)
    setCeleDate(data.settings.celebration.date)
    const nextStatus: Record<string, UserBanStatus> = {}
    const nextReason: Record<string, string> = {}
    const nextUntil: Record<string, string> = {}
    for (const user of data.users) {
      nextStatus[user.id] = user.banStatus || 'active'
      nextReason[user.id] = user.banReason || ''
      nextUntil[user.id] = user.banUntil ? new Date(user.banUntil).toISOString().slice(0, 16) : ''
    }
    setBanStatusByUser(nextStatus)
    setBanReasonByUser(nextReason)
    setBanUntilByUser(nextUntil)
    listPasswordRequests().then(setPasswordRequests).catch(() => undefined)
  }, [data])

  if (!data) return null

  const saveTheme = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      await updateSettings({ theme })
      setTheme(theme)
      toast.success('Site look updated')
      await refresh(true)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed') }
  }

  const saveCelebration = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isBlocked(celeTitle) || isBlocked(celeMessage) || danger(celeTitle) || danger(celeMessage)) {
      toast.error('Please keep celebration text kind and safe.')
      return
    }
    if (!celeTitle.trim()) { toast.error('Add a celebration title first.'); return }
    try {
      await updateSettings({ celebration: { enabled: true, title: celeTitle.trim(), message: celeMessage.trim(), date: celeDate } })
      toast.success('Celebration saved for everyone')
      await refresh(true)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed') }
  }

  const submitBanner = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = bannerTitle.trim()
    const image = bannerImage.trim()
    const link = bannerLink.trim() || '/greet'
    if (!title || !image) { toast.error('Title and image are required.'); return }
    if (isBlocked(title) || danger(title)) { toast.error('That banner title is not allowed.'); return }
    if (danger(image, true) || danger(link, true)) { toast.error('That banner looks unsafe.'); return }
    const src = safeSrc(image)
    if (src === '/images/banner-default.svg' && !image.startsWith('images/') && !image.startsWith('/images/') && !/^https?:\/\//i.test(image)) {
      toast.error('That banner looks unsafe.')
      return
    }
    if (link.toLowerCase().startsWith('javascript:')) { toast.error('That banner looks unsafe.'); return }
    try {
      await addBanner({ title, image: src, link })
      setBannerTitle('')
      setBannerImage('')
      setBannerLink('/greet')
      toast.success('Banner added for everyone')
      await refresh(true)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed') }
  }

  const submitNote = async (e: React.FormEvent) => {
    e.preventDefault()
    const title = noteTitle.trim()
    const message = noteMessage.trim()
    if (!title || !message) { toast.error('Write a title and message.'); return }
    if (isBlocked(title) || isBlocked(message) || danger(title) || danger(message)) {
      toast.error('That notice is not allowed.')
      return
    }
    try {
      await addNotification({ kind: noteKind, title, message })
      setNoteTitle('')
      setNoteMessage('')
      toast.success('Everyone will see this notice')
      await refresh(true)
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Save failed') }
  }

  const resetAll = async () => {
    try {
      await resetDatabase()
      logout()
      toast.success('Database reset')
      navigate('/login')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Reset failed')
    }
  }

  const saveBan = async (userId: string) => {
    const status = banStatusByUser[userId] || 'active'
    const reason = (banReasonByUser[userId] || '').trim()
    const untilValue = banUntilByUser[userId]
    const until = status === 'temporary' && untilValue ? new Date(untilValue).getTime() : null
    try {
      await updateUserBan(userId, { banStatus: status, banReason: reason, banUntil: status === 'temporary' ? until : null })
      toast.success(status === 'active' ? 'Ban cleared' : status === 'temporary' ? 'Temporary ban saved' : 'Permanent ban saved')
      await refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update ban')
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Admin</h1>
      {!mysqlConfigured && (
        <Alert className="mb-4 border-amber-500/50 bg-amber-50"><AlertDescription>Add VITE_MYSQL_HOST, VITE_MYSQL_DATABASE, VITE_MYSQL_USER, and VITE_MYSQL_PASSWORD to .env for shared cloud data. Until then, data stays in this browser only.</AlertDescription></Alert>
      )}
      <Tabs defaultValue="ui">
        <TabsList className="admin_tabs flex h-auto flex-wrap">
          <TabsTrigger value="ui">UI</TabsTrigger>
          <TabsTrigger value="cele">Celebration</TabsTrigger>
          <TabsTrigger value="banners">Banners</TabsTrigger>
          <TabsTrigger value="notify">Notify</TabsTrigger>
          <TabsTrigger value="moderate">Moderate</TabsTrigger>
          <TabsTrigger value="database">Database</TabsTrigger>
        </TabsList>

        <TabsContent value="ui">
          <Card><CardContent className="p-6">
            <form id="uiForm" onSubmit={saveTheme} className="space-y-4 max-w-md">
              <div><Label htmlFor="theme">Default site theme</Label>
                <select id="theme" name="theme" value={theme} onChange={e => setThemeValue(e.target.value as Theme)} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="joyful">Joyful</option>
                  <option value="snow">Snow</option>
                  <option value="autumn">Autumn</option>
                </select>
              </div>
              <Button type="submit">Save look</Button>
            </form>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="cele">
          <Card><CardContent className="p-6">
            <form id="celeForm" onSubmit={saveCelebration} className="space-y-4 max-w-md">
              <div><Label htmlFor="celeTitle">Title</Label><Input id="celeTitle" value={celeTitle} onChange={e => setCeleTitle(e.target.value)} /></div>
              <div><Label htmlFor="celeMessage">Message</Label><Textarea id="celeMessage" value={celeMessage} onChange={e => setCeleMessage(e.target.value)} /></div>
              <div><Label htmlFor="celeDate">When (optional)</Label><Input id="celeDate" value={celeDate} onChange={e => setCeleDate(e.target.value)} /></div>
              <Button type="submit">Save celebration</Button>
            </form>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="banners">
          <Card className="mb-4"><CardHeader><CardTitle>Add banner</CardTitle></CardHeader><CardContent>
            <form id="bannerForm" onSubmit={submitBanner} className="grid gap-4 md:grid-cols-2">
              <div><Label>Title</Label><Input value={bannerTitle} onChange={e => setBannerTitle(e.target.value)} /></div>
              <div><Label>Image URL or path</Label><Input value={bannerImage} onChange={e => setBannerImage(e.target.value)} placeholder="/images/banner-default.svg" /></div>
              <div className="md:col-span-2"><Label>Link</Label><Input value={bannerLink} onChange={e => setBannerLink(e.target.value)} /></div>
              <Button type="submit">Add banner</Button>
            </form>
          </CardContent></Card>
          <div id="bannerList" className="grid gap-4 md:grid-cols-2">
            {(data.banners || []).length ? data.banners.map(b => (
              <Card key={b.id}>
                <CardContent className="p-4">
                  <p className="font-semibold">{b.title}</p>
                  <figure className="my-3 overflow-hidden rounded-lg"><img src={safeSrc(b.image)} alt={b.title} className="max-h-40 w-full object-cover" /></figure>
                  <Button variant="destructive" size="sm" onClick={async () => { await deleteBanner(b.id); toast.success('Removed'); await refresh(true) }}>Remove</Button>
                </CardContent>
              </Card>
            )) : <p className="text-muted-foreground">No extra banners yet.</p>}
          </div>
        </TabsContent>

        <TabsContent value="notify">
          <Card><CardContent className="p-6">
            <form id="noteForm" onSubmit={submitNote} className="space-y-4 max-w-md">
              <div><Label>Kind</Label>
                <select value={noteKind} onChange={e => setNoteKind(e.target.value as 'event' | 'change')} className="mt-1 flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
                  <option value="change">Update</option>
                  <option value="event">Event</option>
                </select>
              </div>
              <div><Label>Title</Label><Input value={noteTitle} onChange={e => setNoteTitle(e.target.value)} /></div>
              <div><Label>Message</Label><Textarea value={noteMessage} onChange={e => setNoteMessage(e.target.value)} /></div>
              <Button type="submit">Post notice</Button>
            </form>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="moderate">
          <Card className="mb-6"><CardHeader><CardTitle>Password requests</CardTitle></CardHeader><CardContent className="space-y-2">
            {passwordRequests.filter(request => request.status === 'pending').length ? passwordRequests.filter(request => request.status === 'pending').map(request => (
              <div key={request.id} className="flex flex-wrap items-center gap-3 rounded-md border p-3 text-sm"><span className="flex-1">@{request.username} requested a password change</span><Button size="sm" onClick={async () => { await approvePasswordRequest(request.id); toast.success('Approved and notification sent'); await refresh(true) }}>Approve</Button><Button size="sm" variant="outline" onClick={async () => { await denyPasswordRequest(request.id); toast.success('Request denied'); await refresh(true) }}>Deny</Button></div>
            )) : <p className="text-sm text-muted-foreground">No pending password requests.</p>}
          </CardContent></Card>
          <div id="greetTable" className="overflow-x-auto rounded-xl border">
            <table className="table w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-3 text-left">Who</th><th className="p-3 text-left">Type</th><th className="p-3 text-left">Message</th><th className="p-3"></th></tr></thead>
              <tbody>
                {data.greetings.sort((a, b) => b.createdAt - a.createdAt).map(g => (
                  <tr key={g.id} className="border-t">
                    <td className="p-3">{g.from} → {g.to}</td>
                    <td className="p-3">{g.type}</td>
                    <td className="p-3">{g.message}</td>
                    <td className="p-3"><Button variant="destructive" size="sm" onClick={async () => { await deleteGreeting(g.id); toast.success('Deleted'); await refresh(true) }}>Delete</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div id="userTable" className="mt-6 overflow-x-auto rounded-xl border">
            <table className="table w-full text-sm">
              <thead className="bg-muted/50"><tr><th className="p-3 text-left">User</th><th className="p-3 text-left">Role</th><th className="p-3 text-left">Ban</th><th className="p-3 text-left">Reason</th><th className="p-3 text-left">Ban Until</th><th className="p-3 text-left"></th></tr></thead>
              <tbody>
                {data.users.map(u => (
                  <tr key={u.id} className="border-t">
                    <td className="p-3">{u.display} (@{u.username})</td>
                    <td className="p-3">{u.role === 'admin' ? 'Admin' : 'User'}</td>
                    <td className="p-3">
                      <select value={banStatusByUser[u.id] || u.banStatus || 'active'} onChange={e => setBanStatusByUser({ ...banStatusByUser, [u.id]: e.target.value as UserBanStatus })} className="h-9 rounded-md border px-2">
                        <option value="active">Active</option>
                        <option value="temporary">Temporary</option>
                        <option value="permanent">Permanent</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <Input value={banReasonByUser[u.id] ?? u.banReason ?? ''} onChange={e => setBanReasonByUser({ ...banReasonByUser, [u.id]: e.target.value })} placeholder="Reason" className="min-w-[160px]" />
                    </td>
                    <td className="p-3">
                      <Input type="datetime-local" value={banUntilByUser[u.id] ?? (u.banUntil ? new Date(u.banUntil).toISOString().slice(0, 16) : '')} onChange={e => setBanUntilByUser({ ...banUntilByUser, [u.id]: e.target.value })} disabled={(banStatusByUser[u.id] || u.banStatus || 'active') !== 'temporary'} className="min-w-[180px]" />
                    </td>
                    <td className="p-3"><Button size="sm" onClick={() => saveBan(u.id)}>Save</Button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </TabsContent>

        <TabsContent value="database">
          <Card><CardContent className="space-y-4 p-6">
            <p className="text-sm text-muted-foreground">MySQL is the shared database. Import <code className="rounded bg-muted px-1">mysql/001_schema.sql</code> in your SQL editor, then add your connection variables to <code className="rounded bg-muted px-1">.env</code>.</p>
            <Button variant="destructive" id="resetDbBtn" onClick={() => setResetOpen(true)}>Reset from zero</Button>
          </CardContent></Card>
        </TabsContent>
      </Tabs>

      <ConfirmDialog
        open={resetOpen}
        title="Reset database?"
        message="This wipes all users, greetings, banners, friends, and notices, then restores the default system accounts."
        okText="Reset everything"
        cancelText="Cancel"
        destructive
        onCancel={() => setResetOpen(false)}
        onConfirm={() => { setResetOpen(false); resetAll() }}
      />
    </div>
  )
}
