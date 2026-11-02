import { loadAll } from '@/lib/data.js'
import { totals, groupBy } from '@/lib/model.js'
import { PageHead, SetupNotice } from '../../ui/ui'
import { RegionsView } from './view'

export const metadata = { title: 'Regions' }

export default async function RegionsPage() {
  const { deliveries, branches, regions, setupError } = await loadAll()
  if (setupError) return <><PageHead title="Regions" /><SetupNotice message={setupError} /></>
  const branchesByRegion = groupBy(branches, (b) => b.region || '')
  const deliveriesByRegion = groupBy(deliveries, (d) => d.region || '')
  const summarise = (name, notes) => {
    const bs = branchesByRegion[name] || []
    const t = totals(deliveriesByRegion[name] || [])
    const zones = Object.entries(groupBy(bs, (b) => b.zone || 'No zone')).map(([z, l]) => ({ zone: z, n: l.length })).sort((a, b) => b.n - a.n)
    return {
      name, notes: notes || null, branches: bs.map((b) => b.code), zones, deliveries: t.count, trunks: t.trunks, used: t.used,
      balance: t.balance, notStarted: (deliveriesByRegion[name] || []).filter((d) => d.shifting_status === 'not_started').length,
      invoiced: t.invoiced, outstanding: t.outstanding,
    }
  }
  const rows = regions.map((r) => summarise(r.name, r.notes))
  const unassigned = branchesByRegion[''] ? summarise('', null) : null
  const zones = Object.entries(groupBy(branches.filter((b) => b.zone), 'zone')).map(([zone, list]) => ({
    zone, branches: list.length, regions: [...new Set(list.map((b) => b.region).filter(Boolean))].sort(),
  })).sort((a, b) => b.branches - a.branches)
  return <RegionsView rows={rows} unassigned={unassigned} zones={zones} />
}
