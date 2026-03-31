import { createClient } from '@/lib/supabase/client'

let cachedToken: string | null = null
let cacheTimestamp = 0
const CACHE_TTL = 30_000

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export async function getAccessToken(): Promise<string | null> {
  const now = Date.now()
  if (cachedToken && (now - cacheTimestamp) < CACHE_TTL) {
    return cachedToken
  }

  const supabase = createClient()
  const { data: { session } } = await supabase.auth.getSession()

  if (session?.access_token) {
    cachedToken = session.access_token
    cacheTimestamp = now
    return session.access_token
  }

  return new Promise<string | null>((resolve) => {
    const timeout = setTimeout(() => {
      sub.unsubscribe()
      resolve(null)
    }, 3000)

    const { data: { subscription: sub } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        clearTimeout(timeout)
        sub.unsubscribe()
        if (session?.access_token) {
          cachedToken = session.access_token
          cacheTimestamp = Date.now()
          resolve(session.access_token)
        } else {
          resolve(null)
        }
      }
    )
  })
}

export function setTokenCache(token: string | null) {
  cachedToken = token
  cacheTimestamp = token ? Date.now() : 0
}
