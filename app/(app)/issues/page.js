import Link from 'next/link'
import { loadAll } from '@/lib/data.js'
import { CHECKS, findDuplicateInvoices, fmtDate, fmtRs } from '@/lib/model.js'
import { PageHead, Card, Empty, SetupNotice, Badge } from '../../ui/ui'
import { Icon } from '../../ui/icons'

export const metadata = { title: 'Data checks' }

const WHY = {
  no_date: 'Without a date the delivery is left out of monthly figures and aging.',
  future_date: 'Usually a day/month mix-up when the date was typed.',
  no_region: 'The delivery shows under “No region” in every report. Set the region on the branch.',
  zero_received: 'A delivery should have at least one trunk. Check the count.',
  overused: 'The balance goes negative. Older trunks may have been reused, or a number is off.',
  used_not_started: 'Trunks are in use, so shifting has probably started or finished.',
  complete_unused: 'Shifting is marked complete but no trunks are recorded as used.',
  no_invoice_no: 'The amount is billed but there is no invoice number to trace it.',
  paid_no_date: 'Received money should have a payment date for the monthly report.',
  date_no_payment: 'There is a payment date but no amount received.',
  long_outstanding: 'Follow up with the branch for payment.',
}

export default async function IssuesPage() {
  const { deliveries: rows, branches, setupError } = await loadAll()
  if (setupError) return <><PageHead title="Data checks" /><SetupNotice message={setupError} /></>
  const groups = CHECKS.map((c) => ({ ...c, rows: rows.filter((r) => r.issues.includes(c.key)) }))
  const dupes = findDuplicateInvoices(rows)
  const noRegionBranches = branches.filter((b) => !b.region)
  const flagged = rows.filter((r) => r.issues.length).length

  return (
    <>
      <PageHead title="Data checks" sub={flagged ? `${flagged} of ${rows.length} deliveries need a look. Fixing these makes every report more accurate.` : 'Everything checks out.'} />
      <div className="grid">
        {dupes.length > 0 && (
          <Card title="Same invoice number used more than once" sub="Each invoice should belong to one delivery">
            <div className="list">
              {dupes.map((g) => (
                <div key={g[0].invoice_no} className="list-item">
                  <div><div className="li-title">{g[0].invoice_no}</div><div className="li-sub">{g.map((r) => `branch ${r.branch_code} (${fmtDate(r.delivered_on)})`).join(' · ')}</div></div>
                  <div style={{ display: 'flex', gap: 6 }}>{g.map((r) => <Link key={r.id} className="btn btn-sm" href={`/deliveries?open=${r.id}`}>Open</Link>)}</div>
                </div>
              ))}
            </div>
          </Card>
        )}
        {noRegionBranches.length > 0 && (
          <Card title="Branches without a region" sub="Set these once and every delivery of the branch is fixed">
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              {noRegionBranches.map((b) => <Link key={b.code} href={`/branches/${encodeURIComponent(b.code)}`} className="btn btn-sm">{b.code}<Icon name="arrowRight" /></Link>)}
            </div>
          </Card>
        )}
        <div className="cols-2-even">
          {groups.map((g) => (
            <Card key={g.key} title={<span style={{ display: 'flex', gap: 8, alignItems: 'center' }}>{g.label}<Badge tone={g.rows.length ? 'amber' : 'green'} plain>{g.rows.length}</Badge></span>} sub={WHY[g.key]}
              action={g.rows.length > 0 && <Link className="btn btn-sm" href={`/deliveries?issue=${g.key}`}>Show all</Link>}>
              {g.rows.length ? (
                <div className="list">
                  {g.rows.slice(0, 4).map((r) => (
                    <Link key={r.id} href={`/deliveries?open=${r.id}`} className="list-item">
                      <div><div className="li-title">Branch {r.branch_label}</div><div className="li-sub">{r.delivered_on ? fmtDate(r.delivered_on) : 'No date'} · {r.trunks_received} received, {r.trunks_used} used{r.outstanding ? ` · ${fmtRs(r.outstanding)} due` : ''}</div></div>
                      <Icon name="arrowRight" size={16} />
                    </Link>
                  ))}
                  {g.rows.length > 4 && <div className="li-sub" style={{ paddingTop: 8 }}>and {g.rows.length - 4} more</div>}
                </div>
              ) : <Empty icon="check" title="All good" />}
            </Card>
          ))}
        </div>
      </div>
    </>
  )
}
