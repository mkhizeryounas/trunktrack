import Link from 'next/link'
import { Icon } from './icons'
import { SHIFTING, BILLING } from '@/lib/model.js'

export function PageHead({ title, sub, crumbs, children }) {
  return (
    <div className="page-head">
      <div>
        {crumbs && <div className="crumbs">{crumbs}</div>}
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
      </div>
      {children && <div className="page-actions">{children}</div>}
    </div>
  )
}

export function Badge({ tone = 'gray', children, plain }) {
  return <span className={`badge tone-${tone}${plain ? ' plain' : ''}`}>{children}</span>
}
export const ShiftingBadge = ({ status }) => <Badge tone={SHIFTING[status]?.tone}>{SHIFTING[status]?.label || status}</Badge>
export const BillingBadge = ({ status }) => <Badge tone={BILLING[status]?.tone}>{BILLING[status]?.label || status}</Badge>

export function Stat({ label, value, foot, icon, href, bar }) {
  return (
    <div className="card stat">
      <div className="stat-label">{icon && <Icon name={icon} size={14} />}{label}</div>
      <div className="stat-value">{value}</div>
      {bar && (
        <div className="stat-bar">
          {bar.map((b, i) => <span key={i} style={{ width: `${b.pct}%`, background: b.color }} title={b.title} />)}
        </div>
      )}
      {foot && <div className="stat-foot">{foot}</div>}
      {href && <Link className="stretch" href={href} aria-label={label} />}
    </div>
  )
}

export function Card({ title, sub, action, children, pad = true, className = '' }) {
  return (
    <section className={`card ${className}`}>
      {(title || action) && (
        <div className="card-head">
          <div><h2>{title}</h2>{sub && <div className="sub">{sub}</div>}</div>
          {action}
        </div>
      )}
      <div className={pad ? 'card-body' : ''}>{children}</div>
    </section>
  )
}

export function Empty({ icon = 'box', title, children }) {
  return (
    <div className="empty">
      <Icon name={icon} />
      <b>{title}</b>
      {children}
    </div>
  )
}

export function SetupNotice({ message }) {
  return (
    <div className="card card-pad" style={{ maxWidth: 680 }}>
      <h2 style={{ marginTop: 0 }}>One-time database setup</h2>
      <p className="muted">{message}</p>
      <ol className="steps">
        <li><span>Open your Supabase project → <b>SQL Editor</b> → <b>New query</b>.</span></li>
        <li><span>Paste the contents of <code>supabase/schema.sql</code> from this project and click <b>Run</b>.</span></li>
        <li><span>Load the workbook with <code>npm run import -- data.xlsx</code>.</span></li>
      </ol>
    </div>
  )
}
