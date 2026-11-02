import 'server-only'
import ExcelJS from 'exceljs'
import { DEFAULT_TAX } from './model.js'

/*
  How the workbook maps to the app

  "Trunks Status"        one row per delivery of trunks to a branch: record-shifting progress,
                         trunks used and the balance left. → the operations side of a delivery.
  "New Trunks 2026 May"  the newest deliveries again, with invoice and payment. → the billing side.

  Each May row is matched to its Trunks Status row (same branch + same trunks received) and merged into
  one delivery. May rows with no match become new deliveries. Trunks Status rows with no May row were
  delivered before the billing list started, so they are kept with billing_tracked = false.

  Any other sheet that has "Branch Code" and "Region" columns is used only to look up a branch's
  region and zone (Trunks Status has no region column).
*/

const STATUS_SHEET = 'trunks status'
const BILLING_SHEET = 'new trunks 2026 may'
const REGION_FIX = { Gugrat: 'Gujrat', 'Faisalabad B': 'Faisalabad-B', 'Faisalabad A': 'Faisalabad-A' }
const CODE_FIX = { 'Credit\\Operations': 'Credit\\Ops' }

// ---------- cell helpers ----------
function raw(cell) {
  let v = cell?.value
  if (v == null) return null
  if (v instanceof Date) return v
  if (typeof v === 'object') {
    if ('result' in v) v = v.result
    else if ('richText' in v) v = v.richText.map((t) => t.text).join('')
    else if ('text' in v) v = v.text
    else if ('error' in v) return null
    else return null
  }
  return v
}
const str = (v) => {
  if (v == null) return null
  const t = (v instanceof Date ? v.toISOString() : String(v)).trim()
  return t || null
}
const num = (v) => {
  if (v == null || v instanceof Date) return null
  const t = String(v).trim()
  if (!t) return null
  const n = Number(t)
  return Number.isFinite(n) ? n : null
}
const int = (v) => {
  const n = num(v)
  return n == null ? 0 : Math.trunc(n)
}
const code = (v) => {
  let c = str(v)
  if (!c) return null
  if (c.endsWith('.0')) c = c.slice(0, -2)
  return CODE_FIX[c] || c
}
const region = (v) => {
  const r = str(v)
  return r ? REGION_FIX[r] || r : null
}
const iso = (y, m, d) => {
  const dt = new Date(Date.UTC(y, m - 1, d))
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== m - 1 || dt.getUTCDate() !== d) return null
  return dt.toISOString().slice(0, 10)
}

/** Typed dates are d/m/yyyy. From 2026 Excel read many as m/d, so a real 2026 date with day <= 12 is
    swapped back (2026-12-05 is really 12 May 2026). Text dates are read as d/m/yyyy. */
export function parseDate(v) {
  if (v == null) return null
  if (v instanceof Date) {
    let y = v.getUTCFullYear(), m = v.getUTCMonth() + 1, d = v.getUTCDate()
    if (y === 2026 && d <= 12) [m, d] = [d, m]
    return iso(y, m, d)
  }
  const match = String(v).match(/^\s*(\d{1,2})\s*[/\\.-]\s*(\d{1,2})\s*[/\\.-]\s*(\d{2,4})\s*$/)
  if (!match) return null
  let [, d, m, y] = match.map(Number)
  if (y < 100) y += 2000
  return iso(y, m, d)
}
const isDate = (v) => parseDate(v) != null

/** Invoice numbers end with their date: 22/I-902/22/6/2026 or 0011/I-880/22/5/26. */
export function invoiceDate(inv) {
  const m = inv && inv.match(/(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\s*$/)
  return m ? parseDate(`${m[1]}/${m[2]}/${m[3]}`) : null
}

function shifting(v) {
  const t = (str(v) || '').toLowerCase()
  if (t.startsWith('comp')) return 'complete'
  if (t.includes('official')) return 'official'
  if (t.includes('progress')) return 'in_progress'
  return 'not_started'
}

function trunkType(v) {
  const t = (str(v) || 'New').toLowerCase()
  if (t === 'old') return ['Old', null]
  const n = num(t)
  return n != null ? ['Old', Math.trunc(n)] : ['New', null]
}

// ---------- sheet helpers ----------
function readTable(ws) {
  // Find the header row (the first row with a "Branch Code" cell) and map header → column.
  for (let r = 1; r <= Math.min(ws.rowCount, 20); r++) {
    const row = ws.getRow(r)
    const cols = {}
    row.eachCell({ includeEmpty: false }, (cell, c) => {
      const h = str(raw(cell))
      if (h) cols[h.toLowerCase().replace(/\s+/g, ' ')] = c
    })
    if (cols['branch code']) {
      const rows = []
      for (let i = r + 1; i <= ws.rowCount; i++) {
        const xr = ws.getRow(i)
        const get = (name) => (cols[name] ? raw(xr.getCell(cols[name])) : null)
        rows.push({ get, rowNumber: i })
      }
      return { cols, rows }
    }
  }
  return null
}

function findSheet(wb, name) {
  return wb.worksheets.find((ws) => ws.name.trim().toLowerCase() === name)
}

function requireCols(cols, names, sheet) {
  const missing = names.filter((n) => !cols[n])
  if (missing.length) throw new Error(`Sheet "${sheet}" is missing columns: ${missing.join(', ')}`)
}

/** Parses the workbook. Returns { branches, deliveries, summary, warnings } and never writes. */
export async function parseWorkbook(buffer) {
  const wb = new ExcelJS.Workbook()
  try {
    await wb.xlsx.load(buffer)
  } catch {
    throw new Error('That file could not be read as an Excel workbook (.xlsx or .xlsm).')
  }
  const statusWs = findSheet(wb, STATUS_SHEET)
  const billingWs = findSheet(wb, BILLING_SHEET)
  if (!statusWs || !billingWs) {
    throw new Error(`The workbook needs sheets named "Trunks Status" and "New Trunks 2026 May". Found: ${wb.worksheets.map((w) => w.name).join(', ')}`)
  }
  const warnings = []

  // ----- Trunks Status -----
  const st = readTable(statusWs)
  if (!st) throw new Error('No "Branch Code" header found in "Trunks Status".')
  requireCols(st.cols, ['branch code', 'date', 'record shifting status', 'trunks type', 'trunks received', 'stand received', 'trunks used'], 'Trunks Status')
  const deliveries = []
  let shiftedRows = 0
  for (const { get, rowNumber } of st.rows) {
    const c = code(get('branch code'))
    if (!c || c.toLowerCase() === 'total') continue
    let dateRaw = get('date'), statusRaw = get('record shifting status'), reg = null
    // Rows pasted from the May list slid one column: Date holds the region, Status holds the date.
    if (!isDate(dateRaw) && str(dateRaw) && isDate(statusRaw)) {
      reg = region(dateRaw)
      dateRaw = statusRaw
      statusRaw = 'Not Start'
      shiftedRows++
    }
    if (str(dateRaw) === 'Official Use') dateRaw = null
    const [type, oldN] = trunkType(get('trunks type'))
    deliveries.push({
      ref_no: int(get('sr no')) || null,
      branch_code: c,
      _region: reg,
      _row: rowNumber,
      delivered_on: parseDate(dateRaw),
      trunk_type: type,
      old_trunks: oldN,
      trunks_received: int(get('trunks received')),
      stands_received: int(get('stand received')),
      trunks_used: int(get('trunks used')),
      shifting_status: shifting(statusRaw),
      shifting_done_on: null,
      billing_tracked: false,
      invoice_no: null,
      invoice_date: null,
      invoice_amount: null,
      tax_rate: DEFAULT_TAX,
      amount_received: null,
      payment_date: null,
      remarks: null,
    })
  }
  if (shiftedRows) warnings.push(`${shiftedRows} rows in "Trunks Status" had Region typed in the Date column (pasted from the May list). They were read with the columns put back in place.`)

  // ----- New Trunks 2026 May -----
  const bt = readTable(billingWs)
  if (!bt) throw new Error('No "Branch Code" header found in "New Trunks 2026 May".')
  requireCols(bt.cols, ['branch code', 'region', 'date', 'trunks received', 'stand received', 'invoice status', 'invoice amount', 'payment transfar date', 'remarks'], 'New Trunks 2026 May')
  const pool = {}
  for (const d of deliveries) (pool[`${d.branch_code}|${d.trunks_received}`] ||= []).push(d)
  let matched = 0
  const added = []
  for (const { get } of bt.rows) {
    const c = code(get('branch code'))
    if (!c) continue
    const recv = int(get('trunks received'))
    let d = (pool[`${c}|${recv}`] || []).find((x) => !x.billing_tracked)
    if (!d) {
      d = {
        ref_no: null, branch_code: c, _region: null, delivered_on: null, trunk_type: 'New', old_trunks: null,
        trunks_received: recv, stands_received: int(get('stand received')), trunks_used: 0,
        shifting_status: 'not_started', shifting_done_on: null, tax_rate: DEFAULT_TAX, remarks: null,
      }
      deliveries.push(d)
      added.push(`${c} (${recv} trunks${str(get('invoice status')) ? ', ' + str(get('invoice status')) : ''})`)
    } else matched++
    const invAmt = num(get('invoice amount'))
    const paid = (str(get('remarks')) || '').toLowerCase() === 'clear'
    const invStatus = str(get('invoice status'))
    const direct = (invStatus || '').toLowerCase() === 'direct payment'
    const invNo = invStatus && !direct ? invStatus : null
    Object.assign(d, {
      _region: region(get('region')) || d._region,
      delivered_on: parseDate(get('date')) || d.delivered_on,
      stands_received: int(get('stand received')) || d.stands_received,
      billing_tracked: true,
      invoice_no: invNo,
      invoice_date: invoiceDate(invNo),
      invoice_amount: invAmt,
      amount_received: paid && invAmt ? Math.round(invAmt * (1 - DEFAULT_TAX / 100) * 100) / 100 : null,
      payment_date: parseDate(get('payment transfar date')),
      remarks: direct ? 'Direct payment' : null,
    })
  }
  if (added.length) warnings.push(`${added.length} rows in "New Trunks 2026 May" have no matching delivery in "Trunks Status" (same branch and trunks received), so they were added as new deliveries: ${added.join('; ')}.`)

  // ----- branch → region / zone lookups from the other sheets -----
  const lookupRegion = {}, lookupZone = {}, regionZone = {}
  const others = wb.worksheets.filter((ws) => ws !== statusWs && ws !== billingWs).reverse() // earlier sheets win
  const lookupSheets = []
  for (const ws of others) {
    const t = readTable(ws)
    if (!t || !t.cols.region) continue
    lookupSheets.push(ws.name)
    for (const { get } of t.rows) {
      const c = code(get('branch code'))
      const reg = region(get('region'))
      if (!c || c.toLowerCase() === 'total' || !reg) continue
      lookupRegion[c] = reg
      const z = str(get('zone'))
      if (z) {
        lookupZone[c] = z
        const counts = (regionZone[reg] ||= new Map())
        counts.set(z, (counts.get(z) || 0) + 1)
      }
    }
  }
  const usualZone = (reg) => {
    const counts = regionZone[reg]
    if (!counts) return null
    let best = null, n = 0
    for (const [z, k] of counts) if (k > n) [best, n] = [z, k]
    return best
  }

  const lastRegion = {}
  for (const d of deliveries) if (d._region) lastRegion[d.branch_code] = d._region
  const branches = [...new Set(deliveries.map((d) => d.branch_code))].map((c) => {
    const reg = lastRegion[c] || lookupRegion[c] || null
    return { code: c, name: /^\d+$/.test(c) ? null : c, region: reg, zone: lookupZone[c] || (reg ? usualZone(reg) : null) }
  })
  const noRegion = branches.filter((b) => !b.region).map((b) => b.code)
  if (noRegion.length) warnings.push(`No region found for branch ${noRegion.join(', ')}. You can set it on the Branches page.`)

  for (const d of deliveries) {
    delete d._region
    delete d._row
  }

  const summary = {
    deliveries: deliveries.length,
    branches: branches.length,
    matched,
    added: added.length,
    billed: deliveries.filter((d) => d.billing_tracked).length,
    paid: deliveries.filter((d) => d.amount_received > 0).length,
    trunks: deliveries.reduce((a, d) => a + d.trunks_received, 0),
    stands: deliveries.reduce((a, d) => a + d.stands_received, 0),
    used: deliveries.reduce((a, d) => a + d.trunks_used, 0),
    invoiced: deliveries.reduce((a, d) => a + (d.invoice_amount || 0), 0),
    lookupSheets,
  }
  return { branches, deliveries, summary, warnings }
}
