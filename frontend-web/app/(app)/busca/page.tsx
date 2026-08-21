'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchCustomers, watchOrders, watchVehicles } from '@/lib/firebase/firestore'
import { Customer, Order, Vehicle } from '@/lib/types'
import { statusColorOf, statusLabelOf } from '@/lib/orders/status'
import { money, orderLabel, vehicleLabel, dateBR } from '@/lib/orders/format'
import PageHeader from '@/components/layout/PageHeader'
import {
  BaseBusca,
  filtrarBusca,
  hrefDaOS,
  hrefDoCliente,
  hrefDoVeiculo,
} from '@/components/layout/BuscaGlobal'

const VAZIO: BaseBusca = { orders: [], customers: [], vehicles: [] }

/**
 * Resultado completo de "/busca?q=", sem limite de 5 por grupo como no
 * dropdown do topo — aqui é a tela pra quando a busca tem muitos
 * resultados e o dropdown não coube tudo (link "Ver todos").
 */
function BuscaContent() {
  const router = useRouter()
  const params = useSearchParams()
  const { clientId } = useClientId()

  const qUrl = params.get('q') ?? ''
  const [campo, setCampo] = useState(qUrl)

  useEffect(() => {
    setCampo(qUrl)
  }, [qUrl])

  const [base, setBase] = useState<BaseBusca>(VAZIO)

  useEffect(() => {
    if (!clientId) return
    const unsubs = [
      watchOrders(clientId, (orders) => setBase((b) => ({ ...b, orders }))),
      watchCustomers(clientId, (customers) => setBase((b) => ({ ...b, customers }))),
      watchVehicles(clientId, (vehicles) => setBase((b) => ({ ...b, vehicles }))),
    ]
    return () => unsubs.forEach((u) => u())
  }, [clientId])

  const resultado = useMemo(() => filtrarBusca(qUrl, base), [qUrl, base])
  const temTermo = qUrl.trim().length > 0
  const totalAchados = resultado.orders.length + resultado.customers.length + resultado.vehicles.length

  const buscar = (e: React.FormEvent) => {
    e.preventDefault()
    const q = campo.trim()
    router.push(q ? `/busca?q=${encodeURIComponent(q)}` : '/busca')
  }

  return (
    <div>
      <PageHeader
        titulo="Busca"
        breadcrumb={[{ label: 'MecOS', href: '/esteira' }]}
        descricao="Procure O.S. por número, cliente por nome/telefone ou veículo por placa."
      />

      <form onSubmit={buscar} className="mb-6 flex gap-2">
        <input
          value={campo}
          onChange={(e) => setCampo(e.target.value)}
          autoFocus
          placeholder="Buscar O.S., cliente ou placa…"
          className="w-full max-w-xl rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Buscar
        </button>
      </form>

      {!temTermo && (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Digite um termo acima para buscar em Ordens de Serviço, Clientes e Veículos.
        </p>
      )}

      {temTermo && totalAchados === 0 && (
        <p className="rounded-lg border border-gray-200 bg-white p-4 text-sm text-gray-500">
          Nada encontrado para “{qUrl.trim()}”.
        </p>
      )}

      {temTermo && totalAchados > 0 && (
        <div className="space-y-6">
          {resultado.orders.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Ordens de Serviço ({resultado.orders.length})
              </h2>
              <div className="divide-y divide-gray-100 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                {resultado.orders.map((o: Order) => (
                  <Link
                    key={o.id}
                    href={hrefDaOS(o)}
                    className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {orderLabel(o)} · {o.customerName}
                      </p>
                      <p className="truncate text-xs text-gray-500">
                        {vehicleLabel(o)} · {dateBR(o.createdAt)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{money(o.totalValue)}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColorOf(o)}`}
                      >
                        {statusLabelOf(o)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {resultado.customers.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Clientes ({resultado.customers.length})
              </h2>
              <div className="divide-y divide-gray-100 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                {resultado.customers.map((c: Customer) => (
                  <Link
                    key={c.id}
                    href={hrefDoCliente(c)}
                    className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-900">{c.name}</span>
                    <span className="text-xs text-gray-500">{c.phone || 'Sem telefone'}</span>
                  </Link>
                ))}
              </div>
            </section>
          )}

          {resultado.vehicles.length > 0 && (
            <section>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                Veículos ({resultado.vehicles.length})
              </h2>
              <div className="divide-y divide-gray-100 overflow-x-auto rounded-lg border border-gray-200 bg-white">
                {resultado.vehicles.map((v: Vehicle) => (
                  <Link
                    key={v.id}
                    href={hrefDoVeiculo(v)}
                    className="flex items-center justify-between gap-2 px-4 py-3 hover:bg-gray-50"
                  >
                    <span className="text-sm font-medium text-gray-900">{v.plate}</span>
                    <span className="text-xs text-gray-500">
                      {[v.brand, v.model].filter(Boolean).join(' ') || 'Sem modelo'}
                    </span>
                  </Link>
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </div>
  )
}

export default function BuscaPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Carregando busca...</p>}>
      <BuscaContent />
    </Suspense>
  )
}
