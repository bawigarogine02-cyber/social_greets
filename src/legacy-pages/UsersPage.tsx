import { useEffect, useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { toast } from 'sonner'
import { UserAvatar } from '@/components/UserAvatar'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { upsertFriend } from '@/lib/db'
import { oneAtATime } from '@/lib/guard'
import type { AppData } from '@/lib/types'
import { publicProfiles } from '@/lib/users'

type Filter = 'people' | 'friends' | 'requests'

function friendState(data: AppData, me: string, other: string) {
  const f = (data.friends || []).find(x => (x.from === me && x.to === other) || (x.from === other && x.to === me))
  if (!f) return 'none'
  if (f.status === 'accepted') return 'friends'
  return f.from === me ? 'outgoing' : 'incoming'
}

export function UsersPage() {
  const { session } = useAuth()
  const { data, refresh } = useData()
  const [searchParams, setSearchParams] = useSearchParams()
  const [filter, setFilter] = useState<Filter>(searchParams.get('requests') === '1' ? 'requests' : 'people')
  const [highlightedRequest, setHighlightedRequest] = useState<string | null>(null)
  if (!session || !data) return null

  const people = useMemo(() => publicProfiles(data.users).filter(u => u.username !== session.username), [data.users, session.username])
  const friendsN = people.filter(u => friendState(data, session.username, u.username) === 'friends').length
  const reqN = people.filter(u => friendState(data, session.username, u.username) === 'incoming').length

  useEffect(() => {
    const requestView = searchParams.get('requests') === '1'
    setFilter(requestView ? 'requests' : 'people')
    if (!requestView) return
    const firstRequest = people.find(user => friendState(data, session.username, user.username) === 'incoming')
    setHighlightedRequest(firstRequest?.username || null)
    if (firstRequest) {
      const timer = window.setTimeout(() => setHighlightedRequest(null), 4000)
      return () => window.clearTimeout(timer)
    }
  }, [data, people, searchParams, session.username])

  const changeFilter = (next: Filter) => {
    setFilter(next)
    if (next === 'requests') setSearchParams({ requests: '1' })
    else setSearchParams({})
  }

  const rows = useMemo(() => {
    if (filter === 'friends') return people.filter(u => friendState(data, session.username, u.username) === 'friends')
    if (filter === 'requests') return people.filter(u => friendState(data, session.username, u.username) === 'incoming')
    return people
  }, [filter, people, data, session.username])

  const act = async (action: 'add' | 'accept' | 'remove', other: string) => {
    try {
      await oneAtATime(async () => {
        if (other === session.username) throw new Error('You cannot add yourself.')
        await upsertFriend(action, session.username, other)
      })
      toast.success(action === 'add' ? 'Friend request sent' : action === 'accept' ? 'You are now friends' : 'Updated')
      await refresh(true)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Could not update friend')
    }
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Users</h1>
      <div className="user_filters mb-4 flex flex-wrap gap-2">
        <Button variant={filter === 'people' ? 'default' : 'outline'} size="sm" onClick={() => changeFilter('people')}>People</Button>
        <Button variant={filter === 'friends' ? 'default' : 'outline'} size="sm" onClick={() => changeFilter('friends')}>Friends{friendsN ? ` (${friendsN})` : ''}</Button>
        <Button variant={filter === 'requests' ? 'default' : 'outline'} size="sm" onClick={() => changeFilter('requests')}>Requests{reqN ? ` (${reqN})` : ''}</Button>
      </div>
      <div id="userList" className="space-y-3">
        {!rows.length ? (
          <p className="text-muted-foreground">{filter === 'friends' ? 'No friends yet.' : filter === 'requests' ? 'No friend requests.' : 'No other users yet.'}</p>
        ) : rows.map(u => {
          const st = friendState(data, session.username, u.username)
          const tag = st === 'friends' ? 'Friend' : st === 'incoming' ? 'Request' : st === 'outgoing' ? 'Sent' : (u.role === 'admin' ? 'Admin' : 'User')
          return (
            <Card key={u.id} className={`user_card transition ${highlightedRequest === u.username ? 'ring-2 ring-primary shadow-lg' : ''}`}>
              <CardContent className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="who flex items-center gap-3">
                  <UserAvatar src={u.avatarUrl} name={u.display || u.username} className="h-11 w-11" />
                  <div>
                    <h4 className="font-semibold">{u.display || u.username}</h4>
                    <p className="text-sm text-muted-foreground">@{u.username} · <Badge variant="outline">{tag}</Badge></p>
                  </div>
                </div>
                <div className="user_actions flex flex-wrap gap-2">
                  {st === 'none' && <>
                    <Button asChild size="sm" variant="secondary"><Link to={`/inbox?with=${encodeURIComponent(u.username)}`}>Message</Link></Button>
                    <Button size="sm" onClick={() => act('add', u.username)}>Add friend</Button>
                  </>}
                  {st === 'friends' && <>
                    <Button asChild size="sm" variant="secondary"><Link to={`/inbox?with=${encodeURIComponent(u.username)}`}>Message</Link></Button>
                    <Button asChild size="sm" variant="outline"><Link to={`/greet?to=${encodeURIComponent(u.username)}`}>Greet</Link></Button>
                    <Button size="sm" variant="destructive" onClick={() => act('remove', u.username)}>Unfriend</Button>
                  </>}
                  {st === 'outgoing' && <>
                    <Button asChild size="sm" variant="secondary"><Link to={`/inbox?with=${encodeURIComponent(u.username)}`}>Message</Link></Button>
                    <Badge variant="secondary">Requested</Badge>
                    <Button size="sm" variant="outline" onClick={() => act('remove', u.username)}>Cancel</Button>
                  </>}
                  {st === 'incoming' && <>
                    <Button asChild size="sm" variant="secondary"><Link to={`/inbox?with=${encodeURIComponent(u.username)}`}>Message</Link></Button>
                    <Button size="sm" onClick={() => act('accept', u.username)}>Accept</Button>
                    <Button size="sm" variant="outline" onClick={() => act('remove', u.username)}>Decline</Button>
                  </>}
                </div>
              </CardContent>
            </Card>
          )
        })}
      </div>
    </div>
  )
}
