import { Nav } from '../ui/nav'
import { AppData } from '../ui/app-data'
import { loadRegionNames } from '@/lib/data.js'

export default async function AppLayout({ children }) {
  const regions = await loadRegionNames()
  return (
    <AppData regions={regions}>
      <div className="shell">
        <Nav />
        <main className="main"><div className="container">{children}</div></main>
      </div>
    </AppData>
  )
}
