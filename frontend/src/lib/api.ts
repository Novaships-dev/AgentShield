const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000'

type FetchOptions = RequestInit & {
  token?: string
}

export async function apiFetch<T>(
  path: string,
  { token, ...init }: FetchOptions = {},
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(init.headers ?? {}),
  }

  const response = await fetch(`${API_URL}${path}`, { ...init, headers })

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: response.statusText } }))
    throw new Error(error?.error?.message ?? `HTTP ${response.status}`)
  }

  return response.json() as Promise<T>
}
