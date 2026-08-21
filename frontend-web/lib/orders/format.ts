import { Order } from '@/lib/types'

export function money(value: number): string {
  return (value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
}

export function dateBR(ms?: number): string {
  return ms ? new Date(ms).toLocaleDateString('pt-BR') : '—'
}

export function dateTimeBR(ms?: number): string {
  return ms ? new Date(ms).toLocaleString('pt-BR') : '—'
}

/**
 * Rótulo do veículo de uma O.S. Ponto ÚNICO de concatenação: antes da
 * v0.5.0 cinco telas faziam `${plate} · ${model}` às cegas, e com veículo
 * opcional isso vira " · " solto ou "undefined · undefined" na tela.
 */
export function vehicleLabel(
  order: Pick<Order, 'vehiclePlate' | 'vehicleModel'>,
  fallback = 'Sem veículo'
): string {
  const parts = [order.vehiclePlate, order.vehicleModel].filter(Boolean)
  return parts.length ? parts.join(' · ') : fallback
}

export function hasVehicle(order: Pick<Order, 'vehicleId'>): boolean {
  return Boolean(order.vehicleId)
}

/** "#1042", ou "#s/nº" enquanto o contador não recolheu a O.S. */
export function orderLabel(order: Pick<Order, 'number'>): string {
  return order.number ? `#${order.number}` : '#s/nº'
}

/**
 * Data em que o serviço foi concluído, para ancorar faturamento.
 *
 * `executionCompletedAt` só passou a ser gravado quando alguém clica
 * "Concluir". O.S. antigas e as que foram direto para 'invoiced' não têm
 * o campo — ancorar sem fallback zeraria o faturamento dos meses
 * passados em silêncio. Quem cair no fallback é sinalizado por
 * `isEstimatedCompletion`, e a tela avisa.
 */
export function completedAtOf(
  order: Pick<Order, 'executionCompletedAt' | 'updatedAt' | 'createdAt'>
): number {
  return order.executionCompletedAt ?? order.updatedAt ?? order.createdAt
}

export function isEstimatedCompletion(
  order: Pick<Order, 'executionCompletedAt'>
): boolean {
  return !order.executionCompletedAt
}

/** Dias inteiros desde `ms` até agora. */
export function daysSince(ms: number, now: number = Date.now()): number {
  return Math.floor((now - ms) / 86400000)
}

export function agingLabel(ms: number, now: number = Date.now()): string {
  const d = daysSince(ms, now)
  if (d <= 0) return 'hoje'
  if (d === 1) return 'há 1 dia'
  return `há ${d} dias`
}

/**
 * Constrói a data local a partir de "YYYY-MM-DD" de um <input type=date>.
 * `new Date('2026-08-17')` é meia-noite UTC, que no Brasil cai às 21h do
 * dia 16 — e o filtro de período perdia o primeiro dia.
 */
export function localDateStart(value: string): number | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
}

export function localDateEnd(value: string): number | null {
  if (!value) return null
  const [y, m, d] = value.split('-').map(Number)
  if (!y || !m || !d) return null
  return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
}
