import {
  collection,
  doc,
  addDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  deleteField,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  orderBy,
  runTransaction,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import {
  Customer,
  Vehicle,
  ServiceItem,
  Order,
  OrderStatus,
  OrderLineItem,
  OrderEvent,
  Client,
  Invoice,
  ApprovalChannel,
  PaymentMethod,
  VehicleType,
} from '@/lib/types'
import { activeInvoiceProvider } from '@/lib/invoices/provider'

const col = (clientId: string, name: string) =>
  collection(db, 'clients', clientId, name)

const orderRef = (clientId: string, orderId: string) =>
  doc(db, 'clients', clientId, 'orders', orderId)

// --- Customers ---
export function watchCustomers(clientId: string, cb: (items: Customer[]) => void) {
  const q = query(col(clientId, 'customers'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)))
  })
}

/**
 * Telefone é opcional desde a v0.5.0: exigir nome E telefone juntos fazia
 * o cadastro no balcão falhar em silêncio. Chaves vazias são OMITIDAS
 * (CLAUDE.md 6.1 — o Firestore rejeita undefined).
 */
export async function createCustomer(
  clientId: string,
  data: { name: string; phone?: string; email?: string; document?: string }
) {
  return addDoc(col(clientId, 'customers'), {
    name: data.name,
    ...(data.phone ? { phone: data.phone } : {}),
    ...(data.email ? { email: data.email } : {}),
    ...(data.document ? { document: data.document } : {}),
    clientId,
    createdAt: Date.now(),
  })
}

export async function updateCustomer(
  clientId: string,
  id: string,
  data: Partial<Omit<Customer, 'id' | 'clientId' | 'createdAt'>>
) {
  return updateDoc(doc(db, 'clients', clientId, 'customers', id), data)
}

// --- Vehicles ---
export function watchVehicles(clientId: string, cb: (items: Vehicle[]) => void) {
  const q = query(col(clientId, 'vehicles'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehicle)))
  })
}

export async function createVehicle(
  clientId: string,
  data: {
    plate: string
    model: string
    customerId: string
    type?: VehicleType
    brand?: string
    year?: string
    color?: string
  }
) {
  return addDoc(col(clientId, 'vehicles'), {
    plate: data.plate.toUpperCase(),
    model: data.model,
    customerId: data.customerId,
    type: data.type ?? 'carro',
    brand: data.brand ?? '',
    year: data.year ?? '',
    color: data.color ?? '',
    clientId,
    createdAt: Date.now(),
  })
}

export async function updateVehicle(
  clientId: string,
  id: string,
  data: Partial<Omit<Vehicle, 'id' | 'clientId' | 'createdAt'>>
) {
  return updateDoc(doc(db, 'clients', clientId, 'vehicles', id), data)
}

// --- Service catalog ---
export function watchServices(clientId: string, cb: (items: ServiceItem[]) => void) {
  const q = query(col(clientId, 'services'), orderBy('name', 'asc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as ServiceItem)))
  })
}

export async function createService(clientId: string, data: Omit<ServiceItem, 'id' | 'clientId'>) {
  return addDoc(col(clientId, 'services'), { ...data, clientId })
}

export async function deleteService(clientId: string, id: string) {
  return deleteDoc(doc(db, 'clients', clientId, 'services', id))
}

export async function updateService(
  clientId: string,
  id: string,
  data: Partial<Omit<ServiceItem, 'id' | 'clientId'>>
) {
  return updateDoc(doc(db, 'clients', clientId, 'services', id), data)
}

/**
 * Bulk import for one-off catalog migrations (e.g. importing a legacy
 * system's product/service list). Writes concurrently in chunks to avoid
 * saturating the connection with hundreds of simultaneous requests.
 */
export async function createServicesBulk(
  clientId: string,
  items: Omit<ServiceItem, 'id' | 'clientId'>[]
) {
  const CHUNK_SIZE = 25
  for (let i = 0; i < items.length; i += CHUNK_SIZE) {
    const chunk = items.slice(i, i + CHUNK_SIZE)
    await Promise.all(chunk.map((item) => createService(clientId, item)))
  }
}

// --- Orders ---
export function watchOrders(clientId: string, cb: (items: Order[]) => void) {
  const q = query(col(clientId, 'orders'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)))
  })
}

export function watchOrder(clientId: string, orderId: string, cb: (order: Order | null) => void) {
  return onSnapshot(orderRef(clientId, orderId), (snap) => {
    cb(snap.exists() ? ({ id: snap.id, ...snap.data() } as Order) : null)
  })
}

/**
 * Próximo número sequencial da oficina.
 *
 * Mora em clients/{clientId}/counters/orders, NUNCA no doc da oficina:
 * a regra de segurança restringe update de clients/{clientId} ao gestor,
 * e a recepcionista precisa poder abrir O.S. A subcoleção cai na regra
 * de membro, então todo mundo incrementa.
 *
 * NUNCA bloqueia a criação: runTransaction não funciona offline e oficina
 * tem internet ruim. Se falhar, devolve undefined e a O.S. nasce sem
 * número — o gestor recolhe depois com backfillOrderNumbers().
 */
export async function nextOrderNumber(clientId: string): Promise<number | undefined> {
  const ref = doc(db, 'clients', clientId, 'counters', 'orders')
  try {
    return await runTransaction(db, async (tx) => {
      const snap = await tx.get(ref)
      const next = ((snap.exists() ? (snap.data().value as number) : 0) || 0) + 1
      tx.set(ref, { value: next, updatedAt: Date.now() }, { merge: true })
      return next
    })
  } catch (err) {
    console.warn('Número sequencial indisponível — O.S. será criada sem número.', err)
    return undefined
  }
}

/**
 * Abre uma O.S. O ÚNICO obrigatório é o cliente: veículo e itens entram
 * depois, dentro da própria O.S. Toda chave ausente é OMITIDA do payload.
 */
export async function createOrder(
  clientId: string,
  data: {
    customerId: string
    customerName: string
    vehicleId?: string
    vehiclePlate?: string
    vehicleModel?: string
    vehicleType?: VehicleType
    items?: OrderLineItem[]
    complaint?: string
    number?: number
  }
) {
  const now = Date.now()
  const items = data.items ?? []
  return addDoc(col(clientId, 'orders'), {
    customerId: data.customerId,
    customerName: data.customerName,
    ...(data.vehicleId ? { vehicleId: data.vehicleId } : {}),
    ...(data.vehiclePlate ? { vehiclePlate: data.vehiclePlate } : {}),
    ...(data.vehicleModel ? { vehicleModel: data.vehicleModel } : {}),
    ...(data.vehicleType ? { vehicleType: data.vehicleType } : {}),
    ...(data.complaint ? { complaint: data.complaint } : {}),
    ...(data.number ? { number: data.number } : {}),
    items,
    totalValue: items.reduce((s, i) => s + i.subtotal, 0),
    clientId,
    status: 'diagnostico' as OrderStatus,
    createdAt: now,
    updatedAt: now,
  })
}

export async function updateOrderStatus(
  clientId: string,
  orderId: string,
  status: OrderStatus,
  extra: Record<string, unknown> = {}
) {
  return updateDoc(orderRef(clientId, orderId), { status, updatedAt: Date.now(), ...extra })
}

/** Vincula, troca ou REMOVE o veículo de uma O.S. já aberta. */
export async function setOrderVehicle(
  clientId: string,
  orderId: string,
  vehicle: { id: string; plate: string; model: string; type?: VehicleType } | null,
  by = ''
) {
  const payload: Record<string, unknown> = { updatedAt: Date.now() }
  if (vehicle) {
    payload.vehicleId = vehicle.id
    payload.vehiclePlate = vehicle.plate
    payload.vehicleModel = vehicle.model
    payload.vehicleType = vehicle.type ?? 'carro'
  } else {
    // deleteField() em vez de undefined — o Firestore rejeita undefined.
    payload.vehicleId = deleteField()
    payload.vehiclePlate = deleteField()
    payload.vehicleModel = deleteField()
    payload.vehicleType = deleteField()
  }
  await updateDoc(orderRef(clientId, orderId), payload)
  await logOrderEvent(clientId, orderId, by, vehicle ? 'veículo definido' : 'veículo removido',
    vehicle ? `${vehicle.plate} · ${vehicle.model}` : undefined)
}

export async function updateOrderItems(
  clientId: string,
  orderId: string,
  items: OrderLineItem[],
  by = ''
) {
  await updateDoc(orderRef(clientId, orderId), {
    items,
    totalValue: items.reduce((s, i) => s + i.subtotal, 0),
    updatedAt: Date.now(),
  })
  await logOrderEvent(clientId, orderId, by, 'itens alterados', `${items.length} item(ns)`)
}

export async function updateOrderFields(
  clientId: string,
  orderId: string,
  data: { complaint?: string; notes?: string; assignedTo?: string; executionEstimatedEnd?: number }
) {
  const payload: Record<string, unknown> = { updatedAt: Date.now() }
  if (data.complaint !== undefined) payload.complaint = data.complaint
  if (data.notes !== undefined) payload.notes = data.notes
  if (data.assignedTo !== undefined) payload.assignedTo = data.assignedTo
  if (data.executionEstimatedEnd !== undefined) payload.executionEstimatedEnd = data.executionEstimatedEnd
  return updateDoc(orderRef(clientId, orderId), payload)
}

/**
 * Aprova o orçamento e já abre a execução, registrando a PROVA: quem
 * autorizou e por qual canal. "Eu não autorizei esse serviço" é discussão
 * semanal em oficina — antes disso o clique era anônimo.
 */
export async function approveOrder(
  clientId: string,
  orderId: string,
  data: {
    approvedBy: string
    approvalChannel: ApprovalChannel
    approvalNote?: string
    executionEstimatedEnd?: number
  }
) {
  const now = Date.now()
  await updateDoc(orderRef(clientId, orderId), {
    status: 'em_servico' as OrderStatus,
    quoteApprovedAt: now,
    executionStartedAt: now,
    approvedBy: data.approvedBy,
    approvalChannel: data.approvalChannel,
    ...(data.approvalNote ? { approvalNote: data.approvalNote } : {}),
    ...(data.executionEstimatedEnd ? { executionEstimatedEnd: data.executionEstimatedEnd } : {}),
    updatedAt: now,
  })
  await logOrderEvent(clientId, orderId, data.approvedBy, 'orçamento aprovado', data.approvalChannel)
}

export async function completeOrder(clientId: string, orderId: string, by = '') {
  const now = Date.now()
  await updateDoc(orderRef(clientId, orderId), {
    status: 'finalizado' as OrderStatus,
    executionCompletedAt: now,
    updatedAt: now,
  })
  await logOrderEvent(clientId, orderId, by, 'serviço concluído')
}

/** Dar baixa: entregar o carro e registrar o recebimento. */
export async function deliverOrder(
  clientId: string,
  orderId: string,
  data: { paymentMethod: PaymentMethod; amountPaid: number; by?: string }
) {
  const now = Date.now()
  await updateDoc(orderRef(clientId, orderId), {
    status: 'entregue' as OrderStatus,
    deliveredAt: now,
    paidAt: now,
    paymentMethod: data.paymentMethod,
    amountPaid: data.amountPaid,
    updatedAt: now,
  })
  await logOrderEvent(clientId, orderId, data.by ?? '', 'entregue e recebido',
    `${data.paymentMethod} · ${data.amountPaid}`)
}

/** Cancelamento é SOFT — a O.S. nunca some, some do fluxo. */
export async function cancelOrder(clientId: string, orderId: string, reason: string, by = '') {
  const now = Date.now()
  await updateDoc(orderRef(clientId, orderId), {
    status: 'cancelado' as OrderStatus,
    cancelledAt: now,
    cancelReason: reason,
    updatedAt: now,
  })
  await logOrderEvent(clientId, orderId, by, 'O.S. cancelada', reason)
}

/** Só para rascunho: em diagnóstico, sem itens e nunca aprovada. */
export async function deleteDraftOrder(clientId: string, order: Order) {
  if (order.status !== 'diagnostico' || (order.items?.length ?? 0) > 0 || order.quoteApprovedAt) {
    throw new Error('Só é possível apagar uma O.S. em diagnóstico, sem itens e nunca aprovada.')
  }
  return deleteDoc(orderRef(clientId, order.id))
}

export async function requestInvoice(clientId: string, orderId: string) {
  return updateDoc(orderRef(clientId, orderId), { invoiceRequested: true, updatedAt: Date.now() })
}

/**
 * Dá número às O.S. que estão sem, em ordem de criação, e sincroniza o
 * contador. Roda sob demanda pelo gestor — o histórico da oficina fica
 * mudo se as O.S. antigas não tiverem número.
 */
export async function backfillOrderNumbers(clientId: string): Promise<number> {
  const snap = await getDocs(query(col(clientId, 'orders'), orderBy('createdAt', 'asc')))
  const all = snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order))
  let max = all.reduce((m, o) => Math.max(m, o.number ?? 0), 0)
  const missing = all.filter((o) => !o.number)

  for (const o of missing) {
    max += 1
    await updateDoc(orderRef(clientId, o.id), { number: max })
  }

  if (missing.length) {
    await setDoc(
      doc(db, 'clients', clientId, 'counters', 'orders'),
      { value: max, updatedAt: Date.now() },
      { merge: true }
    )
  }
  return missing.length
}

// --- Rastro de alteração (append-only) ---
/**
 * A O.S. era imutável; agora itens mudam, veículo troca e ela pode ser
 * cancelada. Sumir um item sem saber quem tirou é inaceitável num
 * documento comercial — daí uma linha por mutação.
 */
export async function logOrderEvent(
  clientId: string,
  orderId: string,
  by: string,
  action: string,
  detail?: string
) {
  try {
    await addDoc(collection(db, 'clients', clientId, 'orders', orderId, 'history'), {
      at: Date.now(),
      by: by || 'sistema',
      action,
      ...(detail ? { detail } : {}),
    })
  } catch (err) {
    // O rastro nunca pode derrubar a operação que ele registra.
    console.warn('Não foi possível gravar o histórico da O.S.', err)
  }
}

export function watchOrderHistory(
  clientId: string,
  orderId: string,
  cb: (items: OrderEvent[]) => void
) {
  const q = query(
    collection(db, 'clients', clientId, 'orders', orderId, 'history'),
    orderBy('at', 'desc')
  )
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as OrderEvent)))
  })
}

// --- Client (oficina) info ---
export async function getClient(clientId: string): Promise<Client> {
  const snap = await getDoc(doc(db, 'clients', clientId))
  return { id: clientId, ...(snap.data() as Omit<Client, 'id'>) }
}

export function watchClient(clientId: string, cb: (client: Client) => void) {
  return onSnapshot(doc(db, 'clients', clientId), (snap) => {
    if (snap.exists()) cb({ id: clientId, ...(snap.data() as Omit<Client, 'id'>) })
  })
}

export async function updateClient(clientId: string, data: Partial<Omit<Client, 'id'>>) {
  return updateDoc(doc(db, 'clients', clientId), data)
}

// --- Invoices ---
export function watchInvoices(clientId: string, cb: (items: Invoice[]) => void) {
  const q = query(col(clientId, 'invoices'), orderBy('issuedAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Invoice)))
  })
}

/**
 * Emite a NF pelo provedor ativo (ver lib/invoices/provider.ts).
 *
 * Desde a v0.5.0 NÃO sobrescreve mais o status de trabalho — grava só o
 * invoiceId. Faturar não desfaz o fato de o serviço ter sido concluído
 * ou entregue, e era isso que o status 'invoiced' apagava.
 */
export async function emitInvoiceForOrder(clientId: string, order: Order) {
  const client = await getClient(clientId)
  const result = await activeInvoiceProvider.emit(order, client)

  const invoiceRef = await addDoc(col(clientId, 'invoices'), {
    clientId,
    orderId: order.id,
    customerName: order.customerName,
    provider: result.provider,
    kind: result.kind,
    number: result.number,
    totalValue: result.totalValue,
    documentContent: result.documentContent,
    documentUrl: result.documentUrl ?? null,
    issuedAt: Date.now(),
  })

  await updateDoc(orderRef(clientId, order.id), {
    invoiceId: invoiceRef.id,
    updatedAt: Date.now(),
  })

  return invoiceRef.id
}

// --- Feedback / melhorias ---
export interface Feedback {
  id: string
  clientId: string
  message: string
  page: string
  userEmail: string
  status: 'new' | 'reviewing' | 'done' | 'rejected'
  createdAt: number
}

export function watchFeedback(clientId: string, cb: (items: Feedback[]) => void) {
  const q = query(col(clientId, 'feedback'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Feedback)))
  })
}

export async function createFeedback(
  clientId: string,
  data: { message: string; page: string; userEmail: string }
) {
  return addDoc(col(clientId, 'feedback'), {
    ...data,
    clientId,
    status: 'new' as const,
    createdAt: Date.now(),
  })
}
