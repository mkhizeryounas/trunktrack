import { loadAll } from '@/lib/data.js'
import { PageHead, SetupNotice } from '../../ui/ui'
import { DeliveriesView } from './view'

export const metadata = { title: 'Deliveries' }

export default async function DeliveriesPage({ searchParams }) {
  const params = await searchParams
  const { deliveries, branches, setupError } = await loadAll()
  if (setupError) return <><PageHead title="Deliveries" /><SetupNotice message={setupError} /></>
  const initial = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, Array.isArray(v) ? v[0] : v]))
  return <DeliveriesView rows={deliveries} branches={branches} initial={initial} />
}
