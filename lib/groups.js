import { totals, groupBy } from './model.js'

/** Per-region or per-zone figures for the Regions / Zones pages. `kind` is 'region' or 'zone'. */
export function summariseGroups(kind, { branches, deliveries, list }) {
  const other = kind === 'region' ? 'zone' : 'region'
  const branchesBy = groupBy(branches, (b) => b[kind] || '')
  const deliveriesBy = groupBy(deliveries, (d) => d[kind] || '')
  const one = (name, notes) => {
    const bs = branchesBy[name] || []
    const ds = deliveriesBy[name] || []
    const t = totals(ds)
    const others = Object.entries(groupBy(bs, (b) => b[other] || `No ${other}`)).map(([n, l]) => ({ name: n, n: l.length })).sort((a, b) => b.n - a.n)
    return {
      name, notes: notes || null, branches: bs.map((b) => b.code), others, deliveries: t.count, trunks: t.trunks, used: t.used,
      balance: t.balance, notStarted: ds.filter((d) => d.shifting_status === 'not_started').length, invoiced: t.invoiced, outstanding: t.outstanding,
    }
  }
  return {
    rows: list.map((g) => one(g.name, g.notes)),
    unassigned: branchesBy[''] ? one('', null) : null,
  }
}
