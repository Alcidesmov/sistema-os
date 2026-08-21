'use client'

import { Suspense, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useParams, useSearchParams } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchOrder, watchCustomers, getClient } from '@/lib/firebase/firestore'
import { Order, Customer, Client } from '@/lib/types'
import { money, dateBR, vehicleLabel, orderLabel } from '@/lib/orders/format'

type Modo = 'orcamento' | 'os'

/**
 * Folha A4 pra impressão — orçamento (assinatura do cliente) ou O.S. de
 * bancada (queixa + espaço pro mecânico anotar). A casca do sistema
 * (menu, topo, botão de melhorias) some no `@media print` de
 * `app/globals.css`; os controles de tela (voltar, botão Imprimir) somem
 * junto por levarem a classe `no-print`.
 */
function ImprimirContent() {
  const params = useParams<{ id: string }>()
  const searchParams = useSearchParams()
  const modo: Modo = searchParams.get('doc') === 'os' ? 'os' : 'orcamento'
  const { clientId } = useClientId()

  const [order, setOrder] = useState<Order | null>(null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [client, setClient] = useState<Client | null>(null)

  useEffect(() => {
    if (!clientId || !params.id) return
    const u1 = watchOrder(clientId, params.id, setOrder)
    const u2 = watchCustomers(clientId, setCustomers)
    return () => {
      u1()
      u2()
    }
  }, [clientId, params.id])

  useEffect(() => {
    if (!clientId) return
    getClient(clientId).then(setClient)
  }, [clientId])

  const customer = useMemo(
    () => customers.find((c) => c.id === order?.customerId),
    [customers, order]
  )

  if (!clientId || !order || !client) {
    return <p className="p-6 text-sm text-gray-500 no-print">Carregando...</p>
  }

  const itens = order.items ?? []

  return (
    <div className="min-h-screen bg-gray-100 py-8 print:min-h-0 print:bg-white print:py-0">
      <div className="no-print mx-auto mb-4 flex max-w-[210mm] items-center justify-between px-2">
        <Link href={`/orders/${order.id}`} className="text-sm text-gray-500 hover:text-gray-700">
          ← Voltar para a O.S.
        </Link>
        <button
          type="button"
          onClick={() => window.print()}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          Imprimir
        </button>
      </div>

      <div className="print-sheet mx-auto max-w-[210mm] bg-white p-[15mm] text-gray-900 shadow print:max-w-full print:p-0 print:shadow-none">
        {/* CABEÇALHO DA OFICINA */}
        <div className="mb-6 flex items-start justify-between gap-4 border-b border-gray-300 pb-4">
          <div>
            <h1 className="text-lg font-bold text-gray-900">
              {client.nomeFantasia || client.name || 'Oficina'}
            </h1>
            {client.razaoSocial && <p className="text-xs text-gray-600">{client.razaoSocial}</p>}
            {client.cnpj && <p className="text-xs text-gray-600">CNPJ: {client.cnpj}</p>}
            {client.address && <p className="text-xs text-gray-600">{client.address}</p>}
            {(client.phone || client.email) && (
              <p className="text-xs text-gray-600">
                {[client.phone, client.email].filter(Boolean).join(' · ')}
              </p>
            )}
          </div>
          <div className="shrink-0 text-right">
            <p className="text-sm font-semibold text-gray-900">
              {modo === 'orcamento' ? 'Orçamento' : 'Ordem de Serviço'}
            </p>
            <p className="text-sm text-gray-700">{orderLabel(order)}</p>
            <p className="text-xs text-gray-500">{dateBR(order.createdAt)}</p>
          </div>
        </div>

        {/* CLIENTE E VEÍCULO */}
        <div className="mb-6 grid grid-cols-2 gap-4 text-sm">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Cliente</p>
            <p className="text-gray-900">{order.customerName}</p>
            {customer?.phone && <p className="text-gray-600">{customer.phone}</p>}
          </div>
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Veículo</p>
            <p className="text-gray-900">{vehicleLabel(order)}</p>
          </div>
        </div>

        {modo === 'os' && (
          <div className="mb-6">
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
              Queixa relatada
            </p>
            <p className="text-sm text-gray-800">{order.complaint || '—'}</p>
          </div>
        )}

        {/* ITENS */}
        <table className="mb-6 w-full text-sm">
          <thead>
            <tr className="border-b border-gray-300 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 font-medium">Item</th>
              <th className="py-2 text-right font-medium">Qtd</th>
              <th className="py-2 text-right font-medium">Unitário</th>
              <th className="py-2 text-right font-medium">Subtotal</th>
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr>
                <td colSpan={4} className="py-3 text-sm text-gray-400">
                  Nenhum item lançado.
                </td>
              </tr>
            ) : (
              itens.map((i) => (
                <tr key={i.itemId} className="border-b border-gray-100">
                  <td className="py-2">{i.description}</td>
                  <td className="py-2 text-right">{i.quantity}</td>
                  <td className="py-2 text-right">{money(i.unitPrice)}</td>
                  <td className="py-2 text-right">{money(i.subtotal)}</td>
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={3} className="pt-3 text-right text-sm font-semibold text-gray-900">
                Total
              </td>
              <td className="pt-3 text-right text-base font-bold text-gray-900">
                {money(order.totalValue)}
              </td>
            </tr>
          </tfoot>
        </table>

        {modo === 'orcamento' ? (
          <div className="mt-16 grid grid-cols-2 gap-8 text-center text-sm">
            <div className="border-t border-gray-400 pt-2 text-gray-700">Assinatura do cliente</div>
            <div className="border-t border-gray-400 pt-2 text-gray-700">Data: ____ / ____ / ______</div>
          </div>
        ) : (
          <div className="mt-10">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Anotações do mecânico
            </p>
            <div className="h-32 rounded border border-gray-300" />
          </div>
        )}
      </div>
    </div>
  )
}

export default function ImprimirOrderPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm text-gray-500">Carregando...</p>}>
      <ImprimirContent />
    </Suspense>
  )
}
