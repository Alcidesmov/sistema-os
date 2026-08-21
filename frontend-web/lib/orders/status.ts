import { Order, OrderStatus, WorkStatus, InvoiceStatus } from '@/lib/types'

/**
 * Traduz o status gravado para o estágio de trabalho real.
 *
 * FUNÇÃO PURA, aplicada no PONTO DE USO — de propósito. Normalizar dentro
 * de watchOrders() deixaria de fora a tela de detalhe da O.S., que assina
 * o documento direto com onSnapshot e não passa por lá. Como 'invoiced'
 * continua no union, qualquer tela que esqueça de chamar statusOf() ainda
 * compila e ainda mostra a O.S. — o pior caso é um rótulo desatualizado,
 * nunca uma O.S. sumindo da tela.
 */
export function statusOf(order: Pick<Order, 'status'>): WorkStatus {
  return order.status === 'invoiced' ? 'finalizado' : order.status
}

/**
 * Situação da nota fiscal, DERIVADA do que já está gravado. Não existe
 * campo invoiceStatus no Firestore: criar um exigiria backfill nas O.S.
 * reais e esvaziaria a fila de NF no dia do deploy.
 */
export function invoiceStatusOf(
  order: Pick<Order, 'invoiceId' | 'invoiceRequested' | 'status'>
): InvoiceStatus {
  if (order.invoiceId || order.status === 'invoiced') return 'issued'
  if (order.invoiceRequested) return 'requested'
  return 'none'
}

export const STATUS_LABEL: Record<WorkStatus, string> = {
  diagnostico: 'Diagnóstico',
  em_servico: 'Em serviço',
  finalizado: 'Finalizado',
  entregue: 'Entregue',
  cancelado: 'Cancelado',
}

export const STATUS_COLOR: Record<WorkStatus, string> = {
  diagnostico: 'bg-amber-100 text-amber-700',
  em_servico: 'bg-purple-100 text-purple-700',
  finalizado: 'bg-green-100 text-green-700',
  entregue: 'bg-teal-100 text-teal-700',
  cancelado: 'bg-gray-200 text-gray-600',
}

export const INVOICE_STATUS_LABEL: Record<InvoiceStatus, string> = {
  none: 'Sem NF',
  requested: 'NF solicitada',
  issued: 'NF emitida',
}

/** Ordem dos estágios na esteira. 'cancelado' fica fora do fluxo. */
export const STATUS_FLOW: WorkStatus[] = [
  'diagnostico',
  'em_servico',
  'finalizado',
  'entregue',
]

export function statusLabelOf(order: Pick<Order, 'status'>): string {
  return STATUS_LABEL[statusOf(order)]
}

export function statusColorOf(order: Pick<Order, 'status'>): string {
  return STATUS_COLOR[statusOf(order)]
}

/** Uma O.S. cancelada não conta em faturamento, carteira nem esteira. */
export function isCancelled(order: Pick<Order, 'status'>): boolean {
  return statusOf(order) === 'cancelado'
}

/** Trabalho concluído (serviço pronto), independente de já ter saído. */
export function isDone(order: Pick<Order, 'status'>): boolean {
  const s = statusOf(order)
  return s === 'finalizado' || s === 'entregue'
}

/** Ainda em andamento — é o que a esteira chama de "em aberto". */
export function isOpen(order: Pick<Order, 'status'>): boolean {
  const s = statusOf(order)
  return s === 'diagnostico' || s === 'em_servico'
}
