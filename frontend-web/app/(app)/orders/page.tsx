'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useClientId } from '@/lib/hooks/useClientId'
import {
  watchOrders,
  watchCustomers,
  watchVehicles,
  watchServices,
  createOrder,
  createCustomer,
  createVehicle,
} from '@/lib/firebase/firestore'
import { Order, Customer, Vehicle, ServiceItem, OrderLineItem, OrderStatus } from '@/lib/types'

const STATUS_LABEL: Record<OrderStatus, string> = {
  diagnostico: 'Diagnóstico',
  em_servico: 'Em Serviço',
  finalizado: 'Finalizado',
  invoiced: 'Faturada',
}

const STATUS_COLOR: Record<OrderStatus, string> = {
  diagnostico: 'bg-amber-100 text-amber-700',
  em_servico: 'bg-purple-100 text-purple-700',
  finalizado: 'bg-green-100 text-green-700',
  invoiced: 'bg-teal-100 text-teal-700',
}

export default function OrdersPage() {
  const { clientId } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [showForm, setShowForm] = useState(false)

  useEffect(() => {
    if (!clientId) return
    const u1 = watchOrders(clientId, setOrders)
    const u2 = watchCustomers(clientId, setCustomers)
    const u3 = watchVehicles(clientId, setVehicles)
    const u4 = watchServices(clientId, setServices)
    return () => {
      u1()
      u2()
      u3()
      u4()
    }
  }, [clientId])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Ordens de Serviço</h1>
        <button
          onClick={() => setShowForm((s) => !s)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          {showForm ? 'Cancelar' : '+ Nova OS'}
        </button>
      </div>

      {showForm && clientId && (
        <NewOrderForm
          clientId={clientId}
          customers={customers}
          vehicles={vehicles}
          services={services}
          onDone={() => setShowForm(false)}
        />
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Cliente</th>
              <th className="px-4 py-3">Veículo</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Total</th>
              <th className="px-4 py-3">Data</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {orders.map((o) => (
              <tr key={o.id} className="cursor-pointer hover:bg-gray-50">
                <td className="px-4 py-3">
                  <Link href={`/orders/${o.id}`} className="font-medium text-gray-900">
                    {o.customerName}
                  </Link>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {o.vehiclePlate} · {o.vehicleModel}
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLOR[o.status]}`}
                  >
                    {STATUS_LABEL[o.status]}
                  </span>
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {o.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3 text-gray-500">
                  {new Date(o.createdAt).toLocaleDateString('pt-BR')}
                </td>
              </tr>
            ))}
            {orders.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                  Nenhuma OS criada ainda
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

function NewOrderForm({
  clientId,
  customers,
  vehicles,
  services,
  onDone,
}: {
  clientId: string
  customers: Customer[]
  vehicles: Vehicle[]
  services: ServiceItem[]
  onDone: () => void
}) {
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  const [vehicleId, setVehicleId] = useState('')
  const [newVehiclePlate, setNewVehiclePlate] = useState('')
  const [newVehicleModel, setNewVehicleModel] = useState('')

  const [lineItems, setLineItems] = useState<OrderLineItem[]>([])
  const [saving, setSaving] = useState(false)

  const [avulsoDesc, setAvulsoDesc] = useState('')
  const [avulsoType, setAvulsoType] = useState<'service' | 'part'>('service')
  const [avulsoPrice, setAvulsoPrice] = useState('')

  const filteredVehicles = useMemo(
    () => vehicles.filter((v) => v.customerId === customerId),
    [vehicles, customerId]
  )

  const total = useMemo(
    () => lineItems.reduce((sum, i) => sum + i.subtotal, 0),
    [lineItems]
  )

  const addItem = (service: ServiceItem) => {
    setLineItems((prev) => {
      const existing = prev.find((i) => i.itemId === service.id)
      if (existing) {
        return prev.map((i) =>
          i.itemId === service.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
            : i
        )
      }
      return [
        ...prev,
        {
          itemId: service.id,
          type: service.type,
          description: service.name,
          quantity: 1,
          unitPrice: service.price,
          subtotal: service.price,
        },
      ]
    })
  }

  const removeItem = (itemId: string) => {
    setLineItems((prev) => prev.filter((i) => i.itemId !== itemId))
  }

  const addAvulsoItem = () => {
    const price = parseFloat(avulsoPrice.replace(',', '.'))
    if (!avulsoDesc || Number.isNaN(price)) return
    setLineItems((prev) => [
      ...prev,
      {
        itemId: crypto.randomUUID(),
        type: avulsoType,
        description: avulsoDesc,
        quantity: 1,
        unitPrice: price,
        subtotal: price,
      },
    ])
    setAvulsoDesc('')
    setAvulsoPrice('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lineItems.length === 0) return
    setSaving(true)

    let finalCustomerId = customerId
    let finalCustomerName = customers.find((c) => c.id === customerId)?.name ?? ''

    if (!finalCustomerId && newCustomerName && newCustomerPhone) {
      const ref = await createCustomer(clientId, {
        name: newCustomerName,
        phone: newCustomerPhone,
      })
      finalCustomerId = ref.id
      finalCustomerName = newCustomerName
    }

    let finalVehicleId = vehicleId
    let finalPlate = vehicles.find((v) => v.id === vehicleId)?.plate ?? ''
    let finalModel = vehicles.find((v) => v.id === vehicleId)?.model ?? ''

    if (!finalVehicleId && newVehiclePlate && newVehicleModel) {
      const ref = await createVehicle(clientId, {
        plate: newVehiclePlate.toUpperCase(),
        model: newVehicleModel,
        brand: '',
        year: '',
        color: '',
        type: 'carro',
        customerId: finalCustomerId,
      })
      finalVehicleId = ref.id
      finalPlate = newVehiclePlate.toUpperCase()
      finalModel = newVehicleModel
    }

    if (!finalCustomerId || !finalVehicleId) {
      setSaving(false)
      return
    }

    await createOrder(clientId, {
      customerId: finalCustomerId,
      customerName: finalCustomerName,
      vehicleId: finalVehicleId,
      vehiclePlate: finalPlate,
      vehicleModel: finalModel,
      items: lineItems,
      totalValue: total,
    })

    setSaving(false)
    onDone()
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 space-y-5 rounded-xl border border-gray-200 bg-white p-5"
    >
      {/* Customer */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Cliente</label>
        <div className="flex gap-2">
          <select
            value={customerId}
            onChange={(e) => {
              setCustomerId(e.target.value)
              setVehicleId('')
            }}
            className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Cliente novo (preencher abaixo) ou selecione...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name} · {c.phone}
              </option>
            ))}
          </select>
        </div>
        {!customerId && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              value={newCustomerName}
              onChange={(e) => setNewCustomerName(e.target.value)}
              placeholder="Nome do novo cliente"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <input
              value={newCustomerPhone}
              onChange={(e) => setNewCustomerPhone(e.target.value)}
              placeholder="Telefone"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* Vehicle */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">Veículo</label>
        <select
          value={vehicleId}
          onChange={(e) => setVehicleId(e.target.value)}
          className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          disabled={!customerId}
        >
          <option value="">Veículo novo (preencher abaixo) ou selecione...</option>
          {filteredVehicles.map((v) => (
            <option key={v.id} value={v.id}>
              {v.plate} · {v.model}
            </option>
          ))}
        </select>
        {!vehicleId && (
          <div className="mt-2 grid grid-cols-2 gap-2">
            <input
              value={newVehiclePlate}
              onChange={(e) => setNewVehiclePlate(e.target.value)}
              placeholder="Placa"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
            />
            <input
              value={newVehicleModel}
              onChange={(e) => setNewVehicleModel(e.target.value)}
              placeholder="Modelo"
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
        )}
      </div>

      {/* Services / parts */}
      <div>
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Serviços e peças (clique para adicionar)
        </label>
        <div className="flex flex-wrap gap-2">
          {services.map((s) => (
            <button
              type="button"
              key={s.id}
              onClick={() => addItem(s)}
              className="rounded-full border border-gray-300 px-3 py-1 text-xs font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600"
            >
              + {s.name} ({s.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })})
            </button>
          ))}
          {services.length === 0 && (
            <p className="text-xs text-gray-400">
              Nenhum serviço cadastrado. Cadastre em &quot;Serviços e Peças&quot;.
            </p>
          )}
        </div>

        <div className="mt-3 rounded-lg border border-dashed border-gray-300 p-3">
          <label className="mb-2 block text-xs font-medium text-gray-600">
            Item avulso — ainda em diagnóstico, sem serviço/peça definido do catálogo
          </label>
          <div className="flex flex-wrap items-end gap-2">
            <input
              value={avulsoDesc}
              onChange={(e) => setAvulsoDesc(e.target.value)}
              placeholder="Descrição (ex.: estimativa inicial)"
              className="min-w-[180px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <select
              value={avulsoType}
              onChange={(e) => setAvulsoType(e.target.value as 'service' | 'part')}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="service">Serviço</option>
              <option value="part">Peça</option>
            </select>
            <input
              value={avulsoPrice}
              onChange={(e) => setAvulsoPrice(e.target.value)}
              type="number"
              step="0.01"
              placeholder="Preço"
              className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
            <button
              type="button"
              onClick={addAvulsoItem}
              disabled={!avulsoDesc || !avulsoPrice}
              className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
            >
              + Adicionar
            </button>
          </div>
        </div>

        {lineItems.length > 0 && (
          <div className="mt-3 space-y-1 rounded-lg border border-gray-200 p-3">
            {lineItems.map((i) => (
              <div key={i.itemId} className="flex items-center justify-between text-sm">
                <span>
                  {i.quantity}x {i.description}
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-gray-600">
                    {i.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                  <button
                    type="button"
                    onClick={() => removeItem(i.itemId)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    remover
                  </button>
                </div>
              </div>
            ))}
            <div className="flex justify-between border-t border-gray-200 pt-2 text-sm font-semibold">
              <span>Total</span>
              <span>{total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
            </div>
          </div>
        )}
      </div>

      <button
        type="submit"
        disabled={saving || lineItems.length === 0}
        className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? 'Criando...' : 'Criar diagnóstico / orçamento'}
      </button>
    </form>
  )
}
