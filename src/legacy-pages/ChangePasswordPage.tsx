import { useState } from 'react'
import { Link, Navigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { changePasswordWithKey } from '@/lib/db'

export function ChangePasswordPage() {
  const [params] = useSearchParams()
  const key = params.get('key') || ''
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  if (!key) return <Navigate to="/login" replace />

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (password !== confirm) { toast.error('Passwords do not match.'); return }
    setBusy(true)
    try {
      await changePasswordWithKey(key, password)
      setDone(true)
      toast.success('Password changed successfully')
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Could not change password')
    } finally { setBusy(false) }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader><CardTitle>Change password</CardTitle></CardHeader>
      <CardContent>
        {done ? <div className="space-y-4"><Alert><AlertDescription>Your password has been changed. This link can no longer be used.</AlertDescription></Alert><Button asChild><Link to="/login">Go to login</Link></Button></div> : <form onSubmit={submit} className="space-y-4">
          <div><label className="mb-1 block text-sm font-medium" htmlFor="newPassword">New password</label><Input id="newPassword" type="password" minLength={6} maxLength={64} value={password} onChange={event => setPassword(event.target.value)} required /></div>
          <div><label className="mb-1 block text-sm font-medium" htmlFor="confirmPassword">Confirm password</label><Input id="confirmPassword" type="password" minLength={6} maxLength={64} value={confirm} onChange={event => setConfirm(event.target.value)} required /></div>
          <Button type="submit" disabled={busy}>{busy ? 'Saving...' : 'Change password'}</Button>
        </form>}
      </CardContent>
    </Card>
  )
}
