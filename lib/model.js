// Shared, pure logic: used by server pages, client components and the importer.

export const DEFAULT_TAX = 5.5

export const SHIFTING = {
  not_started: { label: 'Not started', tone: 'amber' },
  in_progress: { label: 'In progress', tone: 'blue' },
  complete: { label: 'Complete', tone: 'green' },
  official: { label: 'Official use', tone: 'gray' },
}

export const BILLING = {
  not_invoiced: { label: 'Not invoiced', tone: 'red' },
  invoiced: { label: 'Awaiting payment', tone: 'amber' },
  partial: { label: 'Part paid', tone: 'blue' },
  paid: { label: 'Paid', tone: 'green' },
  no_record: { label: 'No billing record', tone: 'gray' },
}

export const AGING = [
  { key: '0-30', label: '0–30 days', max: 30 },
  { key: '31-60', label: '31–60 days', max: 60 },
  { key: '61-90', label: '61–90 days', max: 90 },
  { key: '90+', label: 'Over 90 days', max: Infinity },
]

const round2 = (n) => Math.round(n * 100) / 100

export function today() {
  const d = new Date()
  return new Date(Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()))
}

export function daysBetween(isoFrom, to = today()) {
  if (!isoFrom) return null
  return Math.round((to - new Date(isoFrom + 'T00:00:00Z')) / 86400000)
}

export function receivableOf(d) {
  if (d.invoice_amount == null) return null
  return round2(Number(d.invoice_amount) * (1 - Number(d.tax_rate ?? DEFAULT_TAX) / 100))
}

export function billingStatusOf(d) {
  if (!d.billing_tracked) return 'no_record'
  if (d.invoice_amount == null || Number(d.invoice_amount) === 0) {
    return d.amount_received > 0 ? 'paid' : 'not_invoiced'
  }
  const recv = Number(d.amount_received || 0)
  const due = receivableOf(d)
  if (recv <= 0) return 'invoiced'
  return recv + 0.5 >= due ? 'paid' : 'partial'
}

/** Adds every derived field a screen needs, so pages never recompute them differently. */
export function enrich(d, branchesByCode = {}) {
  const b = branchesByCode[d.branch_code] || {}
  const receivable = receivableOf(d)
  const billing = billingStatusOf(d)
  const received = Number(d.amount_received || 0)
  const outstanding = billing === 'invoiced' || billing === 'partial' ? round2(Math.max(0, receivable - received)) : 0
  const ageFrom = d.invoice_date || d.delivered_on
  const age = outstanding > 0 ? daysBetween(ageFrom) : null
  const row = {
    ...d,
    region: b.region || null,
    zone: b.zone || null,
    branch_label: b.name && b.name !== d.branch_code ? `${d.branch_code} · ${b.name}` : d.branch_code,
    balance: (d.trunks_received || 0) - (d.trunks_used || 0),
    receivable,
    received,
    outstanding,
    billing,
    age,
    aging: age == null ? null : AGING.find((a) => age <= a.max)?.key,
    month: d.delivered_on ? d.delivered_on.slice(0, 7) : null,
  }
  row.issues = issuesOf(row)
  return row
}

/** Data-quality checks. Each returns a short, human message. */
export const CHECKS = [
  { key: 'no_date', label: 'Delivery date missing', test: (d) => !d.delivered_on },
  { key: 'future_date', label: 'Delivery date is in the future', test: (d) => d.delivered_on && daysBetween(d.delivered_on) < 0 },
  { key: 'no_region', label: 'Branch has no region', test: (d) => !d.region },
  { key: 'zero_received', label: 'Trunks received is 0', test: (d) => !d.trunks_received && d.shifting_status !== 'official' },
  { key: 'overused', label: 'More trunks used than received', test: (d) => d.trunks_used > d.trunks_received },
  { key: 'used_not_started', label: 'Trunks used but shifting marked not started', test: (d) => d.trunks_used > 0 && d.shifting_status === 'not_started' },
  { key: 'complete_unused', label: 'Shifting complete but no trunks used', test: (d) => d.shifting_status === 'complete' && !d.trunks_used },
  { key: 'no_invoice_no', label: 'Invoiced amount without an invoice number', test: (d) => d.billing_tracked && d.invoice_amount > 0 && !d.invoice_no && !/direct/i.test(d.remarks || '') },
  { key: 'paid_no_date', label: 'Paid but payment date missing', test: (d) => d.billing === 'paid' && !d.payment_date },
  { key: 'date_no_payment', label: 'Payment date set but nothing received', test: (d) => d.payment_date && !(d.amount_received > 0) },
  { key: 'long_outstanding', label: 'Payment outstanding over 60 days', test: (d) => d.age != null && d.age > 60 },
]

export function issuesOf(d) {
  return CHECKS.filter((c) => c.test(d)).map((c) => c.key)
}

export function findDuplicateInvoices(rows) {
  const seen = {}
  for (const r of rows) {
    if (!r.invoice_no) continue
    const k = r.invoice_no.toLowerCase().replace(/[^a-z0-9]/g, '')
    ;(seen[k] ||= []).push(r)
  }
  return Object.values(seen).filter((g) => g.length > 1)
}

/** Sort key for branch codes: numeric codes in number order first, then names (ACD, CRO, Finance…). */
export const codeKey = (c) => (/^\d+$/.test(c) ? `0${c.padStart(10, '0')}` : `1${c.toLowerCase()}`)

export function totals(rows) {
  const t = {
    count: rows.length, trunks: 0, stands: 0, used: 0, balance: 0,
    invoiced: 0, receivable: 0, received: 0, outstanding: 0,
    shiftingDone: 0, shiftingOpen: 0, branches: new Set(),
  }
  for (const r of rows) {
    t.trunks += r.trunks_received || 0
    t.stands += r.stands_received || 0
    t.used += r.trunks_used || 0
    t.balance += r.balance
    t.invoiced += Number(r.invoice_amount || 0)
    t.receivable += r.receivable || 0
    t.received += r.received
    t.outstanding += r.outstanding
    if (r.shifting_status === 'complete') t.shiftingDone++
    if (r.shifting_status === 'not_started' || r.shifting_status === 'in_progress') t.shiftingOpen++
    t.branches.add(r.branch_code)
  }
  t.branchCount = t.branches.size
  delete t.branches
  return t
}

export function groupBy(rows, key) {
  const out = {}
  for (const r of rows) {
    const k = (typeof key === 'function' ? key(r) : r[key]) ?? '—'
    ;(out[k] ||= []).push(r)
  }
  return out
}

// ---------- formatting ----------
const nf0 = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 })
export const fmtNum = (n) => (n == null || Number.isNaN(n) ? '—' : nf0.format(n))
export const fmtRs = (n) => (n == null || Number.isNaN(Number(n)) ? '—' : `Rs ${nf0.format(Number(n))}`)
export function fmtRsShort(n) {
  if (n == null) return '—'
  const a = Math.abs(n)
  if (a >= 1e7) return `Rs ${(n / 1e7).toFixed(2)} cr`
  if (a >= 1e5) return `Rs ${(n / 1e5).toFixed(1)} lac`
  return fmtRs(n)
}
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
export function fmtDate(iso) {
  if (!iso) return '—'
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  return `${d} ${MONTHS[m - 1]} ${y}`
}
export function fmtMonth(ym) {
  if (!ym) return '—'
  const [y, m] = ym.split('-').map(Number)
  return `${MONTHS[m - 1]} ${y}`
}
export const pct = (a, b) => (b ? Math.round((a / b) * 100) : 0)

export function toCSV(columns, rows) {
  const esc = (v) => {
    const s = v == null ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return [columns.map((c) => esc(c.label)).join(','), ...rows.map((r) => columns.map((c) => esc(c.csv ? c.csv(r) : r[c.key])).join(','))].join('\n')
}
