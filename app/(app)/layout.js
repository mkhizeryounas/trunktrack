import { Nav } from '../ui/nav'
import { AppData } from '../ui/app-data'
import { loadLists } from '@/lib/data.js'

export default async function AppLayout({ children }) {
  const { regions, zones } = await loadLists()
  return (
    <AppData regions={regions} zones={zones}>
      <div className="shell">
        <Nav />
        <main className="main"><div className="container">{children}</div></main>
      </div>
    </AppData>
  )
}
