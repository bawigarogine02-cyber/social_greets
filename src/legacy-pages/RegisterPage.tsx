import { useState } from 'react'
import { Link, Navigate, useNavigate } from 'react-router-dom'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useAuth } from '@/contexts/AuthContext'
import { register, setSession } from '@/lib/auth'
import { getDraftReturnUrl } from '@/hooks/useFormDraft'
import { mysqlConfigured } from '@/lib/mysql'

export function RegisterPage() {
  const { session, setSession: setAuthSession } = useAuth()
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [display, setDisplay] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  if (session) return <Navigate to={getDraftReturnUrl() || '/'} replace />

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setBusy(true)
    try {
      const user = await register(username, password, display)
      setSession(user)
      setAuthSession(user)
      navigate(getDraftReturnUrl() || '/')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Registration failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-md">
      <CardHeader><CardTitle>Create account</CardTitle></CardHeader>
      <CardContent>
        {!mysqlConfigured && (
          <Alert className="mb-4 border-destructive/50 bg-destructive/10"><AlertDescription>Copy <code className="rounded bg-muted px-1">.env.example</code> to <code className="rounded bg-muted px-1">.env</code>, add your MySQL connection details, restart <code className="rounded bg-muted px-1">npm run dev</code>, then import the SQL in <code className="rounded bg-muted px-1">mysql/001_schema.sql</code>.</AlertDescription></Alert>
        )}
        <form id="registerForm" className="space-y-4" onSubmit={submit}>
          <div><Label htmlFor="username">Username</Label><Input id="username" value={username} onChange={e => setUsername(e.target.value)} autoComplete="username" /></div>
          <div><Label htmlFor="display">Display name</Label><Input id="display" value={display} onChange={e => setDisplay(e.target.value)} autoComplete="name" /></div>
          <div><Label htmlFor="password">Password</Label><Input id="password" type="password" value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" /></div>
          {error && <Alert className="border-destructive/50 bg-destructive/10"><AlertDescription>{error}</AlertDescription></Alert>}
          <Button type="submit" disabled={busy || !mysqlConfigured && false} className="w-full">{busy ? 'Please wait...' : 'Sign up'}</Button>
          <p className="text-center text-sm text-muted-foreground">Already have an account? <Link to="/login" className="text-primary underline">Log in</Link></p>
        </form>
      </CardContent>
    </Card>
  )
}
