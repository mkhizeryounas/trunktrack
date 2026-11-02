import Link from 'next/link'
import { loadAll } from '@/lib/data.js'
import { totals, groupBy, pct, fmtNum, fmtRs, fmtRsShort, fmtDate, fmtMonth, SHIFTING, BILLING } from '@/lib/model.js'
import { PageHead, Stat, Card, Empty, SetupNotice, BillingBadge, ShiftingBadge } from '../ui/ui'
import { BarChart, Donut, HBars } from '../ui/charts'
import { Icon } from '../ui/icons'

export const metadata = { title: 'Dashboard' }

const TONE_COLOR = { green: 'var(--chart-2)', amber: 'var(--chart-3)', red: 'var(--chart-4)', blue: 'var(--chart-1)', gray: 'var(--chart-5)' }

const shortMonth = (m, i) => {
  const [y, mo] = m.split('-')
  return fmtMonth(m).slice(0, 3) + (i === 0 || mo === '01' ? ` ’${y.slice(2)}` : '')
}

function lastMonths(rows, n = 12) {
  const months = rows.map((r) => r.month).filter(Boolean).sort()
  if (!months.length) return []
  let [y, m] = months[months.length - 1].split('-').map(Number)
  const out = []
  for (let i = 0; i < n; i++) {
    out.unshift(`${y}-${String(m).padStart(2, '0')}`)
    if (--m === 0) { m = 12; y-- }
  }
  return out
}

export default async function Dashboard() {
  const { deliveries: rows, branches, setupError } = await loadAll()
  if (setupError) return <><PageHead title="Dashboard" /><SetupNotice message={setupError} /></>
  if (!rows.length) {
    return (
      <>
        <PageHead title="Dashboard" />
        <div className="card"><Empty icon="upload" title="No data yet">Load the workbook with <code>npm run import -- data.xlsx</code>, or <Link href="/deliveries?new=1" style={{ color: 'var(--brand)' }}>adding a delivery</Link>.</Empty></div>
      </>
    )
  }

  const t = totals(rows)
  const tracked = rows.filter((r) => r.billing_tracked)
  const tt = totals(tracked)
  const open = rows.filter((r) => r.outstanding > 0).sort((a, b) => (b.age ?? 0) - (a.age ?? 0))
  const notInvoiced = tracked.filter((r) => r.billing === 'not_invoiced')
  const shiftingBase = rows.filter((r) => r.shifting_status !== 'official').length
  const notStarted = rows.filter((r) => r.shifting_status === 'not_started').sort((a, b) => (a.delivered_on || '9').localeCompare(b.delivered_on || '9'))
  const issues = rows.filter((r) => r.issues.length).length

  // monthly trunks, split by shifting state
  const months = lastMonths(rows)
  const byMonth = groupBy(rows.filter((r) => r.month), 'month')
  const monthly = months.map((m, i) => {
    const list = byMonth[m] || []
    return {
      label: fmtMonth(m), short: shortMonth(m, i), href: `/deliveries?month=${m}`,
      values: {
        done: list.filter((r) => r.shifting_status === 'complete').reduce((a, r) => a + r.trunks_received, 0),
        pending: list.filter((r) => r.shifting_status !== 'complete').reduce((a, r) => a + r.trunks_received, 0),
      },
    }
  })

  // billing by invoice month (tracked only)
  const billMonths = lastMonths(tracked.map((r) => ({ month: (r.invoice_date || r.delivered_on || '').slice(0, 7) || null })), 6)
  const billing = billMonths.map((m, i) => {
    const list = tracked.filter((r) => (r.invoice_date || r.delivered_on || '').startsWith(m))
    return {
      label: fmtMonth(m), short: shortMonth(m, i), href: `/deliveries?billing=all&invmonth=${m}`,
      values: { received: list.reduce((a, r) => a + r.received, 0), outstanding: list.reduce((a, r) => a + r.outstanding, 0) },
    }
  })

  const shiftParts = Object.entries(SHIFTING).map(([k, v]) => ({ key: k, label: v.label, color: TONE_COLOR[v.tone], value: rows.filter((r) => r.shifting_status === k).length })).filter((p) => p.value)
  const billParts = Object.entries(BILLING).filter(([k]) => k !== 'no_record').map(([k, v]) => ({ key: k, label: v.label, color: TONE_COLOR[v.tone], value: tracked.filter((r) => r.billing === k).length })).filter((p) => p.value)

  const byRegion = groupBy(rows, (r) => r.region || 'No region')
  const regionRows = Object.entries(byRegion).map(([reg, list]) => ({ reg, ...totals(list) }))
  const outstandingByRegion = regionRows.filter((r) => r.outstanding > 0).sort((a, b) => b.outstanding - a.outstanding)
  const balanceByRegion = regionRows.filter((r) => r.trunks > 0).sort((a, b) => b.trunks - a.trunks).slice(0, 10)
  const latest = rows.map((r) => r.delivered_on).filter(Boolean).sort().at(-1)

  return (
    <>
      <PageHead title="Dashboard" sub={`${fmtNum(t.count)} deliveries to ${fmtNum(branches.length)} branches · latest delivery ${fmtDate(latest)}`}>
        <Link href="/reports" className="btn"><Icon name="chart" />Reports</Link>
        <Link href="/deliveries?new=1" className="btn btn-primary"><Icon name="plus" />New delivery</Link>
      </PageHead>

      <div className="stats">
        <Stat icon="box" label="Trunks delivered" value={fmtNum(t.trunks)} foot={`${fmtNum(t.stands)} stands · ${fmtNum(t.count)} deliveries`} href="/deliveries" />
        <Stat icon="truck" label="Trunks in use" value={`${pct(t.used, t.trunks)}%`}
          bar={[{ pct: Math.min(100, pct(t.used, t.trunks)), color: 'var(--chart-1)', title: 'Used' }]}
          foot={<>{fmtNum(t.used)} used · <b>{fmtNum(t.trunks - t.used)}</b> still unused</>} href="/reports#utilisation" />
        <Stat icon="check" label="Record shifting done" value={`${pct(t.shiftingDone, shiftingBase)}%`}
          bar={[{ pct: pct(t.shiftingDone, shiftingBase), color: 'var(--chart-2)', title: 'Complete' }]}
          foot={<>{fmtNum(t.shiftingDone)} complete · <b>{fmtNum(notStarted.length)}</b> not started</>} href="/deliveries?shifting=open" />
        <Stat icon="alert" label="Data checks" value={fmtNum(issues)} foot="deliveries need a look" href="/issues" />
      </div>
      <div className="stats">
        <Stat icon="file" label="Invoiced" value={fmtRsShort(tt.invoiced)} foot={`${fmtRs(tt.receivable)} receivable after tax`} href="/deliveries?billing=all" />
        <Stat icon="wallet" label="Received" value={fmtRsShort(tt.received)}
          bar={[{ pct: pct(tt.received, tt.receivable), color: 'var(--chart-2)', title: 'Collected' }]}
          foot={`${pct(tt.received, tt.receivable)}% of receivable collected`} href="/deliveries?billing=paid" />
        <Stat icon="clock" label="Outstanding" value={fmtRsShort(tt.outstanding)}
          foot={open.length ? <>{open.length} invoices · oldest <b>{open[0].age} days</b></> : 'Nothing outstanding'} href="/deliveries?billing=open" />
        <Stat icon="info" label="Not invoiced yet" value={fmtNum(notInvoiced.length)} foot="billable deliveries without an invoice" href="/deliveries?billing=not_invoiced" />
      </div>

      <div className="cols-2" style={{ marginBottom: 16 }}>
        <Card title="Trunks delivered per month" sub="Click a bar to see that month's deliveries"
          action={<div className="legend"><span><i className="dot" style={{ background: 'var(--chart-2)' }} />Shifting complete</span><span><i className="dot" style={{ background: 'var(--chart-3)' }} />Shifting pending</span></div>}>
          <BarChart data={monthly} series={[{ key: 'done', label: 'Shifting complete', color: 'var(--chart-2)' }, { key: 'pending', label: 'Shifting pending', color: 'var(--chart-3)' }]} format={fmtNum} />
        </Card>
        <Card title="Record shifting" sub="All deliveries">
          <div className="donut-wrap">
            <Donut parts={shiftParts} center={`${pct(t.shiftingDone, shiftingBase)}%`} sub="complete" />
            <div className="donut-legend">
              {shiftParts.map((p) => (
                <Link key={p.key} href={`/deliveries?shifting=${p.key}`}><i className="dot" style={{ background: p.color }} /><span>{p.label}</span><b className="num">{p.value}</b></Link>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="cols-2" style={{ marginBottom: 16 }}>
        <Card title="Collections by invoice month" sub="Receivable after 5.5% tax, last 6 months"
          action={<div className="legend"><span><i className="dot" style={{ background: 'var(--chart-2)' }} />Received</span><span><i className="dot" style={{ background: 'var(--chart-4)' }} />Outstanding</span></div>}>
          <BarChart data={billing} series={[{ key: 'received', label: 'Received', color: 'var(--chart-2)' }, { key: 'outstanding', label: 'Outstanding', color: 'var(--chart-4)' }]} format={fmtRs} />
        </Card>
        <Card title="Billing status" sub={`${tracked.length} deliveries on the billing list`}>
          <div className="donut-wrap">
            <Donut parts={billParts} center={tracked.length} sub="billed" />
            <div className="donut-legend">
              {billParts.map((p) => (
                <Link key={p.key} href={`/deliveries?billing=${p.key}`}><i className="dot" style={{ background: p.color }} /><span>{p.label}</span><b className="num">{p.value}</b></Link>
              ))}
            </div>
          </div>
        </Card>
      </div>

      <div className="cols-2-even" style={{ marginBottom: 16 }}>
        <Card title="Outstanding by region" action={<Link className="btn btn-sm" href="/reports#aging">Aging report</Link>}>
          {outstandingByRegion.length ? (
            <HBars format={fmtRs} rows={outstandingByRegion.map((r) => ({ label: r.reg, href: `/deliveries?billing=open&region=${encodeURIComponent(r.reg)}`, value: r.outstanding, parts: [{ value: r.outstanding, color: 'var(--chart-4)', title: 'Outstanding' }] }))} />
          ) : <Empty icon="check" title="All collected" />}
        </Card>
        <Card title="Trunks by region" sub="Used vs still unused"
          action={<div className="legend"><span><i className="dot" style={{ background: 'var(--chart-1)' }} />Used</span><span><i className="dot" style={{ background: 'var(--border-strong)' }} />Unused</span></div>}>
          <HBars format={fmtNum} rows={balanceByRegion.map((r) => ({ label: r.reg, href: `/deliveries?region=${encodeURIComponent(r.reg)}`, value: r.trunks, parts: [{ value: Math.min(r.used, r.trunks), color: 'var(--chart-1)', title: 'Used' }, { value: Math.max(0, r.trunks - r.used), color: 'var(--border-strong)', title: 'Unused' }] }))} />
        </Card>
      </div>

      <div className="cols-2-even">
        <Card title="Oldest unpaid invoices" action={<Link className="btn btn-sm" href="/deliveries?billing=open&sort=age">See all {open.length}</Link>}>
          {open.length ? (
            <div className="list">
              {open.slice(0, 6).map((r) => (
                <Link key={r.id} href={`/deliveries?open=${r.id}`} className="list-item">
                  <div><div className="li-title">Branch {r.branch_label} <span className="muted small">· {r.region || 'No region'}</span></div><div className="li-sub">{r.invoice_no || 'No invoice no.'} · invoiced {fmtDate(r.invoice_date || r.delivered_on)}</div></div>
                  <div style={{ textAlign: 'right' }}><div className="num" style={{ fontWeight: 620 }}>{fmtRs(r.outstanding)}</div><div className="li-sub" style={{ color: r.age > 60 ? 'var(--red)' : undefined }}>{r.age} days</div></div>
                </Link>
              ))}
            </div>
          ) : <Empty icon="check" title="Nothing outstanding" />}
        </Card>
        <Card title="Record shifting not started" action={<Link className="btn btn-sm" href="/deliveries?shifting=not_started&sort=delivered_on">See all {notStarted.length}</Link>}>
          {notStarted.length ? (
            <div className="list">
              {notStarted.slice(0, 6).map((r) => (
                <Link key={r.id} href={`/deliveries?open=${r.id}`} className="list-item">
                  <div><div className="li-title">Branch {r.branch_label} <span className="muted small">· {r.region || 'No region'}</span></div><div className="li-sub">{r.trunks_received} trunks · delivered {fmtDate(r.delivered_on)}</div></div>
                  <div style={{ textAlign: 'right' }}><ShiftingBadge status={r.shifting_status} /><div className="li-sub" style={{ marginTop: 3 }}>{r.billing_tracked ? <BillingBadge status={r.billing} /> : null}</div></div>
                </Link>
              ))}
            </div>
          ) : <Empty icon="check" title="Every delivery has started shifting" />}
        </Card>
      </div>
    </>
  )
}
