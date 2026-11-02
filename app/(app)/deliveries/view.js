'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import { PageHead } from '../../ui/ui'
import { Icon } from '../../ui/icons'
import { DeliveryDetail, DeliveryForm, Toast } from '../../ui/delivery-panel'
import { SHIFTING, BILLING, CHECKS, codeKey, totals, fmtNum, fmtRs, fmtDate, fmtMonth, toCSV } from '@/lib/model.js'

const FILTER_KEYS = ['q', 'region', 'zone', 'branch', 'shifting', 'billing', 'type', 'month', 'invmonth', 'from', 'to', 'issue', 'balance']
const LABELS = { open: 'Open', all: 'On billing list', tracked: 'On billing list' }

const COLUMNS = [
  { key: 'branch_code', label: 'Branch', sort: (r) => codeKey(r.branch_code), csv: (r) => r.branch_code },
  { key: 'region', label: 'Region', csv: (r) => r.region },
  { key: 'delivered_on', label: 'Delivered', csv: (r) => r.delivered_on },
  { key: 'trunks_received', label: 'Trunks', num: true, total: 'trunks' },
  { key: 'stands_received', label: 'Stands', num: true, total: 'stands' },
  { key: 'trunks_used', label: 'Used', num: true, total: 'used' },
  { key: 'balance', label: 'Balance', num: true, total: 'balance' },
  { key: 'shifting_status', label: 'Shifting', csv: (r) => SHIFTING[r.shifting_status]?.label },
  { key: 'invoice_no', label: 'Invoice no.' },
  { key: 'invoice_amount', label: 'Invoice', num: true, money: true, total: 'invoiced', sort: (r) => Number(r.invoice_amount || 0) },
  { key: 'received', label: 'Received', num: true, money: true, total: 'received' },
  { key: 'outstanding', label: 'Outstanding', num: true, money: true, total: 'outstanding' },
  { key: 'age', label: 'Days', num: true, sort: (r) => r.age ?? -1 },
  { key: 'billing', label: 'Billing', csv: (r) => BILLING[r.billing]?.label },
]

function matches(r, f) {
  if (f.q) {
    const q = f.q.toLowerCase()
    const hay = [r.branch_code, r.region, r.zone, r.invoice_no, r.remarks, r.branch_label].filter(Boolean).join(' ').toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (f.region && (r.region || 'No region') !== f.region) return false
  if (f.zone && (r.zone || 'No zone') !== f.zone) return false
  if (f.branch && r.branch_code !== f.branch) return false
  if (f.shifting) {
    if (f.shifting === 'open' ? !['not_started', 'in_progress'].includes(r.shifting_status) : r.shifting_status !== f.shifting) return false
  }
  if (f.billing) {
    if (f.billing === 'open') { if (!['invoiced', 'partial'].includes(r.billing)) return false }
    else if (f.billing === 'all' || f.billing === 'tracked') { if (!r.billing_tracked) return false }
    else if (r.billing !== f.billing) return false
  }
  if (f.type && r.trunk_type !== f.type) return false
  if (f.month && r.month !== f.month) return false
  if (f.invmonth && !(r.invoice_date || r.delivered_on || '').startsWith(f.invmonth)) return false
  if (f.from && (!r.delivered_on || r.delivered_on < f.from)) return false
  if (f.to && (!r.delivered_on || r.delivered_on > f.to)) return false
  if (f.issue && (f.issue === 'any' ? !r.issues.length : !r.issues.includes(f.issue))) return false
  if (f.balance && r.balance <= 0) return false
  return true
}

export function DeliveriesView({ rows, branches, initial }) {
  const [f, setF] = useState(() => Object.fromEntries(FILTER_KEYS.map((k) => [k, initial[k] || ''])))
  const [sort, setSort] = useState(() => ({ key: initial.sort || 'delivered_on', dir: initial.dir || (initial.sort && initial.sort !== 'age' ? 'asc' : 'desc') }))
  const [openId, setOpenId] = useState(initial.open ? Number(initial.open) : null)
  const [mode, setMode] = useState(initial.new ? 'new' : initial.open ? 'view' : null)
  const [toast, setToast] = useState(null)
  const notify = useCallback((t) => setToast(t), [])
  const clearToast = useCallback(() => setToast(null), [])

  // keep the URL in step so a filtered view can be bookmarked or shared
  useEffect(() => {
    const p = new URLSearchParams()
    for (const k of FILTER_KEYS) if (f[k]) p.set(k, f[k])
    if (sort.key !== 'delivered_on' || sort.dir !== 'desc') { p.set('sort', sort.key); p.set('dir', sort.dir) }
    if (mode === 'view' && openId) p.set('open', openId)
    const qs = p.toString()
    window.history.replaceState(null, '', qs ? `?${qs}` : window.location.pathname)
  }, [f, sort, mode, openId])

  const regions = useMemo(() => [...new Set(rows.map((r) => r.region || 'No region'))].sort(), [rows])
  const zones = useMemo(() => [...new Set(rows.map((r) => r.zone || 'No zone'))].sort(), [rows])
  const filtered = useMemo(() => {
    const col = COLUMNS.find((c) => c.key === sort.key) || { key: sort.key }
    const get = col.sort || ((r) => r[sort.key])
    const out = rows.filter((r) => matches(r, f))
    out.sort((a, b) => {
      let x = get(a), y = get(b)
      if (x == null || x === '') return 1
      if (y == null || y === '') return -1
      const c = typeof x === 'number' && typeof y === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })
      return sort.dir === 'asc' ? c : -c
    })
    return out
  }, [rows, f, sort])
  const t = useMemo(() => totals(filtered), [filtered])
  const current = rows.find((r) => r.id === openId)

  const setFilter = (k) => (e) => setF((p) => ({ ...p, [k]: e.target.value }))
  const active = FILTER_KEYS.filter((k) => f[k] && k !== 'q')
  const chipText = (k) => {
    const v = f[k]
    if (k === 'shifting') return `Shifting: ${v === 'open' ? 'Not finished' : SHIFTING[v]?.label || v}`
    if (k === 'billing') return `Billing: ${v === 'open' ? 'Awaiting payment' : LABELS[v] || BILLING[v]?.label || v}`
    if (k === 'month') return `Delivered in ${fmtMonth(v)}`
    if (k === 'invmonth') return `Invoiced in ${fmtMonth(v)}`
    if (k === 'from') return `From ${fmtDate(v)}`
    if (k === 'to') return `To ${fmtDate(v)}`
    if (k === 'issue') return v === 'any' ? 'Has data issues' : CHECKS.find((c) => c.key === v)?.label || v
    if (k === 'balance') return 'Has unused trunks'
    if (k === 'branch') return `Branch ${v}`
    if (k === 'type') return `${v} trunks`
    return v
  }
  const onSort = (key) => setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: ['delivered_on', 'invoice_amount', 'received', 'outstanding', 'age', 'trunks_received', 'balance'].includes(key) ? 'desc' : 'asc' }))

  const exportCSV = () => {
    const cols = [
      ...COLUMNS.filter((c) => c.key !== 'billing'), { key: 'zone', label: 'Zone' }, { key: 'trunk_type', label: 'Trunk type' },
      { key: 'invoice_date', label: 'Invoice date' }, { key: 'receivable', label: 'Receivable' }, { key: 'payment_date', label: 'Payment date' },
      COLUMNS.find((c) => c.key === 'billing'), { key: 'remarks', label: 'Remarks' },
      { key: 'issues', label: 'Data issues', csv: (r) => r.issues.map((k) => CHECKS.find((c) => c.key === k)?.label).join('; ') },
    ]
    const blob = new Blob([toCSV(cols, filtered)], { type: 'text/csv;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `deliveries-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  const close = useCallback(() => { setMode(null); setOpenId(null) }, [])

  return (
    <>
      <PageHead title="Deliveries" sub="Every delivery of trunks to a branch: shifting progress and billing in one place">
        <button className="btn" onClick={exportCSV}><Icon name="download" />Export CSV</button>
        <button className="btn btn-primary" onClick={() => { setOpenId(null); setMode('new') }}><Icon name="plus" />New delivery</button>
      </PageHead>

      <div className="card">
        <div className="toolbar">
          <div className="search"><Icon name="search" /><input className="input" placeholder="Search branch, invoice, remarks…" value={f.q} onChange={setFilter('q')} /></div>
          <select className="select" value={f.region} onChange={setFilter('region')} aria-label="Region"><option value="">All regions</option>{regions.map((r) => <option key={r}>{r}</option>)}</select>
          <select className="select" value={f.zone} onChange={setFilter('zone')} aria-label="Zone"><option value="">All zones</option>{zones.map((z) => <option key={z}>{z}</option>)}</select>
          <select className="select" value={f.shifting} onChange={setFilter('shifting')} aria-label="Shifting">
            <option value="">Any shifting</option><option value="open">Not finished</option>
            {Object.entries(SHIFTING).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          <select className="select" value={f.billing} onChange={setFilter('billing')} aria-label="Billing">
            <option value="">Any billing</option><option value="all">On billing list</option><option value="open">Awaiting payment (any)</option>
            {Object.entries(BILLING).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}
          </select>
          <select className="select" value={f.issue} onChange={setFilter('issue')} aria-label="Data checks">
            <option value="">Any data</option><option value="any">Has data issues</option>
            {CHECKS.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}
          </select>
          <input type="date" className="input" value={f.from} onChange={setFilter('from')} aria-label="Delivered from" title="Delivered from" />
          <input type="date" className="input" value={f.to} onChange={setFilter('to')} aria-label="Delivered to" title="Delivered to" />
          <label className="toggle"><input type="checkbox" checked={!!f.balance} onChange={(e) => setF((p) => ({ ...p, balance: e.target.checked ? '1' : '' }))} />Unused trunks</label>
        </div>
        {active.length > 0 && (
          <div className="chips">
            {active.map((k) => <button key={k} className="chip" onClick={() => setF((p) => ({ ...p, [k]: '' }))}>{chipText(k)}<Icon name="x" /></button>)}
            <button className="btn btn-ghost btn-sm" onClick={() => setF(Object.fromEntries(FILTER_KEYS.map((k) => [k, ''])))}>Clear all</button>
          </div>
        )}

        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr>
                {COLUMNS.map((c) => (
                  <th key={c.key} className={`sortable${c.num ? ' r' : ''}`} onClick={() => onSort(c.key)} aria-sort={sort.key === c.key ? (sort.dir === 'asc' ? 'ascending' : 'descending') : undefined}>
                    {c.label}{sort.key === c.key && <span className="arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
                  </th>
                ))}
                <th aria-label="Data issues" />
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className={`clickable${r.id === openId ? ' selected' : ''}`} onClick={() => { setOpenId(r.id); setMode('view') }}>
                  <td className="branch-cell"><b>{r.branch_code}</b>{r.zone && <span>{r.zone}</span>}</td>
                  <td>{r.region || <span className="muted">—</span>}</td>
                  <td className="num">{fmtDate(r.delivered_on)}</td>
                  <td className="r num">{fmtNum(r.trunks_received)}</td>
                  <td className="r num">{fmtNum(r.stands_received)}</td>
                  <td className="r num">{fmtNum(r.trunks_used)}</td>
                  <td className={`r num${r.balance < 0 ? ' neg' : ''}`}>{fmtNum(r.balance)}</td>
                  <td><span className={`badge tone-${SHIFTING[r.shifting_status].tone}`}>{SHIFTING[r.shifting_status].label}</span></td>
                  <td className="small">{r.invoice_no || <span className="muted">—</span>}</td>
                  <td className="r num">{r.invoice_amount != null ? fmtNum(r.invoice_amount) : <span className="muted">—</span>}</td>
                  <td className="r num">{r.received ? fmtNum(r.received) : <span className="muted">—</span>}</td>
                  <td className="r num" style={{ color: r.outstanding ? 'var(--red)' : undefined, fontWeight: r.outstanding ? 600 : undefined }}>{r.outstanding ? fmtNum(r.outstanding) : <span className="muted">—</span>}</td>
                  <td className="r num" style={{ color: r.age > 60 ? 'var(--red)' : undefined }}>{r.age ?? <span className="muted">—</span>}</td>
                  <td><span className={`badge tone-${BILLING[r.billing].tone}`}>{BILLING[r.billing].label}</span></td>
                  <td className="c">{r.issues.length > 0 && <span className="issue-flag" title={r.issues.map((k) => CHECKS.find((c) => c.key === k)?.label).join('\n')}>!</span>}</td>
                </tr>
              ))}
              {!filtered.length && <tr><td colSpan={COLUMNS.length + 1}><div className="empty"><b>No deliveries match</b>Try removing a filter.</div></td></tr>}
            </tbody>
            {filtered.length > 0 && (
              <tfoot>
                <tr>
                  <td colSpan={3}>{fmtNum(filtered.length)} deliveries · {fmtNum(t.branchCount)} branches</td>
                  <td className="r num">{fmtNum(t.trunks)}</td>
                  <td className="r num">{fmtNum(t.stands)}</td>
                  <td className="r num">{fmtNum(t.used)}</td>
                  <td className="r num">{fmtNum(t.balance)}</td>
                  <td colSpan={2} />
                  <td className="r num">{fmtNum(t.invoiced)}</td>
                  <td className="r num">{fmtNum(t.received)}</td>
                  <td className="r num" style={{ color: 'var(--red)' }}>{fmtNum(t.outstanding)}</td>
                  <td colSpan={3} />
                </tr>
              </tfoot>
            )}
          </table>
        </div>
        <div className="table-foot">
          <span>Showing {fmtNum(filtered.length)} of {fmtNum(rows.length)} · amounts in Rs · receivable is after tax · click a row for details</span>
          <span>Outstanding in view: <b style={{ color: 'var(--text)' }}>{fmtRs(t.outstanding)}</b></span>
        </div>
      </div>

      {mode === 'view' && current && <DeliveryDetail key={current.id + current.updated_at} row={current} onClose={close} onEdit={() => setMode('edit')} notify={notify} />}
      {mode === 'edit' && current && <DeliveryForm row={current} branches={branches} allRows={rows} onClose={() => setMode('view')} onSaved={() => setMode('view')} notify={notify} />}
      {mode === 'new' && <DeliveryForm row={null} preset={f.branch ? { branch_code: f.branch } : {}} branches={branches} allRows={rows} onClose={close} onSaved={(id) => { setOpenId(id); setMode('view') }} notify={notify} />}
      <Toast toast={toast} onDone={clearToast} />
    </>
  )
}
