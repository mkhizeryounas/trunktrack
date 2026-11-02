import 'server-only'
import { connection } from 'next/server'
import { db, check } from './db.js'
import { enrich } from './model.js'

async function selectAll(table, order) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    const page = check(await db().from(table).select('*').order(order).range(from, from + 999), `Loading ${table}`)
    rows.push(...page)
    if (page.length < 1000) return rows
  }
}

/** Everything the app shows. The data set is small (hundreds of rows), so screens filter in memory. */
export async function loadAll() {
  await connection() // always render with fresh data
  try {
    const [branches, raw, regions] = await Promise.all([selectAll('trunk_branches', 'code'), selectAll('trunk_deliveries', 'id'), selectAll('trunk_regions', 'name')])
    const byCode = Object.fromEntries(branches.map((b) => [b.code, b]))
    const deliveries = raw.map((d) => enrich(d, byCode))
    return { branches, deliveries, regions, setupError: null }
  } catch (e) {
    if (String(e.message).startsWith('SETUP:')) return { branches: [], deliveries: [], regions: [], setupError: e.message.slice(7) }
    throw e
  }
}

/** Just the managed region names, for pickers on every page. */
export async function loadRegionNames() {
  try {
    return (await selectAll('trunk_regions', 'name')).map((r) => r.name)
  } catch {
    return []
  }
}
