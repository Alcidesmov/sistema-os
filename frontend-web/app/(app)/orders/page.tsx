'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchOrders, backfillOrderNumbers } from '@/lib/firebase/firestore'
import { Order, WorkStatus } from '@/lib/types'
import { statusOf, statusLabelOf, statusColorOf, STATUS_LABEL } from '@/lib/orders/status'
import { faixaOf, FaixaKey } from '@/lib/orders/aggregate'
import { money, dateBR, vehicleLabel, orderLabel } from '@/lib/orders/format'
import { normalize } from '@/lib/utils/search'

/**
 * Lista de O.S. A linha inteira é clicável — na versão antiga só a célula
 * do cliente linkava, e o Alcides clicava na placa achando que travou.
 * Filtros vivem na querystring (?status=, ?faixa=, ?cliente=, ?veiculo=)
 * pra dar pra chegar aqui já filtrado a partir de outra tela (dashboard,
 * relatório) sem reimplementar o filtro lá.
 */

const STATUS_CHIPS: WorkStatus[] = ['diagnostico', 'em_servico', 'finalizado', 'entregue', 'cancelado']

export default function OrdersPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Carregando…</p>}>
      <OrdersList />
    </Suspense>
  )
}

function OrdersList() {
  const router = useRouter()
  const params = useSearchParams()
  const { clientId, role } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])
  const [query, setQuery] = useState('')
  const [backfilling, setBackfilling] = useState(false)
  const [backfillMsg, setBackfillMsg] = useState('')

  useEffect(() => {
    if (!clientId) return
    return watchOrders(clientId, setOrders)
  }, [clientId])

  const statusFiltro = params.get('status') as WorkStatus | null
  const faixaFiltro = params.get('faixa') as FaixaKey | null
  const clienteFiltro = params.get('cliente')
  const veiculoFiltro = params.get('veiculo')

  function setParam(key: string, value: string | null) {
    const next = new URLSearchParams(params.toString())
    if (value) next.set(key, value)
    else next.delete(key)
    router.push(`/orders${next.toString() ? `?${next.toString()}` : ''}`)
  }

  const filtered = useMemo(() => {
    let list = orders

    if (statusFiltro) list = list.filter((o) => statusOf(o) === statusFiltro)
    if (faixaFiltro) list = list.filter((o) => faixaOf(o) === faixaFiltro)
    if (clienteFiltro) list = list.filter((o) => o.customerId === clienteFiltro)
    if (veiculoFiltro) list = list.filter((o) => o.vehicleId === veiculoFiltro)

    const q = normalize(query.trim())
    if (q) {
      list = list.filter((o) => {
        const numero = o.number ? String(o.number) : ''
        return (
          numero.includes(q) ||
          normalize(o.customerName ?? '').includes(q) ||
          normalize(o.vehiclePlate ?? '').includes(q)
        )
      })
    }

    return list
  }, [orders, statusFiltro, faixaFiltro, clienteFiltro, veiculoFiltro, query])

  async function handleBackfill() {
    if (!clientId) return
    if (!confirm('Isso vai dar número a todas as O.S. sem número, em ordem de criação. Confirmar?')) return
    setBackfilling(true)
    setBackfillMsg('')
    try {
      const n = await backfillOrderNumbers(clientId)
      setBackfillMsg(n > 0 ? `${n} O.S. numerada(s).` : 'Nenhuma O.S. sem número encontrada.')
    } catch (err) {
      setBackfillMsg('Não foi possível numerar as O.S. antigas. Tente de novo.')
      console.error('Erro ao numerar O.S. antigas:', err)
    } finally {
      setBackfilling(false)
    }
  }

  const algumFiltroDeContexto = Boolean(faixaFiltro || clienteFiltro || veiculoFiltro)

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h1>
        <div className="flex items-center gap-2">
          {role === 'gestor' && (
            <button
              onClick={handleBackfill}
              disabled={backfilling}
              className="rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-600 hover:border-gray-400 disabled:opacity-50"
            >
              {backfilling ? 'Numerando…' : 'Numerar O.S. antigas'}
            </button>
          )}
          <Link
            href="/orders/nova"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nova OS
          </Link>
        </div>
      </div>

      {backfillMsg && (
        <p className="mb-4 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-600">
          {backfillMsg}
        </p>
      )}

      <div className="mb-4 space-y-3">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
          placeholder="Buscar por número, cliente ou placa…"
          className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
        />

        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => setParam('status', null)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              !statusFiltro ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            Todos
          </button>
          {STATUS_CHIPS.map((s) => (
            <button
              key={s}
              onClick={() => setParam('status', statusFiltro === s ? null : s)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                statusFiltro === s ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {STATUS_LABEL[s]}
            </button>
          ))}

          {algumFiltroDeContexto && (
            <button
              onClick={() => {
                setParam('faixa', null)
                setParam('cliente', null)
                setParam('veiculo', null)
              }}
              className="ml-1 rounded-full border border-blue-300 bg-blue-50 px-3 py-1 text-xs font-medium text-blue-700 hover:bg-blue-100"
            >
              Limpar filtro de {faixaFiltro ? 'faixa' : clienteFiltro ? 'cliente' : 'veículo'} ✕
            </button>
          )}
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Data</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-500">{orderLabel(o)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{o.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">{vehicleLabel(o)}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-2 py-1 text-xs font-medium ${statusColorOf(o)}`}>
                      {statusLabelOf(o)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{money(o.totalValue)}</td>
                  <td className="px-4 py-3 text-gray-500">{dateBR(o.createdAt)}</td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {orders.length === 0
                      ? 'Nenhuma OS criada ainda'
                      : 'Nenhuma OS bate com a busca ou o filtro atual'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
