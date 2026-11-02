'use client'
import { useActionState } from 'react'
import { login } from '../actions'

export function LoginForm({ next }) {
  const [state, action, pending] = useActionState(login, null)
  return (
    <form action={action} className="stack" style={{ gap: 12 }}>
      <input type="hidden" name="next" value={next} />
      <div className="field">
        <label htmlFor="password">Password</label>
        <input id="password" className="input" type="password" name="password" autoFocus required autoComplete="current-password" />
      </div>
      {state?.error && <div className="err-box">{state.error}</div>}
      <button className="btn btn-primary" disabled={pending} style={{ height: 40 }}>{pending ? 'Signing in…' : 'Sign in'}</button>
    </form>
  )
}
