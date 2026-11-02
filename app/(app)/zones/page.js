import { loadAll } from '@/lib/data.js'
import { summariseGroups } from '@/lib/groups.js'
import { PageHead, SetupNotice } from '../../ui/ui'
import { GroupsView } from '../../ui/groups-view'

export const metadata = { title: 'Zones' }

export default async function Page() {
  const data = await loadAll()
  if (data.setupError) return <><PageHead title="Zones" /><SetupNotice message={data.setupError} /></>
  const { rows, unassigned } = summariseGroups('zone', { branches: data.branches, deliveries: data.deliveries, list: data.zones })
  return <GroupsView kind="zone" rows={rows} unassigned={unassigned} />
}
