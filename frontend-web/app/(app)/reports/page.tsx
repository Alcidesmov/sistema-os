'use client'

import { useEffect, useMemo, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchOrders, watchVehicles } from '@/lib/firebase/firestore'
import { Order, Vehicle } from '@/lib/types'

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

export default function ReportsPage() {
  const { clientId } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    if (!clientId) return
    const u1 = watchOrders(clientId, setOrders)
    const u2 = watchVehicles(clientId, setVehicles)
    return () => {
      u1()
      u2()
    }
  }, [clientId])

  const vehicleType = (vehicleId: string) => vehicles.find((v) => v.id === vehicleId)?.type ?? 'outro'

  const filtered = useMemo(() => {
    return orders.filter((o) => {
      if (from && o.createdAt < new Date(from).getTime()) return false
      if (to && o.createdAt > new Date(to).getTime() + 86400000) return false
      return true
    })
  }, [orders, from, to])

  const byType = useMemo(() => {
    const map: Record<string, { count: number; total: number }> = {}
    for (const o of filtered) {
      const t = vehicleType(o.vehicleId)
      if (!map[t]) map[t] = { count: 0, total: 0 }
      map[t].count += 1
      map[t].total += o.totalValue
    }
    return map
  }, [filtered, vehicles])

  const totalValue = filtered.reduce((sum, o) => sum + o.totalValue, 0)

  const exportCSV = () => {
    const rows: (string | number)[][] = [
      ['Data', 'Cliente', 'Veículo', 'Placa', 'Tipo', 'Status', 'Valor'],
      ...filtered.map((o) => [
        new Date(o.createdAt).toLocaleDateString('pt-BR'),
        o.customerName,
        o.vehicleModel,
        o.vehiclePlate,
        vehicleType(o.vehicleId),
        o.status,
        o.totalValue.toFixed(2),
      ]),
    ]
    downloadCSV(`relatorio-os-${Date.now()}.csv`, toCSV(rows))
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Relatórios</h1>

      <div className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
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
        <button
          onClick={exportCSV}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
        >
          Exportar CSV
        </button>
      </div>

      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Total de OS</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{filtered.length}</p>
        </div>
        <div className="rounded-xl border border-gray-200 bg-white p-4">
          <p className="text-xs font-medium text-gray-500">Valor total</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">
            {totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </p>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Por tipo de veículo</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Quantidade</th>
              <th className="px-4 py-3">Valor total</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {Object.entries(byType).map(([type, data]) => (
              <tr key={type}>
                <td className="px-4 py-3 capitalize text-gray-900">{type}</td>
                <td className="px-4 py-3 text-gray-600">{data.count}</td>
                <td className="px-4 py-3 text-gray-600">
                  {data.total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            ))}
            {Object.keys(byType).length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  Nenhum dado no período selecionado
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
