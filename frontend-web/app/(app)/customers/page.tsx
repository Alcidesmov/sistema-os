'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import {
  watchCustomers,
  watchVehicles,
  watchOrders,
  createCustomer,
} from '@/lib/firebase/firestore'
import { Customer, Vehicle, Order } from '@/lib/types'
import { normalize } from '@/lib/utils/search'
import { dateBR, money } from '@/lib/orders/format'
import { isCancelled } from '@/lib/orders/status'

interface Resumo {
  carros: number
  os: number
  total: number
  ultima: number
}

export default function CustomersPage() {
  const router = useRouter()
  const { clientId } = useClientId()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  const [query, setQuery] = useState('')

  const [showForm, setShowForm] = useState(false)
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [docNumber, setDocNumber] = useState('')
  const [saving, setSaving] = useState(false)
  const [created, setCreated] = useState<{ id: string; name: string } | null>(null)

  useEffect(() => {
    if (!clientId) return
    const unsubCustomers = watchCustomers(clientId, setCustomers)
    const unsubVehicles = watchVehicles(clientId, setVehicles)
    const unsubOrders = watchOrders(clientId, setOrders)
    return () => {
      unsubCustomers()
      unsubVehicles()
      unsubOrders()
    }
  }, [clientId])

  /**
   * Resumo por cliente derivado EM MEMÓRIA das listas que a tela já
   * assina — nada de consulta nova por linha (seriam N leituras e um
   * índice composto novo no Firestore só pra mostrar uma data).
   */
  const resumoPorCliente = useMemo(() => {
    const map = new Map<string, Resumo>()
    const get = (id: string) =>
      map.get(id) ?? { carros: 0, os: 0, total: 0, ultima: 0 }

    for (const v of vehicles) {
      if (!v.customerId) continue
      const cur = get(v.customerId)
      cur.carros += 1
      map.set(v.customerId, cur)
    }
    for (const o of orders) {
      if (!o.customerId) continue
      const cur = get(o.customerId)
      cur.os += 1
      cur.ultima = Math.max(cur.ultima, o.createdAt)
      if (!isCancelled(o)) cur.total += o.totalValue || 0
      map.set(o.customerId, cur)
    }
    return map
  }, [vehicles, orders])

  /** Placas de cada cliente — pra achar o dono digitando a placa. */
  const placasPorCliente = useMemo(() => {
    const map = new Map<string, string>()
    for (const v of vehicles) {
      if (!v.customerId) continue
      const anterior = map.get(v.customerId) ?? ''
      map.set(v.customerId, `${anterior} ${v.plate} ${v.model} ${v.brand ?? ''}`)
    }
    return map
  }, [vehicles])

  const filtered = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return customers
    return customers.filter((c) => {
      const alvo = [
        c.name,
        c.phone ?? '',
        c.email ?? '',
        c.document ?? '',
        placasPorCliente.get(c.id) ?? '',
      ].join(' ')
      return normalize(alvo).includes(q)
    })
  }, [customers, query, placasPorCliente])

  const podeSalvar = Boolean(clientId) && name.trim().length > 0

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !podeSalvar) return
    setSaving(true)
    const ref = await createCustomer(clientId, {
      name: name.trim(),
      phone: phone.trim() || undefined,
      email: email.trim() || undefined,
      document: docNumber.trim() || undefined,
    })
    setCreated({ id: ref.id, name: name.trim() })
    setName('')
    setPhone('')
    setEmail('')
    setDocNumber('')
    setSaving(false)
  }

  return (
    <div>
      <h1 className="mb-1 text-2xl font-bold text-gray-900">Clientes</h1>
      <p className="mb-4 text-sm text-gray-500">
        Clique em qualquer linha pra abrir a ficha do cliente — carros, histórico de O.S. e
        total gasto.
      </p>

      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-gray-600">Buscar cliente</label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Nome, telefone, e-mail, CPF/CNPJ ou placa do carro..."
          autoFocus
          className="w-full max-w-lg rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query.trim() && (
          <p className="mt-1 text-xs text-gray-500">
            {filtered.length} de {customers.length} clientes
          </p>
        )}
      </div>

      <div className="mb-4 border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowForm((s) => !s)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {showForm ? 'Fechar cadastro' : '+ Cadastrar cliente'}
        </button>
      </div>

      {created && (
        <div className="mb-6 rounded-xl border border-green-200 bg-green-50 p-4">
          <p className="text-sm font-medium text-green-900">
            {created.name} cadastrado. Já dá pra abrir a O.S. — o carro entra depois, dentro
            dela.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href={`/orders/nova?cliente=${created.id}`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Nova O.S. para {created.name}
            </Link>
            <Link
              href={`/customers/${created.id}`}
              className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Abrir ficha do cliente
            </Link>
            <button
              onClick={() => setCreated(null)}
              className="rounded-lg px-3 py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              Dispensar
            </button>
          </div>
        </div>
      )}

      {showForm && (
        <form
          onSubmit={handleSubmit}
          className="mb-8 rounded-xl border border-gray-200 bg-white p-4"
        >
          <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">Nome</label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="Nome do cliente"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                Telefone (opcional)
              </label>
              <input
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="(00) 00000-0000"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                E-mail (opcional)
              </label>
              <input
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                type="email"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="cliente@email.com"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-gray-600">
                CPF/CNPJ (opcional)
              </label>
              <input
                value={docNumber}
                onChange={(e) => setDocNumber(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="000.000.000-00"
              />
            </div>
          </div>

          <div className="mt-4">
            <button
              type="submit"
              disabled={saving || !podeSalvar}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando...' : 'Cadastrar cliente'}
            </button>
            <p className="mt-2 text-xs text-gray-500">
              {!podeSalvar
                ? 'Falta o nome. É o único campo obrigatório — telefone, e-mail e documento entram depois.'
                : 'Só o nome basta. O carro pode ser cadastrado depois, na ficha do cliente.'}
            </p>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Cliente</th>
                <th className="px-4 py-3">Telefone</th>
                <th className="px-4 py-3">Carros</th>
                <th className="px-4 py-3">O.S.</th>
                <th className="px-4 py-3">Total gasto</th>
                <th className="px-4 py-3">Última O.S.</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const r = resumoPorCliente.get(c.id)
                return (
                  <tr
                    key={c.id}
                    onClick={() => router.push(`/customers/${c.id}`)}
                    className="cursor-pointer hover:bg-blue-50"
                  >
                    <td className="px-4 py-3">
                      <span className="font-medium text-gray-900">{c.name}</span>
                      {c.email && (
                        <span className="block text-xs text-gray-400">{c.email}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{c.phone || '—'}</td>
                    <td className="px-4 py-3 text-gray-600">{r?.carros ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{r?.os ?? 0}</td>
                    <td className="px-4 py-3 text-gray-600">{money(r?.total ?? 0)}</td>
                    <td className="px-4 py-3 text-gray-600">
                      {r?.ultima ? dateBR(r.ultima) : '—'}
                    </td>
                  </tr>
                )
              })}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                    {customers.length === 0
                      ? 'Nenhum cliente cadastrado ainda'
                      : 'Nenhum cliente encontrado pra essa busca'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
