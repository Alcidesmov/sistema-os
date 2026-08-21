'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Customer, Order, Vehicle } from '@/lib/types'
import { isCancelled, isDone, isOpen, statusColorOf, statusLabelOf } from '@/lib/orders/status'
import {
  agingLabel,
  completedAtOf,
  dateBR,
  money,
  orderLabel,
  vehicleLabel,
} from '@/lib/orders/format'
import {
  ALERT_LABEL,
  FaixaKey,
  alertsOf,
  dinheiroOf,
  faixasOf,
  monthEnd,
  monthStart,
} from '@/lib/orders/aggregate'
import { normalize } from '@/lib/utils/search'

/** Qual recorte está selecionado — faixa da esteira ou um dos três números. */
type DinheiroKey = 'faturamento' | 'carteira' | 'recebido'
type Sel = { kind: 'faixa'; key: FaixaKey } | { kind: 'dinheiro'; key: DinheiroKey } | null

export interface EsteiraFilter {
  customerId: string
  vehicleId: string
  faixa: FaixaKey | null
}

interface Props {
  orders: Order[]
  vehicles: Vehicle[]
  customers: Customer[]
  onFilterChange?: (filter: EsteiraFilter) => void
}

/**
 * A esteira: o que precisa de ação, quanto dinheiro está onde, e em que
 * ponto do fluxo cada O.S. está. Um componente só, usado pela rota
 * /esteira (home) e pela primeira aba de /reports — assim os números
 * dessas duas telas não têm como divergir.
 *
 * Nenhum número aqui é beco sem saída: todo card é um botão que filtra a
 * lista logo abaixo, na mesma tela.
 */
export function Esteira({ orders, vehicles, customers, onFilterChange }: Props) {
  const router = useRouter()

  const [custId, setCustId] = useState('')
  const [custQuery, setCustQuery] = useState('')
  const [vehId, setVehId] = useState('')
  const [vehQuery, setVehQuery] = useState('')
  const [sel, setSel] = useState<Sel>(null)

  // Período dos números de dinheiro: o mês corrente.
  const periodo = useMemo(() => ({ from: monthStart(), to: monthEnd() }), [])

  const selectedCustomer = customers.find((c) => c.id === custId) ?? null
  const selectedVehicle = vehicles.find((v) => v.id === vehId) ?? null

  useEffect(() => {
    onFilterChange?.({
      customerId: custId,
      vehicleId: vehId,
      faixa: sel?.kind === 'faixa' ? sel.key : null,
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [custId, vehId, sel])

  // Os três recortes (cliente / veículo) valem para TUDO na tela — o caso
  // real é o frotista com 5 carros parados na oficina.
  const scoped = useMemo(
    () =>
      orders.filter((o) => {
        if (custId && o.customerId !== custId) return false
        if (vehId && o.vehicleId !== vehId) return false
        return true
      }),
    [orders, custId, vehId]
  )

  const alerts = useMemo(() => alertsOf(scoped), [scoped])
  const faixas = useMemo(() => faixasOf(scoped), [scoped])
  const dinheiro = useMemo(
    () => dinheiroOf(scoped, periodo.from, periodo.to),
    [scoped, periodo]
  )

  // As linhas que compõem cada número. Os mesmos predicados de
  // dinheiroOf(), para o card e a lista nunca contarem coisas diferentes.
  const dinheiroOrders = useMemo(() => {
    const inPeriod = (ms?: number) =>
      Boolean(ms) && ms! >= periodo.from && ms! <= periodo.to
    const vivas = scoped.filter((o) => !isCancelled(o))
    return {
      faturamento: vivas.filter((o) => isDone(o) && inPeriod(completedAtOf(o))),
      carteira: vivas.filter((o) => isOpen(o)),
      recebido: vivas.filter((o) => Boolean(o.amountPaid) && inPeriod(o.paidAt)),
    } as Record<DinheiroKey, Order[]>
  }, [scoped, periodo])

  const custMatches = useMemo(() => {
    const q = normalize(custQuery.trim())
    if (!q) return []
    return customers
      .filter((c) => normalize(`${c.name} ${c.phone ?? ''} ${c.document ?? ''}`).includes(q))
      .slice(0, 8)
  }, [customers, custQuery])

  const vehMatches = useMemo(() => {
    const q = normalize(vehQuery.trim())
    if (!q) return []
    return vehicles
      .filter((v) => {
        const dono = customers.find((c) => c.id === v.customerId)?.name ?? ''
        return normalize(`${v.plate} ${v.model} ${v.brand ?? ''} ${dono}`).includes(q)
      })
      .slice(0, 8)
  }, [vehicles, customers, vehQuery])

  const listaTitulo = (() => {
    if (!sel) return 'Todas as O.S. do recorte'
    if (sel.kind === 'faixa') return faixas.find((f) => f.key === sel.key)?.label ?? 'Faixa'
    return DINHEIRO_META[sel.key].label
  })()

  const lista = (() => {
    if (!sel) return scoped
    if (sel.kind === 'faixa') return faixas.find((f) => f.key === sel.key)?.orders ?? []
    return dinheiroOrders[sel.key]
  })()

  const toggleFaixa = (key: FaixaKey) =>
    setSel((cur) => (cur?.kind === 'faixa' && cur.key === key ? null : { kind: 'faixa', key }))

  const toggleDinheiro = (key: DinheiroKey) =>
    setSel((cur) =>
      cur?.kind === 'dinheiro' && cur.key === key ? null : { kind: 'dinheiro', key }
    )

  return (
    <div className="space-y-6">
      {/* 1. PRECISA DE AÇÃO AGORA — antes de qualquer número. */}
      <section className="overflow-hidden rounded-xl border border-red-200 bg-white">
        <div className="flex items-center justify-between border-b border-red-100 bg-red-50 px-4 py-3">
          <h2 className="text-sm font-semibold text-red-800">Precisa de ação agora</h2>
          <span className="text-xs font-medium text-red-700">
            {alerts.length} {alerts.length === 1 ? 'O.S.' : 'O.S.'}
          </span>
        </div>

        {alerts.length === 0 ? (
          <p className="px-4 py-6 text-center text-sm text-gray-500">
            Nada pedindo ação agora. A esteira está em dia.
          </p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {alerts.map((a) => (
              <li key={a.order.id}>
                <Link
                  href={`/orders/${a.order.id}`}
                  className="flex flex-wrap items-center gap-x-2 gap-y-1 px-4 py-3 text-sm hover:bg-red-50"
                >
                  <span className="font-semibold text-gray-900">{orderLabel(a.order)}</span>
                  <span className="text-gray-400">·</span>
                  <span className="font-medium text-gray-900">{a.order.customerName}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-600">{vehicleLabel(a.order)}</span>
                  <span className="text-gray-400">·</span>
                  <span className="text-gray-500">{agingLabel(a.order.updatedAt ?? a.order.createdAt)}</span>
                  <span className="ml-auto flex flex-wrap gap-1">
                    {a.kinds.map((k) => (
                      <span
                        key={k}
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          k === a.main
                            ? 'bg-red-100 text-red-700'
                            : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {ALERT_LABEL[k]}
                      </span>
                    ))}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 4. Recortes por cliente e por veículo — valem para a tela inteira. */}
      <section className="rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Filtrar por cliente
            </label>
            {selectedCustomer ? (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                <span className="font-medium text-blue-900">{selectedCustomer.name}</span>
                <button
                  type="button"
                  onClick={() => {
                    setCustId('')
                    setCustQuery('')
                  }}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  limpar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={custQuery}
                  onChange={(e) => setCustQuery(e.target.value)}
                  placeholder="Digite o nome do cliente"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                {custMatches.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    {custMatches.map((c) => (
                      <li key={c.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setCustId(c.id)
                            setCustQuery('')
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{c.name}</span>
                          {c.phone && <span className="ml-2 text-gray-500">{c.phone}</span>}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="relative">
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Filtrar por veículo
            </label>
            {selectedVehicle ? (
              <div className="flex items-center justify-between rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm">
                <span className="font-medium text-blue-900">
                  {selectedVehicle.plate} · {selectedVehicle.model}
                </span>
                <button
                  type="button"
                  onClick={() => {
                    setVehId('')
                    setVehQuery('')
                  }}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  limpar
                </button>
              </div>
            ) : (
              <>
                <input
                  value={vehQuery}
                  onChange={(e) => setVehQuery(e.target.value)}
                  placeholder="Digite a placa ou o modelo"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
                {vehMatches.length > 0 && (
                  <ul className="absolute z-20 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                    {vehMatches.map((v) => (
                      <li key={v.id}>
                        <button
                          type="button"
                          onClick={() => {
                            setVehId(v.id)
                            setVehQuery('')
                          }}
                          className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
                        >
                          <span className="font-medium text-gray-900">{v.plate}</span>
                          <span className="ml-2 text-gray-600">{v.model}</span>
                          <span className="ml-2 text-gray-400">
                            {customers.find((c) => c.id === v.customerId)?.name ?? ''}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>
        </div>

        {(custId || vehId) && (
          <p className="mt-3 text-xs text-gray-500">
            Mostrando {scoped.length} de {orders.length} O.S. —{' '}
            <button
              type="button"
              onClick={() => {
                setCustId('')
                setVehId('')
                setCustQuery('')
                setVehQuery('')
              }}
              className="font-medium text-blue-600 hover:underline"
            >
              limpar recorte
            </button>
          </p>
        )}
      </section>

      {/* 2. Os três números que nunca se somam. */}
      <section>
        <div className="mb-2 flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900">
            Dinheiro — {dateBR(periodo.from)} a {dateBR(periodo.to)}
          </h2>
          <span className="text-xs text-gray-500">clique num número para ver as O.S. dele</span>
        </div>
        <div className="grid gap-4 md:grid-cols-3">
          {(['faturamento', 'carteira', 'recebido'] as DinheiroKey[]).map((key) => {
            const on = sel?.kind === 'dinheiro' && sel.key === key
            return (
              <button
                key={key}
                type="button"
                aria-pressed={on}
                onClick={() => toggleDinheiro(key)}
                className={`rounded-xl border bg-white p-4 text-left transition ${
                  on ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <p className="text-xs font-medium uppercase text-gray-500">
                  {DINHEIRO_META[key].label}
                </p>
                <p className="mt-1 text-2xl font-bold text-gray-900">{money(dinheiro[key])}</p>
                <p className="mt-1 text-xs text-gray-500">{DINHEIRO_META[key].hint}</p>
                <p className="mt-1 text-xs text-gray-400">
                  {dinheiroOrders[key].length}{' '}
                  {dinheiroOrders[key].length === 1 ? 'O.S.' : 'O.S.'}
                </p>
                {key === 'faturamento' && dinheiro.estimadas > 0 && (
                  <p className="mt-2 rounded-lg bg-amber-50 px-2 py-1 text-xs text-amber-800">
                    inclui {dinheiro.estimadas}{' '}
                    {dinheiro.estimadas === 1 ? 'O.S.' : 'O.S.'} com data estimada
                  </p>
                )}
              </button>
            )
          })}
        </div>
        <p className="mt-2 text-xs text-gray-500">
          Estes três números não se somam: faturamento é o que foi feito, carteira é o que ainda
          pode entrar, recebido é o dinheiro que já entrou.
        </p>
      </section>

      {/* 3. As faixas do fluxo. */}
      <section>
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Esteira do fluxo</h2>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {faixas.map((f) => {
            const on = sel?.kind === 'faixa' && sel.key === f.key
            return (
              <div
                key={f.key}
                className={`flex flex-col rounded-xl border bg-white transition ${
                  on ? 'border-blue-500 ring-2 ring-blue-100' : 'border-gray-200'
                }`}
              >
                <button
                  type="button"
                  aria-pressed={on}
                  onClick={() => toggleFaixa(f.key)}
                  className="flex-1 rounded-t-xl p-4 text-left hover:bg-gray-50"
                >
                  <p className="text-xs font-medium text-gray-600">{f.label}</p>
                  <p className="mt-1 text-2xl font-bold text-gray-900">{f.orders.length}</p>
                  <p className="text-sm font-medium text-gray-700">{money(f.total)}</p>
                  <p className="mt-1 text-xs text-gray-400">{f.hint}</p>
                </button>
                <Link
                  href={`/orders?faixa=${f.key}`}
                  className="border-t border-gray-100 px-4 py-2 text-xs font-medium text-blue-600 hover:underline"
                >
                  ver todas
                </Link>
              </div>
            )
          })}
        </div>
      </section>

      {/* 5. A lista do recorte selecionado. */}
      <section className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">{listaTitulo}</h2>
            <p className="text-xs text-gray-500">
              {lista.length} {lista.length === 1 ? 'O.S.' : 'O.S.'}
              {sel ? ' — filtro aplicado pelos cards acima' : ''}
            </p>
          </div>
          {sel && (
            <button
              type="button"
              onClick={() => setSel(null)}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
            >
              Mostrar todas
            </button>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nº</th>
                <th className="px-4 py-3">Aberta em</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {lista.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="cursor-pointer hover:bg-gray-50"
                >
                  <td className="whitespace-nowrap px-4 py-3">
                    <Link
                      href={`/orders/${o.id}`}
                      onClick={(e) => e.stopPropagation()}
                      className="font-semibold text-gray-900 hover:underline"
                    >
                      {orderLabel(o)}
                    </Link>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-500">{dateBR(o.createdAt)}</td>
                  <td className="px-4 py-3 font-medium text-gray-900">{o.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">{vehicleLabel(o)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`whitespace-nowrap rounded-full px-2 py-1 text-xs font-medium ${statusColorOf(o)}`}
                    >
                      {statusLabelOf(o)}
                    </span>
                  </td>
                  <td className="whitespace-nowrap px-4 py-3 text-gray-700">{money(o.totalValue)}</td>
                </tr>
              ))}
              {lista.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma O.S. neste recorte
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

const DINHEIRO_META: Record<DinheiroKey, { label: string; hint: string }> = {
  faturamento: { label: 'Faturamento', hint: 'o que foi feito — serviços concluídos no período' },
  carteira: { label: 'Carteira em aberto', hint: 'o que ainda pode entrar — O.S. em andamento' },
  recebido: { label: 'Recebido', hint: 'dinheiro na mão — pagamentos do período' },
}
