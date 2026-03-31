import { createClient } from '@/lib/supabase/client'

export async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await getAccessToken()
  if (!token) return {}
  return { Authorization: `Bearer ${token}` }
}

export async function getAccessToken(): Promise<string | null> {
  const supabase = createClient()

  // Première tentative
  const { data: { session } } = await supabase.auth.getSession()
  if (session?.access_token) return session.access_token

  // Si la session n'est pas encore prête, attendre un peu et réessayer
  // Cela arrive quand le composant se monte avant que Supabase ait fini
  // de restaurer la session depuis les cookies
  await new Promise(resolve => setTimeout(resolve, 500))
  const { data: { session: retrySession } } = await supabase.auth.getSession()
  if (retrySession?.access_token) return retrySession.access_token

  // Dernière tentative après un délai plus long
  await new Promise(resolve => setTimeout(resolve, 1000))
  const { data: { session: finalSession } } = await supabase.auth.getSession()
  return finalSession?.access_token ?? null
}
