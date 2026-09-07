import { Order } from '@/lib/types'

/** Intervalo sugerido na UI quando o campo ainda está vazio (troca de óleo). */
export const DEFAULT_REMINDER_KM_INTERVAL = 3000

/**
 * Km-alvo do próximo retorno desta O.S., ou null se a quilometragem de
 * entrada não foi registrada. Pura por design (ver status.ts/format.ts) —
 * usada tanto na tela da O.S. quanto na ficha do veículo.
 */
export function kmTargetOf(
  order: Pick<Order, 'entryKm' | 'reminderKmInterval'>
): number | null {
  if (order.entryKm == null) return null
  const interval = order.reminderKmInterval ?? DEFAULT_REMINDER_KM_INTERVAL
  return order.entryKm + interval
}

/**
 * Entre as O.S. de um mesmo veículo, a mais recente que já teve km de
 * entrada registrado — é o que sustenta o "aviso de retorno" mostrado na
 * ficha do veículo e nas próximas O.S. dele. `excludeOrderId` tira a
 * própria O.S. da busca (usado no detalhe da O.S., que quer o HISTÓRICO,
 * não ela mesma).
 */
export function lastKmOrderOf(
  orders: Order[],
  vehicleId: string,
  excludeOrderId?: string
): Order | null {
  const candidatas = orders
    .filter((o) => o.vehicleId === vehicleId && o.id !== excludeOrderId && o.entryKm != null)
    .sort((a, b) => b.createdAt - a.createdAt)
  return candidatas[0] ?? null
}

export type KmAlertLevel = 'atrasado' | 'proximo' | 'programado'

export interface KmAlert {
  level: KmAlertLevel
  message: string
  /** A O.S. de origem do aviso (onde o km-alvo foi calculado). */
  fromOrder: Order
  targetKm: number
}

/**
 * Compara o km de entrada da O.S. ATUAL (se já informado) contra o
 * km-alvo deixado por uma visita anterior do mesmo veículo. Sem
 * telemetria do carro, isso só é detectável quando ele volta e alguém
 * digita o km de novo — por isso o aviso vive dentro da O.S. seguinte,
 * não como monitoramento em tempo real.
 */
export function kmAlertOf(currentOrder: Pick<Order, 'entryKm'>, previous: Order | null): KmAlert | null {
  if (!previous) return null
  const targetKm = kmTargetOf(previous)
  if (targetKm == null) return null

  if (currentOrder.entryKm != null) {
    if (currentOrder.entryKm >= targetKm) {
      return {
        level: 'atrasado',
        targetKm,
        fromOrder: previous,
        message: `Este veículo já passou do km previsto para revisão (${targetKm.toLocaleString('pt-BR')} km, calculado na O.S. anterior).`,
      }
    }
    const faltam = targetKm - currentOrder.entryKm
    if (faltam <= 500) {
      return {
        level: 'proximo',
        targetKm,
        fromOrder: previous,
        message: `Faltam cerca de ${faltam.toLocaleString('pt-BR')} km para a revisão prevista (${targetKm.toLocaleString('pt-BR')} km).`,
      }
    }
  }

  return {
    level: 'programado',
    targetKm,
    fromOrder: previous,
    message: `Revisão recomendada aos ${targetKm.toLocaleString('pt-BR')} km (registrado na O.S. anterior).`,
  }
}
