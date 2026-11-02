import { loadAll } from '@/lib/data.js'
import { totals, groupBy } from '@/lib/model.js'
import { PageHead, SetupNotice } from '../../ui/ui'
import { BranchesView } from './view'

export const metadata = { title: 'Branches' }

export default async function BranchesPage({ searchParams }) {
  const { region: initialRegion, zone: initialZone } = await searchParams
  const { deliveries, branches, setupError } = await loadAll()
  if (setupError) return <><PageHead title="Branches" /><SetupNotice message={setupError} /></>
  const byBranch = groupBy(deliveries, 'branch_code')
  const rows = branches.map((b) => {
    const list = byBranch[b.code] || []
    const t = totals(list)
    return {
      ...b, deliveries: t.count, trunks: t.trunks, stands: t.stands, used: t.used, balance: t.balance,
      invoiced: t.invoiced, received: t.received, outstanding: t.outstanding,
      notStarted: list.filter((r) => r.shifting_status === 'not_started').length,
      last: list.map((r) => r.delivered_on).filter(Boolean).sort().at(-1) || null,
      issues: list.filter((r) => r.issues.length).length,
    }
  })
  return <BranchesView rows={rows} initialRegion={typeof initialRegion === 'string' ? initialRegion : ''} initialZone={typeof initialZone === 'string' ? initialZone : ''} />
}
