'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchVehicles, watchCustomers, watchOrders, createVehicle } from '@/lib/firebase/firestore'
import { Customer, Vehicle, Order, VehicleType, VEHICLE_TYPE_LABEL } from '@/lib/types'
import { normalize } from '@/lib/utils/search'
import { dateBR } from '@/lib/orders/format'
import { isCancelled } from '@/lib/orders/status'

const TIPOS = Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[]

interface Resumo {
  os: number
  total: number
  ultima: number
}

/**
 * Autocomplete de cliente — substitui o <select> que listava todos.
 * "Nenhum bloco escondido atrás de preenchimento" (R1) não se aplica aqui
 * (não é bloco de formulário, é escolha de um único campo), mas segue a
 * mesma regra de busca-ao-digitar do resto do projeto (CLAUDE.md 6.11).
 */
function ClienteAutocomplete({
  customers,
  customerId,
  onSelect,
}: {
  customers: Customer[]
  customerId: string
  onSelect: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)

  const selected = customers.find((c) => c.id === customerId) ?? null

  const results = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return []
    return customers
      .filter((c) => normalize(`${c.name} ${c.phone ?? ''} ${c.document ?? ''}`).includes(q))
      .slice(0, 8)
  }, [customers, query])

  if (selected) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-2 text-sm">
        <span className="font-medium text-gray-900">{selected.name}</span>
        <button
          type="button"
          onClick={() => onSelect('')}
          className="text-xs font-medium text-blue-600 hover:underline"
        >
          Trocar
        </button>
      </div>
    )
  }

  return (
    <div className="relative">
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Buscar cliente por nome ou telefone..."
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />
      {open && query.trim() && (
        <div className="absolute z-20 mt-1 max-h-60 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((c) => (
            <button
              key={c.id}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onSelect(c.id)
                setQuery('')
                setOpen(false)
              }}
              className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-blue-50"
            >
              <span className="font-medium text-gray-900">{c.name}</span>
              {c.phone && <span className="text-xs text-gray-500">{c.phone}</span>}
            </button>
          ))}
          {results.length === 0 && (
            <p className="px-3 py-2 text-sm text-gray-400">
              Nenhum cliente encontrado. Cadastre primeiro em Clientes.
            </p>
          )}
        </div>
      )}
    </div>
  )
}

export default function VehiclesPage() {
  const router = useRouter()
  const { clientId } = useClientId()

  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [query, setQuery] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [plate, setPlate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [type, setType] = useState<VehicleType>('carro')
  const [customerId, setCustomerId] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ id: string; label: string } | null>(null)

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

  const customersById = useMemo(() => {
    const map = new Map<string, Customer>()
    for (const c of customers) map.set(c.id, c)
    return map
  }, [customers])

  /**
   * Resumo por veículo derivado EM MEMÓRIA do que a tela já assina — sem
   * índice composto novo no Firestore só pra mostrar uma data.
   */
  const resumoPorVeiculo = useMemo(() => {
    const map = new Map<string, Resumo>()
    for (const o of orders) {
      if (!o.vehicleId) continue
      const cur = map.get(o.vehicleId) ?? { os: 0, total: 0, ultima: 0 }
      cur.os += 1
      cur.ultima = Math.max(cur.ultima, o.createdAt)
      if (!isCancelled(o)) cur.total += o.totalValue || 0
      map.set(o.vehicleId, cur)
    }
    return map
  }, [orders])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return vehicles
    return vehicles.filter((v) => {
      const dono = customersById.get(v.customerId)
      const alvo = [
        v.plate,
        v.model,
        v.brand,
        v.color,
        v.year,
        VEHICLE_TYPE_LABEL[v.type] ?? '',
        dono?.name ?? '',
      ].join(' ')
      return normalize(alvo).includes(q)
    })
  }, [vehicles, query, customersById])

  const podeSalvar = Boolean(clientId) && plate.trim().length > 0 && model.trim().length > 0 && Boolean(customerId)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !podeSalvar) return
    setSaving(true)
    const ref = await createVehicle(clientId, {
      plate: plate.trim().toUpperCase(),
      model: model.trim(),
      customerId,
      type,
      brand: brand.trim(),
      year: year.trim(),
      color: color.trim(),
    })
    setCreated({ id: ref.id, label: `${plate.trim().toUpperCase()} · ${model.trim()}` })
    setPlate('')
    setBrand('')
    setModel('')
    setYear('')
    setColor('')
    setType('carro')
    setCustomerId('')
    setSaving(false)
  }

  const faltando = () => {
    const partes: string[] = []
    if (!plate.trim()) partes.push('a placa')
    if (!model.trim()) partes.push('o modelo')
    if (!customerId) partes.push('o cliente dono')
    if (partes.length === 0) return null
    if (partes.length === 1) return `Falta ${partes[0]}.`
    return `Falta ${partes.slice(0, -1).join(', ')} e ${partes[partes.length - 1]}.`
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Veículos</h1>
      <p className="mb-4 text-sm text-gray-500">
        Clique em qualquer linha pra abrir a ficha do veículo — dono, histórico de O.S. e total
        gasto.
      </p>

      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-gray-600">Buscar veículo</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Placa, modelo, marca ou nome do cliente..."
          autoFocus
          className="w-full max-w-lg rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query.trim() && (
          <p className="mt-1 text-xs text-gray-500">
            {filtered.length} de {vehicles.length} veículos
          </p>
        )}
      </div>

      <div className="mb-4 border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {showForm ? 'Fechar cadastro' : '+ Cadastrar veículo'}
        </button>
      </div>

      {created && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">
            {created.label} cadastrado.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/orders/nova?veiculo=${created.id}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Nova O.S. para este veículo
            </Link>
            <Link
              href={`/vehicles/${created.id}`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abrir ficha do veículo
            </Link>
            <button
              onClick={() => setCreated(null)}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Dispensar
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Placa</label>
              <input
                value={plate}
                onChange={(e) => setPlate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
                placeholder="ABC1D23"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Marca</label>
              <input
                value={brand}
                onChange={(e) => setBrand(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Fiat"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Modelo</label>
              <input
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Uno"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Ano</label>
              <input
                value={year}
                onChange={(e) => setYear(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="2020"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Cor</label>
              <input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Prata"
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
            <div className="sm:col-span-2">
              <label className="mb-1 block text-xs font-medium text-gray-600">Cliente dono</label>
              <ClienteAutocomplete
                customers={customers}
                customerId={customerId}
                onSelect={setCustomerId}
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="submit"
              disabled={saving || !podeSalvar}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Cadastrar veículo'}
            </button>
            {faltando() && <p className="mt-2 text-xs text-gray-500">{faltando()}</p>}
            {!faltando() && customers.length === 0 && (
              <p className="mt-2 text-xs text-amber-700">
                Nenhum cliente cadastrado ainda — cadastre um em Clientes antes de vincular o
                veículo.
              </p>
            )}
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Última O.S.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((v) => {
                const dono = customersById.get(v.customerId)
                const r = resumoPorVeiculo.get(v.id)
                return (
                  <tr
                    key={v.id}
                    onClick={() => router.push(`/vehicles/${v.id}`)}
                    className="cursor-pointer hover:bg-blue-50"
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">{v.plate}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {[v.brand, v.model, v.year].filter(Boolean).join(' ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {VEHICLE_TYPE_LABEL[v.type] ?? '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{dono?.name ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r?.ultima ? dateBR(r.ultima) : 'nunca'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    {vehicles.length === 0
                      ? 'Nenhum veículo cadastrado ainda'
                      : 'Nenhum veículo encontrado pra essa busca'}
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
