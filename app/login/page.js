import { LoginForm } from './login-form'
import { Logo } from '../ui/logo'

export const metadata = { title: 'Sign in' }

export default async function LoginPage({ searchParams }) {
  const { next } = await searchParams
  return (
    <div className="login-page">
      <div className="card login-card">
        <Logo size={48} />
        <h1>Trunks MIS</h1>
        <p>Central Record Office · sign in to continue</p>
        <LoginForm next={typeof next === 'string' ? next : '/'} />
      </div>
    </div>
  )
}
