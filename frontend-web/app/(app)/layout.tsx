'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { ClientProvider, useClientId } from '@/lib/hooks/useClientId'
import DashboardShell from '@/components/layout/DashboardShell'

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { clientId, role, loading: clientLoading } = useClientId()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
    }
  }, [authLoading, user, router])

  if (authLoading || clientLoading || !user || !clientId) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <p className="text-sm text-gray-500">Carregando...</p>
      </div>
    )
  }

  return <DashboardShell role={role}>{children}</DashboardShell>
}

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClientProvider>
      <AppLayoutInner>{children}</AppLayoutInner>
    </ClientProvider>
  )
}
