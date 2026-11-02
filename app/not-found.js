import Link from 'next/link'
export default function NotFound() {
  return (
    <div className="login-page">
      <div className="card login-card" style={{ textAlign: 'center' }}>
        <h1>Not found</h1>
        <p>That page or record does not exist.</p>
        <Link href="/" className="btn btn-primary">Back to dashboard</Link>
      </div>
    </div>
  )
}
