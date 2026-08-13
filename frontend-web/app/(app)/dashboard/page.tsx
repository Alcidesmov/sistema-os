'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchOrders } from '@/lib/firebase/firestore'
import { Order } from '@/lib/types'

export default function DashboardPage() {
  const { clientId } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])

  useEffect(() => {
    if (!clientId) return
    return watchOrders(clientId, setOrders)
  }, [clientId])

  const stats = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const todayOrders = orders.filter((o) => o.createdAt >= today.getTime())
    const awaitingApproval = orders.filter((o) => o.status === 'quoted')
    const inProgress = orders.filter((o) => o.status === 'in_progress')
    const totalMonth = orders
      .filter((o) => {
        const d = new Date(o.createdAt)
        const now = new Date()
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
      })
      .reduce((sum, o) => sum + o.totalValue, 0)

    return {
      todayCount: todayOrders.length,
      awaitingApproval: awaitingApproval.length,
      inProgress: inProgress.length,
      totalMonth,
    }
  }, [orders])

  const recent = orders.slice(0, 8)

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Visão geral</h1>

      <div className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard label="OS hoje" value={stats.todayCount} />
        <StatCard label="Aguardando aprovação" value={stats.awaitingApproval} />
        <StatCard label="Em execução" value={stats.inProgress} />
        <StatCard
          label="Faturamento do mês"
          value={stats.totalMonth.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
        />
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">OS recentes</h2>
          <Link href="/orders" className="text-xs font-medium text-blue-600 hover:underline">
            Ver todas
          </Link>
        </div>
        <div className="divide-y divide-gray-100">
          {recent.map((o) => (
            <Link
              key={o.id}
              href={`/orders/${o.id}`}
              className="flex items-center justify-between px-4 py-3 text-sm hover:bg-gray-50"
            >
              <div>
                <p className="font-medium text-gray-900">{o.customerName}</p>
                <p className="text-xs text-gray-500">
                  {o.vehiclePlate} · {o.vehicleModel}
                </p>
              </div>
              <span className="text-gray-600">
                {o.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </Link>
          ))}
          {recent.length === 0 && (
            <p className="px-4 py-8 text-center text-sm text-gray-400">Nenhuma OS ainda</p>
          )}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}
