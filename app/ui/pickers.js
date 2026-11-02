'use client'
import { useMemo } from 'react'
import { Combobox } from './combobox'
import { saveBranch, deleteBranch, renameBranchField } from '../actions'
import { codeKey } from '@/lib/model.js'
import { useAppData } from './app-data'

const plural = (n, one, many = one + 's') => `${n} ${n === 1 ? one : many}`

/** Branch code picker: search, add a new code, edit a branch's code/region/zone, delete unused branches. */
export function BranchPicker({ id, value, onChange, branches, deliveries = [], autoFocus, invalid }) {
  const counts = useMemo(() => {
    const c = {}
    for (const d of deliveries) c[d.branch_code] = (c[d.branch_code] || 0) + 1
    return c
  }, [deliveries])
  const regions = useMemo(() => [...new Set(branches.map((b) => b.region).filter(Boolean))].sort(), [branches])
  const zones = useMemo(() => [...new Set(branches.map((b) => b.zone).filter(Boolean))].sort(), [branches])
  const options = useMemo(() => [...branches].sort((a, b) => codeKey(a.code).localeCompare(codeKey(b.code))).map((b) => {
    const n = counts[b.code] || 0
    return {
      value: b.code,
      label: b.name && b.name !== b.code ? `${b.code} · ${b.name}` : b.code,
      sub: [b.region || 'No region', b.zone && `${b.zone} zone`].filter(Boolean).join(' · '),
      meta: plural(n, 'delivery', 'deliveries'),
      deleteBlocked: n ? `Has ${plural(n, 'delivery', 'deliveries')}, so it can't be deleted` : null,
      data: { code: b.code, region: b.region || '', zone: b.zone || '', name: b.name, notes: b.notes },
    }
  }), [branches, counts])

  return (
    <Combobox
      id={id} value={value} onChange={onChange} options={options} autoFocus={autoFocus} invalid={invalid}
      placeholder="Search or type a branch code"
      addLabel={(t) => `Add new branch “${t}”`}
      editFields={[{ key: 'code', label: 'Code' }, { key: 'region', label: 'Region', list: regions }, { key: 'zone', label: 'Zone', list: zones }]}
      onEdit={(o, v) => saveBranch({ ...o.data, ...v, originalCode: o.value })}
      onDelete={(o) => deleteBranch(o.value)}
      deleteText={(o) => `Delete branch ${o.value}?`}
    />
  )
}

/** Region or zone picker. Editing renames it on every branch; deleting clears it from those branches. */
export function FieldPicker({ field, id, value, onChange, branches, invalid }) {
  const noun = field === 'zone' ? 'zone' : 'region'
  const { regions } = useAppData()
  const options = useMemo(() => {
    const c = {}
    if (field === 'region') for (const r of regions) c[r] = 0 // managed regions, even with no branches yet
    for (const b of branches) if (b[field]) c[b[field]] = (c[b[field]] || 0) + 1
    return Object.entries(c).sort(([a], [b]) => a.localeCompare(b)).map(([v, n]) => ({
      value: v, meta: plural(n, 'branch', 'branches'), data: { value: v }, count: n,
    }))
  }, [branches, field, regions])

  return (
    <Combobox
      id={id} value={value} onChange={onChange} options={options} invalid={invalid}
      placeholder={`Search or add a ${noun}`}
      addLabel={(t) => `Add new ${noun} “${t}”`}
      editFields={[{ key: 'value', label: field === 'region' ? 'Rename (an existing name merges them)' : 'Rename zone (all its branches)' }]}
      onEdit={(o, v) => (v.value?.trim() ? renameBranchField(field, o.value, v.value) : { ok: false, error: 'Name cannot be empty.' })}
      onDelete={(o) => renameBranchField(field, o.value, null)}
      deleteText={(o) => (o.count ? `Remove “${o.value}”? ${plural(o.count, 'branch', 'branches')} will have no ${noun}.` : `Delete ${noun} “${o.value}”?`)}
    />
  )
}
