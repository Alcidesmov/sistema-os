'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { ClientProvider, useClientId } from '@/lib/hooks/useClientId'
import DashboardShell from '@/components/layout/DashboardShell'

function AppLayoutInner({ children }: { children: React.ReactNode }) {
  const router = useRouter()
  const { user, loading: authLoading } = useAuth()
  const { clientId, role, loading: clientLoading, status } = useClientId()

  useEffect(() => {
    if (!authLoading && !user) {
      router.push('/login')
      return
    }
    if (clientLoading) return
    // Sem users/{uid} e sem platformAdmins/{uid}: nenhuma oficina cadastrou
    // essa pessoa ainda. Antes disso ficava preso numa tela "Carregando..."
    // eterna, sem saída — agora tem rota própria, com botão Sair.
    if (status === 'sem-oficina') {
      router.push('/sem-oficina')
      return
    }
    // Admin do sistema sem oficina própria vinculada: a área dele é /admin,
    // não uma tela de oficina que não existe.
    if (status === 'admin' && !clientId) {
      router.push('/admin')
    }
  }, [authLoading, user, clientLoading, status, clientId, router])

  const stillResolving =
    authLoading || !user || clientLoading || status === 'sem-oficina' || (status === 'admin' && !clientId)

  if (stillResolving) {
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
