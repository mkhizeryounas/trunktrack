'use client'
import { useId } from 'react'

// The Trunks MIS mark: a record trunk with a file tucked in. Same art as app/icon.svg.
export function Logo({ size = 34 }) {
  // unique ids: the logo appears more than once per page (sidebar + mobile bar)
  const uid = useId().replace(/:/g, '')
  const bg = `tmis-bg-${uid}`, shine = `tmis-shine-${uid}`
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label="Trunks MIS" style={{ flex: 'none', display: 'block', filter: 'drop-shadow(0 2px 6px rgba(74, 85, 235, .35))' }}>
      <defs>
        <linearGradient id={bg} x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#3b6cf6" /><stop offset="1" stopColor="#6a3fe0" /></linearGradient>
        <linearGradient id={shine} x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="#fff" stopOpacity=".22" /><stop offset=".5" stopColor="#fff" stopOpacity="0" /></linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill={`url(#${bg})`} />
      <rect width="64" height="64" rx="15" fill={`url(#${shine})`} />
      <rect x="22" y="11" width="20" height="16" rx="2.5" fill="#fff" opacity=".55" transform="rotate(-8 32 19)" />
      <rect x="26" y="9" width="18" height="16" rx="2.5" fill="#fff" opacity=".85" transform="rotate(6 35 17)" />
      <path d="M31 14.5h9M31 18h6" stroke="#6a3fe0" strokeWidth="1.8" strokeLinecap="round" transform="rotate(6 35 17)" />
      <rect x="11" y="24" width="42" height="11" rx="3.5" fill="#fff" />
      <path d="M14 35h36v13a4 4 0 0 1-4 4H18a4 4 0 0 1-4-4z" fill="#fff" />
      <path d="M14 35h36" stroke="#4a55eb" strokeWidth="2" opacity=".35" />
      <rect x="27.5" y="30" width="9" height="11" rx="2.5" fill="#4a55eb" />
      <circle cx="32" cy="35.5" r="1.7" fill="#fff" />
      <path d="M20 41v6M44 41v6" stroke="#4a55eb" strokeWidth="2.4" strokeLinecap="round" opacity=".5" />
    </svg>
  )
}
