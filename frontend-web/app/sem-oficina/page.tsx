'use client'

import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * Quem loga sem nenhum users/{uid} apontando pra uma oficina, e sem ser
 * administrador do sistema, cai aqui — em vez de ficar preso numa tela
 * "Carregando..." eterna (era o que acontecia até a v0.4.x). Cadastrar
 * oficina não é mais autosserviço: só o administrador do sistema faz
 * isso, pela área /admin.
 */
export default function SemOficinaPage() {
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <div className="mb-3 text-4xl">🔧</div>
        <h1 className="mb-2 text-lg font-bold text-gray-900">Conta sem oficina vinculada</h1>
        <p className="mb-1 text-sm text-gray-600">
          Você está logado como <strong>{user?.email}</strong>, mas essa conta ainda não está
          associada a nenhuma oficina no MecOS.
        </p>
        <p className="mb-6 text-sm text-gray-500">
          Peça pro gestor da sua oficina te cadastrar em Usuários, ou fale com quem administra o
          sistema pra criar a oficina.
        </p>
        <div className="flex justify-center gap-3">
          <button
            onClick={() => router.refresh()}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Tentar de novo
          </button>
          <button
            onClick={handleSignOut}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Sair
          </button>
        </div>
      </div>
    </main>
  )
}
