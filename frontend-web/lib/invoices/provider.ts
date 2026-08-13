import { Order, Client, InvoiceKind } from '@/lib/types'

export interface InvoiceEmissionResult {
  provider: string
  kind: InvoiceKind
  number: string
  totalValue: number
  documentContent: string
  documentUrl?: string
}

export interface InvoiceProvider {
  name: string
  emit(order: Order, client: Client): Promise<InvoiceEmissionResult>
}

/**
 * Swap this to a real provider (eNotas or another) once the integration
 * is defined. Everything downstream (Firestore writes, UI) only depends
 * on the InvoiceProvider interface, not on any specific vendor.
 */
export { mockInvoiceProvider as activeInvoiceProvider } from '@/lib/invoices/mockProvider'
