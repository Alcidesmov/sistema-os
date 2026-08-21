'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchVehicles, watchCustomers, watchOrders, updateVehicle } from '@/lib/firebase/firestore'
import { Vehicle, Customer, Order, VehicleType, VEHICLE_TYPE_LABEL } from '@/lib/types'
import { dateBR, money, orderLabel } from '@/lib/orders/format'
import { isCancelled, statusColorOf, statusLabelOf } from '@/lib/orders/status'

const TIPOS = Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[]

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { clientId } = useClientId()

  const [vehicles, setVehicles] = useState<Vehicle[] | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [editing, setEditing] = useState(false)
  const [plate, setPlate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [type, setType] = useState<VehicleType>('carro')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!clientId) return
    const unsub1 = watchVehicles(clientId, setVehicles)
    const unsub2 = watchCustomers(clientId, setCustomers)
    const unsub3 = watchOrders(clientId, setOrders)
    return () => {
      unsub1()
      unsub2()
      unsub3()
    }
  }, [clientId])

  const vehicle = useMemo(
    () => (vehicles ?? []).find((v) => v.id === params.id) ?? null,
    [vehicles, params.id]
  )

  const dono = useMemo(
    () => (vehicle ? customers.find((c) => c.id === vehicle.customerId) ?? null : null),
    [customers, vehicle]
  )

  /** O.S. deste veículo — filtro EM MEMÓRIA sobre o que a tela já assina. */
  const minhasOs = useMemo(
    () => orders.filter((o) => o.vehicleId === params.id),
    [orders, params.id]
  )

  const osValidas = useMemo(() => minhasOs.filter((o) => !isCancelled(o)), [minhasOs])
  const totalGasto = useMemo(
    () => osValidas.reduce((s, o) => s + (o.totalValue || 0), 0),
    [osValidas]
  )
  const osMaisRecente = minhasOs[0] ?? null

  useEffect(() => {
    if (!vehicle || editing) return
    setPlate(vehicle.plate ?? '')
    setBrand(vehicle.brand ?? '')
    setModel(vehicle.model ?? '')
    setYear(vehicle.year ?? '')
    setColor(vehicle.color ?? '')
    setType(vehicle.type ?? 'carro')
  }, [vehicle, editing])

  if (!clientId || vehicles === null) {
    return <p className="text-sm text-gray-500">Carregando...</p>
  }

  if (!vehicle) {
    return (
      <div>
        <button
          onClick={() => router.push('/vehicles')}
          className="mb-4 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar para Veículos
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">
            Veículo não encontrado. Ele pode ter sido removido, ou o endereço está errado.
          </p>
        </div>
      </div>
    )
  }

  const podeSalvar = plate.trim().length > 0 && model.trim().length > 0

  const salvar = async () => {
    if (!podeSalvar) return
    setSaving(true)
    await updateVehicle(clientId, vehicle.id, {
      plate: plate.trim().toUpperCase(),
      brand: brand.trim(),
      model: model.trim(),
      year: year.trim(),
      color: color.trim(),
      type,
    })
    setSaving(false)
    setEditing(false)
  }

  return (
    <div>
      <button
        onClick={() => router.push('/vehicles')}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Voltar para Veículos
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{vehicle.plate}</h1>
          <p className="text-sm text-gray-500">
            {[vehicle.brand, vehicle.model, vehicle.year].filter(Boolean).join(' ') || 'Sem modelo cadastrado'}
            {' · '}
            {dono ? (
              <>
                dono:{' '}
                <Link href={`/customers/${dono.id}`} className="font-medium text-blue-600 hover:underline">
                  {dono.name}
                </Link>
              </>
            ) : (
              'sem dono cadastrado'
            )}
          </p>
        </div>
        <Link
          href={`/orders/nova?veiculo=${vehicle.id}`}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Nova O.S. para este veículo
        </Link>
      </div>

      {/* --- Os três números. Nenhum é beco sem saída: todos levam às linhas que os compõem. --- */}
      <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <a
          href="#historico"
          className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50"
        >
          <p className="text-xs font-medium uppercase text-gray-500">Total já gasto</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{money(totalGasto)}</p>
          <p className="mt-1 text-xs text-blue-600">
            ver as {osValidas.length} O.S. que somam isso →
          </p>
        </a>

        <a
          href="#historico"
          className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50"
        >
          <p className="text-xs font-medium uppercase text-gray-500">Última visita</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {osMaisRecente ? dateBR(osMaisRecente.createdAt) : '—'}
          </p>
          <p className="mt-1 text-xs text-blue-600">
            {osMaisRecente ? `ver a O.S. ${orderLabel(osMaisRecente)} →` : 'nenhuma O.S. ainda'}
          </p>
        </a>

        <a
          href="#historico"
          className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50"
        >
          <p className="text-xs font-medium uppercase text-gray-500">O.S. no total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{minhasOs.length}</p>
          <p className="mt-1 text-xs text-blue-600">ver o histórico completo →</p>
        </a>
      </div>

      {/* --- Dados do veículo, edição inline --- */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Dados do veículo</h2>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-medium text-blue-600 hover:underline"
            >
              Editar
            </button>
          )}
        </div>

        {editing ? (
          <div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Placa</label>
                <input
                  value={plate}
                  onChange={(e) => setPlate(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Marca</label>
                <input
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Modelo</label>
                <input
                  value={model}
                  onChange={(e) => setModel(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Ano</label>
                <input
                  value={year}
                  onChange={(e) => setYear(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Cor</label>
                <input
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
                <select
                  value={type}
                  onChange={(e) => setType(e.target.value as VehicleType)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                >
                  {TIPOS.map((t) => (
                    <option key={t} value={t}>
                      {VEHICLE_TYPE_LABEL[t]}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={salvar}
                disabled={saving || !podeSalvar}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
            {!podeSalvar && (
              <p className="mt-2 text-xs text-gray-500">
                Faltam {!plate.trim() ? 'a placa' : ''}
                {!plate.trim() && !model.trim() ? ' e ' : ''}
                {!model.trim() ? 'o modelo' : ''} — os únicos campos obrigatórios do veículo.
              </p>
            )}
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 md:grid-cols-6">
            <div>
              <dt className="text-xs text-gray-500">Placa</dt>
              <dd className="font-medium text-gray-900">{vehicle.plate}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Marca</dt>
              <dd className="text-gray-700">{vehicle.brand || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Modelo</dt>
              <dd className="text-gray-700">{vehicle.model || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Ano</dt>
              <dd className="text-gray-700">{vehicle.year || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Cor</dt>
              <dd className="text-gray-700">{vehicle.color || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Tipo</dt>
              <dd className="text-gray-700">{VEHICLE_TYPE_LABEL[vehicle.type] ?? '—'}</dd>
            </div>
          </dl>
        )}

        <div className="mt-4 border-t border-gray-100 pt-3 text-sm">
          <span className="text-xs text-gray-500">Dono: </span>
          {dono ? (
            <Link href={`/customers/${dono.id}`} className="font-medium text-blue-600 hover:underline">
              {dono.name} →
            </Link>
          ) : (
            <span className="text-gray-400">nenhum cliente vinculado</span>
          )}
        </div>
      </div>

      {/* --- Histórico de O.S. --- */}
      <div id="historico" className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Histórico de O.S. ({minhasOs.length})
          </h2>
          <span className="text-xs text-gray-500">clique numa linha pra abrir a O.S.</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">O.S.</th>
                <th className="px-4 py-3">Abertura</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Total</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {minhasOs.map((o) => (
                <tr
                  key={o.id}
                  onClick={() => router.push(`/orders/${o.id}`)}
                  className="cursor-pointer hover:bg-blue-50"
                >
                  <td className="px-4 py-3 font-medium text-gray-900">{orderLabel(o)}</td>
                  <td className="px-4 py-3 text-gray-600">{dateBR(o.createdAt)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${statusColorOf(o)}`}
                    >
                      {statusLabelOf(o)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{money(o.totalValue)}</td>
                </tr>
              ))}
              {minhasOs.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Este veículo ainda não tem nenhuma O.S.
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
