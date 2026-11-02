import Link from 'next/link'
import { loadAll } from '@/lib/data.js'
import { totals, groupBy, pct, fmtNum, fmtRs, fmtMonth, AGING } from '@/lib/model.js'
import { PageHead, Card, SetupNotice } from '../../ui/ui'
import { CsvButton, PrintButton } from '../../ui/csv-button'

export const metadata = { title: 'Reports' }

function summarise(rows, keyFn) {
  return Object.entries(groupBy(rows, keyFn))
    .map(([k, list]) => {
      const t = totals(list)
      const base = list.filter((r) => r.shifting_status !== 'official').length
      return { k, ...t, util: pct(t.used, t.trunks), shift: pct(t.shiftingDone, base) }
    })
    .sort((a, b) => b.trunks - a.trunks)
}

function SummaryTable({ title, sub, id, rows, keyLabel, linkKey, all, filename }) {
  const header = [keyLabel, 'Branches', 'Deliveries', 'Trunks', 'Stands', 'Used', 'Unused', 'Used %', 'Shifting done %', 'Invoiced', 'Received', 'Outstanding']
  const line = (r) => [r.k, r.branchCount, r.count, r.trunks, r.stands, r.used, r.balance, r.util, r.shift, r.invoiced, r.received, Math.round(r.outstanding)]
  return (
    <Card title={title} sub={sub} pad={false} className="report" action={<CsvButton filename={filename} header={header} rows={[...rows.map(line), line({ ...all, k: 'Total' })]} />}>
      <div id={id} className="table-wrap auto">
        <table className="tbl">
          <thead><tr>{header.map((h, i) => <th key={h} className={i ? 'r' : ''}>{h}</th>)}</tr></thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.k}>
                <td><Link href={`/deliveries?${linkKey}=${encodeURIComponent(r.k)}`} style={{ fontWeight: 600 }}>{r.k}</Link></td>
                <td className="r num">{r.branchCount}</td><td className="r num">{r.count}</td><td className="r num">{fmtNum(r.trunks)}</td>
                <td className="r num">{fmtNum(r.stands)}</td><td className="r num">{fmtNum(r.used)}</td><td className={`r num${r.balance < 0 ? ' neg' : ''}`}>{fmtNum(r.balance)}</td>
                <td className="r num">{r.util}%</td><td className="r num">{r.shift}%</td><td className="r num">{fmtNum(r.invoiced)}</td>
                <td className="r num">{fmtNum(r.received)}</td><td className="r num" style={{ color: r.outstanding ? 'var(--red)' : undefined }}>{fmtNum(r.outstanding)}</td>
              </tr>
            ))}
          </tbody>
          <tfoot><tr>
            <td>Total</td><td className="r num">{all.branchCount}</td><td className="r num">{all.count}</td><td className="r num">{fmtNum(all.trunks)}</td>
            <td className="r num">{fmtNum(all.stands)}</td><td className="r num">{fmtNum(all.used)}</td><td className="r num">{fmtNum(all.balance)}</td>
            <td className="r num">{all.util}%</td><td className="r num">{all.shift}%</td><td className="r num">{fmtNum(all.invoiced)}</td>
            <td className="r num">{fmtNum(all.received)}</td><td className="r num">{fmtNum(all.outstanding)}</td>
          </tr></tfoot>
        </table>
      </div>
    </Card>
  )
}

export default async function ReportsPage() {
  const { deliveries: rows, setupError } = await loadAll()
  if (setupError) return <><PageHead title="Reports" /><SetupNotice message={setupError} /></>
  const allT = totals(rows)
  const base = rows.filter((r) => r.shifting_status !== 'official').length
  const all = { ...allT, util: pct(allT.used, allT.trunks), shift: pct(allT.shiftingDone, base) }
  const regions = summarise(rows, (r) => r.region || 'No region')
  const zones = summarise(rows, (r) => r.zone || 'No zone')

  // aging of outstanding money, by region
  const open = rows.filter((r) => r.outstanding > 0)
  const agingRows = Object.entries(groupBy(open, (r) => r.region || 'No region')).map(([k, list]) => ({
    k, buckets: AGING.map((a) => list.filter((r) => r.aging === a.key).reduce((s, r) => s + r.outstanding, 0)), total: list.reduce((s, r) => s + r.outstanding, 0), n: list.length,
  })).sort((a, b) => b.total - a.total)
  const agingTotals = AGING.map((_, i) => agingRows.reduce((s, r) => s + r.buckets[i], 0))

  // monthly activity: each money column uses its own date
  const months = new Set()
  for (const r of rows) {
    if (r.delivered_on) months.add(r.delivered_on.slice(0, 7))
    if (r.billing_tracked && r.invoice_date) months.add(r.invoice_date.slice(0, 7))
    if (r.payment_date) months.add(r.payment_date.slice(0, 7))
  }
  const monthly = [...months].sort().reverse().map((m) => {
    const del = rows.filter((r) => r.delivered_on?.startsWith(m))
    const inv = rows.filter((r) => r.billing_tracked && r.invoice_date?.startsWith(m))
    const paid = rows.filter((r) => r.payment_date?.startsWith(m))
    return { m, deliveries: del.length, trunks: del.reduce((a, r) => a + r.trunks_received, 0), stands: del.reduce((a, r) => a + r.stands_received, 0),
      invoices: inv.length, invoiced: inv.reduce((a, r) => a + Number(r.invoice_amount || 0), 0), payments: paid.length, received: paid.reduce((a, r) => a + r.received, 0) }
  })

  return (
    <>
      <PageHead title="Reports" sub="Summaries for review and sharing. Every number links back to the deliveries behind it.">
        <PrintButton />
      </PageHead>
      <div className="grid">
        <SummaryTable title="By region" sub="Trunk use, shifting progress and money, per region" id="utilisation" rows={regions} keyLabel="Region" linkKey="region" all={all} filename="report-by-region.csv" />

        <Card title="Outstanding by age" sub="How long receivables (after tax) have been waiting, counted from the invoice date" pad={false}
          action={<CsvButton filename="report-aging.csv" header={['Region', 'Invoices', ...AGING.map((a) => a.label), 'Total']} rows={agingRows.map((r) => [r.k, r.n, ...r.buckets.map(Math.round), Math.round(r.total)])} />}>
          <div id="aging" className="table-wrap auto">
            <table className="tbl">
              <thead><tr><th>Region</th><th className="r">Invoices</th>{AGING.map((a) => <th key={a.key} className="r">{a.label}</th>)}<th className="r">Total</th></tr></thead>
              <tbody>
                {agingRows.map((r) => (
                  <tr key={r.k}>
                    <td><Link href={`/deliveries?billing=open&region=${encodeURIComponent(r.k)}&sort=age`} style={{ fontWeight: 600 }}>{r.k}</Link></td>
                    <td className="r num">{r.n}</td>
                    {r.buckets.map((v, i) => <td key={i} className="r num" style={{ color: v && i >= 2 ? 'var(--red)' : undefined }}>{v ? fmtNum(v) : <span className="muted">—</span>}</td>)}
                    <td className="r num" style={{ fontWeight: 620 }}>{fmtNum(r.total)}</td>
                  </tr>
                ))}
                {!agingRows.length && <tr><td colSpan={7}><div className="empty"><b>Nothing outstanding</b></div></td></tr>}
              </tbody>
              {agingRows.length > 0 && <tfoot><tr><td>Total</td><td className="r num">{open.length}</td>{agingTotals.map((v, i) => <td key={i} className="r num">{fmtNum(v)}</td>)}<td className="r num">{fmtRs(agingTotals.reduce((a, b) => a + b, 0))}</td></tr></tfoot>}
            </table>
          </div>
        </Card>

        <SummaryTable title="By zone" id="zones" rows={zones} keyLabel="Zone" linkKey="zone" all={all} filename="report-by-zone.csv" />

        <Card title="Month by month" sub="Deliveries by delivery date · invoices by invoice date · payments by payment date" pad={false}
          action={<CsvButton filename="report-monthly.csv" header={['Month', 'Deliveries', 'Trunks', 'Stands', 'Invoices', 'Invoiced', 'Payments', 'Received']} rows={monthly.map((r) => [r.m, r.deliveries, r.trunks, r.stands, r.invoices, r.invoiced, r.payments, Math.round(r.received)])} />}>
          <div className="table-wrap auto">
            <table className="tbl">
              <thead><tr><th>Month</th><th className="r">Deliveries</th><th className="r">Trunks</th><th className="r">Stands</th><th className="r">Invoices</th><th className="r">Invoiced</th><th className="r">Payments</th><th className="r">Received</th></tr></thead>
              <tbody>
                {monthly.map((r) => (
                  <tr key={r.m}>
                    <td><Link href={`/deliveries?month=${r.m}`} style={{ fontWeight: 600 }}>{fmtMonth(r.m)}</Link></td>
                    <td className="r num">{r.deliveries || <span className="muted">—</span>}</td><td className="r num">{r.trunks ? fmtNum(r.trunks) : <span className="muted">—</span>}</td>
                    <td className="r num">{r.stands ? fmtNum(r.stands) : <span className="muted">—</span>}</td><td className="r num">{r.invoices || <span className="muted">—</span>}</td>
                    <td className="r num">{r.invoiced ? fmtNum(r.invoiced) : <span className="muted">—</span>}</td><td className="r num">{r.payments || <span className="muted">—</span>}</td>
                    <td className="r num">{r.received ? fmtNum(r.received) : <span className="muted">—</span>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
        <p className="small muted">Deliveries without a date ({rows.filter((r) => !r.delivered_on).length}) are counted in the region and zone tables but not in the monthly table.</p>
      </div>
    </>
  )
}
