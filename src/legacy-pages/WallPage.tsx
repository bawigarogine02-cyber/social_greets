import { GreetingCard } from '@/components/GreetingCard'
import { useData } from '@/contexts/DataContext'
import { publicBannerGreetings } from '@/lib/users'

export function WallPage() {
  const { data } = useData()
  if (!data) return null
  const publicG = publicBannerGreetings(data.greetings, data.users)
  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold">Banner Wall</h1>
      <div id="wallGrid" className="mx-auto flex max-w-2xl flex-col gap-4">
        {publicG.length ? publicG.map(g => <GreetingCard key={g.id} greeting={g} />) : <p className="text-muted-foreground">The wall is waiting for a kind hello.</p>}
      </div>
    </div>
  )
}
