'use client'
export default function Error({ error, reset }) {
  return (
    <div className="card card-pad" style={{ maxWidth: 560 }}>
      <h2 style={{ marginTop: 0 }}>Something went wrong</h2>
      <p className="muted">{error?.message || 'An unexpected error occurred.'}</p>
      <button className="btn btn-primary" onClick={reset}>Try again</button>
    </div>
  )
}
