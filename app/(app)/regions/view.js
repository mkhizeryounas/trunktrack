'use client'
import { useCallback, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { PageHead, Card } from '../../ui/ui'
import { Icon } from '../../ui/icons'
import { Drawer, Toast } from '../../ui/delivery-panel'
import { saveRegion, deleteRegion, renameBranchField } from '../../actions'
import { fmtNum, fmtRs, codeKey } from '@/lib/model.js'

export function RegionsView({ rows, unassigned, zones }) {
  const router = useRouter()
  const [q, setQ] = useState('')
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' })
  const [editing, setEditing] = useState(null) // null | 'new' | row
  const [toast, setToast] = useState(null)
  const notify = useCallback((t) => setToast(t), [])

  const list = useMemo(() => rows
    .filter((r) => !q || [r.name, r.notes, ...r.branches, ...r.zones.map((z) => z.zone)].filter(Boolean).join(' ').toLowerCase().includes(q.toLowerCase()))
    .sort((a, b) => {
      const x = a[sort.key], y = b[sort.key]
      const c = typeof x === 'number' ? x - y : String(x).localeCompare(String(y))
      return sort.dir === 'asc' ? c : -c
    }), [rows, q, sort])
  const sum = (k) => list.reduce((a, r) => a + r[k], 0)
  const cols = [['name', 'Region'], ['zones', 'Zones'], ['branchCount', 'Branches', true], ['deliveries', 'Deliveries', true], ['trunks', 'Trunks', true], ['used', 'Used', true], ['balance', 'Unused', true], ['notStarted', 'Shifting not started', true], ['invoiced', 'Invoiced', true], ['outstanding', 'Outstanding', true]]
  list.forEach((r) => { r.branchCount = r.branches.length })

  return (
    <>
      <PageHead title="Regions" sub={`${rows.length} regions · rename, merge or remove them here and every branch follows`}>
        <button className="btn btn-primary" onClick={() => setEditing('new')}><Icon name="plus" />New region</button>
      </PageHead>

      {unassigned && (
        <div className="warn-box" style={{ marginBottom: 16, alignItems: 'center' }}>
          <Icon name="alert" />
          <span style={{ flex: 1 }}><b>{unassigned.branches.length} branches have no region</b> ({unassigned.branches.join(', ')}). Open a branch to set it.</span>
          <Link className="btn btn-sm" href="/branches">Go to branches</Link>
        </div>
      )}

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="toolbar">
          <div className="search"><Icon name="search" /><input className="input" placeholder="Search region, branch code or zone…" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        </div>
        <div className="table-wrap auto">
          <table className="tbl">
            <thead><tr>{cols.map(([k, l, num]) => (
              <th key={k} className={`${k !== 'zones' ? 'sortable' : ''}${num ? ' r' : ''}`} onClick={() => k !== 'zones' && setSort((s) => ({ key: k, dir: s.key === k && s.dir === (num ? 'desc' : 'asc') ? (num ? 'asc' : 'desc') : num ? 'desc' : 'asc' }))}>
                {l}{sort.key === k && <span className="arrow">{sort.dir === 'asc' ? '▲' : '▼'}</span>}
              </th>))}<th /></tr></thead>
            <tbody>
              {list.map((r) => (
                <tr key={r.name} className="clickable" onClick={() => setEditing(r)}>
                  <td><b>{r.name}</b>{r.notes && <div className="small muted" style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.notes}</div>}</td>
                  <td><div style={{ display: 'flex', gap: 4, flexWrap: 'wrap' }}>{r.zones.map((z) => <span key={z.zone} className="badge plain" title={`${z.n} branches`}>{z.zone} · {z.n}</span>)}{!r.zones.length && <span className="muted">—</span>}</div></td>
                  <td className="r num">{r.branches.length || <span className="muted">0</span>}</td>
                  <td className="r num">{r.deliveries}</td>
                  <td className="r num">{fmtNum(r.trunks)}</td>
                  <td className="r num">{fmtNum(r.used)}</td>
                  <td className={`r num${r.balance < 0 ? ' neg' : ''}`}>{fmtNum(r.balance)}</td>
                  <td className="r num">{r.notStarted || <span className="muted">—</span>}</td>
                  <td className="r num">{r.invoiced ? fmtNum(r.invoiced) : <span className="muted">—</span>}</td>
                  <td className="r num" style={{ color: r.outstanding ? 'var(--red)' : undefined, fontWeight: r.outstanding ? 600 : undefined }}>{r.outstanding ? fmtNum(r.outstanding) : <span className="muted">—</span>}</td>
                  <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                    <Link className="btn btn-ghost btn-sm" href={`/branches?region=${encodeURIComponent(r.name)}`}>Branches</Link>
                    <Link className="btn btn-ghost btn-sm" href={`/deliveries?region=${encodeURIComponent(r.name)}`}>Deliveries</Link>
                  </td>
                </tr>
              ))}
              {!list.length && <tr><td colSpan={11}><div className="empty"><b>No regions match</b></div></td></tr>}
            </tbody>
            {list.length > 0 && (
              <tfoot><tr>
                <td colSpan={2}>{list.length} regions</td><td className="r num">{fmtNum(sum('branchCount'))}</td><td className="r num">{fmtNum(sum('deliveries'))}</td>
                <td className="r num">{fmtNum(sum('trunks'))}</td><td className="r num">{fmtNum(sum('used'))}</td><td className="r num">{fmtNum(sum('balance'))}</td>
                <td className="r num">{fmtNum(sum('notStarted'))}</td><td className="r num">{fmtNum(sum('invoiced'))}</td><td className="r num" style={{ color: 'var(--red)' }}>{fmtNum(sum('outstanding'))}</td><td />
              </tr></tfoot>
            )}
          </table>
        </div>
        <div className="table-foot"><span>Click a region to rename it, add notes, or delete / merge it · amounts in Rs</span><span>Outstanding: <b style={{ color: 'var(--text)' }}>{fmtRs(sum('outstanding'))}</b></span></div>
      </div>

      <ZonesCard zones={zones} notify={notify} />

      {editing && <RegionForm region={editing === 'new' ? null : editing} all={rows} onClose={() => setEditing(null)} notify={notify} onRenamed={() => router.refresh()} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}

function RegionForm({ region, all, onClose, notify }) {
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
        const res = await saveRegion({ ...v, originalName: region?.name })
        if (!res.ok) { setErrors(res.errors || {}); return }
        notify({ text: region ? (res.name !== region.name ? `Renamed to ${res.name} on ${region.branches.length} branches` : 'Region saved') : 'Region added' })
        onClose()
      } catch (err) { notify({ text: err.message, error: true }) }
    })
  }
  const remove = () => start(async () => {
    try {
      const res = await deleteRegion(region.name, moveTo || null)
      if (!res.ok) { notify({ text: res.error, error: true }); return }
      notify({ text: moveTo ? `Merged into ${moveTo}` : 'Region deleted' })
      onClose()
    } catch (err) { notify({ text: err.message, error: true }) }
  })

  return (
    <Drawer title={region ? `Region ${region.name}` : 'New region'} sub={region ? `${region.branches.length} branches · ${region.deliveries} deliveries` : 'Add a region before any branch uses it'} onClose={onClose}
      footer={confirm ? (
        <><button className="btn" onClick={() => setConfirm(false)}>Back</button>
          <button className="btn btn-danger" disabled={pending} onClick={remove}>{pending ? 'Working…' : moveTo ? `Move branches & delete` : 'Delete region'}</button></>
      ) : (
        <>{region ? <button className="btn btn-danger" onClick={() => setConfirm(true)}><Icon name="trash" />Delete or merge</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={onClose}>Cancel</button><button form="region-form" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button></div></>
      )}>
      {confirm ? (
        <div className="stack" style={{ gap: 14 }}>
          <div className="warn-box"><Icon name="alert" /><span>Deleting <b>{region.name}</b> affects {region.branches.length} branches. Move them to another region (a merge), or leave them without a region.</span></div>
          <div className="field">
            <label htmlFor="moveTo">Move its branches to</label>
            <select id="moveTo" className="select" value={moveTo} onChange={(e) => setMoveTo(e.target.value)}>
              <option value="">Nowhere (leave them without a region)</option>
              {others.map((r) => <option key={r.name} value={r.name}>{r.name} ({r.branches.length} branches)</option>)}
            </select>
          </div>
        </div>
      ) : (
        <form id="region-form" onSubmit={save} className="stack" style={{ gap: 14 }} noValidate>
          <div className={`field${errors.name ? ' has-err' : ''}`}>
            <label htmlFor="rname">Region name <span className="req">*</span></label>
            <input id="rname" className="input" value={v.name} onChange={(e) => setV((p) => ({ ...p, name: e.target.value }))} autoFocus />
            {errors.name ? <div className="err">{errors.name}</div> : region ? <div className="hint">Renaming updates all {region.branches.length} branches straight away.</div> : null}
          </div>
          <div className="field"><label htmlFor="rnotes">Notes</label><textarea id="rnotes" className="textarea" value={v.notes} onChange={(e) => setV((p) => ({ ...p, notes: e.target.value }))} placeholder="e.g. regional office contact" /></div>
          {region && (
            <div className="form-section">
              <h3>Branches in this region</h3>
              {region.branches.length ? (
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {[...region.branches].sort((a, b) => codeKey(a).localeCompare(codeKey(b))).map((c) => <Link key={c} href={`/branches/${encodeURIComponent(c)}`} className="btn btn-sm">{c}</Link>)}
                </div>
              ) : <p className="muted" style={{ margin: 0 }}>No branches yet. Pick this region on a branch to add it.</p>}
            </div>
          )}
        </form>
      )}
    </Drawer>
  )
}

function ZonesCard({ zones, notify }) {
  const [edit, setEdit] = useState(null) // { zone, value }
  const [del, setDel] = useState(null)
  const [pending, start] = useTransition()
  const run = (fn, ok) => start(async () => {
    try {
      const res = await fn()
      if (res?.ok === false) notify({ text: res.error, error: true })
      else { notify({ text: ok }); setEdit(null); setDel(null) }
    } catch (err) { notify({ text: err.message, error: true }) }
  })
  return (
    <Card title="Zones" sub="Zones are set per branch. Renaming one here renames it on every branch; removing clears it." pad={false}>
      <div className="table-wrap auto">
        <table className="tbl">
          <thead><tr><th>Zone</th><th className="r">Branches</th><th>Regions it covers</th><th /></tr></thead>
          <tbody>
            {zones.map((z) => (
              <tr key={z.zone}>
                <td>
                  {edit?.zone === z.zone ? (
                    <input className="input" style={{ height: 30, maxWidth: 200 }} autoFocus value={edit.value} onChange={(e) => setEdit({ ...edit, value: e.target.value })}
                      onKeyDown={(e) => { if (e.key === 'Enter' && edit.value.trim()) run(() => renameBranchField('zone', z.zone, edit.value), 'Zone renamed'); if (e.key === 'Escape') setEdit(null) }} />
                  ) : <b>{z.zone}</b>}
                </td>
                <td className="r num">{z.branches}</td>
                <td className="small" style={{ whiteSpace: 'normal' }}>{z.regions.join(', ') || <span className="muted">—</span>}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {edit?.zone === z.zone ? (
                    <><button className="btn btn-sm" onClick={() => setEdit(null)}>Cancel</button> <button className="btn btn-sm btn-primary" disabled={pending || !edit.value.trim()} onClick={() => run(() => renameBranchField('zone', z.zone, edit.value), 'Zone renamed')}>Save</button></>
                  ) : del === z.zone ? (
                    <><span className="small" style={{ color: 'var(--red)', marginRight: 6 }}>Clear from {z.branches} branches?</span><button className="btn btn-sm" onClick={() => setDel(null)}>Keep</button> <button className="btn btn-sm btn-danger" disabled={pending} onClick={() => run(() => renameBranchField('zone', z.zone, null), 'Zone removed')}>Remove</button></>
                  ) : (
                    <><button className="btn btn-ghost btn-sm" onClick={() => { setDel(null); setEdit({ zone: z.zone, value: z.zone }) }}><Icon name="edit" />Rename</button> <button className="btn btn-ghost btn-sm btn-danger" onClick={() => { setEdit(null); setDel(z.zone) }}><Icon name="trash" />Remove</button></>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  )
}
