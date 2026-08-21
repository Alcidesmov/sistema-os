/**
 * Estágios de trabalho de uma O.S.
 *
 * 'invoiced' é LEGADO: até a v0.4.x, emitir a NF sobrescrevia o status da
 * O.S., então existem O.S. reais gravadas com esse valor. O status de
 * trabalho e o de nota fiscal são coisas separadas desde a v0.5.0 — a
 * emissão passou a gravar só `invoiceId`. Nunca comparar `order.status`
 * diretamente: usar `statusOf(order)` de lib/orders/status.ts, que
 * traduz o legado.
 */
export type OrderStatus =
  | 'diagnostico'
  | 'em_servico'
  | 'finalizado'
  | 'entregue'
  | 'cancelado'
  /** @deprecated legado — ver statusOf() em lib/orders/status.ts */
  | 'invoiced'

/** Estágios "vivos" do trabalho, na ordem da esteira. */
export type WorkStatus = Exclude<OrderStatus, 'invoiced'>

/** Derivado de invoiceId/invoiceRequested — nunca gravado no Firestore. */
export type InvoiceStatus = 'none' | 'requested' | 'issued'

export type VehicleType = 'carro' | 'moto' | 'caminhao' | 'outro'

export const VEHICLE_TYPE_LABEL: Record<VehicleType, string> = {
  carro: 'Carro',
  moto: 'Moto',
  caminhao: 'Caminhão',
  outro: 'Outro',
}

export type PaymentMethod = 'dinheiro' | 'pix' | 'debito' | 'credito' | 'boleto' | 'outro'

export const PAYMENT_METHOD_LABEL: Record<PaymentMethod, string> = {
  dinheiro: 'Dinheiro',
  pix: 'PIX',
  debito: 'Cartão de débito',
  credito: 'Cartão de crédito',
  boleto: 'Boleto',
  outro: 'Outro',
}

/** Por qual meio o cliente autorizou o serviço — vira prova da aprovação. */
export type ApprovalChannel = 'presencial' | 'telefone' | 'whatsapp' | 'papel'

export const APPROVAL_CHANNEL_LABEL: Record<ApprovalChannel, string> = {
  presencial: 'Presencial',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp',
  papel: 'Assinado no papel',
}

export interface Vehicle {
  id: string
  clientId: string
  plate: string
  model: string
  brand: string
  year: string
  color: string
  type: VehicleType
  customerId: string
  createdAt: number
}

export interface Customer {
  id: string
  clientId: string
  name: string
  /** Opcional desde a v0.5.0 — exigir telefone travava o cadastro no balcão. */
  phone?: string
  email?: string
  document?: string
  createdAt: number
}

export interface ServiceItem {
  id: string
  clientId: string
  name: string
  description?: string
  price: number
  type: 'service' | 'part'
  code?: string
  barcode?: string
}

export interface OrderLineItem {
  itemId: string
  type: 'service' | 'part'
  description: string
  quantity: number
  unitPrice: number
  subtotal: number
}

export interface Order {
  id: string
  clientId: string
  /**
   * Número sequencial legível por oficina. Opcional de propósito: se o
   * contador falhar (oficina sem internet), a O.S. nasce sem número em
   * vez de o atendimento parar. O gestor recolhe depois pelo botão
   * "Numerar O.S. antigas".
   */
  number?: number

  customerId: string
  customerName: string

  /**
   * Veículo é OPCIONAL desde a v0.5.0: o cliente pode abrir a O.S. e
   * trazer o carro depois, ou voltar com outro carro. Quando não houver,
   * as chaves são OMITIDAS do documento (o Firestore rejeita undefined —
   * ver CLAUDE.md 6.1). Nunca concatenar placa/modelo direto: usar
   * vehicleLabel() de lib/orders/format.ts.
   */
  vehicleId?: string
  vehiclePlate?: string
  vehicleModel?: string
  vehicleType?: VehicleType

  status: OrderStatus
  items: OrderLineItem[]
  totalValue: number

  /** Queixa relatada pelo cliente na abertura. */
  complaint?: string
  notes?: string

  quoteApprovedAt?: number
  approvedBy?: string
  approvalChannel?: ApprovalChannel
  approvalNote?: string

  executionStartedAt?: number
  executionEstimatedEnd?: number
  executionCompletedAt?: number

  deliveredAt?: number
  paidAt?: number
  paymentMethod?: PaymentMethod
  amountPaid?: number

  cancelledAt?: number
  cancelReason?: string

  /** Semente da tela do mecânico — e-mail do responsável. */
  assignedTo?: string

  invoiceRequested?: boolean
  invoiceId?: string

  createdAt: number
  updatedAt: number
}

export interface Client {
  id: string
  name: string
  razaoSocial?: string
  nomeFantasia?: string
  cnpj?: string
  address?: string
  email?: string
  phone?: string
  /** Falso = oficina suspensa pelo administrador do sistema. */
  active?: boolean
  ownerUid?: string
  createdAt?: number
  /**
   * Snapshot do gestor inicial, gravado na criação pelo admin sistêmico.
   * Existe SÓ para a tela /admin identificar a oficina sem precisar ler
   * a subcoleção members (que o admin não acessa — ver
   * firebase/firestore.rules). Pode ficar desatualizado se o gestor
   * trocar depois; não é fonte de verdade de quem é gestor hoje.
   */
  gestorNome?: string
  gestorEmail?: string
}

export type UserRole = 'gestor' | 'supervisor' | 'mecanico' | 'recepcionista'

export const USER_ROLE_LABEL: Record<UserRole, string> = {
  gestor: 'Gestor',
  supervisor: 'Supervisor',
  mecanico: 'Mecânico',
  recepcionista: 'Recepcionista',
}

// users/{uid} — documento enxuto usado só pra resolver uid -> oficina
// (bootstrap do login e regra de segurança). Não usar pra listar membros.
export interface UserLookup {
  clientId: string
  email: string
  role: UserRole
  createdAt: number
  /**
   * Só para o primeiro login de uma oficina provisionada pelo admin
   * sistêmico: dá o nome pro self-bootstrap de
   * clients/{clientId}/members/{uid} (ver useClientId.tsx). Nunca lido
   * fora disso.
   */
  name?: string
}

// clients/{clientId}/members/{uid} — espelha UserLookup, mas vive dentro
// do tenant pra poder ser listado (ver Usuários) sob a mesma regra de
// segurança que já vale pra customers/vehicles/services/orders.
export interface Member {
  id: string
  name: string
  email: string
  role: UserRole
  createdAt: number
}

/**
 * platformAdmins/{uid} — administrador SISTÊMICO, acima dos papéis de
 * oficina. É o único que cadastra novas oficinas. Vive numa coleção
 * própria, fora de clients/, e só é criado manualmente pelo console do
 * Firebase (a regra é write:false) — ver docs/ADMIN-RUNBOOK.md.
 */
export interface PlatformAdmin {
  id: string
  email: string
  name?: string
  createdAt: number
}

export type InvoiceKind = 'nfe' | 'nfse'

export interface Invoice {
  id: string
  clientId: string
  orderId: string
  customerName: string
  provider: string
  kind: InvoiceKind
  number: string
  totalValue: number
  documentContent: string
  documentUrl?: string
  issuedAt: number
}

/** Uma linha do rastro append-only de clients/{id}/orders/{id}/history. */
export interface OrderEvent {
  id: string
  at: number
  by: string
  action: string
  detail?: string
}
