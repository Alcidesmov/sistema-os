'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchCustomers, watchOrders, watchVehicles } from '@/lib/firebase/firestore'
import { Customer, Order, Vehicle } from '@/lib/types'
import { Esteira } from '@/components/esteira/Esteira'

/**
 * Home do sistema: a esteira. Substituiu o antigo /dashboard (que virou
 * um redirect para cá). O mesmo componente é a primeira aba de
 * /reports — os números das duas telas saem do mesmo lugar.
 */
export default function EsteiraPage() {
  const { clientId } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    if (!clientId) return
    const u1 = watchOrders(clientId, (items) => {
      setOrders(items)
      setLoaded(true)
    })
    const u2 = watchVehicles(clientId, setVehicles)
    const u3 = watchCustomers(clientId, setCustomers)
    return () => {
      u1()
      u2()
      u3()
    }
  }, [clientId])

  return (
    <div>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Esteira</h1>
          <p className="text-sm text-gray-500">
            O que precisa de ação, onde está o dinheiro e em que ponto do fluxo cada O.S. está.
          </p>
        </div>
        <div className="flex gap-2">
          <Link
            href="/reports"
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Relatórios
          </Link>
          <Link
            href="/orders"
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Nova O.S.
          </Link>
        </div>
      </div>

      {!loaded && orders.length === 0 ? (
        <p className="rounded-xl border border-gray-200 bg-white px-4 py-8 text-center text-sm text-gray-400">
          Carregando a esteira…
        </p>
      ) : (
        <Esteira orders={orders} vehicles={vehicles} customers={customers} />
      )}
    </div>
  )
}
