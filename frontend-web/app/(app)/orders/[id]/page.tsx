'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { doc, onSnapshot } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useClientId } from '@/lib/hooks/useClientId'
import { updateOrderStatus, requestInvoice } from '@/lib/firebase/firestore'
import { Order, OrderStatus } from '@/lib/types'

const STATUS_LABEL: Record<OrderStatus, string> = {
  diagnostico: 'Diagnóstico',
  em_servico: 'Em Serviço',
  finalizado: 'Finalizado',
  invoiced: 'Faturada',
}

export default function OrderDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { clientId } = useClientId()
  const [order, setOrder] = useState<Order | null>(null)
  const [deadline, setDeadline] = useState('')

  useEffect(() => {
    if (!clientId || !params.id) return
    const ref = doc(db, 'clients', clientId, 'orders', params.id)
    return onSnapshot(ref, (snap) => {
      if (snap.exists()) setOrder({ id: snap.id, ...snap.data() } as Order)
    })
  }, [clientId, params.id])

  if (!order || !clientId) {
    return <p className="text-sm text-gray-500">Carregando...</p>
  }

  const approveAndOpen = () => {
    const extra: Record<string, unknown> = {
      quoteApprovedAt: Date.now(),
      executionStartedAt: Date.now(),
    }
    if (deadline) extra.executionEstimatedEnd = new Date(deadline).getTime()
    updateOrderStatus(clientId, order.id, 'em_servico', extra)
  }

  const complete = () =>
    updateOrderStatus(clientId, order.id, 'finalizado', { executionCompletedAt: Date.now() })

  const askInvoice = () => requestInvoice(clientId, order.id)

  return (
    <div className="max-w-2xl">
      <button
        onClick={() => router.push('/orders')}
        className="mb-4 text-sm text-gray-500 hover:text-gray-700"
      >
        ← Voltar
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{order.customerName}</h1>
            <p className="text-sm text-gray-500">
              {order.vehiclePlate} · {order.vehicleModel}
            </p>
          </div>
          <span className="rounded-full bg-gray-100 px-3 py-1 text-xs font-medium text-gray-700">
            {STATUS_LABEL[order.status]}
          </span>
        </div>

        <div className="mb-4 space-y-1 border-t border-gray-100 pt-4">
          {order.items.map((i) => (
            <div key={i.itemId} className="flex justify-between text-sm">
              <span>
                {i.quantity}x {i.description}
              </span>
              <span className="text-gray-600">
                {i.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
              </span>
            </div>
          ))}
          <div className="flex justify-between border-t border-gray-100 pt-2 text-sm font-semibold">
            <span>Total</span>
            <span>{order.totalValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}</span>
          </div>
        </div>

        <div className="space-y-3 border-t border-gray-100 pt-4 text-sm text-gray-600">
          {order.quoteApprovedAt && (
            <p>Orçamento aprovado em {new Date(order.quoteApprovedAt).toLocaleString('pt-BR')}</p>
          )}
          {order.executionStartedAt && (
            <p>Serviço iniciado em {new Date(order.executionStartedAt).toLocaleString('pt-BR')}</p>
          )}
          {order.executionEstimatedEnd && (
            <p>Prazo estimado: {new Date(order.executionEstimatedEnd).toLocaleDateString('pt-BR')}</p>
          )}
          {order.executionCompletedAt && (
            <p>Serviço concluído em {new Date(order.executionCompletedAt).toLocaleString('pt-BR')}</p>
          )}
          {order.invoiceRequested && order.status !== 'invoiced' && (
            <p>
              ✓ NF solicitada —{' '}
              <Link href="/invoices" className="text-blue-600 hover:underline">
                acompanhar na emissão em lote
              </Link>
            </p>
          )}
          {order.status === 'invoiced' && (
            <p>
              ✓ NF emitida —{' '}
              <Link href="/invoices" className="text-blue-600 hover:underline">
                ver documento
              </Link>
            </p>
          )}
        </div>

        {/* Workflow actions */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-gray-100 pt-4">
          {order.status === 'diagnostico' && (
            <div className="flex items-end gap-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">
                  Prazo de conclusão (opcional)
                </label>
                <input
                  type="date"
                  value={deadline}
                  onChange={(e) => setDeadline(e.target.value)}
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
              <button
                onClick={approveAndOpen}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Aprovar orçamento e abrir O.S.
              </button>
            </div>
          )}

          {order.status === 'em_servico' && (
            <button
              onClick={complete}
              className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
            >
              Concluir serviço
            </button>
          )}

          {order.status === 'finalizado' && !order.invoiceRequested && (
            <button
              onClick={askInvoice}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Marcar para emissão de NF
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
