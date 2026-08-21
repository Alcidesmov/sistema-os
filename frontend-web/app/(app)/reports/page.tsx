'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchCustomers, watchOrders, watchVehicles } from '@/lib/firebase/firestore'
import { Customer, Order, Vehicle, VEHICLE_TYPE_LABEL, VehicleType, WorkStatus } from '@/lib/types'
import { STATUS_LABEL, statusColorOf, statusLabelOf, statusOf } from '@/lib/orders/status'
import {
  completedAtOf,
  dateBR,
  isEstimatedCompletion,
  localDateEnd,
  localDateStart,
  money,
  orderLabel,
  vehicleLabel,
} from '@/lib/orders/format'
import { porCliente, porTipoVeiculo, porVeiculo } from '@/lib/orders/aggregate'
import { normalize } from '@/lib/utils/search'
import { Esteira } from '@/components/esteira/Esteira'

type TabKey = 'aberto' | 'os' | 'cliente' | 'veiculo' | 'tipo'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'aberto', label: 'Em aberto' },
  { key: 'os', label: 'Por O.S.' },
  { key: 'cliente', label: 'Por cliente' },
  { key: 'veiculo', label: 'Por veículo' },
  { key: 'tipo', label: 'Por tipo de veículo' },
]

/** Qual data ancora o período — o dono precisa ver isso escrito na tela. */
type Anchor = 'abertura' | 'conclusao'

const STATUS_OPTIONS: WorkStatus[] = [
  'diagnostico',
  'em_servico',
  'finalizado',
  'entregue',
  'cancelado',
]

function toCSV(rows: (string | number)[][]) {
  return rows.map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(',')).join('\n')
}

function downloadCSV(filename: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function tipoLabel(tipo: string): string {
  return VEHICLE_TYPE_LABEL[tipo as VehicleType] ?? tipo
}

export default function ReportsPage() {
  const { clientId } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])

  const [tab, setTab] = useState<TabKey>('aberto')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [anchor, setAnchor] = useState<Anchor>('abertura')
  const [status, setStatus] = useState<'todos' | WorkStatus>('todos')
  const [q, setQ] = useState('')
  const [tipoSel, setTipoSel] = useState<string | null>(null)

  useEffect(() => {
    if (!clientId) return
    const u1 = watchOrders(clientId, setOrders)
    const u2 = watchVehicles(clientId, setVehicles)
    const u3 = watchCustomers(clientId, setCustomers)
    return () => {
      u1()
      u2()
      u3()
    }
  }, [clientId])

  const typeOf = (vehicleId: string) => vehicles.find((v) => v.id === vehicleId)?.type

  /** Mesma regra do agregador: "Sem veículo" é um balde explícito. */
  const tipoOf = (o: Order) =>
    o.vehicleId ? (o.vehicleType ?? typeOf(o.vehicleId) ?? 'outro') : 'Sem veículo'

  const dateOf = (o: Order) => (anchor === 'abertura' ? o.createdAt : completedAtOf(o))

  const filtered = useMemo(() => {
    const fromMs = localDateStart(from)
    const toMs = localDateEnd(to)
    const needle = normalize(q.trim())

    return orders.filter((o) => {
      const d = dateOf(o)
      if (fromMs && d < fromMs) return false
      if (toMs && d > toMs) return false
      if (status !== 'todos' && statusOf(o) !== status) return false
      if (needle) {
        const hay = normalize(
          `${o.number ?? ''} ${o.customerName} ${o.vehiclePlate ?? ''} ${o.vehicleModel ?? ''}`
        )
        if (!hay.includes(needle)) return false
      }
      return true
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orders, from, to, anchor, status, q])

  const totalValue = filtered.reduce((sum, o) => sum + (o.totalValue || 0), 0)
  const ticket = filtered.length ? totalValue / filtered.length : 0

  const estimadas = useMemo(
    () => (anchor === 'conclusao' ? filtered.filter(isEstimatedCompletion).length : 0),
    [filtered, anchor]
  )

  const clientes = useMemo(() => porCliente(filtered), [filtered])
  const veiculos = useMemo(() => porVeiculo(filtered), [filtered])
  const tipos = useMemo(() => porTipoVeiculo(filtered, typeOf), [filtered, vehicles])
  const semVeiculo = useMemo(() => filtered.filter((o) => !o.vehicleId), [filtered])

  const ordersDoTipo = useMemo(
    () => (tipoSel ? filtered.filter((o) => tipoOf(o) === tipoSel) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [filtered, tipoSel, vehicles]
  )

  const exportCSV = () => {
    let rows: (string | number)[][] = []
    let name = 'relatorio'

    if (tab === 'cliente') {
      name = 'relatorio-por-cliente'
      rows = [
        ['Cliente', 'O.S.', 'Total', 'Última visita'],
        ...clientes.map((c) => [c.customerName, c.count, c.total.toFixed(2), dateBR(c.lastAt)]),
      ]
    } else if (tab === 'veiculo') {
      name = 'relatorio-por-veiculo'
      rows = [
        ['Placa', 'Modelo', 'Cliente', 'O.S.', 'Total', 'Última visita'],
        ...veiculos.map((v) => [
          v.plate,
          v.model,
          v.customerName,
          v.count,
          v.total.toFixed(2),
          dateBR(v.lastAt),
        ]),
      ]
    } else if (tab === 'tipo') {
      name = 'relatorio-por-tipo'
      rows = [
        ['Tipo', 'O.S.', 'Total'],
        ...tipos.map((t) => [tipoLabel(t.tipo), t.count, t.total.toFixed(2)]),
      ]
    } else {
      name = 'relatorio-por-os'
      rows = [
        ['Nº', 'Abertura', 'Conclusão', 'Cliente', 'Placa', 'Modelo', 'Tipo', 'Status', 'Valor'],
        ...filtered.map((o) => [
          o.number ?? '',
          dateBR(o.createdAt),
          o.executionCompletedAt ? dateBR(o.executionCompletedAt) : '',
          o.customerName,
          o.vehiclePlate ?? '',
          o.vehicleModel ?? '',
          tipoLabel(tipoOf(o)),
          statusLabelOf(o),
          (o.totalValue || 0).toFixed(2),
        ]),
      ]
    }

    downloadCSV(`${name}-${Date.now()}.csv`, toCSV(rows))
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Relatórios</h1>
      <p className="mb-6 text-sm text-gray-500">
        Tudo que está em aberto, o que foi feito e o que precisa ser feito — por O.S., por cliente e
        por veículo.
      </p>

      <div className="mb-6 flex flex-wrap gap-2 border-b border-gray-200">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            aria-pressed={tab === t.key}
            className={`-mb-px border-b-2 px-3 py-2 text-sm font-medium ${
              tab === t.key
                ? 'border-blue-600 text-blue-700'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'aberto' ? (
        <Esteira orders={orders} vehicles={vehicles} customers={customers} />
      ) : (
        <>
          {/* Cabeçalho comum das abas 2 a 5 */}
          <div className="mb-4 rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-3">
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Buscar (filtra ao digitar)
              </label>
              <input
                value={q}
                onChange={(e) => setQ(e.target.value)}
                placeholder="Nº da O.S., cliente, placa ou modelo"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm md:max-w-md"
              />
            </div>

            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">De</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Até</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <span className="mb-1 block text-xs font-medium text-gray-600">
                  O período conta pela
                </span>
                <div className="flex overflow-hidden rounded-lg border border-gray-300">
                  {(
                    [
                      { key: 'abertura', label: 'Data de abertura' },
                      { key: 'conclusao', label: 'Data de conclusão' },
                    ] as { key: Anchor; label: string }[]
                  ).map((a) => (
                    <button
                      key={a.key}
                      onClick={() => setAnchor(a.key)}
                      aria-pressed={anchor === a.key}
                      className={`px-3 py-2 text-sm font-medium ${
                        anchor === a.key
                          ? 'bg-blue-600 text-white'
                          : 'bg-white text-gray-600 hover:bg-gray-50'
                      }`}
                    >
                      {a.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Situação</label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'todos' | WorkStatus)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  <option value="todos">Todas as situações</option>
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
                  ))}
                </select>
              </div>

              <button
                onClick={exportCSV}
                className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
              >
                Exportar CSV
              </button>
            </div>

            {anchor === 'conclusao' && estimadas > 0 && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
                {estimadas} {estimadas === 1 ? 'O.S. entrou' : 'O.S. entraram'} pela data estimada —
                não têm data de conclusão gravada, então o período usa a última atualização.
              </p>
            )}
          </div>

          <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Total de O.S.</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{filtered.length}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Valor total</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{money(totalValue)}</p>
            </div>
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="text-xs font-medium text-gray-500">Ticket médio</p>
              <p className="mt-1 text-2xl font-bold text-gray-900">{money(ticket)}</p>
            </div>
          </div>

          {tab === 'os' && <OrdersTable orders={filtered} />}

          {tab === 'cliente' && (
            <Card title="Por cliente" hint="clique na linha para abrir a ficha do cliente">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Cliente</th>
                    <th className="px-4 py-3">O.S.</th>
                    <th className="px-4 py-3">Total gasto</th>
                    <th className="px-4 py-3">Última visita</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {clientes.map((c) => (
                    <tr key={c.customerId || c.customerName} className="hover:bg-gray-50">
                      <td className="px-4 py-3">
                        <Link
                          href={`/customers/${c.customerId}`}
                          className="font-medium text-gray-900 hover:underline"
                        >
                          {c.customerName}
                        </Link>
                      </td>
                      <td className="px-4 py-3 text-gray-600">{c.count}</td>
                      <td className="px-4 py-3 text-gray-700">{money(c.total)}</td>
                      <td className="px-4 py-3 text-gray-500">{dateBR(c.lastAt)}</td>
                    </tr>
                  ))}
                  {clientes.length === 0 && <EmptyRow cols={4} />}
                </tbody>
              </table>
            </Card>
          )}

          {tab === 'veiculo' && (
            <>
              <Card title="Por veículo" hint="clique na linha para abrir a ficha do veículo">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Placa</th>
                      <th className="px-4 py-3">Modelo</th>
                      <th className="px-4 py-3">Dono</th>
                      <th className="px-4 py-3">O.S.</th>
                      <th className="px-4 py-3">Total</th>
                      <th className="px-4 py-3">Última visita</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {veiculos.map((v) => (
                      <tr key={v.vehicleId} className="hover:bg-gray-50">
                        <td className="px-4 py-3">
                          <Link
                            href={`/vehicles/${v.vehicleId}`}
                            className="font-medium text-gray-900 hover:underline"
                          >
                            {v.plate || '—'}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-gray-600">{v.model || '—'}</td>
                        <td className="px-4 py-3 text-gray-600">{v.customerName}</td>
                        <td className="px-4 py-3 text-gray-600">{v.count}</td>
                        <td className="px-4 py-3 text-gray-700">{money(v.total)}</td>
                        <td className="px-4 py-3 text-gray-500">{dateBR(v.lastAt)}</td>
                      </tr>
                    ))}
                    {veiculos.length === 0 && <EmptyRow cols={6} />}
                  </tbody>
                </table>
              </Card>

              {semVeiculo.length > 0 && (
                <p className="mt-3 text-xs text-gray-600">
                  {semVeiculo.length}{' '}
                  {semVeiculo.length === 1 ? 'O.S. do período não tem' : 'O.S. do período não têm'}{' '}
                  veículo e por isso não aparece{semVeiculo.length === 1 ? '' : 'm'} nesta lista —{' '}
                  <button
                    onClick={() => {
                      setTab('tipo')
                      setTipoSel('Sem veículo')
                    }}
                    className="font-medium text-blue-600 hover:underline"
                  >
                    ver essas O.S.
                  </button>
                </p>
              )}
            </>
          )}

          {tab === 'tipo' && (
            <>
              <Card title="Por tipo de veículo" hint="clique num tipo para ver as O.S. dele">
                <table className="w-full text-sm">
                  <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
                    <tr>
                      <th className="px-4 py-3">Tipo</th>
                      <th className="px-4 py-3">O.S.</th>
                      <th className="px-4 py-3">Valor total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-100">
                    {tipos.map((t) => (
                      <tr
                        key={t.tipo}
                        onClick={() => setTipoSel((cur) => (cur === t.tipo ? null : t.tipo))}
                        aria-pressed={tipoSel === t.tipo}
                        className={`cursor-pointer hover:bg-gray-50 ${
                          tipoSel === t.tipo ? 'bg-blue-50' : ''
                        }`}
                      >
                        <td className="px-4 py-3 font-medium text-gray-900">{tipoLabel(t.tipo)}</td>
                        <td className="px-4 py-3 text-gray-600">{t.count}</td>
                        <td className="px-4 py-3 text-gray-700">{money(t.total)}</td>
                      </tr>
                    ))}
                    {tipos.length === 0 && <EmptyRow cols={3} />}
                  </tbody>
                </table>
              </Card>

              {tipoSel && (
                <div className="mt-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h3 className="text-sm font-semibold text-gray-900">
                      O.S. de {tipoLabel(tipoSel)} ({ordersDoTipo.length})
                    </h3>
                    <button
                      onClick={() => setTipoSel(null)}
                      className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50"
                    >
                      Fechar
                    </button>
                  </div>
                  <OrdersTable orders={ordersDoTipo} />
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  )
}

function Card({
  title,
  hint,
  children,
}: {
  title: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
        <h2 className="text-sm font-semibold text-gray-900">{title}</h2>
        {hint && <span className="text-xs text-gray-500">{hint}</span>}
      </div>
      <div className="overflow-x-auto">{children}</div>
    </div>
  )
}

function EmptyRow({ cols }: { cols: number }) {
  return (
    <tr>
      <td colSpan={cols} className="px-4 py-8 text-center text-gray-400">
        Nenhum dado no período e nos filtros selecionados
      </td>
    </tr>
  )
}

function OrdersTable({ orders }: { orders: Order[] }) {
  const router = useRouter()
  return (
    <Card title="Por O.S." hint="clique na linha para abrir a O.S.">
      <table className="w-full text-sm">
        <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
          <tr>
            <th className="px-4 py-3">Nº</th>
            <th className="px-4 py-3">Abertura</th>
            <th className="px-4 py-3">Conclusão</th>
            <th className="px-4 py-3">Cliente</th>
            <th className="px-4 py-3">Veículo</th>
            <th className="px-4 py-3">Situação</th>
            <th className="px-4 py-3">Total</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-100">
          {orders.map((o) => (
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
              <td className="whitespace-nowrap px-4 py-3 text-gray-500">
                {o.executionCompletedAt ? dateBR(o.executionCompletedAt) : '—'}
              </td>
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
          {orders.length === 0 && <EmptyRow cols={7} />}
        </tbody>
      </table>
    </Card>
  )
}
