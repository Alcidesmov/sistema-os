import { Order } from '@/lib/types'
import { statusOf, invoiceStatusOf, isCancelled, isDone, isOpen } from '@/lib/orders/status'
import { completedAtOf, isEstimatedCompletion, daysSince } from '@/lib/orders/format'

/** Dias parados no mesmo estágio antes de a O.S. virar caso de atenção. */
export const PARADA_DIAS = 3

export type AlertKind = 'atrasada' | 'parada' | 'sem_item' | 'sem_veiculo'

export const ALERT_LABEL: Record<AlertKind, string> = {
  atrasada: 'atrasada',
  parada: `parada há mais de ${PARADA_DIAS} dias`,
  sem_item: 'sem nenhum item',
  sem_veiculo: 'sem veículo',
}

export interface Alert {
  order: Order
  kinds: AlertKind[]
  /** Motivo mais grave, para a etiqueta da linha. */
  main: AlertKind
  days: number
}

/**
 * "PRECISA DE AÇÃO AGORA" — a pergunta que o dono faz às 8h da manhã.
 * Fica no topo da esteira, antes das faixas: as faixas mostram o estado,
 * isto aqui dá a ordem de ataque.
 */
export function alertsOf(orders: Order[], now: number = Date.now()): Alert[] {
  const out: Alert[] = []

  for (const o of orders) {
    if (isCancelled(o)) continue
    const s = statusOf(o)
    if (s === 'entregue') continue

    const kinds: AlertKind[] = []

    if (isOpen(o) && o.executionEstimatedEnd && o.executionEstimatedEnd < now) {
      kinds.push('atrasada')
    }
    if (isOpen(o) && daysSince(o.updatedAt ?? o.createdAt, now) > PARADA_DIAS) {
      kinds.push('parada')
    }
    if (s === 'diagnostico' && (!o.items || o.items.length === 0)) {
      kinds.push('sem_item')
    }
    if (!o.vehicleId) {
      kinds.push('sem_veiculo')
    }

    if (kinds.length) {
      out.push({
        order: o,
        kinds,
        main: kinds[0],
        days: daysSince(o.updatedAt ?? o.createdAt, now),
      })
    }
  }

  return out.sort((a, b) => b.days - a.days)
}

export type FaixaKey = 'orcamento' | 'em_servico' | 'baixa' | 'nf' | 'faturadas'

export interface Faixa {
  key: FaixaKey
  label: string
  hint: string
  orders: Order[]
  total: number
}

/** Em qual faixa da esteira a O.S. está agora, ou null se fora do fluxo. */
export function faixaOf(order: Order, now: number = Date.now()): FaixaKey | null {
  if (isCancelled(order)) return null
  const s = statusOf(order)
  const inv = invoiceStatusOf(order)

  if (s === 'diagnostico') return 'orcamento'
  if (s === 'em_servico') return 'em_servico'
  if (s === 'finalizado' && !order.deliveredAt) return 'baixa'
  if (inv === 'requested') return 'nf'
  if (inv === 'issued' && isSameMonth(completedAtOf(order), now)) return 'faturadas'
  return null
}

const FAIXA_META: Record<FaixaKey, { label: string; hint: string }> = {
  orcamento: { label: 'Orçamento em aberto', hint: 'aguardando aprovação' },
  em_servico: { label: 'Em serviço', hint: 'mão na massa' },
  baixa: { label: 'Pronto, aguardando baixa', hint: 'entregar e receber' },
  nf: { label: 'Aguardando NF', hint: 'marcadas para emissão' },
  faturadas: { label: 'Faturadas no mês', hint: 'nota emitida' },
}

export const FAIXA_ORDER: FaixaKey[] = ['orcamento', 'em_servico', 'baixa', 'nf', 'faturadas']

export function faixasOf(orders: Order[], now: number = Date.now()): Faixa[] {
  const buckets = new Map<FaixaKey, Order[]>()
  for (const k of FAIXA_ORDER) buckets.set(k, [])

  for (const o of orders) {
    const k = faixaOf(o, now)
    if (k) buckets.get(k)!.push(o)
  }

  return FAIXA_ORDER.map((key) => {
    // Mais antiga no topo: quem está esperando há mais tempo aparece primeiro.
    const list = (buckets.get(key) ?? []).sort(
      (a, b) => (a.updatedAt ?? a.createdAt) - (b.updatedAt ?? b.createdAt)
    )
    return {
      key,
      label: FAIXA_META[key].label,
      hint: FAIXA_META[key].hint,
      orders: list,
      total: list.reduce((sum, o) => sum + (o.totalValue || 0), 0),
    }
  })
}

export interface Dinheiro {
  /** Serviço concluído no período — o que foi feito. */
  faturamento: number
  /** O.S. ainda em aberto — o que ainda pode entrar. */
  carteira: number
  /** Pagamentos recebidos no período — dinheiro na mão. */
  recebido: number
  /** Quantas O.S. entraram no faturamento por data estimada (sem conclusão gravada). */
  estimadas: number
}

/**
 * Os três números que NUNCA mais se somam. Hoje o dashboard mistura
 * tudo num "faturamento do mês" que na verdade é a soma de todas as O.S.
 */
export function dinheiroOf(
  orders: Order[],
  from?: number | null,
  to?: number | null
): Dinheiro {
  let faturamento = 0
  let carteira = 0
  let recebido = 0
  let estimadas = 0

  const inPeriod = (ms?: number) => {
    if (!ms) return false
    if (from && ms < from) return false
    if (to && ms > to) return false
    return true
  }

  for (const o of orders) {
    if (isCancelled(o)) continue

    if (isDone(o) && inPeriod(completedAtOf(o))) {
      faturamento += o.totalValue || 0
      if (isEstimatedCompletion(o)) estimadas += 1
    }
    if (isOpen(o)) {
      carteira += o.totalValue || 0
    }
    if (o.amountPaid && inPeriod(o.paidAt)) {
      recebido += o.amountPaid
    }
  }

  return { faturamento, carteira, recebido, estimadas }
}

export interface PorCliente {
  customerId: string
  customerName: string
  count: number
  total: number
  lastAt: number
}

export function porCliente(orders: Order[]): PorCliente[] {
  const map = new Map<string, PorCliente>()
  for (const o of orders) {
    if (isCancelled(o)) continue
    const key = o.customerId || o.customerName
    const cur =
      map.get(key) ??
      { customerId: o.customerId, customerName: o.customerName, count: 0, total: 0, lastAt: 0 }
    cur.count += 1
    cur.total += o.totalValue || 0
    cur.lastAt = Math.max(cur.lastAt, o.createdAt)
    map.set(key, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

export interface PorVeiculo {
  vehicleId: string
  plate: string
  model: string
  customerName: string
  count: number
  total: number
  lastAt: number
}

export function porVeiculo(orders: Order[]): PorVeiculo[] {
  const map = new Map<string, PorVeiculo>()
  for (const o of orders) {
    if (isCancelled(o)) continue
    if (!o.vehicleId) continue
    const cur =
      map.get(o.vehicleId) ??
      {
        vehicleId: o.vehicleId,
        plate: o.vehiclePlate ?? '',
        model: o.vehicleModel ?? '',
        customerName: o.customerName,
        count: 0,
        total: 0,
        lastAt: 0,
      }
    cur.count += 1
    cur.total += o.totalValue || 0
    cur.lastAt = Math.max(cur.lastAt, o.createdAt)
    map.set(o.vehicleId, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

/**
 * Agrupa por tipo de veículo. "Sem veículo" é um balde EXPLÍCITO — antes
 * essas O.S. caíam caladas em "outro" e o dono lia um número errado.
 */
export function porTipoVeiculo(
  orders: Order[],
  typeOf: (vehicleId: string) => string | undefined
): { tipo: string; count: number; total: number }[] {
  const map = new Map<string, { tipo: string; count: number; total: number }>()
  for (const o of orders) {
    if (isCancelled(o)) continue
    const tipo = o.vehicleId ? (o.vehicleType ?? typeOf(o.vehicleId) ?? 'outro') : 'Sem veículo'
    const cur = map.get(tipo) ?? { tipo, count: 0, total: 0 }
    cur.count += 1
    cur.total += o.totalValue || 0
    map.set(tipo, cur)
  }
  return [...map.values()].sort((a, b) => b.total - a.total)
}

function isSameMonth(ms: number, now: number): boolean {
  const a = new Date(ms)
  const b = new Date(now)
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth()
}

export function monthStart(now: number = Date.now()): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
}

export function monthEnd(now: number = Date.now()): number {
  const d = new Date(now)
  return new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59, 999).getTime()
}
