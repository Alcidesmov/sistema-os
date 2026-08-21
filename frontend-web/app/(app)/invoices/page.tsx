'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchOrders, watchInvoices, emitInvoiceForOrder } from '@/lib/firebase/firestore'
import { Order, Invoice } from '@/lib/types'
import { invoiceStatusOf, isCancelled, statusLabelOf, statusColorOf } from '@/lib/orders/status'
import {
  money,
  dateBR,
  dateTimeBR,
  vehicleLabel,
  orderLabel,
  completedAtOf,
  localDateStart,
  localDateEnd,
} from '@/lib/orders/format'
import { normalize } from '@/lib/utils/search'

/**
 * Abre o documento numa aba nova.
 *
 * A versão anterior criava um <a> com target="_blank" E download="..." —
 * o atributo download vence o target, então o arquivo caía calado na
 * pasta Downloads e o botão parecia quebrado. window.open mostra o
 * documento na hora. A blob URL só é revogada depois de um tempo: revogar
 * na mesma linha (como era feito antes) mata a URL antes de a aba nova
 * terminar de carregar.
 */
function openDocument(content: string) {
  const blob = new Blob([content], { type: 'text/html;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const win = window.open(url, '_blank')
  if (!win) {
    URL.revokeObjectURL(url)
    alert(
      'O navegador bloqueou a janela do documento. Libere os pop-ups para este endereço e tente de novo.'
    )
    return
  }
  setTimeout(() => URL.revokeObjectURL(url), 60000)
}

interface EmitResult {
  ok: number
  failed: string[]
  lastError?: string
}

/**
 * Uma linha da tabela "Emitidas". Junta as notas gravadas em
 * clients/{id}/invoices com as O.S. LEGADAS — as que ficaram com
 * status 'invoiced' no banco antes da v0.5.0 e podem não ter documento
 * guardado. Sem isso, uma O.S. já faturada simplesmente não apareceria
 * em lugar nenhum desta tela.
 */
interface EmittedRow {
  key: string
  orderId: string
  order?: Order
  invoiceNumber?: string
  kind?: string
  customerName: string
  totalValue: number
  at: number
  documentContent?: string
  legacy: boolean
}

export default function InvoicesPage() {
  const { clientId } = useClientId()
  const [orders, setOrders] = useState<Order[]>([])
  const [invoices, setInvoices] = useState<Invoice[]>([])
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [emitting, setEmitting] = useState(false)
  const [result, setResult] = useState<EmitResult | null>(null)

  const [q, setQ] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')

  useEffect(() => {
    if (!clientId) return
    const u1 = watchOrders(clientId, setOrders)
    const u2 = watchInvoices(clientId, setInvoices)
    return () => {
      u1()
      u2()
    }
  }, [clientId])

  const ordersById = useMemo(() => {
    const m = new Map<string, Order>()
    for (const o of orders) m.set(o.id, o)
    return m
  }, [orders])

  const fromMs = useMemo(() => localDateStart(from), [from])
  const toMs = useMemo(() => localDateEnd(to), [to])

  const inPeriod = (ms?: number) => {
    if (!ms) return !fromMs && !toMs
    if (fromMs && ms < fromMs) return false
    if (toMs && ms > toMs) return false
    return true
  }

  const term = normalize(q.trim())

  const matchesOrder = (o: Order, extra: string[] = []) => {
    if (!term) return true
    const haystack = [
      o.customerName,
      orderLabel(o),
      String(o.number ?? ''),
      vehicleLabel(o, ''),
      ...extra,
    ]
      .filter(Boolean)
      .join(' ')
    return normalize(haystack).includes(term)
  }

  /**
   * A fila agora é DERIVADA (invoiceStatusOf), não mais um status gravado:
   * é toda O.S. marcada para emissão que ainda não tem invoiceId. O.S.
   * legadas com status 'invoiced' caem em 'issued' e ficam de fora, como
   * deve ser.
   */
  const pending = useMemo(
    () =>
      orders
        .filter((o) => !isCancelled(o) && invoiceStatusOf(o) === 'requested')
        // Quem espera há mais tempo aparece primeiro.
        .sort((a, b) => completedAtOf(a) - completedAtOf(b)),
    [orders]
  )

  const visiblePending = useMemo(
    () => pending.filter((o) => matchesOrder(o) && inPeriod(completedAtOf(o))),
    [pending, term, fromMs, toMs]
  )

  const emittedRows = useMemo<EmittedRow[]>(() => {
    const rows: EmittedRow[] = invoices.map((inv) => ({
      key: inv.id,
      orderId: inv.orderId,
      order: ordersById.get(inv.orderId),
      invoiceNumber: inv.number,
      kind: inv.kind,
      customerName: inv.customerName,
      totalValue: inv.totalValue,
      at: inv.issuedAt,
      documentContent: inv.documentContent,
      legacy: false,
    }))

    const withDoc = new Set(invoices.map((i) => i.orderId))
    for (const o of orders) {
      if (invoiceStatusOf(o) !== 'issued') continue
      if (withDoc.has(o.id)) continue
      rows.push({
        key: `legacy-${o.id}`,
        orderId: o.id,
        order: o,
        customerName: o.customerName,
        totalValue: o.totalValue,
        at: completedAtOf(o),
        legacy: true,
      })
    }

    return rows.sort((a, b) => b.at - a.at)
  }, [invoices, orders, ordersById])

  const visibleEmitted = useMemo(
    () =>
      emittedRows.filter((r) => {
        if (!inPeriod(r.at)) return false
        if (!term) return true
        const o = r.order
        const haystack = [
          r.customerName,
          r.invoiceNumber ?? '',
          o ? orderLabel(o) : '',
          o ? String(o.number ?? '') : '',
          o ? vehicleLabel(o, '') : '',
        ]
          .filter(Boolean)
          .join(' ')
        return normalize(haystack).includes(term)
      }),
    [emittedRows, term, fromMs, toMs]
  )

  // Só conta o que está selecionado E visível: com filtro ativo, emitir
  // uma O.S. escondida seria uma surpresa.
  const selectedOrders = useMemo(
    () => visiblePending.filter((o) => selected.has(o.id)),
    [visiblePending, selected]
  )

  const pendingTotal = visiblePending.reduce((s, o) => s + (o.totalValue || 0), 0)
  const emittedTotal = visibleEmitted.reduce((s, r) => s + (r.totalValue || 0), 0)

  // Fica escrito na tela por que ainda não dá pra emitir (nada de botão
  // cinza e mudo).
  const blockedReason = emitting
    ? 'Emitindo... não feche a página até terminar.'
    : pending.length === 0
      ? 'Nenhuma O.S. marcada para emissão. A marcação é feita dentro da O.S., no botão "Marcar para emissão de NF".'
      : visiblePending.length === 0
        ? 'Nenhuma O.S. da fila bate com a busca/período — limpe os filtros para ver as demais.'
        : selectedOrders.length === 0
          ? 'Selecione ao menos uma O.S. da fila abaixo para liberar a emissão.'
          : ''

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const allVisibleSelected =
    visiblePending.length > 0 && selectedOrders.length === visiblePending.length

  const toggleAll = () => {
    setSelected(allVisibleSelected ? new Set() : new Set(visiblePending.map((o) => o.id)))
  }

  /**
   * Emissão em lote tolerante a falha: cada O.S. tem seu próprio try, e o
   * setEmitting(false) mora no finally. Antes, um erro de rede no meio do
   * loop deixava o botão preso em "Emitindo..." para sempre, sem nenhuma
   * mensagem. Agora o resultado é escrito na tela e as que falharam
   * continuam selecionadas, prontas pra nova tentativa.
   */
  const emitSelected = async () => {
    if (!clientId || selectedOrders.length === 0 || emitting) return
    setEmitting(true)
    setResult(null)

    let ok = 0
    const failed: string[] = []
    const failedIds = new Set<string>()
    let lastError: string | undefined

    try {
      for (const order of selectedOrders) {
        try {
          await emitInvoiceForOrder(clientId, order)
          ok += 1
        } catch (err) {
          console.error('Falha ao emitir NF da O.S.', order.id, err)
          failed.push(orderLabel(order))
          failedIds.add(order.id)
          lastError = err instanceof Error ? err.message : String(err)
        }
      }
    } finally {
      setSelected(failedIds)
      setResult({ ok, failed, lastError })
      setEmitting(false)
    }
  }

  const clearFilters = () => {
    setQ('')
    setFrom('')
    setTo('')
  }

  const hasFilter = Boolean(q || from || to)

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-bold text-gray-900">Notas Fiscais</h1>
        <Link
          href="/orders"
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          Ver todas as O.S. →
        </Link>
      </div>
      <p className="mb-4 text-sm text-gray-500">
        Último estágio da esteira: a O.S. é marcada para emissão dentro dela, cai na fila abaixo e
        sai daqui como nota emitida. Emitir a nota não muda mais o estágio de trabalho da O.S.
      </p>

      <div className="mb-6 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800">
        ⚠ Modo de teste: nenhum provedor de NF (eNotas/Nota Gateway ou outro) está configurado
        ainda. As emissões abaixo geram um documento de exemplo, sem valor fiscal, só para validar o
        fluxo.
      </div>

      {/* Busca sempre primeiro na tela (CLAUDE.md 6.11) e sem botão de
          "pesquisar": filtra ao digitar. */}
      <div className="mb-6 rounded-xl border border-gray-200 bg-white p-4">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-gray-600">Buscar</label>
            <input
              autoFocus
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="cliente, nº da O.S., placa ou nº da nota"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">De</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Até</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          </div>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
          <p className="text-xs text-gray-500">
            O período filtra a fila pela data de conclusão do serviço e as emitidas pela data da
            nota.
          </p>
          {hasFilter && (
            <button
              onClick={clearFilters}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Limpar filtros
            </button>
          )}
        </div>
      </div>

      {result && (
        <div
          className={`mb-6 rounded-lg border px-4 py-3 text-sm ${
            result.failed.length
              ? 'border-red-300 bg-red-50 text-red-800'
              : 'border-green-300 bg-green-50 text-green-800'
          }`}
        >
          <p className="font-medium">
            {result.ok} {result.ok === 1 ? 'nota emitida' : 'notas emitidas'}
            {result.failed.length > 0 &&
              ` · ${result.failed.length} ${
                result.failed.length === 1 ? 'falhou' : 'falharam'
              } (${result.failed.join(', ')})`}
          </p>
          {result.failed.length > 0 && (
            <p className="mt-1 text-xs">
              As que falharam continuam selecionadas na fila — dá pra tentar de novo.
              {result.lastError ? ` Último erro: ${result.lastError}` : ''}
            </p>
          )}
        </div>
      )}

      <div className="mb-8 rounded-xl border border-gray-200 bg-white">
        <div className="flex flex-wrap items-start justify-between gap-3 border-b border-gray-100 px-4 py-3">
          <div>
            <h2 className="text-sm font-semibold text-gray-900">
              Aguardando emissão ({visiblePending.length}
              {visiblePending.length !== pending.length ? ` de ${pending.length}` : ''})
            </h2>
            <p className="mt-0.5 text-xs text-gray-500">
              Total das O.S. da fila: <span className="font-medium">{money(pendingTotal)}</span> —
              cada linha abre a O.S. que gerou o valor.
            </p>
          </div>
          <div className="text-right">
            <button
              onClick={emitSelected}
              disabled={Boolean(blockedReason)}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {emitting ? 'Emitindo...' : `Emitir selecionadas (${selectedOrders.length})`}
            </button>
            {blockedReason && (
              <p className="mt-1 max-w-xs text-right text-xs text-gray-500">{blockedReason}</p>
            )}
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allVisibleSelected}
                    disabled={visiblePending.length === 0}
                    onChange={toggleAll}
                    title="Selecionar todas as O.S. visíveis"
                  />
                </th>
                <th className="px-4 py-3">O.S.</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Concluída em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visiblePending.map((o) => (
                <tr key={o.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selected.has(o.id)}
                      onChange={() => toggle(o.id)}
                    />
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/orders/${o.id}`}
                      className="font-medium text-blue-600 hover:underline"
                    >
                      {orderLabel(o)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 font-medium text-gray-900">{o.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">{vehicleLabel(o)}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${statusColorOf(o)}`}
                    >
                      {statusLabelOf(o)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{money(o.totalValue)}</td>
                  <td className="px-4 py-3 text-gray-500">{dateBR(o.executionCompletedAt)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/orders/${o.id}`}
                      className="text-xs font-medium text-blue-600 hover:underline"
                    >
                      Abrir O.S. →
                    </Link>
                  </td>
                </tr>
              ))}
              {visiblePending.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    {pending.length === 0 ? (
                      <>
                        Nenhuma O.S. marcada para emissão.
                        <br />
                        <span className="text-xs text-gray-400">
                          A marcação é feita dentro da O.S., no botão &quot;Marcar para emissão de
                          NF&quot;.
                        </span>
                        <br />
                        <Link
                          href="/orders"
                          className="mt-2 inline-block text-xs font-medium text-blue-600 hover:underline"
                        >
                          Ver O.S. →
                        </Link>
                      </>
                    ) : (
                      <>
                        Nenhuma das {pending.length} O.S. da fila bate com a busca/período.
                        <br />
                        <button
                          onClick={clearFilters}
                          className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                        >
                          Limpar filtros
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white">
        <div className="border-b border-gray-100 px-4 py-3">
          <h2 className="text-sm font-semibold text-gray-900">
            Emitidas ({visibleEmitted.length}
            {visibleEmitted.length !== emittedRows.length ? ` de ${emittedRows.length}` : ''})
          </h2>
          <p className="mt-0.5 text-xs text-gray-500">
            Total emitido no filtro atual: <span className="font-medium">{money(emittedTotal)}</span>{' '}
            — cada linha abre a O.S. correspondente.
          </p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nota</th>
                <th className="px-4 py-3">O.S.</th>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Veículo</th>
                <th className="px-4 py-3">Tipo</th>
                <th className="px-4 py-3">Total</th>
                <th className="px-4 py-3">Emitida em</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {visibleEmitted.map((r) => (
                <tr key={r.key} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">
                    {r.invoiceNumber ?? (
                      <span className="text-xs font-normal text-gray-500">
                        sem nº (emitida antes do registro)
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.order ? (
                      <Link
                        href={`/orders/${r.orderId}`}
                        className="font-medium text-blue-600 hover:underline"
                      >
                        {orderLabel(r.order)}
                      </Link>
                    ) : (
                      <span className="text-xs text-gray-400">O.S. removida</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{r.customerName}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {r.order ? vehicleLabel(r.order) : '—'}
                  </td>
                  <td className="px-4 py-3 uppercase text-gray-600">{r.kind ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-600">{money(r.totalValue)}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {r.legacy ? (
                      <span title="O.S. legada: marcada como faturada antes de a nota passar a ser guardada.">
                        {dateBR(r.at)} <span className="text-xs text-gray-400">(legado)</span>
                      </span>
                    ) : (
                      dateTimeBR(r.at)
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    {r.documentContent ? (
                      <button
                        onClick={() => openDocument(r.documentContent!)}
                        className="text-xs font-medium text-blue-600 hover:underline"
                      >
                        Ver documento
                      </button>
                    ) : (
                      <span className="text-xs text-gray-400">
                        Documento não guardado — só o registro na O.S.
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {visibleEmitted.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm text-gray-500">
                    {emittedRows.length === 0 ? (
                      'Nenhuma NF emitida ainda.'
                    ) : (
                      <>
                        Nenhuma das {emittedRows.length} notas bate com a busca/período.
                        <br />
                        <button
                          onClick={clearFilters}
                          className="mt-2 text-xs font-medium text-blue-600 hover:underline"
                        >
                          Limpar filtros
                        </button>
                      </>
                    )}
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
