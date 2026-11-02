import { Inter } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter', display: 'swap' })

export const metadata = {
  title: { default: 'Trunks MIS', template: '%s · Trunks MIS' },
  description: 'Deliveries, record shifting and billing for record trunks — Central Record Office.',
}

export default function RootLayout({ children }) {
  return (
    <html lang="en" className={inter.variable}>
      <body>{children}</body>
    </html>
  )
}
