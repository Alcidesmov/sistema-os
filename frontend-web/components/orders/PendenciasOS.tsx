'use client'

import { useState } from 'react'
import { Customer, Order } from '@/lib/types'
import { isCancelled, isOpen, statusOf } from '@/lib/orders/status'
import { localDateEnd } from '@/lib/orders/format'
import { updateCustomer, updateOrderFields } from '@/lib/firebase/firestore'

type PendenciaKey = 'veiculo' | 'itens' | 'prazo' | 'telefone'

interface PendenciasOSProps {
  clientId: string
  order: Order
  customer?: Customer
  /** Leva a pessoa até o bloco que resolve a pendência, dentro da própria O.S. */
  onGoTo: (target: 'veiculo' | 'itens') => void
}

/**
 * O que falta nesta O.S. — no topo, nunca como bloqueio.
 *
 * A O.S. nasce válida só com o cliente: veículo, itens, prazo e telefone
 * entram depois. Este bloco é o lembrete DO QUE FALTA, e cada linha é
 * resolvível aqui mesmo (ou leva ao bloco que resolve) — nunca é um aviso
 * mudo que só diz "está incompleto".
 */
export default function PendenciasOS({
  clientId,
  order,
  customer,
  onGoTo,
}: PendenciasOSProps) {
  const [prazo, setPrazo] = useState('')
  const [telefone, setTelefone] = useState('')
  const [saving, setSaving] = useState<PendenciaKey | null>(null)
  const [erro, setErro] = useState('')

  const s = statusOf(order)
  const cancelada = isCancelled(order)

  const pendencias: PendenciaKey[] = []
  if (!cancelada) {
    if (!order.vehicleId) pendencias.push('veiculo')
    if (!order.items || order.items.length === 0) pendencias.push('itens')
    if (isOpen(order) && !order.executionEstimatedEnd) pendencias.push('prazo')
    if (customer && !customer.phone) pendencias.push('telefone')
  }

  if (pendencias.length === 0) return null

  const salvarPrazo = async () => {
    const ms = localDateEnd(prazo)
    if (!ms) return
    setSaving('prazo')
    setErro('')
    try {
      await updateOrderFields(clientId, order.id, { executionEstimatedEnd: ms })
      setPrazo('')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível salvar o prazo.')
    }
    setSaving(null)
  }

  const salvarTelefone = async () => {
    if (!customer || !telefone.trim()) return
    setSaving('telefone')
    setErro('')
    try {
      await updateCustomer(clientId, customer.id, { phone: telefone.trim() })
      setTelefone('')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível salvar o telefone.')
    }
    setSaving(null)
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4">
      <div className="mb-3 flex items-baseline gap-2">
        <h2 className="text-sm font-semibold text-amber-900">
          Falta completar nesta O.S.
        </h2>
        <span className="text-xs text-amber-700">
          {pendencias.length} pendência{pendencias.length > 1 ? 's' : ''} — a O.S. continua
          válida, isto aqui só não deixa esquecer
        </span>
      </div>

      <div className="space-y-2">
        {pendencias.includes('veiculo') && (
          <Linha
            titulo="Sem veículo"
            explicacao="A O.S. está aberta no nome do cliente. Vincule o carro quando ele chegar."
          >
            <button
              type="button"
              onClick={() => onGoTo('veiculo')}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100"
            >
              Definir veículo agora
            </button>
          </Linha>
        )}

        {pendencias.includes('itens') && (
          <Linha
            titulo="Sem itens"
            explicacao={
              s === 'diagnostico'
                ? 'Sem nenhum item o orçamento fecha em R$ 0,00 e não dá para aprovar.'
                : 'Esta O.S. está sem nenhum serviço ou peça lançado.'
            }
          >
            <button
              type="button"
              onClick={() => onGoTo('itens')}
              className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100"
            >
              Adicionar itens
            </button>
          </Linha>
        )}

        {pendencias.includes('prazo') && (
          <Linha
            titulo="Sem prazo"
            explicacao="Sem data prevista, a O.S. nunca aparece como atrasada na esteira."
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={prazo}
                onChange={(e) => setPrazo(e.target.value)}
                className="rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={salvarPrazo}
                disabled={!prazo || saving === 'prazo'}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-50"
              >
                {saving === 'prazo' ? 'Salvando...' : 'Salvar prazo'}
              </button>
            </div>
          </Linha>
        )}

        {pendencias.includes('telefone') && customer && (
          <Linha
            titulo="Sem telefone do cliente"
            explicacao={`${customer.name} está cadastrado sem telefone — não dá para avisar quando o carro ficar pronto.`}
          >
            <div className="flex flex-wrap items-center gap-2">
              <input
                value={telefone}
                onChange={(e) => setTelefone(e.target.value)}
                placeholder="(00) 00000-0000"
                className="w-40 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-xs"
              />
              <button
                type="button"
                onClick={salvarTelefone}
                disabled={!telefone.trim() || saving === 'telefone'}
                className="rounded-lg bg-white px-3 py-1.5 text-xs font-medium text-amber-800 ring-1 ring-amber-300 hover:bg-amber-100 disabled:opacity-50"
              >
                {saving === 'telefone' ? 'Salvando...' : 'Salvar telefone'}
              </button>
            </div>
          </Linha>
        )}
      </div>

      {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
    </section>
  )
}

function Linha({
  titulo,
  explicacao,
  children,
}: {
  titulo: string
  explicacao: string
  children: React.ReactNode
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg bg-white/70 px-3 py-2">
      <div className="min-w-[200px] flex-1">
        <p className="text-sm font-medium text-amber-900">{titulo}</p>
        <p className="text-xs text-amber-700">{explicacao}</p>
      </div>
      {children}
    </div>
  )
}
