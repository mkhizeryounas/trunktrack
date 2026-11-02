'use client'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { useState, useEffect } from 'react'
import { Icon } from './icons'
import { Logo } from './logo'
import { logout } from '../actions'

const LINKS = [
  { href: '/', label: 'Dashboard', icon: 'home' },
  { href: '/deliveries', label: 'Deliveries', icon: 'truck' },
  { href: '/branches', label: 'Branches', icon: 'building' },
  { href: '/regions', label: 'Regions', icon: 'map' },
  { href: '/reports', label: 'Reports', icon: 'chart' },
  { href: '/issues', label: 'Data checks', icon: 'alert' },
]

export function Nav() {
  const path = usePathname()
  const [open, setOpen] = useState(false)
  useEffect(() => setOpen(false), [path])
  const isActive = (href) => (href === '/' ? path === '/' : path.startsWith(href))
  return (
    <>
      <div className="mobile-bar">
        <Link href="/" className="brand" style={{ padding: 0 }}><Logo size={28} /><b>Trunks MIS</b></Link>
        <button className="btn btn-ghost" onClick={() => setOpen(!open)} aria-label="Menu"><Icon name="menu" /></button>
      </div>
      <aside className={`sidebar${open ? ' open' : ''}`}>
        <Link href="/" className="brand">
          <Logo />
          <div><b>Trunks MIS</b><span>Central Record Office</span></div>
        </Link>
        {LINKS.map((l) => (
          <Link key={l.href} href={l.href} className={`nav-link${isActive(l.href) ? ' active' : ''}`}>
            <Icon name={l.icon} />{l.label}
          </Link>
        ))}
        <div className="sidebar-foot">
          <form action={logout}>
            <button className="nav-link" style={{ width: '100%', border: 0, background: 'none', cursor: 'pointer' }}>
              <Icon name="logout" />Sign out
            </button>
          </form>
        </div>
      </aside>
    </>
  )
}

