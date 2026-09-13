import { Link } from 'react-router-dom'
import { GreetingCard } from '@/components/GreetingCard'
import { Button } from '@/components/ui/button'
import { Card, CardContent } from '@/components/ui/card'
import { useAuth } from '@/contexts/AuthContext'
import { useData } from '@/contexts/DataContext'
import { globalNotifications } from '@/lib/notifications'
import { publicBannerGreetings, publicProfiles } from '@/lib/users'

export function HomePage() {
  const { session } = useAuth()
  const { data } = useData()
  if (!data) return null

  const visibleUsers = publicProfiles(data.users)
  const publicGreetings = publicBannerGreetings(data.greetings, data.users).slice(0, 6)
  const latestNote = globalNotifications(data.notifications).slice().sort((a, b) => b.createdAt - a.createdAt)[0]
  const cele = data.settings.celebration

  return (
    <div className="main_box grid gap-6 lg:grid-cols-[260px_1fr]">
      <aside className="sidebar">
        <Card>
          <CardContent className="p-5 text-center">
            <figure className="mb-4 flex justify-center"><img src="/images/feature-send.svg" alt="Send a greeting" className="h-16 w-16" /></figure>
            <h3 className="text-lg font-semibold">Hello, {session ? (session.display || session.username) : 'friend'}</h3>
            <p className="mt-2 text-sm text-muted-foreground">{session ? 'Your inbox and friends are ready.' : 'Browse the wall or draft a greeting, then sign up to send it.'}</p>
            <p className="mt-4 text-3xl font-bold text-primary">{publicBannerGreetings(data.greetings, data.users).length}</p>
            <p className="text-sm text-muted-foreground">bannered greetings</p>
            <p className="mt-3 text-3xl font-bold text-primary">{visibleUsers.length}</p>
            <p className="text-sm text-muted-foreground">kind people here</p>
            <Button asChild className="mt-4 w-full"><Link to="/greet">Send a Greeting</Link></Button>
          </CardContent>
        </Card>
      </aside>
      <div className="content space-y-6">
        {latestNote && (
          <div id="siteNotice" className="cele_banner rounded-xl bg-primary px-5 py-4 text-primary-foreground">
            <h3 className="font-semibold">{latestNote.kind === 'event' ? 'Upcoming event' : 'Update'}: {latestNote.title}</h3>
            <p className="mt-1 text-sm opacity-90">{latestNote.message}</p>
          </div>
        )}
        {cele.title && (
          <div id="celebration" className="cele_banner rounded-xl bg-gradient-to-r from-pink-500 to-violet-500 px-5 py-4 text-white">
            <h3 className="font-semibold">{cele.title}</h3>
            {cele.message && <p className="mt-1 text-sm opacity-90">{cele.message}</p>}
            {cele.date && <p className="mt-2 text-sm opacity-80">When: {cele.date}</p>}
          </div>
        )}
        <div className="hero rounded-xl border bg-card p-6">
          <h2 className="text-2xl font-bold">Catch a smile. Pass it on.</h2>
          <p className="mt-2 max-w-2xl text-muted-foreground">Social Greetings is a bright little box of hellos. Banner a public wish for everyone, or send a private note to one person.</p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Button asChild><Link to="/wall">See the Wall</Link></Button>
            <Button asChild variant="secondary"><Link to="/greet">Send a Greeting</Link></Button>
          </div>
        </div>
        <div>
          <h2 className="mb-4 text-xl font-semibold">Latest bannered greetings</h2>
          <div id="latestGreetings" className="greet_grid grid gap-4 md:grid-cols-2">
            {publicGreetings.length ? publicGreetings.map(g => <GreetingCard key={g.id} greeting={g} />) : <p className="text-muted-foreground">No bannered greetings yet. Be the first!</p>}
          </div>
        </div>
      </div>
    </div>
  )
}
