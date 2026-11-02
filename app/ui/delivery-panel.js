'use client'
import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import { Icon } from './icons'
import { BranchPicker, FieldPicker } from './pickers'
import { saveDelivery, deleteDelivery, quickUpdate } from '../actions'
import {
  SHIFTING, BILLING, CHECKS, DEFAULT_TAX, receivableOf, billingStatusOf, fmtRs, fmtNum, fmtDate,
} from '@/lib/model.js'

export function Drawer({ title, sub, onClose, children, footer }) {
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = '' }
  }, [onClose])
  return (
    <>
      <div className="overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <div><h2>{title}</h2>{sub && <p>{sub}</p>}</div>
          <button className="btn btn-ghost btn-sm" onClick={onClose} aria-label="Close"><Icon name="x" /></button>
        </div>
        <div className="drawer-body">{children}</div>
        {footer && <div className="drawer-foot">{footer}</div>}
      </aside>
    </>
  )
}

export function Toast({ toast, onDone }) {
  useEffect(() => {
    if (!toast) return
    const t = setTimeout(onDone, 3200)
    return () => clearTimeout(t)
  }, [toast, onDone])
  if (!toast) return null
  return <div className={`toast${toast.error ? ' error' : ''}`} role="status"><Icon name={toast.error ? 'alert' : 'check'} size={16} />{toast.text}</div>
}

const Tone = ({ map, k }) => <span className={`badge tone-${map[k]?.tone || 'gray'}`}>{map[k]?.label || k}</span>

/** Read-only view of one delivery, with one-click actions. */
export function DeliveryDetail({ row, onEdit, onClose, notify }) {
  const [pending, start] = useTransition()
  const [confirmDelete, setConfirmDelete] = useState(false)
  const run = (fn, ok) => start(async () => {
    try {
      const res = await fn()
      if (res?.ok === false) notify({ text: res.error, error: true })
      else { notify({ text: ok }); if (ok === 'Delivery deleted') onClose() }
    } catch (e) { notify({ text: e.message, error: true }) }
  })
  const usedPct = row.trunks_received ? Math.min(100, Math.round((row.trunks_used / row.trunks_received) * 100)) : 0
  return (
    <Drawer
      title={`Branch ${row.branch_label}`}
      sub={`${row.region || 'No region'}${row.zone ? ' · ' + row.zone + ' zone' : ''} · delivered ${fmtDate(row.delivered_on)}${row.ref_no ? ' · Sr ' + row.ref_no : ''}`}
      onClose={onClose}
      footer={confirmDelete ? (
        <>
          <span className="small" style={{ alignSelf: 'center', color: 'var(--red)' }}>Delete this delivery for good?</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" onClick={() => setConfirmDelete(false)}>Keep it</button>
            <button className="btn btn-danger" disabled={pending} onClick={() => run(() => deleteDelivery(row.id), 'Delivery deleted')}>Delete</button>
          </div>
        </>
      ) : (
        <>
          <button className="btn btn-danger" onClick={() => setConfirmDelete(true)}><Icon name="trash" />Delete</button>
          <div style={{ display: 'flex', gap: 8 }}>
            <Link className="btn" href={`/branches/${encodeURIComponent(row.branch_code)}`}>Branch history</Link>
            <button className="btn btn-primary" onClick={onEdit}><Icon name="edit" />Edit</button>
          </div>
        </>
      )}
    >
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Tone map={SHIFTING} k={row.shifting_status} />
        <Tone map={BILLING} k={row.billing} />
        {row.trunk_type === 'Old' && <span className="badge plain">Old trunks{row.old_trunks ? ` (${row.old_trunks})` : ''}</span>}
      </div>

      <div className="quick">
        {row.shifting_status !== 'complete' && row.shifting_status !== 'official' && (
          <button className="btn btn-sm" disabled={pending} onClick={() => run(() => quickUpdate(row.id, 'shifting_complete'), 'Shifting marked complete')}><Icon name="check" />Mark shifting complete</button>
        )}
        {row.shifting_status === 'not_started' && (
          <button className="btn btn-sm" disabled={pending} onClick={() => run(() => quickUpdate(row.id, 'shifting_started'), 'Shifting marked in progress')}>Mark in progress</button>
        )}
        {(row.billing === 'invoiced' || row.billing === 'partial') && (
          <button className="btn btn-sm" disabled={pending} onClick={() => run(() => quickUpdate(row.id, 'mark_paid'), 'Marked as paid')}><Icon name="wallet" />Mark paid ({fmtRs(row.receivable)})</button>
        )}
      </div>

      {row.issues.length > 0 && (
        <div className="warn-box" style={{ marginBottom: 16 }}>
          <Icon name="alert" />
          <div>{row.issues.map((k) => <div key={k}>{CHECKS.find((c) => c.key === k)?.label}</div>)}</div>
        </div>
      )}

      <div className="form-section">
        <h3>Trunks</h3>
        <dl className="kv">
          <div><dt>Trunks received</dt><dd>{fmtNum(row.trunks_received)}</dd></div>
          <div><dt>Stands received</dt><dd>{fmtNum(row.stands_received)}</dd></div>
          <div><dt>Trunks used</dt><dd>{fmtNum(row.trunks_used)}</dd></div>
          <div><dt>Balance (unused)</dt><dd className={row.balance < 0 ? 'neg' : ''}>{fmtNum(row.balance)}</dd></div>
        </dl>
        <div className="progress" style={{ marginTop: 10 }}><span style={{ width: `${usedPct}%` }} /></div>
        <div className="small muted" style={{ marginTop: 4 }}>{usedPct}% of delivered trunks used{row.shifting_done_on ? ` · shifting completed ${fmtDate(row.shifting_done_on)}` : ''}</div>
      </div>

      <div className="form-section">
        <h3>Billing</h3>
        {row.billing_tracked ? (
          <dl className="kv">
            <div><dt>Invoice no.</dt><dd>{row.invoice_no || '—'}</dd></div>
            <div><dt>Invoice date</dt><dd>{fmtDate(row.invoice_date)}</dd></div>
            <div><dt>Invoice amount</dt><dd>{fmtRs(row.invoice_amount)}</dd></div>
            <div><dt>Receivable (after {row.tax_rate}% tax)</dt><dd>{fmtRs(row.receivable)}</dd></div>
            <div><dt>Received</dt><dd>{row.received ? fmtRs(row.received) : '—'}</dd></div>
            <div><dt>Payment date</dt><dd>{fmtDate(row.payment_date)}</dd></div>
            <div><dt>Outstanding</dt><dd style={{ color: row.outstanding ? 'var(--red)' : undefined }}>{fmtRs(row.outstanding)}</dd></div>
            <div><dt>Days outstanding</dt><dd>{row.age ?? '—'}</dd></div>
          </dl>
        ) : (
          <div className="info-box"><Icon name="info" />This delivery is from before the billing list started, so there is no invoice record here. Edit it and turn on “On the billing list” to start tracking its invoice.</div>
        )}
      </div>

      {row.remarks && (
        <div className="form-section"><h3>Remarks</h3><p style={{ margin: 0, whiteSpace: 'pre-wrap' }}>{row.remarks}</p></div>
      )}
    </Drawer>
  )
}

const blank = {
  branch_code: '', delivered_on: new Date().toISOString().slice(0, 10), trunk_type: 'New', old_trunks: '',
  trunks_received: '', stands_received: '', trunks_used: 0, shifting_status: 'not_started', shifting_done_on: '',
  billing_tracked: true, invoice_no: '', invoice_date: '', invoice_amount: '', tax_rate: DEFAULT_TAX,
  amount_received: '', payment_date: '', remarks: '', new_branch_region: '', new_branch_zone: '',
}

/** Add / edit form. `row` = existing delivery or null; `preset` = defaults (e.g. branch). */
export function DeliveryForm({ row, preset, branches, allRows, onClose, onSaved, notify }) {
  const [v, setV] = useState(() => {
    if (!row) return { ...blank, ...preset }
    const out = { ...blank }
    for (const k of Object.keys(blank)) if (row[k] != null) out[k] = row[k]
    return out
  })
  const [errors, setErrors] = useState({})
  const [pending, start] = useTransition()
  const set = (k) => (e) => setV((p) => ({ ...p, [k]: e?.target ? (e.target.type === 'checkbox' ? e.target.checked : e.target.value) : e }))

  const branch = branches.find((b) => b.code === v.branch_code.trim())
  const preview = {
    billing_tracked: v.billing_tracked, invoice_amount: v.invoice_amount === '' ? null : Number(v.invoice_amount),
    tax_rate: v.tax_rate === '' ? DEFAULT_TAX : Number(v.tax_rate), amount_received: v.amount_received === '' ? null : Number(v.amount_received),
  }
  const receivable = receivableOf(preview)
  const status = billingStatusOf(preview)
  const balance = (Number(v.trunks_received) || 0) - (Number(v.trunks_used) || 0)
  const dupInvoice = v.invoice_no.trim() && allRows.find((r) => r.id !== row?.id && r.invoice_no && r.invoice_no.toLowerCase().replace(/[^a-z0-9]/g, '') === v.invoice_no.toLowerCase().replace(/[^a-z0-9]/g, ''))

  const submit = (e) => {
    e.preventDefault()
    start(async () => {
      try {
        const res = await saveDelivery({ ...v, id: row?.id })
        if (!res.ok) { setErrors(res.errors || {}); notify({ text: 'Please fix the highlighted fields.', error: true }); return }
        notify({ text: row ? 'Delivery saved' : 'Delivery added' })
        onSaved(res.id)
      } catch (err) { notify({ text: err.message, error: true }) }
    })
  }

  const F = ({ k, label, req, hint, children, full }) => (
    <div className={`field${errors[k] ? ' has-err' : ''}${full ? ' full' : ''}`}>
      <label htmlFor={k}>{label}{req && <span className="req"> *</span>}</label>
      {children}
      {errors[k] ? <div className="err">{errors[k]}</div> : hint ? <div className="hint">{hint}</div> : null}
    </div>
  )

  return (
    <Drawer
      title={row ? `Edit delivery · Branch ${row.branch_label}` : 'New delivery'}
      sub={row ? `Last updated ${fmtDate(row.updated_at?.slice(0, 10))}` : 'Trunks sent to a branch, with shifting and billing'}
      onClose={onClose}
      footer={<><button type="button" className="btn" onClick={onClose}>Cancel</button><button form="delivery-form" className="btn btn-primary" disabled={pending}>{pending ? 'Saving…' : row ? 'Save changes' : 'Add delivery'}</button></>}
    >
      <form id="delivery-form" onSubmit={submit} noValidate>
        <div className="form-section">
          <h3>Delivery</h3>
          <div className="fields">
            {F({ k: 'branch_code', label: 'Branch code', req: true, hint: branch ? `${branch.region || 'No region'}${branch.zone ? ' · ' + branch.zone + ' zone' : ''}` : v.branch_code ? 'New branch: it will be created' : 'Type or pick a code',
              children: <BranchPicker id="branch_code" value={v.branch_code} onChange={set('branch_code')} branches={branches} deliveries={allRows} autoFocus={!row} invalid={!!errors.branch_code} /> })}
            {F({ k: 'delivered_on', label: 'Delivered on', children: <input id="delivered_on" type="date" className="input" value={v.delivered_on || ''} onChange={set('delivered_on')} /> })}
            {!branch && v.branch_code.trim() && (
              <>
                {F({ k: 'new_branch_region', label: 'Region of new branch', children: <FieldPicker field="region" id="new_branch_region" value={v.new_branch_region} onChange={set('new_branch_region')} branches={branches} /> })}
                {F({ k: 'new_branch_zone', label: 'Zone of new branch', children: <FieldPicker field="zone" id="new_branch_zone" value={v.new_branch_zone} onChange={set('new_branch_zone')} branches={branches} /> })}
              </>
            )}
            {F({ k: 'trunks_received', label: 'Trunks received', req: true, children: <input id="trunks_received" type="number" min="0" inputMode="numeric" className="input" value={v.trunks_received} onChange={set('trunks_received')} /> })}
            {F({ k: 'stands_received', label: 'Stands received', children: <input id="stands_received" type="number" min="0" inputMode="numeric" className="input" value={v.stands_received} onChange={set('stands_received')} /> })}
            {F({ k: 'trunk_type', label: 'Trunk type', children: <select id="trunk_type" className="select" value={v.trunk_type} onChange={set('trunk_type')}><option>New</option><option>Old</option></select> })}
            {v.trunk_type === 'Old' && F({ k: 'old_trunks', label: 'Old trunks (count)', children: <input id="old_trunks" type="number" min="0" className="input" value={v.old_trunks ?? ''} onChange={set('old_trunks')} /> })}
          </div>
        </div>

        <div className="form-section">
          <h3>Record shifting</h3>
          <div className="fields">
            {F({ k: 'shifting_status', label: 'Status', children: <select id="shifting_status" className="select" value={v.shifting_status} onChange={set('shifting_status')}>{Object.entries(SHIFTING).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select> })}
            {v.shifting_status === 'complete'
              ? F({ k: 'shifting_done_on', label: 'Completed on', children: <input id="shifting_done_on" type="date" className="input" value={v.shifting_done_on || ''} onChange={set('shifting_done_on')} /> })
              : <div />}
            {F({ k: 'trunks_used', label: 'Trunks used', children: <input id="trunks_used" type="number" min="0" inputMode="numeric" className="input" value={v.trunks_used} onChange={set('trunks_used')} /> })}
            <div className="field"><label>Balance (unused)</label><div className="calc" style={{ color: balance < 0 ? 'var(--red)' : undefined }}>{fmtNum(balance)}</div></div>
          </div>
          {balance < 0 && <div className="warn-box" style={{ marginTop: 10 }}><Icon name="alert" />More trunks used than received. That's allowed (e.g. older trunks reused), but double-check the numbers.</div>}
        </div>

        <div className="form-section">
          <h3>Billing</h3>
          <label className="toggle" style={{ marginBottom: 12 }}><input type="checkbox" checked={v.billing_tracked} onChange={set('billing_tracked')} />On the billing list (invoice and payment tracked here)</label>
          {v.billing_tracked && (
            <div className="fields">
              {F({ k: 'invoice_no', label: 'Invoice no.', hint: dupInvoice ? null : 'e.g. 819/I-960/18/9/2026: the date at the end fills Invoice date',
                children: (<><input id="invoice_no" className="input" value={v.invoice_no} onChange={set('invoice_no')} />
                  {dupInvoice && <div className="err">Already used on branch {dupInvoice.branch_code}’s delivery of {fmtDate(dupInvoice.delivered_on)}.</div>}</>) })}
              {F({ k: 'invoice_date', label: 'Invoice date', hint: 'Leave empty to read it from the invoice no.', children: <input id="invoice_date" type="date" className="input" value={v.invoice_date || ''} onChange={set('invoice_date')} /> })}
              {F({ k: 'invoice_amount', label: 'Invoice amount (Rs)', children: <input id="invoice_amount" type="number" min="0" step="any" className="input" value={v.invoice_amount ?? ''} onChange={set('invoice_amount')} /> })}
              {F({ k: 'tax_rate', label: 'Tax withheld (%)', children: <input id="tax_rate" type="number" min="0" max="100" step="0.01" className="input" value={v.tax_rate} onChange={set('tax_rate')} /> })}
              <div className="field"><label>Receivable</label><div className="calc">{fmtRs(receivable)}</div></div>
              <div className="field"><label>Status</label><div style={{ height: 36, display: 'flex', alignItems: 'center' }}><Tone map={BILLING} k={status} /></div></div>
              {F({ k: 'amount_received', label: 'Amount received (Rs)', children: (
                <div style={{ display: 'flex', gap: 6 }}>
                  <input id="amount_received" type="number" min="0" step="any" className="input" value={v.amount_received ?? ''} onChange={set('amount_received')} />
                  {receivable != null && <button type="button" className="btn btn-sm" style={{ height: 36 }} onClick={() => setV((p) => ({ ...p, amount_received: receivable, payment_date: p.payment_date || new Date().toISOString().slice(0, 10) }))}>Full</button>}
                </div>) })}
              {F({ k: 'payment_date', label: 'Payment date', children: <input id="payment_date" type="date" className="input" value={v.payment_date || ''} onChange={set('payment_date')} /> })}
            </div>
          )}
        </div>

        <div className="form-section">
          <h3>Remarks</h3>
          <textarea className="textarea" value={v.remarks || ''} onChange={set('remarks')} placeholder="Anything worth remembering about this delivery" />
        </div>
      </form>
    </Drawer>
  )
}
