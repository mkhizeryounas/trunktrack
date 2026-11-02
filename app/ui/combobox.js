'use client'
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { Icon } from './icons'

/*
  Searchable picker with add / edit / delete inside the list.

  options:   [{ value, label?, sub?, meta?, deleteBlocked?: string }]
  value:     current value (string)
  onChange:  (value) => void            picking or typing
  addLabel:  (text) => string           text of the "add" row; omit to disable adding
  onAdd:     (text) => void             optional; default just sets the value
  editFields:[{ key, label, list? }]    fields shown when editing a row (values come from option.data)
  onEdit:    async (option, values) => { ok, error? }
  onDelete:  async (option) => { ok, error? }
  deleteText:(option) => string         confirm sentence
*/
export function Combobox({
  id, value, onChange, options, placeholder, addLabel, onAdd, editFields, onEdit, onDelete, deleteText, autoFocus, invalid,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState(null) // null = not searching, show all
  const [active, setActive] = useState(0)
  const [editing, setEditing] = useState(null) // { value, values }
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const root = useRef(null)
  const list = useRef(null)
  const listId = useId()

  const q = (query ?? '').trim().toLowerCase()
  const shown = useMemo(() => {
    if (!q) return options
    const starts = [], contains = []
    for (const o of options) {
      const hay = [o.value, o.label, o.sub].filter(Boolean).join(' ').toLowerCase()
      if (String(o.value).toLowerCase().startsWith(q)) starts.push(o)
      else if (hay.includes(q)) contains.push(o)
    }
    return [...starts, ...contains]
  }, [options, q])
  const exact = options.some((o) => String(o.value).toLowerCase() === q)
  const canAdd = addLabel && q && !exact
  const total = shown.length + (canAdd ? 1 : 0)

  useEffect(() => {
    if (!open) return
    const onDown = (e) => { if (root.current && !root.current.contains(e.target)) close() }
    document.addEventListener('mousedown', onDown)
    return () => document.removeEventListener('mousedown', onDown)
  }, [open])
  useEffect(() => { setActive(0) }, [q])
  useEffect(() => {
    list.current?.querySelector(`[data-i="${active}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [active])

  function close() {
    setOpen(false); setQuery(null); setEditing(null); setDeleting(null); setError(null)
  }
  function pick(v) {
    onChange(v)
    close()
  }
  function add() {
    const text = query.trim()
    onAdd ? onAdd(text) : onChange(text)
    close()
  }

  function onKeyDown(e) {
    if (editing || deleting) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setOpen(true); setActive((a) => Math.min(total - 1, a + 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(0, a - 1)) }
    else if (e.key === 'Enter' && open) {
      e.preventDefault()
      if (active < shown.length) pick(shown[active].value)
      else if (canAdd) add()
    } else if (e.key === 'Escape' && open) { e.stopPropagation(); close() }
    else if (e.key === 'Tab') close()
  }

  async function saveEdit(o) {
    setBusy(true); setError(null)
    try {
      const res = await onEdit(o, editing.values)
      if (res?.ok === false) setError(res.error || Object.values(res.errors || {})[0] || 'Could not save.')
      else {
        // keep the field pointing at the renamed item
        const renamed = editing.values.value ?? editing.values.code
        if (String(value) === String(o.value) && renamed && renamed !== o.value) onChange(renamed)
        setEditing(null)
      }
    } catch (err) { setError(err.message) }
    setBusy(false)
  }
  async function confirmDelete(o) {
    setBusy(true); setError(null)
    try {
      const res = await onDelete(o)
      if (res?.ok === false) setError(res.error || 'Could not delete.')
      else {
        if (String(value) === String(o.value)) onChange('')
        setDeleting(null)
      }
    } catch (err) { setError(err.message) }
    setBusy(false)
  }

  const current = options.find((o) => String(o.value) === String(value))

  return (
    <div className={`combo${open ? ' open' : ''}`} ref={root}>
      <div className={`combo-control${invalid ? ' invalid' : ''}`} onClick={() => { setOpen(true); root.current.querySelector('input').focus() }}>
        <input
          id={id}
          className="combo-input"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          aria-autocomplete="list"
          autoComplete="off"
          autoFocus={autoFocus}
          placeholder={placeholder}
          value={query ?? value ?? ''}
          onChange={(e) => { setQuery(e.target.value); setOpen(true); if (!addLabel) return; onChange(e.target.value) }}
          onFocus={() => setOpen(true)}
          onKeyDown={onKeyDown}
        />
        {current?.sub && query == null && <span className="combo-sub">{current.sub}</span>}
        {value && <button type="button" className="combo-clear" aria-label="Clear" onClick={(e) => { e.stopPropagation(); onChange(''); setQuery('') }}><Icon name="x" size={14} /></button>}
        <span className="combo-chev" aria-hidden="true"><svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="m6 9 6 6 6-6" /></svg></span>
      </div>

      {open && (
        <div className="combo-pop" onMouseDown={(e) => e.target.tagName !== 'INPUT' && e.preventDefault()}>
          {error && <div className="combo-error"><Icon name="alert" size={14} />{error}</div>}
          <ul className="combo-list" role="listbox" id={listId} ref={list}>
            {shown.map((o, i) => {
              const isEditing = editing?.value === o.value
              const isDeleting = deleting === o.value
              if (isEditing) {
                return (
                  <li key={o.value} className="combo-edit" onKeyDown={(e) => { if (e.key === 'Escape') { e.stopPropagation(); setEditing(null) } if (e.key === 'Enter') { e.preventDefault(); saveEdit(o) } }}>
                    <div className="combo-edit-fields">
                      {editFields.map((f, fi) => (
                        <label key={f.key}>
                          <span>{f.label}</span>
                          <input className="input" autoFocus={fi === 0} list={f.list ? `${listId}-${f.key}` : undefined} value={editing.values[f.key] ?? ''}
                            onChange={(e) => setEditing((p) => ({ ...p, values: { ...p.values, [f.key]: e.target.value } }))} />
                          {f.list && <datalist id={`${listId}-${f.key}`}>{f.list.map((v) => <option key={v} value={v} />)}</datalist>}
                        </label>
                      ))}
                    </div>
                    <div className="combo-row-actions">
                      <button type="button" className="btn btn-sm" onClick={() => { setEditing(null); setError(null) }}>Cancel</button>
                      <button type="button" className="btn btn-sm btn-primary" disabled={busy} onClick={() => saveEdit(o)}>{busy ? 'Saving…' : 'Save'}</button>
                    </div>
                  </li>
                )
              }
              if (isDeleting) {
                return (
                  <li key={o.value} className="combo-confirm">
                    <span>{deleteText ? deleteText(o) : `Delete ${o.value}?`}</span>
                    <div className="combo-row-actions">
                      <button type="button" className="btn btn-sm" onClick={() => { setDeleting(null); setError(null) }}>Keep</button>
                      <button type="button" className="btn btn-sm btn-danger" disabled={busy} onClick={() => confirmDelete(o)}>{busy ? 'Deleting…' : 'Delete'}</button>
                    </div>
                  </li>
                )
              }
              return (
                <li key={o.value} data-i={i} role="option" aria-selected={String(value) === String(o.value)}
                  className={`combo-opt${i === active ? ' active' : ''}${String(value) === String(o.value) ? ' selected' : ''}`}
                  onMouseEnter={() => setActive(i)} onClick={() => pick(o.value)}>
                  <span className="combo-check">{String(value) === String(o.value) && <Icon name="check" size={14} />}</span>
                  <span className="combo-text"><b>{o.label ?? o.value}</b>{o.sub && <span>{o.sub}</span>}</span>
                  {o.meta && <span className="combo-meta">{o.meta}</span>}
                  {(onEdit || onDelete) && (
                    <span className="combo-tools">
                      {onEdit && <button type="button" title="Edit" aria-label={`Edit ${o.value}`} onClick={(e) => { e.stopPropagation(); setDeleting(null); setError(null); setEditing({ value: o.value, values: { ...o.data } }) }}><Icon name="edit" size={14} /></button>}
                      {onDelete && <button type="button" title={o.deleteBlocked || 'Delete'} aria-label={`Delete ${o.value}`} disabled={!!o.deleteBlocked} onClick={(e) => { e.stopPropagation(); setEditing(null); setError(null); setDeleting(o.value) }}><Icon name="trash" size={14} /></button>}
                    </span>
                  )}
                </li>
              )
            })}
            {!shown.length && !canAdd && <li className="combo-empty">{options.length ? 'No matches' : 'Nothing here yet'}</li>}
          </ul>
          {canAdd && (
            <button type="button" data-i={shown.length} className={`combo-add${active === shown.length ? ' active' : ''}`} onMouseEnter={() => setActive(shown.length)} onClick={add}>
              <Icon name="plus" size={15} />{addLabel(query.trim())}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
