'use client'
import { useCallback, useState } from 'react'
import Link from 'next/link'
import { PageHead, Stat, Card } from '../../../ui/ui'
import { Icon } from '../../../ui/icons'
import { DeliveryDetail, DeliveryForm, Toast } from '../../../ui/delivery-panel'
import { BranchForm } from '../../../ui/branch-form'
import { SHIFTING, BILLING, totals, pct, fmtNum, fmtRs, fmtDate } from '@/lib/model.js'

export function BranchDetailView({ branch, rows, branches, allRows }) {
  const [mode, setMode] = useState(null) // view | edit | new | branch
  const [openId, setOpenId] = useState(null)
  const [toast, setToast] = useState(null)
  const notify = useCallback((t) => setToast(t), [])
  const close = useCallback(() => { setMode(null); setOpenId(null) }, [])
  const t = totals(rows)
  const current = rows.find((r) => r.id === openId)
  const base = rows.filter((r) => r.shifting_status !== 'official').length

  return (
    <>
      <PageHead
        crumbs={<><Link href="/branches">Branches</Link> / {branch.code}</>}
        title={`Branch ${branch.code}${branch.name && branch.name !== branch.code ? ' · ' + branch.name : ''}`}
        sub={<>{branch.region || <span style={{ color: 'var(--amber)' }}>No region set</span>}{branch.zone ? ` · ${branch.zone} zone` : ''} · {rows.length} deliveries</>}>
        <button className="btn" onClick={() => setMode('branch')}><Icon name="edit" />Edit branch</button>
        <button className="btn btn-primary" onClick={() => setMode('new')}><Icon name="plus" />New delivery</button>
      </PageHead>

      {branch.notes && <div className="info-box" style={{ marginBottom: 16 }}><Icon name="info" />{branch.notes}</div>}

      <div className="stats">
        <Stat icon="box" label="Trunks received" value={fmtNum(t.trunks)} foot={`${fmtNum(t.stands)} stands`} />
        <Stat icon="truck" label="Trunks used" value={fmtNum(t.used)} bar={[{ pct: Math.min(100, pct(t.used, t.trunks)), color: 'var(--chart-1)' }]} foot={<><b className={t.balance < 0 ? 'neg' : ''}>{fmtNum(t.balance)}</b> unused</>} />
        <Stat icon="check" label="Shifting complete" value={`${t.shiftingDone} of ${base}`} bar={[{ pct: pct(t.shiftingDone, base), color: 'var(--chart-2)' }]} foot={t.shiftingOpen ? `${t.shiftingOpen} not finished` : 'All done'} />
        <Stat icon="wallet" label="Outstanding" value={fmtRs(t.outstanding)} foot={`${fmtRs(t.received)} received of ${fmtRs(t.receivable)}`} />
      </div>

      <div className="cols-2">
        <Card title="Deliveries" sub="Click one to see or change it" pad={false}>
          <div className="table-wrap auto">
            <table className="tbl">
              <thead><tr><th>Delivered</th><th className="r">Trunks</th><th className="r">Used</th><th className="r">Unused</th><th>Shifting</th><th>Invoice</th><th className="r">Outstanding</th><th>Billing</th></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className={`clickable${r.id === openId ? ' selected' : ''}`} onClick={() => { setOpenId(r.id); setMode('view') }}>
                    <td className="num">{fmtDate(r.delivered_on)}</td>
                    <td className="r num">{r.trunks_received}</td>
                    <td className="r num">{r.trunks_used}</td>
                    <td className={`r num${r.balance < 0 ? ' neg' : ''}`}>{r.balance}</td>
                    <td><span className={`badge tone-${SHIFTING[r.shifting_status].tone}`}>{SHIFTING[r.shifting_status].label}</span></td>
                    <td className="small">{r.invoice_no || <span className="muted">—</span>}</td>
                    <td className="r num" style={{ color: r.outstanding ? 'var(--red)' : undefined }}>{r.outstanding ? fmtNum(r.outstanding) : <span className="muted">—</span>}</td>
                    <td><span className={`badge tone-${BILLING[r.billing].tone}`}>{BILLING[r.billing].label}</span></td>
                  </tr>
                ))}
                {!rows.length && <tr><td colSpan={8}><div className="empty"><b>No deliveries yet</b></div></td></tr>}
              </tbody>
            </table>
          </div>
        </Card>
        <Card title="Timeline">
          <div className="timeline">
            {rows.map((r) => (
              <div key={r.id} className={`tl-item${r.shifting_status === 'complete' ? ' done' : ''}`}>
                <div style={{ fontWeight: 600 }}>{fmtDate(r.delivered_on)} · {r.trunks_received} trunks, {r.stands_received} stands</div>
                <div className="small muted">
                  Shifting {SHIFTING[r.shifting_status].label.toLowerCase()}{r.shifting_done_on ? ` on ${fmtDate(r.shifting_done_on)}` : ''}
                  {r.billing_tracked && <> · {r.invoice_no ? `invoice ${r.invoice_no}` : 'no invoice no.'}{r.payment_date ? ` · paid ${fmtDate(r.payment_date)}` : r.outstanding ? ` · ${fmtRs(r.outstanding)} due` : ''}</>}
                </div>
              </div>
            ))}
            {!rows.length && <div className="muted">Deliveries to this branch will appear here.</div>}
          </div>
        </Card>
      </div>

      {mode === 'view' && current && <DeliveryDetail key={current.id + current.updated_at} row={current} onClose={close} onEdit={() => setMode('edit')} notify={notify} />}
      {mode === 'edit' && current && <DeliveryForm row={current} branches={branches} allRows={allRows} onClose={() => setMode('view')} onSaved={() => setMode('view')} notify={notify} />}
      {mode === 'new' && <DeliveryForm row={null} preset={{ branch_code: branch.code }} branches={branches} allRows={allRows} onClose={close} onSaved={(id) => { setOpenId(id); setMode('view') }} notify={notify} />}
      {mode === 'branch' && <BranchForm branch={branch} allBranches={branches} deliveriesCount={rows.length} onClose={close} notify={notify} />}
      <Toast toast={toast} onDone={() => setToast(null)} />
    </>
  )
}
