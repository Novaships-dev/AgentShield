'use client'

import { useAuthContext } from '@/components/providers/AuthProvider'

export function useAuth() {
  const { user, session, isLoading, signOut } = useAuthContext()
  return { user, session, isLoading, signOut }
}
