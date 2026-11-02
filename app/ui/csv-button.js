'use client'
import { Icon } from './icons'

/** Downloads a ready-made table (header + rows of plain values) as CSV. */
export function CsvButton({ filename, header, rows, label = 'CSV' }) {
  const go = () => {
    const esc = (v) => { const s = v == null ? '' : String(v); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
    const csv = [header, ...rows].map((r) => r.map(esc).join(',')).join('\n')
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })), download: filename })
    a.click()
    URL.revokeObjectURL(a.href)
  }
  return <button className="btn btn-sm no-print" onClick={go}><Icon name="download" />{label}</button>
}

export function PrintButton() {
  return <button className="btn" onClick={() => window.print()}><Icon name="printer" />Print</button>
}
