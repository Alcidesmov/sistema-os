'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * Casca visualmente distinta da área da oficina (tom escuro, de
 * propósito) — quem está aqui está administrando a PLATAFORMA, não uma
 * oficina, e a tela precisa deixar isso óbvio pra ninguém confundir as
 * duas áreas.
 */
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 flex-col border-r border-gray-800 bg-gray-900">
        <div className="border-b border-gray-800 px-4 py-4">
          <h1 className="text-lg font-bold text-white">MecOS</h1>
          <p className="text-xs font-medium uppercase tracking-wide text-amber-400">
            Administração do sistema
          </p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          <Link
            href="/admin"
            aria-current={pathname === '/admin' ? 'page' : undefined}
            className={`block rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === '/admin' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            Oficinas
          </Link>
          <Link
            href="/admin/nova"
            aria-current={pathname === '/admin/nova' ? 'page' : undefined}
            className={`block rounded-lg px-3 py-2 text-sm font-medium ${
              pathname === '/admin/nova' ? 'bg-gray-800 text-white' : 'text-gray-300 hover:bg-gray-800'
            }`}
          >
            + Nova oficina
          </Link>
        </nav>
        <div className="border-t border-gray-800 p-3">
          <Link
            href="/esteira"
            className="mb-1 block rounded-lg px-3 py-2 text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            ← Voltar pra oficina
          </Link>
          <p className="truncate px-3 text-xs text-gray-500" title={user?.email ?? ''}>
            {user?.email}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-300 hover:bg-gray-800"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
    </div>
  )
}
