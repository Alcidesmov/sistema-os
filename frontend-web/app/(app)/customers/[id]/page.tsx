'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import {
  watchCustomers,
  watchVehicles,
  watchOrders,
  updateCustomer,
  createVehicle,
} from '@/lib/firebase/firestore'
import { Customer, Vehicle, Order, VehicleType, VEHICLE_TYPE_LABEL } from '@/lib/types'
import { dateBR, money, orderLabel, vehicleLabel } from '@/lib/orders/format'
import { isCancelled, statusColorOf, statusLabelOf } from '@/lib/orders/status'

const TIPOS = Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[]

export default function CustomerDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { clientId } = useClientId()

  const [customers, setCustomers] = useState<Customer[] | null>(null)
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [editing, setEditing] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [savingCustomer, setSavingCustomer] = useState(false)

  const [showVehicleForm, setShowVehicleForm] = useState(false)
  const [plate, setPlate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [type, setType] = useState<VehicleType>('carro')
  const [savingVehicle, setSavingVehicle] = useState(false)

  useEffect(() => {
    if (!clientId) return
    const unsubCustomers = watchCustomers(clientId, setCustomers)
    const unsubVehicles = watchVehicles(clientId, setVehicles)
    const unsubOrders = watchOrders(clientId, setOrders)
    return () => {
      unsubCustomers()
      unsubVehicles()
      unsubOrders()
    }
  }, [clientId])

  const customer = useMemo(
    () => (customers ?? []).find((c) => c.id === params.id) ?? null,
    [customers, params.id]
  )

  /** Carros e O.S. deste cliente — filtro EM MEMÓRIA sobre o que a tela já assina. */
  const meusCarros = useMemo(
    () => vehicles.filter((v) => v.customerId === params.id),
    [vehicles, params.id]
  )

  const minhasOs = useMemo(
    () => orders.filter((o) => o.customerId === params.id),
    [orders, params.id]
  )

  const ultimaOsPorVeiculo = useMemo(() => {
    const map = new Map<string, number>()
    for (const o of minhasOs) {
      if (!o.vehicleId) continue
      map.set(o.vehicleId, Math.max(map.get(o.vehicleId) ?? 0, o.createdAt))
    }
    return map
  }, [minhasOs])

  const osValidas = useMemo(() => minhasOs.filter((o) => !isCancelled(o)), [minhasOs])
  const totalGasto = useMemo(
    () => osValidas.reduce((s, o) => s + (o.totalValue || 0), 0),
    [osValidas]
  )
  const osMaisRecente = minhasOs[0] ?? null

  useEffect(() => {
    if (!customer || editing) return
    setName(customer.name ?? '')
    setPhone(customer.phone ?? '')
    setEmail(customer.email ?? '')
    setDocNumber(customer.document ?? '')
  }, [customer, editing])

  if (!clientId || customers === null) {
    return <p className="text-sm text-gray-500">Carregando...</p>
  }

  if (!customer) {
    return (
      <div>
        <button
          onClick={() => router.push('/customers')}
          className="mb-4 text-sm text-gray-500 hover:text-gray-700"
        >
          ← Voltar para Clientes
        </button>
        <div className="rounded-xl border border-gray-200 bg-white p-6">
          <p className="text-sm text-gray-700">
            Cliente não encontrado. Ele pode ter sido removido, ou o endereço está errado.
          </p>
        </div>
      </div>
    )
  }

  const podeSalvarCliente = name.trim().length > 0

  const salvarCliente = async () => {
    if (!podeSalvarCliente) return
    setSavingCustomer(true)
    // Sempre string, nunca undefined — o Firestore rejeita undefined (CLAUDE.md 6.1).
    await updateCustomer(clientId, customer.id, {
      name: name.trim(),
      phone: phone.trim(),
      email: email.trim(),
      document: docNumber.trim(),
    })
    setSavingCustomer(false)
    setEditing(false)
  }

  const podeSalvarVeiculo = plate.trim().length > 0 && model.trim().length > 0

  const salvarVeiculo = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!podeSalvarVeiculo) return
    setSavingVehicle(true)
    await createVehicle(clientId, {
      plate: plate.trim().toUpperCase(),
      model: model.trim(),
      customerId: customer.id,
      type,
      brand: brand.trim(),
      year: year.trim(),
      color: color.trim(),
    })
    setPlate('')
    setBrand('')
    setModel('')
    setYear('')
    setColor('')
    setType('carro')
    setSavingVehicle(false)
    setShowVehicleForm(false)
  }

  return (
    <div>
      <button
        onClick={() => router.push('/customers')}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Voltar para Clientes
      </button>

      <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{customer.name}</h1>
          <p className="text-sm text-gray-500">
            Cliente desde {dateBR(customer.createdAt)}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href={`/orders/nova?cliente=${customer.id}`}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Nova O.S. para este cliente
          </Link>
          <button
            onClick={() => setShowVehicleForm((s) => !s)}
            className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            {showVehicleForm ? 'Fechar cadastro de carro' : 'Cadastrar outro carro'}
          </button>
        </div>
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
            {osMaisRecente
              ? `ver a O.S. ${orderLabel(osMaisRecente)} →`
              : 'nenhuma O.S. ainda'}
          </p>
        </a>

        <a
          href="#carros"
          className="rounded-xl border border-gray-200 bg-white p-4 hover:border-blue-300 hover:bg-blue-50"
        >
          <p className="text-xs font-medium uppercase text-gray-500">Carros dele</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{meusCarros.length}</p>
          <p className="mt-1 text-xs text-blue-600">ver a lista de carros →</p>
        </a>
      </div>

      {/* --- Dados do cliente, edição inline --- */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Dados do cliente</h2>
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
            <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Nome</label>
                <input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Telefone (opcional)
                </label>
                <input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="(00) 00000-0000"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  E-mail (opcional)
                </label>
                <input
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  type="email"
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  CPF/CNPJ (opcional)
                </label>
                <input
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="mt-4 flex items-center gap-3">
              <button
                onClick={salvarCliente}
                disabled={savingCustomer || !podeSalvarCliente}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {savingCustomer ? 'Salvando...' : 'Salvar'}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="text-sm text-gray-500 hover:text-gray-700"
              >
                Cancelar
              </button>
            </div>
            {!podeSalvarCliente && (
              <p className="mt-2 text-xs text-gray-500">
                Falta o nome — é o único campo obrigatório do cliente.
              </p>
            )}
          </div>
        ) : (
          <dl className="grid grid-cols-1 gap-3 text-sm md:grid-cols-4">
            <div>
              <dt className="text-xs text-gray-500">Nome</dt>
              <dd className="font-medium text-gray-900">{customer.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">Telefone</dt>
              <dd className="text-gray-700">{customer.phone || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">E-mail</dt>
              <dd className="text-gray-700">{customer.email || '—'}</dd>
            </div>
            <div>
              <dt className="text-xs text-gray-500">CPF/CNPJ</dt>
              <dd className="text-gray-700">{customer.document || '—'}</dd>
            </div>
          </dl>
        )}
      </div>

      {/* --- Cadastro de outro carro pra este cliente --- */}
      {showVehicleForm && (
        <form
          onSubmit={salvarVeiculo}
          className="mb-6 rounded-xl border border-gray-200 bg-white p-4"
        >
          <h2 className="mb-3 text-sm font-semibold text-gray-900">
            Cadastrar outro carro para {customer.name}
          </h2>
          <div className="grid grid-cols-2 gap-3 md:grid-cols-6">
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
          </div>
          <div className="mt-4">
            <button
              type="submit"
              disabled={savingVehicle || !podeSalvarVeiculo}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {savingVehicle ? 'Salvando...' : 'Cadastrar carro'}
            </button>
            {!podeSalvarVeiculo && (
              <p className="mt-2 text-xs text-gray-500">
                Falta {!plate.trim() ? 'a placa' : ''}
                {!plate.trim() && !model.trim() ? ' e ' : ''}
                {!model.trim() ? 'o modelo' : ''} — o resto é opcional.
              </p>
            )}
          </div>
        </form>
      )}

      {/* --- Carros dele --- */}
      <div id="carros" className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Carros deste cliente ({meusCarros.length})
          </h2>
          <span className="text-xs text-gray-500">clique num carro pra abrir a ficha dele</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Placa</th>
                <th className="px-4 py-3">Modelo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Última O.S.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {meusCarros.map((v) => {
                const ultima = ultimaOsPorVeiculo.get(v.id)
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
                    <td className="px-4 py-3 text-gray-600">
                      {ultima ? `última O.S. ${dateBR(ultima)}` : 'nunca passou por O.S.'}
                    </td>
                  </tr>
                )
              })}
              {meusCarros.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Nenhum carro cadastrado para este cliente — a O.S. pode ser aberta assim
                    mesmo, e o carro entra depois dentro dela.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* --- Histórico de O.S. --- */}
      <div
        id="historico"
        className="overflow-hidden rounded-xl border border-gray-200 bg-white"
      >
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
                <th className="px-4 py-3">Veículo</th>
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
                  <td className="px-4 py-3 text-gray-600">{vehicleLabel(o)}</td>
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
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Este cliente ainda não tem nenhuma O.S.
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
