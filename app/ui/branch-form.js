'use client'
import { useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { Drawer } from './delivery-panel'
import { Icon } from './icons'
import { FieldPicker } from './pickers'
import { saveBranch, deleteBranch } from '../actions'

export function BranchForm({ branch, allBranches, onClose, notify, deliveriesCount = branch?.deliveries }) {
  const router = useRouter()
  const [v, setV] = useState({ code: branch?.code || '', name: branch?.name || '', region: branch?.region || '', zone: branch?.zone || '', notes: branch?.notes || '' })
  const [errors, setErrors] = useState({})
  const [pending, start] = useTransition()
  const [confirm, setConfirm] = useState(false)
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e.target.value }))

  const save = (e) => {
    e.preventDefault()
    start(async () => {
      try {
        const res = await saveBranch({ ...v, originalCode: branch?.code })
        if (!res.ok) { setErrors(res.errors || {}); return }
        notify({ text: branch ? 'Branch saved' : 'Branch added' })
        onClose()
        if (branch && res.code !== branch.code) router.replace(`/branches/${encodeURIComponent(res.code)}`)
      } catch (err) { notify({ text: err.message, error: true }) }
    })
  }
  const remove = () => start(async () => {
    const res = await deleteBranch(branch.code)
    if (!res.ok) { notify({ text: res.error, error: true }); setConfirm(false); return }
    notify({ text: 'Branch deleted' })
    onClose()
    router.push('/branches')
  })

  return (
    <Drawer title={branch ? `Edit branch ${branch.code}` : 'New branch'} sub="Region and zone are used across every report" onClose={onClose}
      footer={confirm ? (
        <><span className="small" style={{ alignSelf: 'center', color: 'var(--red)' }}>Delete branch {branch.code}?</span>
          <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={() => setConfirm(false)}>Keep it</button><button className="btn btn-danger" disabled={pending} onClick={remove}>Delete</button></div></>
      ) : (
        <>{branch ? <button className="btn btn-danger" disabled={deliveriesCount > 0} title={deliveriesCount > 0 ? 'Only branches with no deliveries can be deleted' : undefined} onClick={() => setConfirm(true)}><Icon name="trash" />Delete</button> : <span />}
          <div style={{ display: 'flex', gap: 8 }}><button className="btn" onClick={onClose}>Cancel</button><button form="branch-form" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : 'Save'}</button></div></>
      )}>
      <form id="branch-form" onSubmit={save} className="fields" noValidate>
        <div className={`field${errors.code ? ' has-err' : ''}`}>
          <label htmlFor="code">Branch code <span className="req">*</span></label>
          <input id="code" className="input" value={v.code} onChange={set('code')} autoFocus={!branch} />
          {errors.code ? <div className="err">{errors.code}</div> : branch ? <div className="hint">Changing it updates every delivery of this branch.</div> : null}
        </div>
        <div className="field"><label htmlFor="name">Name</label><input id="name" className="input" value={v.name} onChange={set('name')} placeholder="Optional, e.g. Model Town" /></div>
        <div className="field"><label htmlFor="region">Region</label><FieldPicker field="region" id="region" value={v.region} onChange={(x) => setV((p) => ({ ...p, region: x }))} branches={allBranches} /></div>
        <div className="field"><label htmlFor="zone">Zone</label><FieldPicker field="zone" id="zone" value={v.zone} onChange={(x) => setV((p) => ({ ...p, zone: x }))} branches={allBranches} /></div>
        <div className="field full"><label htmlFor="notes">Notes</label><textarea id="notes" className="textarea" value={v.notes} onChange={set('notes')} /></div>
      </form>
    </Drawer>
  )
}
