import { NextResponse } from 'next/server'
import { COOKIE, verifyToken } from './lib/session.js'

export async function proxy(request) {
  const ok = await verifyToken(request.cookies.get(COOKIE)?.value)
  const isLogin = request.nextUrl.pathname === '/login'
  if (!ok && !isLogin) {
    const url = new URL('/login', request.url)
    if (request.nextUrl.pathname !== '/') url.searchParams.set('next', request.nextUrl.pathname + request.nextUrl.search)
    return NextResponse.redirect(url)
  }
  if (ok && isLogin) return NextResponse.redirect(new URL('/', request.url))
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icon.svg).*)'],
}
