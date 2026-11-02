// Signed session cookie for the single user. Works in both proxy.js and server code (Web Crypto).
export const COOKIE = 'tmis_session'
const MAX_AGE = 60 * 60 * 24 * 30 // 30 days

async function hmac(text) {
  const enc = new TextEncoder()
  const key = await crypto.subtle.importKey('raw', enc.encode(process.env.SESSION_SECRET || ''), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(text))
  return Array.from(new Uint8Array(sig), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function makeToken() {
  const expires = Date.now() + MAX_AGE * 1000
  return `${expires}.${await hmac(String(expires))}`
}

export async function verifyToken(token) {
  if (!token || !process.env.SESSION_SECRET) return false
  const [expires, sig] = token.split('.')
  if (!expires || !sig || Number(expires) < Date.now()) return false
  const expected = await hmac(expires)
  if (expected.length !== sig.length) return false
  let diff = 0
  for (let i = 0; i < sig.length; i++) diff |= expected.charCodeAt(i) ^ sig.charCodeAt(i)
  return diff === 0
}

export const cookieOptions = { httpOnly: true, sameSite: 'lax', secure: process.env.NODE_ENV === 'production', path: '/', maxAge: MAX_AGE }
