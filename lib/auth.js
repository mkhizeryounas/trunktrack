import 'server-only'
import { cookies } from 'next/headers'
import { COOKIE, verifyToken } from './session.js'

/** Call at the top of every Server Action: actions are reachable by direct POST, not only from the UI. */
export async function requireUser() {
  const store = await cookies()
  if (!(await verifyToken(store.get(COOKIE)?.value))) throw new Error('Your session has expired. Please sign in again.')
}
