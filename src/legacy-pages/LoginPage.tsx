import { useState } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { login, setSession } from '@/lib/auth'
import { getDraftReturnUrl } from '@/hooks/useFormDraft'

export function LoginPage() {
  const { session, setSession: setAuthSession } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={getDraftReturnUrl() || (location.state as { from?: string })?.from || '/'} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await login(username, password)
      setSession(user)
      setAuthSession(user)
      navigate(getDraftReturnUrl() || (location.state as { from?: string })?.from || '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader><CardTitle>Log in</CardTitle></CardHeader>
      <CardContent>
        <form id="loginForm" className="space-y-4" onSubmit={submit}>
          <div><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" /></div>
          {error && <Alert className="border-destructive/50 bg-destructive/10"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" disabled={busy} className="w-full">{busy ? 'Please wait...' : 'Log in'}</Button>
          <p className="text-center text-sm text-muted-foreground">No account? <Link to="/register" className="text-primary underline">Sign up</Link></p>
        </form>
      </CardContent>
    </Card>
  )
}
