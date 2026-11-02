'use client'
import { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { PageHead } from './ui'
import { Icon } from './icons'
import { Drawer, Toast } from './delivery-panel'
import { saveGroup, deleteGroup } from '../actions'
import { fmtNum, fmtRs, codeKey } from '@/lib/model.js'

const KINDS = {
  region: { title: 'Regions', noun: 'region', Noun: 'Region', other: 'Zones', icon: 'map' },
  zone: { title: 'Zones', noun: 'zone', Noun: 'Zone', other: 'Regions', icon: 'map' },
}

/** Manage regions or zones: totals per row, add, rename (branches follow), notes, delete or merge. */
export function GroupsView({ kind, rows, unassigned }) {
  const K = KINDS[kind]
    const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [editing, setEditing] = useState(null) // null | 'new' | row
  const [toast, setToast] = useState(null)
  const notify = useCallback((t) => setToast(t), [])

  const list = useMemo(() => rows
    .filter((r) => !q || [r.name, r.notes, ...r.branches, ...r.others.map((o) => o.name)].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const x = a[sort.key], y = b[sort.key]
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.dir === 'asc' ? c : -c
    }), [rows, q, sort])
  const sum = (k) => list.reduce((a, r) => a + r[k], 0)
  const cols = [['name', K.Noun], ['others', K.other], ['branchCount', 'Branches', true], ['deliveries', 'Deliveries', true], ['trunks', 'Trunks', true], ['used', 'Used', true], ['balance', 'Unused', true], ['notStarted', 'Shifting not started', true], ['invoiced', 'Invoiced', true], ['outstanding', 'Outstanding', true]]
  list.forEach((r) => { r.branchCount = r.branches.length })

  return (
    <>
      <PageHead title={K.title} sub={`${rows.length} ${K.noun}s · rename, merge or remove them here and every branch follows`}>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" />New {K.noun}</button>
      </PageHead>

      {unassigned && (
        <div className="warn-box" style={{ marginBottom: 16, alignItems: 'center' }}>
          <Icon name="alert" />
          <span style={{ flex: 1 }}><b>{unassigned.branches.length} branches have no {K.noun}</b> ({unassigned.branches.slice(0, 12).join(', ')}{unassigned.branches.length > 12 ? '…' : ''}). Open a branch to set it.</span>
          <Link className="btn btn-sm" href={`/branches?${kind}=__none`}>Show them</Link>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <div className="search"><Icon name="search" /><input className="input" placeholder={`Search ${K.noun}, branch code or ${K.other.toLowerCase().slice(0, -1)}…`} value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div className="table-wrap auto">
          <table className="tbl">
            <thead><tr>{cols.map(([k, l, num]) => (
              <th key={k} className={`${k !== 'others' ? 'sortable' : ''}${num ? ' r' : ''}`} onClick={() => k !== 'others' && setSort((s) => ({ key: k, dir: s.key === k && s.dir === (num ? 'desc' : 'asc') ? (num ? 'asc' : 'desc') : num ? 'desc' : 'asc' }))}>
                {l}{sort.key === k && <span className="arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
              </th>))}<th /></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.name} className="clickable" onClick={() => setEditing(r)}>
                  <td><b>{r.name}</b>{r.notes && <div className="small muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes}</div>}</td>
                  <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{r.others.map((o) => <span key={o.name} className="badge plain" title={`${o.n} branches`}>{o.name} · {o.n}</span>)}{!r.others.length && <span className="muted">—</span>}</div></td>
                  <td className="r num">{r.branches.length || <span className="muted">0</span>}</td>
                  <td className="r num">{r.deliveries}</td>
                  <td className="r num">{fmtNum(r.trunks)}</td>
                  <td className="r num">{fmtNum(r.used)}</td>
                  <td className={`r num${r.balance < 0 ? ' neg' : ''}`}>{fmtNum(r.balance)}</td>
                  <td className="r num">{r.notStarted || <span className="muted">—</span>}</td>
                  <td className="r num">{r.invoiced ? fmtNum(r.invoiced) : <span className="muted">—</span>}</td>
                  <td className="r num" style={{ color: r.outstanding ? 'var(--red)' : undefined, fontWeight: r.outstanding ? 600 : undefined }}>{r.outstanding ? fmtNum(r.outstanding) : <span className="muted">—</span>}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <Link className="btn btn-ghost btn-sm" href={`/branches?${kind}=${encodeURIComponent(r.name)}`}>Branches</Link>
                    <Link className="btn btn-ghost btn-sm" href={`/deliveries?${kind}=${encodeURIComponent(r.name)}`}>Deliveries</Link>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={11}><div className="empty"><b>No {K.noun}s match</b></div></td></tr>}
            </tbody>
            {list.length > 0 && (
              <tfoot><tr>
                <td colSpan={2}>{list.length} {K.noun}s</td><td className="r num">{fmtNum(sum('branchCount'))}</td><td className="r num">{fmtNum(sum('deliveries'))}</td>
                <td className="r num">{fmtNum(sum('trunks'))}</td><td className="r num">{fmtNum(sum('used'))}</td><td className="r num">{fmtNum(sum('balance'))}</td>
                <td className="r num">{fmtNum(sum('notStarted'))}</td><td className="r num">{fmtNum(sum('invoiced'))}</td><td className="r num" style={{ color: 'var(--red)' }}>{fmtNum(sum('outstanding'))}</td><td />
              </tr></tfoot>
            )}
          </table>
        </div>
        <div className="table-foot"><span>Click a {K.noun} to rename it, add notes, or delete / merge it · amounts in Rs</span><span>Outstanding: <b style={{ color: 'var(--text)' }}>{fmtRs(sum('outstanding'))}</b></span></div>
      </div>

      {editing && <GroupForm K={K} kind={kind} item={editing === 'new' ? null : editing} all={rows} onClose={() => setEditing(null)} notify={notify} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}

function GroupForm({ K, kind, item: region, all, onClose, notify }) {
  const [v, setV] = useState({ name: region?.name || '', notes: region?.notes || '' })
  const [errors, setErrors] = useState({})
  const [pending, start] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const [moveTo, setMoveTo] = useState('')
  const others = all.filter((r) => r.name !== region?.name)

  const save = (e) => {
    e.preventDefault()
    start(async () => {
      try {
        const res = await saveGroup(kind, { ...v, originalName: region?.name })
        if (!res.ok) { setErrors(res.errors || {}); return }
        notify({ text: region ? (res.name !== region.name ? `Renamed to ${res.name} on ${region.branches.length} branches` : `${K.Noun} saved`) : `${K.Noun} added` })
        onClose()
      } catch (err) { notify({ text: err.message, error: true }) }
    })
  }
  const remove = () => start(async () => {
    try {
      const res = await deleteGroup(kind, region.name, moveTo || null)
      if (!res.ok) { notify({ text: res.error, error: true }); return }
      notify({ text: moveTo ? `Merged into ${moveTo}` : `${K.Noun} deleted` })
      onClose()
    } catch (err) { notify({ text: err.message, error: true }) }
  })

  return (
    <Drawer title={region ? `${K.Noun} ${region.name}` : `New ${K.noun}`} sub={region ? `${region.branches.length} branches · ${region.deliveries} deliveries` : `Add a ${K.noun} before any branch uses it`} onClose={onClose}
      footer={confirm ? (
        <><button className="btn" onClick={() => setConfirm(false)}>Back</button>
          <button className="btn btn-danger" disabled={pending} onClick={remove}>{pending ? 'Working…' : moveTo ? `Move branches & delete` : `Delete ${K.noun}`}</button></>
      ) : (
        <>{region ? <button className="btn btn-danger" onClick={() => setConfirm(true)}><Icon name="trash" />Delete or merge</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={onClose}>Cancel</button><button form="region-form" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button></div></>
      )}>
      {confirm ? (
        <div className="stack" style={{ gap: 14 }}>
          <div className="warn-box"><Icon name="alert" /><span>Deleting <b>{region.name}</b> affects {region.branches.length} branches. Move them to another {K.noun} (a merge), or leave them without a {K.noun}.</span></div>
          <div className="field">
            <label htmlFor="moveTo">Move its branches to</label>
            <select id="moveTo" className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Nowhere (leave them without a {K.noun})</option>
              {others.map((r) => <option key={r.name} value={r.name}>{r.name} ({r.branches.length} branches)</option>)}
            </select>
          </div>
        </div>
      ) : (
        <form id="region-form" onSubmit={save} className="stack" style={{ gap: 14 }} noValidate>
          <div className={`field${errors.name ? ' has-err' : ''}`}>
            <label htmlFor="rname">{K.Noun} name <span className="req">*</span></label>
            <input id="rname" className="input" value={v.name} onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))} autoFocus />
            {errors.name ? <div className="err">{errors.name}</div> : region ? <div className="hint">Renaming updates all {region.branches.length} branches straight away.</div> : null}
          </div>
          <div className="field"><label htmlFor="rnotes">Notes</label><textarea id="rnotes" className="textarea" value={v.notes} onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))} placeholder={kind === "region" ? "e.g. regional office contact" : "e.g. which areas this zone covers"} /></div>
          {region && (
            <div className="form-section">
              <h3>Branches in this {K.noun}</h3>
              {region.branches.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[...region.branches].sort((a, b) => codeKey(a).localeCompare(codeKey(b))).map((c) => <Link key={c} href={`/branches/${encodeURIComponent(c)}`} className="btn btn-sm">{c}</Link>)}
                </div>
              ) : <p className="muted" style={{ margin: 0 }}>No branches yet. Pick this {K.noun} on a branch to add it.</p>}
            </div>
          )}
        </form>
      )}
    </Drawer>
  )
}
