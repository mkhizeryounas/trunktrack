import { loadAll } from '@/lib/data.js'
import { summariseGroups } from '@/lib/groups.js'
import { PageHead, SetupNotice } from '../../ui/ui'
import { GroupsView } from '../../ui/groups-view'

export const metadata = { title: 'Regions' }

export default async function Page() {
  const data = await loadAll()
  if (data.setupError) return <><PageHead title="Regions" /><SetupNotice message={data.setupError} /></>
  const { rows, unassigned } = summariseGroups('region', { branches: data.branches, deliveries: data.deliveries, list: data.regions })
  return <GroupsView kind="region" rows={rows} unassigned={unassigned} />
}
