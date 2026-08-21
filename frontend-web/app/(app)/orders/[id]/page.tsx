'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import { useAuth } from '@/lib/hooks/useAuth'
import { watchOrder, watchVehicles, watchCustomers, watchServices } from '@/lib/firebase/firestore'
import { Order, Vehicle, Customer, ServiceItem } from '@/lib/types'
import { statusColorOf, statusLabelOf } from '@/lib/orders/status'
import { orderLabel, vehicleLabel } from '@/lib/orders/format'
import PendenciasOS from '@/components/orders/PendenciasOS'
import VeiculoDaOS from '@/components/orders/VeiculoDaOS'
import ItensDaOS from '@/components/orders/ItensDaOS'
import AcoesDaOS from '@/components/orders/AcoesDaOS'

/**
 * A O.S. como PASTA DE TRABALHO: nasce válida só com o cliente e vai
 * sendo completada aqui dentro — veículo, itens, prazo e baixa entram
 * nesta mesma tela, nunca num formulário à parte. Quem trava é a
 * transição de estágio (ver AcoesDaOS), nunca a criação.
 */
export default function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { clientId } = useClientId()
  const { user } = useAuth()
  const by = user?.email ?? ''

  const [order, setOrder] = useState<Order | null>(null)
  const [naoEncontrada, setNaoEncontrada] = useState(false)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [menuImpressao, setMenuImpressao] = useState(false)

  useEffect(() => {
    if (!clientId || !params.id) return
    const u1 = watchOrder(clientId, params.id, (o) => {
      setOrder(o)
      if (!o) setNaoEncontrada(true)
    })
    const u2 = watchVehicles(clientId, setVehicles)
    const u3 = watchCustomers(clientId, setCustomers)
    const u4 = watchServices(clientId, setServices)
    return () => {
      u1()
      u2()
      u3()
      u4()
    }
  }, [clientId, params.id])

  const customer = useMemo(
    () => customers.find((c) => c.id === order?.customerId),
    [customers, order]
  )

  // Quem chegou da esteira/relatórios com filtro aplicado não pode perder
  // o filtro voltando pra /orders "na unha" — por isso router.back(), com
  // /orders só como rede de segurança pra quem abriu a O.S. direto (link
  // externo, aba nova).
  const voltar = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back()
    } else {
      router.push('/orders')
    }
  }

  const irPara = (target: 'veiculo' | 'itens') => {
    const id = target === 'veiculo' ? 'bloco-veiculo' : 'bloco-itens'
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }

  if (!clientId || (!order && !naoEncontrada)) {
    return <p className="text-sm text-gray-500">Carregando...</p>
  }

  if (naoEncontrada || !order) {
    return (
      <div className="max-w-2xl">
        <p className="text-sm text-gray-600">
          Esta O.S. não existe mais ou foi apagada.{' '}
          <Link href="/orders" className="text-blue-600 hover:underline">
            Voltar para Ordens de Serviço
          </Link>
        </p>
      </div>
    )
  }

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      <button
        type="button"
        onClick={voltar}
        className="text-sm text-gray-500 hover:text-gray-700"
      >
        ← Voltar
      </button>

      {/* CABEÇALHO */}
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-xl font-bold text-gray-900">{orderLabel(order)}</h1>
              <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColorOf(order)}`}>
                {statusLabelOf(order)}
              </span>
            </div>

            <p className="mt-1 text-sm">
              <Link
                href={`/customers/${order.customerId}`}
                className="font-medium text-blue-600 hover:underline"
              >
                {order.customerName}
              </Link>
            </p>

            <p className="text-sm text-gray-500">
              {order.vehicleId ? (
                <Link href={`/vehicles/${order.vehicleId}`} className="hover:underline">
                  {vehicleLabel(order)}
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => irPara('veiculo')}
                  className="font-medium text-amber-700 hover:underline"
                >
                  Sem veículo — definir
                </button>
              )}
            </p>

            {order.complaint && (
              <p className="mt-2 text-sm text-gray-600">
                <span className="font-medium text-gray-700">Queixa do cliente:</span>{' '}
                {order.complaint}
              </p>
            )}
          </div>

          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setMenuImpressao((v) => !v)}
              onBlur={() => setMenuImpressao(false)}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              🖨️ Imprimir
            </button>
            {menuImpressao && (
              // onMouseDown preventDefault: sem isso o blur fecha o menu
              // antes do clique no link registrar (mesmo padrão de BuscaGlobal).
              <div
                onMouseDown={(e) => e.preventDefault()}
                className="absolute right-0 z-10 mt-1 w-56 overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg"
              >
                <Link
                  href={`/orders/${order.id}/imprimir?doc=orcamento`}
                  target="_blank"
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  Orçamento (para o cliente assinar)
                </Link>
                <Link
                  href={`/orders/${order.id}/imprimir?doc=os`}
                  target="_blank"
                  className="block px-3 py-2 text-sm text-gray-700 hover:bg-gray-50"
                >
                  O.S. (para a bancada)
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      <PendenciasOS clientId={clientId} order={order} customer={customer} onGoTo={irPara} />
      <VeiculoDaOS clientId={clientId} order={order} vehicles={vehicles} by={by} />
      <ItensDaOS clientId={clientId} order={order} services={services} by={by} />
      <AcoesDaOS clientId={clientId} order={order} by={by} />
    </div>
  )
}
