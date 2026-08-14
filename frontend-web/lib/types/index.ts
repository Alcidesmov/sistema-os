export type OrderStatus =
  | 'diagnostico'
  | 'em_servico'
  | 'finalizado'
  | 'invoiced'

export interface Vehicle {
  id: string
  clientId: string
  plate: string
  model: string
  brand: string
  year: string
  color: string
  type: 'carro' | 'moto' | 'caminhao' | 'outro'
  customerId: string
  createdAt: number
}

export interface Customer {
  id: string
  clientId: string
  name: string
  phone: string
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
  vehicleId: string
  customerId: string
  customerName: string
  vehiclePlate: string
  vehicleModel: string
  status: OrderStatus
  items: OrderLineItem[]
  totalValue: number
  quoteApprovedAt?: number
  executionStartedAt?: number
  executionEstimatedEnd?: number
  executionCompletedAt?: number
  invoiceRequested?: boolean
  invoiceId?: string
  notes?: string
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
