'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { isPlatformAdmin } from '@/lib/firebase/platform'
import AdminShell from '@/components/layout/AdminShell'

/**
 * Route group FORA de app/(app)/ de propósito: não herda o
 * ClientProvider nem o DashboardShell da área de oficina. Quem entra
 * aqui está administrando a plataforma, não uma oficina — as duas áreas
 * não podem se misturar visualmente nem tecnicamente.
 */
export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const [checking, setChecking] = useState(true)
  const [allowed, setAllowed] = useState(false)

  useEffect(() => {
    if (authLoading) return
    if (!user) {
      router.push('/login')
      return
    }
    let cancelled = false
    isPlatformAdmin(user.uid).then((ok) => {
      if (cancelled) return
      setAllowed(ok)
      setChecking(false)
      if (!ok) router.push('/esteira')
    })
    return () => {
      cancelled = true
    }
  }, [authLoading, user, router])

  if (authLoading || checking || !allowed) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Carregando...</p>
      </div>
    )
  }

  return <AdminShell>{children}</AdminShell>
}
