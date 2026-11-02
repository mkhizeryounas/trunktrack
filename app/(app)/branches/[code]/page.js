import { notFound } from 'next/navigation'
import { loadAll } from '@/lib/data.js'
import { PageHead, SetupNotice } from '../../../ui/ui'
import { BranchDetailView } from './view'

export async function generateMetadata({ params }) {
  const { code } = await params
  return { title: `Branch ${decodeURIComponent(code)}` }
}

export default async function BranchPage({ params }) {
  const { code: raw } = await params
  const code = decodeURIComponent(raw)
  const { deliveries, branches, setupError } = await loadAll()
  if (setupError) return <><PageHead title="Branch" /><SetupNotice message={setupError} /></>
  const branch = branches.find((b) => b.code === code)
  if (!branch) notFound()
  const rows = deliveries.filter((d) => d.branch_code === code).sort((a, b) => (b.delivered_on || '').localeCompare(a.delivered_on || ''))
  return <BranchDetailView branch={branch} rows={rows} branches={branches} allRows={deliveries} />
}
