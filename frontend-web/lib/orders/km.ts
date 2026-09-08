import { Order } from '@/lib/types'
import { daysSince } from '@/lib/orders/format'

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

export type ReturnPanelLevel = KmAlertLevel | 'sem_estimativa'

export interface ReturnPanelItem {
  vehicleId: string
  customerId: string
  customerName: string
  vehiclePlate?: string
  vehicleModel?: string
  /** A O.S. mais recente deste veículo que teve km registrado. */
  lastOrder: Order
  targetKm: number
  daysSinceLastVisit: number
  /**
   * Km estimado hoje, só quando há 2+ visitas com km pra calcular uma
   * média de uso real do carro. Nunca inventa uma média genérica — sem
   * segundo ponto de dado, o painel mostra a última visita e o alvo, sem
   * alegar status de atraso (nível 'sem_estimativa').
   */
  estimatedCurrentKm: number | null
  level: ReturnPanelLevel
}

/**
 * Um item por veículo (o painel é "por carro", não "por O.S.") — pra cada
 * um, pega a visita mais recente com km registrado e, se houver uma
 * visita anterior também com km, estima o km de hoje pela média de uso
 * real entre as duas (km rodado / dias decorridos). Essa é a única forma
 * honesta de "aviso proativo" sem telemetria do carro: nunca assume uma
 * média de km/dia genérica quando só existe um ponto de dado.
 */
export function returnPanelItemsOf(orders: Order[], now: number = Date.now()): ReturnPanelItem[] {
  const porVeiculo = new Map<string, Order[]>()
  for (const o of orders) {
    if (!o.vehicleId || o.entryKm == null) continue
    const lista = porVeiculo.get(o.vehicleId)
    if (lista) lista.push(o)
    else porVeiculo.set(o.vehicleId, [o])
  }

  const items: ReturnPanelItem[] = []
  for (const [vehicleId, lista] of porVeiculo) {
    const ordenadas = [...lista].sort((a, b) => a.createdAt - b.createdAt)
    const ultima = ordenadas[ordenadas.length - 1]
    const anterior = ordenadas[ordenadas.length - 2] ?? null
    const targetKm = kmTargetOf(ultima)
    if (targetKm == null) continue

    const daysSinceLastVisit = daysSince(ultima.createdAt, now)

    let estimatedCurrentKm: number | null = null
    let level: ReturnPanelLevel = 'sem_estimativa'

    if (anterior?.entryKm != null && ultima.entryKm != null) {
      const diasEntreVisitas = daysSince(anterior.createdAt, ultima.createdAt)
      const kmRodado = ultima.entryKm - anterior.entryKm
      if (diasEntreVisitas > 0 && kmRodado > 0) {
        const mediaKmPorDia = kmRodado / diasEntreVisitas
        estimatedCurrentKm = Math.round(ultima.entryKm + mediaKmPorDia * daysSinceLastVisit)
        const faltam = targetKm - estimatedCurrentKm
        level = faltam <= 0 ? 'atrasado' : faltam <= 500 ? 'proximo' : 'programado'
      }
    }

    items.push({
      vehicleId,
      customerId: ultima.customerId,
      customerName: ultima.customerName,
      vehiclePlate: ultima.vehiclePlate,
      vehicleModel: ultima.vehicleModel,
      lastOrder: ultima,
      targetKm,
      daysSinceLastVisit,
      estimatedCurrentKm,
      level,
    })
  }

  return items
}

/** Mais urgente primeiro — usada pra ordenar o Painel de Retorno. */
export const RETURN_LEVEL_PRIORITY: Record<ReturnPanelLevel, number> = {
  atrasado: 0,
  proximo: 1,
  programado: 2,
  sem_estimativa: 3,
}
