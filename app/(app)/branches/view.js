'use client'
import { useCallback, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { PageHead } from '../../ui/ui'
import { Icon } from '../../ui/icons'
import { Toast } from '../../ui/delivery-panel'
import { BranchForm } from '../../ui/branch-form'
import { codeKey, fmtNum, fmtRs, fmtDate, toCSV } from '@/lib/model.js'

const COLS = [
  { key: 'code', label: 'Branch', sort: (r) => codeKey(r.code) },
  { key: 'region', label: 'Region' },
  { key: 'zone', label: 'Zone' },
  { key: 'deliveries', label: 'Deliveries', num: true },
  { key: 'trunks', label: 'Trunks', num: true },
  { key: 'used', label: 'Used', num: true },
  { key: 'balance', label: 'Unused', num: true },
  { key: 'notStarted', label: 'Shifting not started', num: true },
  { key: 'invoiced', label: 'Invoiced', num: true },
  { key: 'outstanding', label: 'Outstanding', num: true },
  { key: 'last', label: 'Last delivery' },
]

export function BranchesView({ rows, initialRegion = '' }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [region, setRegion] = useState(initialRegion)
  const [zone, setZone] = useState('')
  const [only, setOnly] = useState('')
  const [sort, setSort] = useState({ key: 'code', dir: 'asc' })
  const [editing, setEditing] = useState(null) // null | 'new' | branch row
  const [toast, setToast] = useState(null)
  const notify = useCallback((t) => setToast(t), [])

  const regions = useMemo(() => [...new Set(rows.map((r) => r.region || 'No region'))].sort(), [rows])
  const zones = useMemo(() => [...new Set(rows.map((r) => r.zone || 'No zone'))].sort(), [rows])
  const list = useMemo(() => {
    const col = COLS.find((c) => c.key === sort.key)
    const get = col.sort || ((r) => r[sort.key])
    return rows
      .filter((r) => !q || [r.code, r.name, r.region, r.zone, r.notes].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()))
      .filter((r) => !region || (r.region || 'No region') === region)
      .filter((r) => !zone || (r.zone || 'No zone') === zone)
      .filter((r) => !only || (only === 'outstanding' ? r.outstanding > 0 : only === 'notStarted' ? r.notStarted > 0 : only === 'unused' ? r.balance > 0 : only === 'noRegion' ? !r.region : true))
      .sort((a, b) => {
        let x = get(a), y = get(b)
        if (x == null || x === '') return 1
        if (y == null || y === '') return -1
        const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y), undefined, { numeric: true })
        return sort.dir === 'asc' ? c : -c
      })
  }, [rows, q, region, zone, only, sort])
  const sum = (k) => list.reduce((a, r) => a + (r[k] || 0), 0)

  const exportCSV = () => {
    const blob = new Blob([toCSV([...COLS, { key: 'name', label: 'Name' }, { key: 'received', label: 'Received' }, { key: 'notes', label: 'Notes' }], list)], { type: 'text/csv;charset=utf-8' })
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `branches-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click()
    URL.revokeObjectURL(a.href)
  }

  return (
    <>
      <PageHead title="Branches" sub={`${rows.length} branches and departments that have received trunks`}>
        <button className="btn" onClick={exportCSV}><Icon name="download" />Export CSV</button>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" />New branch</button>
      </PageHead>
      <div className="card">
        <div className="toolbar">
          <div className="search"><Icon name="search" /><input className="input" placeholder="Search code, name, region…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
          <select className="select" value={region} onChange={(e) => setRegion(e.target.value)} aria-label="Region"><option value="">All regions</option>{regions.map((r) => <option key={r}>{r}</option>)}</select>
          <select className="select" value={zone} onChange={(e) => setZone(e.target.value)} aria-label="Zone"><option value="">All zones</option>{zones.map((z) => <option key={z}>{z}</option>)}</select>
          <div className="seg">
            {[['', 'All'], ['outstanding', 'Owing money'], ['notStarted', 'Shifting pending'], ['unused', 'Unused trunks'], ['noRegion', 'No region']].map(([k, l]) => (
              <button key={k} className={only === k ? 'on' : ''} onClick={() => setOnly(k)}>{l}</button>
            ))}
          </div>
        </div>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr>{COLS.map((c) => (
              <th key={c.key} className={`sortable${c.num ? ' r' : ''}`} onClick={() => setSort((s) => ({ key: c.key, dir: s.key === c.key && s.dir === 'asc' ? 'desc' : c.num ? 'desc' : 'asc' }))}>
                {c.label}{sort.key === c.key && <span className="arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
              </th>))}<th /></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.code} className="clickable" onClick={() => router.push(`/branches/${encodeURIComponent(r.code)}`)}>
                  <td className="branch-cell"><b>{r.code}</b>{r.name && r.name !== r.code && <span>{r.name}</span>}</td>
                  <td>{r.region || <span className="badge tone-amber plain">Not set</span>}</td>
                  <td>{r.zone || <span className="muted">—</span>}</td>
                  <td className="r num">{r.deliveries}</td>
                  <td className="r num">{fmtNum(r.trunks)}</td>
                  <td className="r num">{fmtNum(r.used)}</td>
                  <td className={`r num${r.balance < 0 ? ' neg' : ''}`}>{fmtNum(r.balance)}</td>
                  <td className="r num">{r.notStarted || <span className="muted">—</span>}</td>
                  <td className="r num">{r.invoiced ? fmtNum(r.invoiced) : <span className="muted">—</span>}</td>
                  <td className="r num" style={{ color: r.outstanding ? 'var(--red)' : undefined, fontWeight: r.outstanding ? 600 : undefined }}>{r.outstanding ? fmtNum(r.outstanding) : <span className="muted">—</span>}</td>
                  <td className="num">{fmtDate(r.last)}</td>
                  <td><button className="btn btn-ghost btn-sm" onClick={(e) => { e.stopPropagation(); setEditing(r) }} aria-label={`Edit branch ${r.code}`}><Icon name="edit" /></button></td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={COLS.length + 1}><div className="empty"><b>No branches match</b></div></td></tr>}
            </tbody>
            {list.length > 0 && (
              <tfoot><tr>
                <td colSpan={3}>{list.length} branches</td>
                <td className="r num">{fmtNum(sum('deliveries'))}</td><td className="r num">{fmtNum(sum('trunks'))}</td><td className="r num">{fmtNum(sum('used'))}</td>
                <td className="r num">{fmtNum(sum('balance'))}</td><td className="r num">{fmtNum(sum('notStarted'))}</td><td className="r num">{fmtNum(sum('invoiced'))}</td>
                <td className="r num" style={{ color: 'var(--red)' }}>{fmtNum(sum('outstanding'))}</td><td colSpan={2} />
              </tr></tfoot>
            )}
          </table>
        </div>
        <div className="table-foot"><span>Amounts in Rs · outstanding is after tax · click a branch for its full history</span><span>Outstanding in view: <b style={{ color: 'var(--text)' }}>{fmtRs(sum('outstanding'))}</b></span></div>
      </div>
      {editing && <BranchForm branch={editing === 'new' ? null : editing} allBranches={rows} onClose={() => setEditing(null)} notify={notify} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}
