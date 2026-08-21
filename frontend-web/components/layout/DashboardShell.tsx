'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchClient } from '@/lib/firebase/firestore'
import { Client, UserRole } from '@/lib/types'
import FeedbackButton from '@/components/layout/FeedbackButton'
import BuscaGlobal from '@/components/layout/BuscaGlobal'

interface NavItem {
  href: string
  label: string
  /** Só o gestor vê. */
  gestor?: boolean
}

interface NavGroup {
  title: string
  items: NavItem[]
}

/** Ação de abertura de O.S. — fica fora dos grupos, destacada no topo. */
const NOVA_OS_HREF = '/orders/nova'

/**
 * Menu agrupado por MOMENTO DE USO, não por tipo de dado.
 *
 * Antes da v0.5.0 eram 12 itens chapados numa lista só ("Ordens",
 * "Clientes", "Veículos", "Serviços", ...), e o dono reclamou que "o
 * sistema está carente de navegação": o atendente vive em OPERAÇÃO
 * (esteira/O.S./NF) e o dono vive em GESTÃO (relatórios/oficina), mas os
 * dois tinham que varrer a mesma lista plana pra achar a própria rotina.
 */
const NAV_GROUPS: NavGroup[] = [
  {
    title: 'Operação',
    items: [
      { href: '/esteira', label: 'Esteira' },
      { href: '/orders', label: 'Ordens de Serviço' },
      { href: '/invoices', label: 'Notas Fiscais' },
    ],
  },
  {
    title: 'Cadastros',
    items: [
      { href: '/customers', label: 'Clientes' },
      { href: '/vehicles', label: 'Veículos' },
      { href: '/services', label: 'Serviços e Peças' },
    ],
  },
  {
    title: 'Gestão',
    items: [
      { href: '/reports', label: 'Relatórios' },
      { href: '/oficina', label: 'Oficina', gestor: true },
      { href: '/usuarios', label: 'Usuários', gestor: true },
      { href: '/feedback', label: 'Melhorias' },
    ],
  },
]

/**
 * Qual link do menu está aceso.
 *
 * Antes era `pathname === item.href`: dentro de /orders/1042 nenhum item
 * batia e o menu inteiro apagava — o usuário perdia a referência de onde
 * estava. Agora acende por PREFIXO, e o mais específico ganha, senão
 * /orders acenderia junto com /orders/nova.
 */
function activeHrefFor(pathname: string, hrefs: string[]): string | null {
  let best: string | null = null
  for (const href of hrefs) {
    const matches = pathname === href || pathname.startsWith(href + '/')
    if (matches && (!best || href.length > best.length)) best = href
  }
  return best
}

export default function DashboardShell({
  children,
  role,
}: {
  children: React.ReactNode
  /** Opcional: se o layout não passar, cai no papel resolvido pelo contexto. */
  role?: UserRole | null
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { user, signOut } = useAuth()
  const { clientId, role: contextRole, isPlatformAdmin } = useClientId()
  const effectiveRole = role ?? contextRole
  const isGestor = effectiveRole === 'gestor'

  const [oficina, setOficina] = useState<Client | null>(null)
  const [menuAberto, setMenuAberto] = useState(false)

  // Nome da oficina no topo: sem isso ninguém enxerga em qual tenant está
  // logado — foi assim que o catálogo "sumiu" e nasceu um tenant órfão.
  useEffect(() => {
    if (!clientId) return
    return watchClient(clientId, setOficina)
  }, [clientId])

  // Navegou? fecha a gaveta do mobile, senão ela cobre a tela nova.
  useEffect(() => {
    setMenuAberto(false)
  }, [pathname])

  const groups = NAV_GROUPS.map((g) => ({
    ...g,
    items: g.items.filter((i) => !i.gestor || isGestor),
  })).filter((g) => g.items.length > 0)

  const todosHrefs = [NOVA_OS_HREF, ...groups.flatMap((g) => g.items.map((i) => i.href))]
  const activeHref = activeHrefFor(pathname, todosHrefs)

  const nomeOficina = oficina?.nomeFantasia || oficina?.name || 'Minha oficina'

  const handleSignOut = async () => {
    await signOut()
    router.push('/login')
  }

  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Fundo escuro da gaveta — só existe no mobile, e fechar é clicar fora. */}
      {menuAberto && (
        <div
          onClick={() => setMenuAberto(false)}
          className="fixed inset-0 z-30 bg-black/30 md:hidden"
          aria-hidden
        />
      )}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-gray-200 bg-white transition-transform duration-200 md:static md:z-auto md:translate-x-0 ${
          menuAberto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-start justify-between gap-2 border-b border-gray-200 px-4 py-4">
          <div className="min-w-0">
            <h1 className="text-lg font-bold text-gray-900">MecOS</h1>
            <p className="truncate text-sm font-medium text-gray-600" title={nomeOficina}>
              {nomeOficina}
            </p>
          </div>
          <button
            onClick={() => setMenuAberto(false)}
            className="-mr-1 rounded-lg px-2 py-1 text-lg leading-none text-gray-400 hover:bg-gray-100 md:hidden"
            aria-label="Fechar menu"
          >
            ×
          </button>
        </div>

        <div className="p-3 pb-0">
          <Link
            href={NOVA_OS_HREF}
            className={`block rounded-lg px-3 py-2.5 text-center text-sm font-semibold text-white shadow-sm transition-colors ${
              activeHref === NOVA_OS_HREF
                ? 'bg-blue-700'
                : 'bg-blue-600 hover:bg-blue-700'
            }`}
          >
            + Nova O.S.
          </Link>
        </div>

        <nav className="flex-1 space-y-4 overflow-y-auto p-3">
          {groups.map((group) => (
            <div key={group.title}>
              <p className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                {group.title}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const active = activeHref === item.href
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? 'page' : undefined}
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
              </div>
            </div>
          ))}
        </nav>

        <div className="border-t border-gray-200 p-3">
          {isPlatformAdmin && (
            <Link
              href="/admin"
              className="mb-1 block rounded-lg px-3 py-2 text-sm font-medium text-amber-700 hover:bg-amber-50"
            >
              ⚙ Administração do sistema
            </Link>
          )}
          <p className="truncate px-3 text-xs text-gray-500" title={user?.email ?? ''}>
            {user?.email}
          </p>
          <button
            onClick={handleSignOut}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-gray-600 hover:bg-gray-100"
          >
            Sair
          </button>
        </div>
      </aside>

      {/* min-w-0: sem isso, uma tabela larga empurra o flex e o conteúdo
          estoura a viewport em vez de rolar dentro do overflow-x-auto. */}
      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-gray-200 bg-white px-3 py-2.5 sm:px-6">
          <button
            onClick={() => setMenuAberto(true)}
            className="rounded-lg border border-gray-200 px-2.5 py-1.5 text-gray-600 hover:bg-gray-100 md:hidden"
            aria-label="Abrir menu"
          >
            <span className="block text-base leading-none">☰</span>
          </button>
          <span className="text-sm font-semibold text-gray-900 md:hidden">MecOS</span>
          <BuscaGlobal className="ml-auto w-full max-w-xl" />
        </header>

        {/* pb-24: o botão flutuante de melhorias cobria o rodapé da tela. */}
        <main className="flex-1 p-4 pb-24 sm:p-6 sm:pb-24">{children}</main>
      </div>

      <FeedbackButton />
    </div>
  )
}
