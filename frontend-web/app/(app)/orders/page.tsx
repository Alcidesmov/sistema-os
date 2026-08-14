'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useClientId } from '@/lib/hooks/useClientId'
import {
  watchOrders,
  watchCustomers,
  watchVehicles,
  watchServices,
} from '@/lib/firebase/firestore'
import { Order, Customer, Vehicle, ServiceItem, OrderStatus } from '@/lib/types'
import { NewOrderForm } from '@/components/forms/NewOrderForm'

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
