'use client'

import { useEffect, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchVehicles, watchCustomers, createVehicle } from '@/lib/firebase/firestore'
import { Vehicle, Customer } from '@/lib/types'

const VEHICLE_TYPES: { value: Vehicle['type']; label: string }[] = [
  { value: 'carro', label: 'Carro' },
  { value: 'moto', label: 'Moto' },
  { value: 'caminhao', label: 'Caminhão' },
  { value: 'outro', label: 'Outro' },
]

export default function VehiclesPage() {
  const { clientId } = useClientId()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [plate, setPlate] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [year, setYear] = useState('')
  const [color, setColor] = useState('')
  const [type, setType] = useState<Vehicle['type']>('carro')
  const [customerId, setCustomerId] = useState('')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!clientId) return
    const unsub1 = watchVehicles(clientId, setVehicles)
    const unsub2 = watchCustomers(clientId, setCustomers)
    return () => {
      unsub1()
      unsub2()
    }
  }, [clientId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !plate || !model || !customerId) return
    setSaving(true)
    await createVehicle(clientId, {
      plate: plate.toUpperCase(),
      brand,
      model,
      year,
      color,
      type,
      customerId,
    })
    setPlate('')
    setBrand('')
    setModel('')
    setYear('')
    setColor('')
    setCustomerId('')
    setSaving(false)
  }

  const customerName = (id: string) => customers.find((c) => c.id === id)?.name ?? '—'

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Veículos</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-8 grid grid-cols-2 gap-3 rounded-xl border border-gray-200 bg-white p-4 md:grid-cols-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Placa</label>
          <input
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
            placeholder="ABC1D23"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Marca</label>
          <input
            value={brand}
            onChange={(e) => setBrand(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Fiat"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Modelo</label>
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Uno"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Ano</label>
          <input
            value={year}
            onChange={(e) => setYear(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="2020"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Cor</label>
          <input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Prata"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as Vehicle['type'])}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {VEHICLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Cliente</label>
          <select
            value={customerId}
            onChange={(e) => setCustomerId(e.target.value)}
            required
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="">Selecione...</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-end">
          <button
            type="submit"
            disabled={saving}
            className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : '+ Novo veículo'}
          </button>
        </div>
      </form>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Placa</th>
              <th className="px-4 py-3">Modelo</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Cliente</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {vehicles.map((v) => (
              <tr key={v.id}>
                <td className="px-4 py-3 font-medium text-gray-900">{v.plate}</td>
                <td className="px-4 py-3 text-gray-600">
                  {v.brand} {v.model} {v.year}
                </td>
                <td className="px-4 py-3 text-gray-600 capitalize">{v.type}</td>
                <td className="px-4 py-3 text-gray-600">{customerName(v.customerId)}</td>
              </tr>
            ))}
            {vehicles.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                  Nenhum veículo cadastrado ainda
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
