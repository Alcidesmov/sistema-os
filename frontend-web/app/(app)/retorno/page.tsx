'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchOrders } from '@/lib/firebase/firestore'
import { Order } from '@/lib/types'
import { normalize } from '@/lib/utils/search'
import { dateBR } from '@/lib/orders/format'
import {
  RETURN_LEVEL_PRIORITY,
  ReturnPanelItem,
  ReturnPanelLevel,
  returnPanelItemsOf,
} from '@/lib/orders/km'

const LEVEL_STYLE: Record<ReturnPanelLevel, string> = {
  atrasado: 'border-red-300 bg-red-50',
  proximo: 'border-amber-300 bg-amber-50',
  programado: 'border-blue-200 bg-blue-50',
  sem_estimativa: 'border-gray-200 bg-gray-50',
}

const LEVEL_BADGE: Record<ReturnPanelLevel, string> = {
  atrasado: 'bg-red-100 text-red-800',
  proximo: 'bg-amber-100 text-amber-800',
  programado: 'bg-blue-100 text-blue-800',
  sem_estimativa: 'bg-gray-200 text-gray-600',
}

const LEVEL_LABEL: Record<ReturnPanelLevel, string> = {
  atrasado: 'Provável atraso',
  proximo: 'Deve estar próximo',
  programado: 'Dentro do previsto',
  sem_estimativa: 'Sem histórico suficiente',
}

function vehicleLabelOf(item: Pick<ReturnPanelItem, 'vehiclePlate' | 'vehicleModel'>): string {
  const parts = [item.vehiclePlate, item.vehicleModel].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Veículo sem placa'
}

/**
 * Painel de Retorno: uma "colmeia" de cartões, um por veículo com km
 * registrado em algum atendimento, ordenados do mais provável de já estar
 * na hora de voltar pro menos. Complementa o aviso que já existe DENTRO
 * de cada O.S. (KmDaOS) — aqui é a visão de "quem eu deveria ligar hoje",
 * sem precisar abrir veículo por veículo.
 */
export default function RetornoPage() {
  const { clientId } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!clientId) return
    return watchOrders(clientId, setOrders)
  }, [clientId])

  const items = useMemo(() => returnPanelItemsOf(orders), [orders])

  const ordenados = useMemo(
    () =>
      [...items].sort((a, b) => {
        const p = RETURN_LEVEL_PRIORITY[a.level] - RETURN_LEVEL_PRIORITY[b.level]
        if (p !== 0) return p
        // Dentro do mesmo nível, quem está há mais tempo sem voltar primeiro.
        return b.daysSinceLastVisit - a.daysSinceLastVisit
      }),
    [items]
  )

  const filtrados = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return ordenados
    return ordenados.filter((it) =>
      normalize(`${it.customerName} ${vehicleLabelOf(it)}`).includes(q)
    )
  }, [ordenados, query])

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Painel de Retorno</h1>
      <p className="mb-4 text-sm text-gray-500">
        Um cartão por veículo com km registrado em alguma O.S. — pra ver de relance quem já deve
        estar na hora de voltar pra revisão. Sem sensor no carro, a estimativa de km de hoje só
        aparece quando o veículo já tem 2 visitas com km registrado; com só uma, o cartão mostra a
        última visita e o km-alvo, sem alegar atraso.
      </p>

      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Buscar por cliente ou veículo
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome do cliente, placa ou modelo..."
          autoFocus
          className="w-full max-w-lg rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query.trim() && (
          <p className="mt-1 text-xs text-gray-500">
            {filtrados.length} de {ordenados.length} veículos
          </p>
        )}
      </div>

      {filtrados.length === 0 ? (
        <div className="rounded-xl border border-gray-200 bg-white p-8 text-center text-gray-400">
          {items.length === 0
            ? 'Nenhum veículo com km registrado ainda — registre o km de entrada numa O.S. para começar a aparecer aqui.'
            : 'Nenhum veículo encontrado pra essa busca.'}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filtrados.map((it) => (
            <Link
              key={it.vehicleId}
              href={`/vehicles/${it.vehicleId}`}
              className={`rounded-xl border p-3 transition-shadow hover:shadow-md ${LEVEL_STYLE[it.level]}`}
            >
              <span
                className={`mb-2 inline-block rounded-full px-2 py-0.5 text-[11px] font-medium ${LEVEL_BADGE[it.level]}`}
              >
                {LEVEL_LABEL[it.level]}
              </span>
              <p className="truncate text-sm font-semibold text-gray-900" title={it.customerName}>
                {it.customerName}
              </p>
              <p className="truncate text-xs text-gray-600" title={vehicleLabelOf(it)}>
                {vehicleLabelOf(it)}
              </p>
              <p className="mt-2 text-xs text-gray-500">
                Alvo: {it.targetKm.toLocaleString('pt-BR')} km
              </p>
              {it.estimatedCurrentKm != null ? (
                <p className="text-xs text-gray-500">
                  ≈ hoje em {it.estimatedCurrentKm.toLocaleString('pt-BR')} km (estimado)
                </p>
              ) : (
                <p className="text-xs text-gray-500">
                  Última visita há {it.daysSinceLastVisit}{' '}
                  {it.daysSinceLastVisit === 1 ? 'dia' : 'dias'} ({dateBR(it.lastOrder.createdAt)})
                </p>
              )}
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
