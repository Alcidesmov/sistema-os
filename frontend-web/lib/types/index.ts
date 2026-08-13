export type OrderStatus =
  | 'draft'
  | 'quoted'
  | 'approved'
  | 'in_progress'
  | 'completed'
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
  cnpj?: string
  email?: string
  phone?: string
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
