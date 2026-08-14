'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { UserRole } from '@/lib/types'
import FeedbackButton from '@/components/layout/FeedbackButton'

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Visão geral' },
  { href: '/orders', label: 'Ordens de Serviço' },
  { href: '/customers', label: 'Clientes' },
  { href: '/vehicles', label: 'Veículos' },
  { href: '/services', label: 'Serviços e Peças' },
  { href: '/invoices', label: 'Notas Fiscais' },
  { href: '/reports', label: 'Relatórios' },
  { href: '/feedback', label: 'Melhorias' },
]

// Só o gestor vê/mexe no cadastro da oficina e nos usuários.
const GESTOR_ONLY_NAV_ITEMS = [
  { href: '/oficina', label: 'Oficina' },
  { href: '/usuarios', label: 'Usuários' },
]

export default function DashboardShell({
  children,
  role,
}: {
  children: React.ReactNode
  role: UserRole | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const navItems = role === 'gestor' ? [...NAV_ITEMS, ...GESTOR_ONLY_NAV_ITEMS] : NAV_ITEMS

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="flex w-56 flex-col border-r border-gray-200 bg-white">
        <div className="border-b border-gray-200 px-4 py-5">
          <h1 className="text-lg font-bold text-gray-900">MecOS</h1>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {navItems.map((item) => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
        <div className="border-t border-gray-200 p-3">
          <p className="truncate px-3 text-xs text-gray-500">{user?.email}</p>
          <button
            onClick={handleSignOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Sair
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto p-6">{children}</main>
      <FeedbackButton />
    </div>
  )
}
