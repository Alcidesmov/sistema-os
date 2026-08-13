'use client'

import { useEffect, useMemo, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchOrders, watchInvoices, emitInvoiceForOrder } from '@/lib/firebase/firestore'
import { Order, Invoice } from '@/lib/types'

function openDocument(content: string, number: string) {
  const blob = new Blob([content], { type: 'text/html' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.target = '_blank'
  a.download = `nf-teste-${number}.html`
  a.click()
  URL.revokeObjectURL(url)
}

export default function InvoicesPage() {
  const { clientId } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [emitting, setEmitting] = useState(false)

  useEffect(() => {
    if (!clientId) return
    const u1 = watchOrders(clientId, setOrders)
    const u2 = watchInvoices(clientId, setInvoices)
    return () => {
      u1()
      u2()
    }
  }, [clientId])

  const pending = useMemo(
    () => orders.filter((o) => o.status === 'completed' && o.invoiceRequested && !o.invoiceId),
    [orders]
  )

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(selected.size === pending.length ? new Set() : new Set(pending.map((o) => o.id)))
  }

  const emitSelected = async () => {
    if (!clientId || selected.size === 0) return
    setEmitting(true)
    for (const orderId of selected) {
      const order = pending.find((o) => o.id === orderId)
      if (order) await emitInvoiceForOrder(clientId, order)
    }
    setSelected(new Set())
    setEmitting(false)
  }

  return (
    <div>
      <h1 className="mb-2 text-2xl font-bold text-gray-900">Notas Fiscais</h1>
      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠ Modo de teste: nenhum provedor de NF (eNotas ou outro) está configurado ainda. As emissões abaixo
        geram um documento de exemplo, sem valor fiscal, só para validar o fluxo.
      </div>

      <div className="mb-8 rounded-xl border border-gray-200 bg-white">
        <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Aguardando emissão ({pending.length})
          </h2>
          {pending.length > 0 && (
            <button
              onClick={emitSelected}
              disabled={selected.size === 0 || emitting}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {emitting ? 'Emitindo...' : `Emitir selecionadas (${selected.size})`}
            </button>
          )}
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">
                  {pending.length > 0 && (
                    <input
                      type="checkbox"
                      checked={selected.size === pending.length}
                      onChange={toggleAll}
                    />
                  )}
                </th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Concluída em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pending.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                    />
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{o.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.vehiclePlate} · {o.vehicleModel}
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.executionCompletedAt
                      ? new Date(o.executionCompletedAt).toLocaleDateString('pt-BR')
                      : '—'}
                  </td>
                </tr>
              ))}
              {pending.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma OS aguardando emissão
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">Emitidas</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Número</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Emitida em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {invoices.map((inv) => (
                <tr key={inv.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{inv.number}</td>
                  <td className="px-4 py-3 text-gray-600">{inv.customerName}</td>
                  <td className="px-4 py-3 text-gray-600 uppercase">{inv.kind}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {inv.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(inv.issuedAt).toLocaleString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() => openDocument(inv.documentContent, inv.number)}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Ver documento
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    Nenhuma NF emitida ainda
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
