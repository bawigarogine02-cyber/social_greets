import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ConfirmDialog'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { addGreeting } from '@/lib/db'
import { uploadBannerMedia } from '@/lib/avatar'
import { checkSend, markSent, oneAtATime, waitMs } from '@/lib/guard'
import { clearFormDraft, getDraftReturnUrl, readFormDraft, saveFormDraft } from '@/hooks/useFormDraft'
import { isHiddenUser, publicProfiles } from '@/lib/users'

export function GreetPage() {
  const { session } = useAuth()
  const { data, refresh } = useData()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const [from, setFrom] = useState('')
  const [to, setTo] = useState(params.get('to') || '')
  const [message, setMessage] = useState('')
  const [type, setType] = useState<'banner' | 'private'>(params.get('private') === '1' ? 'private' : 'banner')
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [busy, setBusy] = useState(false)
  const [waitLabel, setWaitLabel] = useState('')
  const [signupOpen, setSignupOpen] = useState(false)
  const [media, setMedia] = useState<{ url: string; mediaType: 'image' | 'video' } | null>(null)
  const [mediaBusy, setMediaBusy] = useState(false)

  useEffect(() => {
    if (session) setFrom(session.display || session.username)
    const draft = readFormDraft()
    if (draft?.page === 'greet') {
      setFrom(String(draft.fields.from || from))
      setTo(String(draft.fields.to || to))
      setMessage(String(draft.fields.message || ''))
      if (draft.fields.type === 'private' || draft.fields.type === 'banner') setType(draft.fields.type)
      clearFormDraft()
    }
  }, [session])

  useEffect(() => {
    const tick = () => {
      const left = waitMs()
      setWaitLabel(left > 0 ? `Wait ${Math.ceil(left / 1000)}s` : '')
      if (left > 0) window.setTimeout(tick, 400)
    }
    tick()
  }, [success, error, busy])

  const hints = useMemo(() => {
    if (!data) return [] as string[]
    const names = new Set<string>()
    publicProfiles(data.users).forEach(u => { if (!session || u.username !== session.username) names.add(u.username) })
    if (session) {
      data.friends.filter(f => f.status === 'accepted').forEach(f => {
        const name = f.from === session.username ? f.to : f.from
        if (!isHiddenUser(name)) names.add(name)
      })
    }
    return [...names]
  }, [data, session])

  const trySubmit = async () => {
    if (!session) {
      setSignupOpen(true)
      return
    }
    if (!data) return
    setError('')
    setSuccess('')
    const blocked = checkSend(from, to, message, data, session.id)
    if (blocked) { setError(blocked); return }
    let targetName = to
    if (type === 'private') {
      const target = data.users.find(u => u.username === to.toLowerCase() || u.display.toLowerCase() === to.toLowerCase())
      if (!target || isHiddenUser(target.username)) { setError('Private greetings need a registered username.'); return }
      targetName = target.username
    }
    setBusy(true)
    try {
      await oneAtATime(async () => {
        await addGreeting({ from, to: targetName, message, type, fromId: session.id, mediaUrl: media?.url, mediaType: media?.mediaType })
      })
      markSent(from, targetName, message)
      setMessage('')
      setSuccess(type === 'private' ? 'Private greeting sent.' : 'Your greeting is now on the banner wall.')
      toast.success('Greeting sent!')
      await refresh(true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send right now.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Card className="mx-auto max-w-xl">
      <CardHeader>
        <CardTitle>Send a Greeting</CardTitle>
      </CardHeader>
      <CardContent>
        <form id="greetForm" className="space-y-4" onSubmit={e => { e.preventDefault(); trySubmit() }}>
          <div>
            <Label htmlFor="from">From</Label>
            <Input id="from" name="from" value={from} onChange={e => setFrom(e.target.value)} readOnly={!!session} />
          </div>
          <div>
            <Label htmlFor="to">To</Label>
            <Input id="to" name="to" list="toHints" value={to} onChange={e => setTo(e.target.value)} />
            <datalist id="toHints">{hints.map(n => <option key={n} value={n} />)}</datalist>
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" name="message" value={message} onChange={e => setMessage(e.target.value)} rows={4} />
          </div>
          <div>
            <Label htmlFor="bannerMedia">Image, GIF, or video</Label>
            <Input id="bannerMedia" type="file" accept="image/*,video/*" disabled={mediaBusy} onChange={async event => {
              const file = event.target.files?.[0]
              if (!file) return
              setMediaBusy(true)
              try { setMedia(await uploadBannerMedia(file)) } catch (err) { setError(err instanceof Error ? err.message : 'Could not process that media.') } finally { setMediaBusy(false); event.currentTarget.value = '' }
            }} />
            {media && <p className="mt-1 text-xs text-muted-foreground">Media ready to attach.</p>}
          </div>
          <fieldset className="space-y-2">
            <legend className="text-sm font-medium">Type</legend>
            <label className="mr-4 text-sm"><input type="radio" name="type" value="banner" checked={type === 'banner'} onChange={() => setType('banner')} className="mr-2" />Banner (public wall)</label>
            <label className="text-sm"><input type="radio" name="type" value="private" checked={type === 'private'} onChange={() => setType('private')} className="mr-2" />Private (inbox only)</label>
          </fieldset>
          {error && <Alert className="border-destructive/50 bg-destructive/10"><AlertDescription>{error}</AlertDescription></Alert>}
          {success && <Alert className="border-green-500/50 bg-green-50 text-green-900"><AlertDescription>{success}</AlertDescription></Alert>}
          <Button type="submit" disabled={busy || mediaBusy || !!waitLabel}>
            {busy ? 'Sending...' : mediaBusy ? 'Uploading media...' : waitLabel || 'Send Greeting'}
          </Button>
        </form>
      </CardContent>
      <ConfirmDialog
        open={signupOpen}
        title="Sign up first"
        message="Create an account to submit this form. Your answers will be saved and restored after you sign up."
        okText="Sign up"
        cancelText="Cancel"
        onCancel={() => setSignupOpen(false)}
        onConfirm={() => {
          saveFormDraft('greet', getDraftReturnUrl() || '/greet', { from, to, message, type })
          setSignupOpen(false)
          navigate('/register')
        }}
      />
    </Card>
  )
}
