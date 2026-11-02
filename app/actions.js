'use server'

import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { db, check } from '@/lib/db.js'
import { requireUser } from '@/lib/auth.js'
import { COOKIE, makeToken, cookieOptions } from '@/lib/session.js'
import { invoiceDate } from '@/lib/importer.js'
import { receivableOf, DEFAULT_TAX, SHIFTING } from '@/lib/model.js'

const refresh = () => revalidatePath('/', 'layout')
const todayISO = () => new Date().toISOString().slice(0, 10)

// ---------- auth ----------
export async function login(_prev, formData) {
  const password = String(formData.get('password') || '')
  const expected = process.env.APP_PASSWORD || ''
  let diff = password.length ^ expected.length
  for (let i = 0; i < Math.max(password.length, expected.length); i++) diff |= (password.charCodeAt(i) || 0) ^ (expected.charCodeAt(i) || 0)
  if (!expected || diff !== 0) {
    await new Promise((r) => setTimeout(r, 600))
    return { error: 'That password is not right.' }
  }
  const store = await cookies()
  store.set(COOKIE, await makeToken(), cookieOptions)
  const next = String(formData.get('next') || '/')
  redirect(next.startsWith('/') && !next.startsWith('//') ? next : '/')
}

export async function logout() {
  const store = await cookies()
  store.delete(COOKIE)
  redirect('/login')
}

// ---------- validation helpers ----------
function intField(v, label, errors, key) {
  if (v === '' || v == null) return 0
  const n = Number(v)
  if (!Number.isInteger(n) || n < 0) errors[key] = `${label} must be a whole number, 0 or more.`
  return n
}
function moneyField(v, label, errors, key) {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(/,/g, ''))
  if (!Number.isFinite(n) || n < 0) errors[key] = `${label} must be an amount, 0 or more.`
  return Math.round(n * 100) / 100
}
function dateField(v, label, errors, key) {
  if (!v) return null
  if (!/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) errors[key] = `${label} is not a valid date.`
  return v
}
const text = (v) => (v == null || String(v).trim() === '' ? null : String(v).trim())

// ---------- deliveries ----------
export async function saveDelivery(input) {
  await requireUser()
  const e = {}
  const branch_code = text(input.branch_code)
  if (!branch_code) e.branch_code = 'Pick a branch.'

  const row = {
    branch_code,
    delivered_on: dateField(input.delivered_on, 'Delivery date', e, 'delivered_on'),
    trunk_type: input.trunk_type === 'Old' ? 'Old' : 'New',
    old_trunks: input.trunk_type === 'Old' && input.old_trunks !== '' && input.old_trunks != null ? intField(input.old_trunks, 'Old trunks', e, 'old_trunks') : null,
    trunks_received: intField(input.trunks_received, 'Trunks received', e, 'trunks_received'),
    stands_received: intField(input.stands_received, 'Stands received', e, 'stands_received'),
    trunks_used: intField(input.trunks_used, 'Trunks used', e, 'trunks_used'),
    shifting_status: SHIFTING[input.shifting_status] ? input.shifting_status : 'not_started',
    shifting_done_on: dateField(input.shifting_done_on, 'Shifting completed on', e, 'shifting_done_on'),
    billing_tracked: input.billing_tracked !== false,
    invoice_no: text(input.invoice_no),
    invoice_date: dateField(input.invoice_date, 'Invoice date', e, 'invoice_date'),
    invoice_amount: moneyField(input.invoice_amount, 'Invoice amount', e, 'invoice_amount'),
    tax_rate: input.tax_rate === '' || input.tax_rate == null ? DEFAULT_TAX : Number(input.tax_rate),
    amount_received: moneyField(input.amount_received, 'Amount received', e, 'amount_received'),
    payment_date: dateField(input.payment_date, 'Payment date', e, 'payment_date'),
    remarks: text(input.remarks),
  }
  if (!(row.tax_rate >= 0 && row.tax_rate <= 100)) e.tax_rate = 'Tax must be between 0 and 100 %.'
  if (row.shifting_status !== 'complete') row.shifting_done_on = null
  if (!row.invoice_date && row.invoice_no) row.invoice_date = invoiceDate(row.invoice_no)
  if (Object.keys(e).length) return { ok: false, errors: e }

  // A branch typed in the form that does not exist yet is created with the region given.
  const exists = check(await db().from('trunk_branches').select('code').eq('code', branch_code).maybeSingle(), 'Checking branch')
  if (!exists) {
    await ensureRegion(text(input.new_branch_region))
    await ensureZone(text(input.new_branch_zone))
    check(await db().from('trunk_branches').insert({
      code: branch_code, name: /^\d+$/.test(branch_code) ? null : branch_code,
      region: text(input.new_branch_region), zone: text(input.new_branch_zone),
    }), 'Creating branch')
  }

  let saved
  if (input.id) saved = check(await db().from('trunk_deliveries').update(row).eq('id', input.id).select().single(), 'Saving delivery')
  else saved = check(await db().from('trunk_deliveries').insert(row).select().single(), 'Adding delivery')
  refresh()
  return { ok: true, id: saved.id }
}

export async function deleteDelivery(id) {
  await requireUser()
  check(await db().from('trunk_deliveries').delete().eq('id', id), 'Deleting delivery')
  refresh()
  return { ok: true }
}

/** One-click updates from the delivery panel. */
export async function quickUpdate(id, kind) {
  await requireUser()
  const d = check(await db().from('trunk_deliveries').select('*').eq('id', id).single(), 'Loading delivery')
  let patch
  if (kind === 'mark_paid') {
    const due = receivableOf(d)
    if (due == null) return { ok: false, error: 'Add the invoice amount first.' }
    patch = { amount_received: due, payment_date: d.payment_date || todayISO(), billing_tracked: true }
  } else if (kind === 'shifting_complete') {
    patch = { shifting_status: 'complete', shifting_done_on: todayISO() }
  } else if (kind === 'shifting_started') {
    patch = { shifting_status: 'in_progress', shifting_done_on: null }
  } else return { ok: false, error: 'Unknown action.' }
  check(await db().from('trunk_deliveries').update(patch).eq('id', id), 'Updating delivery')
  refresh()
  return { ok: true }
}

// ---------- branches ----------
export async function saveBranch(input) {
  await requireUser()
  const code = text(input.code)
  if (!code) return { ok: false, errors: { code: 'Branch code is required.' } }
  const row = { code, name: text(input.name), region: text(input.region), zone: text(input.zone), notes: text(input.notes) }
  await ensureRegion(row.region)
  await ensureZone(row.zone)
  if (input.originalCode && input.originalCode !== code) {
    const taken = check(await db().from('trunk_branches').select('code').eq('code', code).maybeSingle(), 'Checking code')
    if (taken) return { ok: false, errors: { code: `Branch ${code} already exists.` } }
    // the foreign key cascades the new code to every delivery
    check(await db().from('trunk_branches').update(row).eq('code', input.originalCode), 'Saving branch')
  } else if (input.originalCode) {
    check(await db().from('trunk_branches').update(row).eq('code', code), 'Saving branch')
  } else {
    const taken = check(await db().from('trunk_branches').select('code').eq('code', code).maybeSingle(), 'Checking code')
    if (taken) return { ok: false, errors: { code: `Branch ${code} already exists.` } }
    check(await db().from('trunk_branches').insert(row), 'Adding branch')
  }
  refresh()
  return { ok: true, code }
}

export async function deleteBranch(code) {
  await requireUser()
  const { count } = await db().from('trunk_deliveries').select('id', { count: 'exact', head: true }).eq('branch_code', code)
  if (count) return { ok: false, error: `Branch ${code} has ${count} deliveries. Move or delete them first.` }
  check(await db().from('trunk_branches').delete().eq('code', code), 'Deleting branch')
  refresh()
  return { ok: true }
}

// ---------- regions & zones (managed lists; branches follow renames via the foreign key) ----------
const GROUPS = { region: { table: 'trunk_regions', noun: 'Region' }, zone: { table: 'trunk_zones', noun: 'Zone' } }

async function ensureGroup(kind, name) {
  if (name) check(await db().from(GROUPS[kind].table).upsert({ name }, { onConflict: 'name', ignoreDuplicates: true }), `Adding ${kind}`)
}
const ensureRegion = (name) => ensureGroup('region', name)
const ensureZone = (name) => ensureGroup('zone', name)

/** Adds a region/zone, or renames it (every branch follows) and updates its notes. */
export async function saveGroup(kind, input) {
  await requireUser()
  const g = GROUPS[kind]
  if (!g) return { ok: false, error: 'Unknown list.' }
  const name = text(input.name)
  if (!name) return { ok: false, errors: { name: `${g.noun} name is required.` } }
  const original = text(input.originalName)
  if (name !== original) {
    const taken = check(await db().from(g.table).select('name').eq('name', name).maybeSingle(), `Checking ${kind}`)
    if (taken) return { ok: false, errors: { name: `“${name}” already exists. To combine them, use Delete or merge and move the branches there.` } }
  }
  if (original) check(await db().from(g.table).update({ name, notes: text(input.notes) }).eq('name', original), `Saving ${kind}`)
  else check(await db().from(g.table).insert({ name, notes: text(input.notes) }), `Adding ${kind}`)
  refresh()
  return { ok: true, name }
}

/** Deletes a region/zone. Its branches move to `moveTo` (a merge), or are left without one. */
export async function deleteGroup(kind, name, moveTo) {
  await requireUser()
  const g = GROUPS[kind]
  if (!g) return { ok: false, error: 'Unknown list.' }
  const target = text(moveTo)
  if (target === name) return { ok: false, error: `Pick a different ${kind} to move the branches to.` }
  if (target) {
    await ensureGroup(kind, target)
    check(await db().from('trunk_branches').update({ [kind]: target }).eq(kind, name), 'Moving branches')
  }
  check(await db().from(g.table).delete().eq('name', name), `Deleting ${kind}`)
  refresh()
  return { ok: true }
}

export async function saveRegion(input) { return saveGroup('region', input) }
export async function deleteRegion(name, moveTo) { return deleteGroup('region', name, moveTo) }

/** Used by the pickers: rename (an existing name merges them) or, with no new name, remove. */
export async function renameBranchField(field, from, to) {
  await requireUser()
  if (!GROUPS[field]) return { ok: false, error: 'Unknown field.' }
  const value = text(to)
  if (!text(from)) return { ok: false, error: 'Nothing to rename.' }
  if (!value) return deleteGroup(field, from, null)
  const exists = check(await db().from(GROUPS[field].table).select('name').eq('name', value).maybeSingle(), `Checking ${field}`)
  if (exists) return deleteGroup(field, from, value)
  const cur = check(await db().from(GROUPS[field].table).select('notes').eq('name', from).maybeSingle(), `Loading ${field}`)
  return saveGroup(field, { name: value, originalName: from, notes: cur?.notes })
}
