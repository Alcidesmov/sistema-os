'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Order,
  OrderEvent,
  ApprovalChannel,
  APPROVAL_CHANNEL_LABEL,
  PaymentMethod,
  PAYMENT_METHOD_LABEL,
} from '@/lib/types'
import { statusOf, invoiceStatusOf, isCancelled } from '@/lib/orders/status'
import { money, dateTimeBR, localDateEnd } from '@/lib/orders/format'
import {
  approveOrder,
  completeOrder,
  deliverOrder,
  requestInvoice,
  cancelOrder,
  deleteDraftOrder,
  watchOrderHistory,
} from '@/lib/firebase/firestore'

interface AcoesDaOSProps {
  clientId: string
  order: Order
  by: string
}

/**
 * Onde vivem os GATES do workflow — nunca na criação da O.S. (ver
 * PendenciasOS: a O.S. nasce válida só com o cliente). Cada botão
 * bloqueado explica o motivo por escrito embaixo dele (regra R2): nenhum
 * botão cinza fica mudo.
 */
export default function AcoesDaOS({ clientId, order, by }: AcoesDaOSProps) {
  const router = useRouter()
  const s = statusOf(order)
  const cancelada = isCancelled(order)
  const invStatus = invoiceStatusOf(order)
  const itens = order.items ?? []
  const rascunho = s === 'diagnostico' && itens.length === 0 && !order.quoteApprovedAt

  const [history, setHistory] = useState<OrderEvent[]>([])
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  useEffect(() => watchOrderHistory(clientId, order.id, setHistory), [clientId, order.id])

  // --- Apagar rascunho ---
  const apagarRascunho = async () => {
    if (!window.confirm('Apagar este rascunho? Não dá para desfazer.')) return
    setSalvando(true)
    setErro('')
    try {
      await deleteDraftOrder(clientId, order)
      router.push('/orders')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível apagar o rascunho.')
      setSalvando(false)
    }
  }

  // --- Aprovar orçamento ---
  const [aprovando, setAprovando] = useState(false)
  const [aprovadoPor, setAprovadoPor] = useState('')
  const [canal, setCanal] = useState<ApprovalChannel>('presencial')
  const [obsAprovacao, setObsAprovacao] = useState('')
  const [prazoAprovacao, setPrazoAprovacao] = useState('')

  const confirmarAprovacao = async () => {
    if (!aprovadoPor.trim()) return
    setSalvando(true)
    setErro('')
    try {
      const prazoMs = localDateEnd(prazoAprovacao)
      await approveOrder(clientId, order.id, {
        approvedBy: aprovadoPor.trim(),
        approvalChannel: canal,
        ...(obsAprovacao.trim() ? { approvalNote: obsAprovacao.trim() } : {}),
        ...(prazoMs ? { executionEstimatedEnd: prazoMs } : {}),
      })
      setAprovando(false)
      setAprovadoPor('')
      setObsAprovacao('')
      setPrazoAprovacao('')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível aprovar o orçamento.')
    }
    setSalvando(false)
  }

  // --- Concluir serviço ---
  const concluir = async () => {
    setSalvando(true)
    setErro('')
    try {
      await completeOrder(clientId, order.id, by)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível concluir o serviço.')
    }
    setSalvando(false)
  }

  // --- Entregar e receber (baixa) ---
  const [entregando, setEntregando] = useState(false)
  const [formaPagamento, setFormaPagamento] = useState<PaymentMethod>('dinheiro')
  const [valorRecebido, setValorRecebido] = useState(String(order.totalValue || 0))

  const confirmarEntrega = async () => {
    const valor = parseFloat(valorRecebido.replace(',', '.'))
    if (Number.isNaN(valor)) return
    setSalvando(true)
    setErro('')
    try {
      await deliverOrder(clientId, order.id, { paymentMethod: formaPagamento, amountPaid: valor, by })
      setEntregando(false)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível dar baixa na O.S.')
    }
    setSalvando(false)
  }

  // --- Marcar para emissão de NF ---
  const marcarParaNF = async () => {
    setSalvando(true)
    setErro('')
    try {
      await requestInvoice(clientId, order.id)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível marcar para emissão de NF.')
    }
    setSalvando(false)
  }

  // --- Cancelar O.S. ---
  const [cancelando, setCancelando] = useState(false)
  const [motivoCancelamento, setMotivoCancelamento] = useState('')

  const confirmarCancelamento = async () => {
    if (!motivoCancelamento.trim()) return
    setSalvando(true)
    setErro('')
    try {
      await cancelOrder(clientId, order.id, motivoCancelamento.trim(), by)
      setCancelando(false)
      setMotivoCancelamento('')
    } catch (e) {
      console.error(e)
      setErro('Não foi possível cancelar a O.S.')
    }
    setSalvando(false)
  }

  return (
    <section className="space-y-5 rounded-xl border border-gray-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-gray-900">Ações</h2>

      {erro && (
        <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600">{erro}</p>
      )}

      {/* RASCUNHO */}
      {rascunho && !cancelada && (
        <div className="rounded-lg border border-dashed border-gray-300 p-3">
          <p className="text-sm text-gray-700">
            Esta O.S. ainda é um rascunho: em diagnóstico, sem itens, nunca aprovada.
          </p>
          <button
            type="button"
            onClick={apagarRascunho}
            disabled={salvando}
            className="mt-2 rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 disabled:opacity-50"
          >
            Apagar rascunho
          </button>
        </div>
      )}

      {/* APROVAR ORÇAMENTO */}
      {s === 'diagnostico' && (
        <div>
          {!aprovando ? (
            <>
              <button
                type="button"
                onClick={() => setAprovando(true)}
                disabled={itens.length === 0}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Aprovar orçamento
              </button>
              {itens.length === 0 && (
                <p className="mt-1 text-xs text-red-600">
                  Adicione pelo menos 1 item para aprovar — ninguém aprova orçamento de R$ 0,00.
                </p>
              )}
            </>
          ) : (
            <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50 p-3">
              <p className="text-sm font-medium text-blue-900">Aprovação do orçamento</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-blue-800">
                    Quem autorizou
                  </label>
                  <input
                    value={aprovadoPor}
                    onChange={(e) => setAprovadoPor(e.target.value)}
                    placeholder="Nome de quem autorizou"
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-blue-800">Canal</label>
                  <select
                    value={canal}
                    onChange={(e) => setCanal(e.target.value as ApprovalChannel)}
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm"
                  >
                    {(Object.keys(APPROVAL_CHANNEL_LABEL) as ApprovalChannel[]).map((c) => (
                      <option key={c} value={c}>
                        {APPROVAL_CHANNEL_LABEL[c]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-blue-800">
                    Observação (opcional)
                  </label>
                  <input
                    value={obsAprovacao}
                    onChange={(e) => setObsAprovacao(e.target.value)}
                    placeholder="Ex: aprovou só a troca de óleo"
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-blue-800">
                    Prazo de conclusão (opcional)
                  </label>
                  <input
                    type="date"
                    value={prazoAprovacao}
                    onChange={(e) => setPrazoAprovacao(e.target.value)}
                    className="w-full rounded-lg border border-blue-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={confirmarAprovacao}
                  disabled={salvando || !aprovadoPor.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando ? 'Aprovando...' : 'Confirmar aprovação'}
                </button>
                <button
                  type="button"
                  onClick={() => setAprovando(false)}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Cancelar
                </button>
                {!aprovadoPor.trim() && (
                  <p className="w-full text-xs text-blue-700">
                    Quem autorizou é obrigatório — é a prova de que alguém aprovou este orçamento.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* CONCLUIR SERVIÇO */}
      {s === 'em_servico' && (
        <button
          type="button"
          onClick={concluir}
          disabled={salvando}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {salvando ? 'Concluindo...' : 'Concluir serviço'}
        </button>
      )}

      {/* ENTREGAR E RECEBER (BAIXA) */}
      {s === 'finalizado' && !order.deliveredAt && (
        <div>
          {!entregando ? (
            <button
              type="button"
              onClick={() => setEntregando(true)}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700"
            >
              Entregar e receber (dar baixa)
            </button>
          ) : (
            <div className="space-y-3 rounded-lg border border-teal-200 bg-teal-50 p-3">
              <p className="text-sm font-medium text-teal-900">Entrega e recebimento</p>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-teal-800">
                    Forma de pagamento
                  </label>
                  <select
                    value={formaPagamento}
                    onChange={(e) => setFormaPagamento(e.target.value as PaymentMethod)}
                    className="w-full rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm"
                  >
                    {(Object.keys(PAYMENT_METHOD_LABEL) as PaymentMethod[]).map((p) => (
                      <option key={p} value={p}>
                        {PAYMENT_METHOD_LABEL[p]}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-teal-800">
                    Valor recebido
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={valorRecebido}
                    onChange={(e) => setValorRecebido(e.target.value)}
                    className="w-full rounded-lg border border-teal-300 bg-white px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={confirmarEntrega}
                  disabled={salvando || Number.isNaN(parseFloat(valorRecebido.replace(',', '.')))}
                  className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Confirmar entrega e recebimento'}
                </button>
                <button
                  type="button"
                  onClick={() => setEntregando(false)}
                  className="text-xs font-medium text-teal-700 hover:underline"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* MARCAR PARA EMISSÃO DE NF */}
      {(s === 'finalizado' || s === 'entregue') && invStatus === 'none' && (
        <button
          type="button"
          onClick={marcarParaNF}
          disabled={salvando}
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
        >
          Marcar para emissão de NF
        </button>
      )}
      {invStatus === 'requested' && (
        <p className="text-xs text-gray-500">
          NF solicitada —{' '}
          <Link href="/invoices" className="text-blue-600 hover:underline">
            acompanhar na emissão em lote
          </Link>
        </p>
      )}
      {invStatus === 'issued' && (
        <p className="text-xs text-gray-500">
          NF emitida —{' '}
          <Link href="/invoices" className="text-blue-600 hover:underline">
            ver documento
          </Link>
        </p>
      )}

      {/* PROVA DA APROVAÇÃO */}
      {order.approvedBy && (
        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          <p>
            Orçamento aprovado por <strong className="text-gray-900">{order.approvedBy}</strong>
            {order.approvalChannel && ` via ${APPROVAL_CHANNEL_LABEL[order.approvalChannel]}`}
            {order.quoteApprovedAt && ` em ${dateTimeBR(order.quoteApprovedAt)}`}.
          </p>
          {order.approvalNote && <p className="mt-1">Obs: {order.approvalNote}</p>}
        </div>
      )}

      {/* ENTREGA */}
      {order.deliveredAt && (
        <div className="rounded-lg bg-gray-50 p-3 text-xs text-gray-600">
          Entregue e recebido em {dateTimeBR(order.deliveredAt)}
          {order.paymentMethod && ` — ${PAYMENT_METHOD_LABEL[order.paymentMethod]}`}
          {typeof order.amountPaid === 'number' && ` — ${money(order.amountPaid)}`}
        </div>
      )}

      {/* CANCELAMENTO */}
      {cancelada ? (
        <div className="rounded-lg bg-gray-100 p-3 text-xs text-gray-600">
          O.S. cancelada em {dateTimeBR(order.cancelledAt)}
          {order.cancelReason && ` — motivo: ${order.cancelReason}`}
        </div>
      ) : (
        <div className="border-t border-gray-100 pt-4">
          {!cancelando ? (
            <button
              type="button"
              onClick={() => setCancelando(true)}
              className="text-xs font-medium text-red-600 hover:underline"
            >
              Cancelar O.S.
            </button>
          ) : (
            <div className="space-y-2 rounded-lg border border-red-200 bg-red-50 p-3">
              <label className="block text-xs font-medium text-red-800">
                Motivo do cancelamento (obrigatório)
              </label>
              <textarea
                value={motivoCancelamento}
                onChange={(e) => setMotivoCancelamento(e.target.value)}
                rows={2}
                className="w-full rounded-lg border border-red-300 bg-white px-3 py-2 text-sm"
                placeholder="Por que esta O.S. está sendo cancelada?"
              />
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={confirmarCancelamento}
                  disabled={salvando || !motivoCancelamento.trim()}
                  className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
                >
                  {salvando ? 'Cancelando...' : 'Confirmar cancelamento'}
                </button>
                <button
                  type="button"
                  onClick={() => setCancelando(false)}
                  className="text-xs font-medium text-red-700 hover:underline"
                >
                  Voltar
                </button>
                {!motivoCancelamento.trim() && (
                  <p className="w-full text-xs text-red-600">
                    O motivo é obrigatório para cancelar — fica no histórico da O.S.
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* HISTÓRICO */}
      <div className="border-t border-gray-100 pt-4">
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
          Histórico
        </h3>
        {history.length === 0 ? (
          <p className="text-xs text-gray-400">Nenhuma alteração registrada ainda.</p>
        ) : (
          <ul className="space-y-1.5">
            {history.map((h) => (
              <li key={h.id} className="text-xs text-gray-600">
                <span className="text-gray-400">{dateTimeBR(h.at)}</span> — {h.action}
                {h.detail && <span className="text-gray-500"> ({h.detail})</span>}
                {h.by && <span className="text-gray-400"> · {h.by}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  )
}
