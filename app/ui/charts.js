// Dependency-free SVG charts. Hover shows exact values (native <title> tooltips).
import Link from 'next/link'

export function BarChart({ data, series, height = 220, format = (v) => v }) {
  // data: [{ label, href?, values: { key: number } }], series: [{ key, label, color }] (stacked)
  const W = 640, H = height, padL = 44, padB = 26, padT = 10
  const max = Math.max(1, ...data.map((d) => series.reduce((a, s) => a + (d.values[s.key] || 0), 0)))
  const nice = niceMax(max)
  const bw = (W - padL) / Math.max(1, data.length)
  const y = (v) => padT + (H - padT - padB) * (1 - v / nice)
  const ticks = [0, 0.25, 0.5, 0.75, 1].map((t) => t * nice)
  return (
    <svg className="chart" viewBox={`0 0 ${W} ${H}`} role="img">
      {ticks.map((t) => (
        <g key={t}>
          <line className="grid-line" x1={padL} x2={W} y1={y(t)} y2={y(t)} />
          <text x={padL - 8} y={y(t) + 4} textAnchor="end">{short(t)}</text>
        </g>
      ))}
      {data.map((d, i) => {
        let acc = 0
        const x = padL + i * bw + bw * 0.18
        const w = bw * 0.64
        const bars = series.map((s) => {
          const v = d.values[s.key] || 0
          const top = y(acc + v), bottom = y(acc)
          acc += v
          return v > 0 ? <rect key={s.key} className="bar" x={x} y={top} width={w} height={Math.max(0, bottom - top)} rx={3} fill={s.color} /> : null
        })
        const tip = `${d.label}\n` + series.map((s) => `${s.label}: ${format(d.values[s.key] || 0)}`).join('\n')
        const label = <text x={x + w / 2} y={H - 8} textAnchor="middle">{d.short || d.label}</text>
        const body = <g className="col"><title>{tip}</title><rect x={padL + i * bw} y={padT} width={bw} height={H - padT - padB} fill="transparent" />{bars}{label}</g>
        return d.href ? <Link key={d.label} href={d.href}>{body}</Link> : <g key={d.label}>{body}</g>
      })}
    </svg>
  )
}

export function Donut({ parts, size = 150, thickness = 20, center, sub }) {
  const total = parts.reduce((a, p) => a + p.value, 0) || 1
  const r = (size - thickness) / 2, c = 2 * Math.PI * r
  let offset = 0
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" style={{ flex: 'none' }}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--gray-soft)" strokeWidth={thickness} />
      {parts.map((p) => {
        const len = (p.value / total) * c
        const el = (
          <circle key={p.label} cx={size / 2} cy={size / 2} r={r} fill="none" stroke={p.color} strokeWidth={thickness}
            strokeDasharray={`${Math.max(0, len - 2)} ${c}`} strokeDashoffset={-offset} transform={`rotate(-90 ${size / 2} ${size / 2})`}>
            <title>{`${p.label}: ${p.value}`}</title>
          </circle>
        )
        offset += len
        return el
      })}
      <text x="50%" y="48%" textAnchor="middle" style={{ fontSize: 22, fontWeight: 650, fill: 'var(--text)' }}>{center}</text>
      <text x="50%" y="62%" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-3)' }}>{sub}</text>
    </svg>
  )
}

export function HBars({ rows, format = (v) => v }) {
  // rows: [{ label, href?, parts: [{ value, color, title }], value }]
  const max = Math.max(1, ...rows.map((r) => r.parts.reduce((a, p) => a + p.value, 0)))
  return (
    <div className="hbars">
      {rows.map((r) => (
        <div className="hbar-row" key={r.label}>
          {r.href ? <Link href={r.href} className="nowrap" style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{r.label}</Link> : <span>{r.label}</span>}
          <div className="hbar-track">
            {r.parts.map((p, i) => <span key={i} title={`${p.title}: ${format(p.value)}`} style={{ width: `${(p.value / max) * 100}%`, background: p.color }} />)}
          </div>
          <span className="num small" style={{ color: 'var(--text-2)', minWidth: 70, textAlign: 'right' }}>{format(r.value)}</span>
        </div>
      ))}
    </div>
  )
}

function niceMax(v) {
  const p = Math.pow(10, Math.floor(Math.log10(v)))
  const n = v / p
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p
}
function short(v) {
  if (v >= 1e7) return (v / 1e7).toFixed(1).replace(/\.0$/, '') + 'cr'
  if (v >= 1e5) return (v / 1e5).toFixed(1).replace(/\.0$/, '') + 'L'
  if (v >= 1e3) return (v / 1e3).toFixed(1).replace(/\.0$/, '') + 'k'
  return Math.round(v)
}
