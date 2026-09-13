import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { UserAvatar } from '@/components/UserAvatar'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { uploadAvatar } from '@/lib/avatar'
import { requestPasswordChange, updateProfile } from '@/lib/db'
import { nameOk, oneAtATime } from '@/lib/guard'

export function ProfilePage() {
  const { session, setSession } = useAuth()
  const { data, refresh } = useData()
  const [display, setDisplay] = useState('')
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>()
  const [busy, setBusy] = useState(false)
  const [passwordBusy, setPasswordBusy] = useState(false)
  const fileRef = useRef<HTMLInputElement>(null)

  const profile = data?.users.find(u => u.id === session?.id)

  useEffect(() => {
    if (!session) return
    setDisplay(profile?.display || session.display)
    setAvatarUrl(profile?.avatarUrl || session.avatarUrl)
  }, [session, profile?.display, profile?.avatarUrl])

  if (!session) return null

  const pickAvatar = async (file?: File | null) => {
    if (!file) return
    try {
      const url = await uploadAvatar(file)
      setAvatarUrl(url)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not use that image')
    }
  }

  const save = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = display.trim()
    const nameErr = nameOk(trimmed)
    if (nameErr) {
      toast.error(nameErr)
      return
    }
    setBusy(true)
    try {
      const saved = await oneAtATime(() => updateProfile(session.id, {
        display: trimmed,
        avatarUrl: avatarUrl || null,
      }))
      setSession({ ...session, display: saved.display, avatarUrl: saved.avatarUrl })
      await refresh(true)
      toast.success('Profile updated')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not save profile')
    } finally {
      setBusy(false)
    }
  }

  const removeAvatar = () => setAvatarUrl(undefined)

  const requestPassword = async () => {
    setPasswordBusy(true)
    try {
      await requestPasswordChange(session.username)
      toast.success('Password change request sent to the admin')
    } catch (err) { toast.error(err instanceof Error ? err.message : 'Could not request a password change') }
    finally { setPasswordBusy(false) }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Your profile</h1>
      <Card className="max-w-lg">
        <CardContent className="p-6">
          <form onSubmit={save} className="space-y-6">
            <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
              <UserAvatar src={avatarUrl} name={display || session.username} size="lg" />
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>Change photo</Button>
                {avatarUrl && <Button type="button" variant="ghost" size="sm" onClick={removeAvatar}>Remove photo</Button>}
                <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={e => pickAvatar(e.target.files?.[0])} />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="profileDisplay">Display name</label>
              <Input id="profileDisplay" value={display} onChange={e => setDisplay(e.target.value)} maxLength={40} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="profileUsername">Username</label>
              <Input id="profileUsername" value={`@${session.username}`} disabled />
            </div>
            <Button type="submit" disabled={busy}>Save profile</Button>
            <Button type="button" variant="outline" disabled={passwordBusy} onClick={requestPassword}>{passwordBusy ? 'Requesting...' : 'Request password change'}</Button>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
