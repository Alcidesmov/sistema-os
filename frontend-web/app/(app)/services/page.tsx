'use client'

import { useEffect, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchServices, createService } from '@/lib/firebase/firestore'
import { ServiceItem } from '@/lib/types'

export default function ServicesPage() {
  const { clientId } = useClientId()
  const [items, setItems] = useState<ServiceItem[]>([])
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [type, setType] = useState<ServiceItem['type']>('service')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!clientId) return
    return watchServices(clientId, setItems)
  }, [clientId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !name || !price) return
    setSaving(true)
    await createService(clientId, { name, price: parseFloat(price), type })
    setName('')
    setPrice('')
    setSaving(false)
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Serviços e Peças</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Troca de óleo"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as ServiceItem['type'])}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="service">Serviço</option>
            <option value="part">Peça</option>
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Preço (R$)</label>
          <input
            value={price}
            onChange={(e) => setPrice(e.target.value)}
            type="number"
            step="0.01"
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="150.00"
          />
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Salvando...' : '+ Adicionar'}
        </button>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Preço</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {items.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {s.type === 'service' ? 'Serviço' : 'Peça'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {s.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
              </tr>
            ))}
            {items.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-gray-400">
                  Nenhum serviço/peça cadastrado ainda
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
