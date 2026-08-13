import {
  collection,
  doc,
  addDoc,
  updateDoc,
  onSnapshot,
  query,
  orderBy,
  Timestamp,
} from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { Customer, Vehicle, ServiceItem, Order, OrderStatus, OrderLineItem } from '@/lib/types'

const col = (clientId: string, name: string) =>
  collection(db, 'clients', clientId, name)

// --- Customers ---
export function watchCustomers(clientId: string, cb: (items: Customer[]) => void) {
  const q = query(col(clientId, 'customers'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Customer)))
  })
}

export async function createCustomer(clientId: string, data: Omit<Customer, 'id' | 'clientId' | 'createdAt'>) {
  return addDoc(col(clientId, 'customers'), { ...data, clientId, createdAt: Date.now() })
}

// --- Vehicles ---
export function watchVehicles(clientId: string, cb: (items: Vehicle[]) => void) {
  const q = query(col(clientId, 'vehicles'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Vehicle)))
  })
}

export async function createVehicle(clientId: string, data: Omit<Vehicle, 'id' | 'clientId' | 'createdAt'>) {
  return addDoc(col(clientId, 'vehicles'), { ...data, clientId, createdAt: Date.now() })
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

// --- Orders ---
export function watchOrders(clientId: string, cb: (items: Order[]) => void) {
  const q = query(col(clientId, 'orders'), orderBy('createdAt', 'desc'))
  return onSnapshot(q, (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Order)))
  })
}

export async function createOrder(
  clientId: string,
  data: {
    vehicleId: string
    customerId: string
    customerName: string
    vehiclePlate: string
    vehicleModel: string
    items: OrderLineItem[]
    totalValue: number
    notes?: string
  }
) {
  const now = Date.now()
  return addDoc(col(clientId, 'orders'), {
    ...data,
    clientId,
    status: 'quoted' as OrderStatus,
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
  const ref = doc(db, 'clients', clientId, 'orders', orderId)
  return updateDoc(ref, { status, updatedAt: Date.now(), ...extra })
}

export async function requestInvoice(clientId: string, orderId: string) {
  const ref = doc(db, 'clients', clientId, 'orders', orderId)
  return updateDoc(ref, { invoiceRequested: true, updatedAt: Date.now() })
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
