'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

export default function LogoutPage() {
  const router = useRouter()
  const { signOut } = useAuth()

  useEffect(() => {
    signOut().finally(() => router.push('/login'))
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50">
      <p className="text-sm text-gray-500">Saindo...</p>
    </main>
  )
}
