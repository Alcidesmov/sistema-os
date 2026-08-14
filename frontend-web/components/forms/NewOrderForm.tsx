'use client'

import { useEffect, useMemo, useState } from 'react'
import { Customer, Vehicle, ServiceItem, OrderLineItem } from '@/lib/types'
import { createOrder, createCustomer, createVehicle } from '@/lib/firebase/firestore'
import { normalize } from '@/lib/utils/search'
import { CustomerAutocomplete } from '@/lib/components/CustomerAutocomplete'
import { VehicleAutocomplete } from '@/lib/components/VehicleAutocomplete'

interface NewOrderFormProps {
  clientId: string
  customers: Customer[]
  vehicles: Vehicle[]
  services: ServiceItem[]
  onDone: () => void
}

export function NewOrderForm({
  clientId,
  customers,
  vehicles,
  services,
  onDone,
}: NewOrderFormProps) {
  const [customerId, setCustomerId] = useState('')
  const [newCustomerName, setNewCustomerName] = useState('')
  const [newCustomerPhone, setNewCustomerPhone] = useState('')

  const [vehicleId, setVehicleId] = useState('')
  const [newVehiclePlate, setNewVehiclePlate] = useState('')
  const [newVehicleModel, setNewVehicleModel] = useState('')

  const [lineItems, setLineItems] = useState<OrderLineItem[]>([])
  const [saving, setSaving] = useState(false)

  const [avulsoDesc, setAvulsoDesc] = useState('')
  const [avulsoType, setAvulsoType] = useState<'service' | 'part'>('service')
  const [avulsoPrice, setAvulsoPrice] = useState('')

  const [itemQuery, setItemQuery] = useState('')
  const [showItemResults, setShowItemResults] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const filteredVehicles = useMemo(
    () => vehicles.filter((v) => v.customerId === customerId),
    [vehicles, customerId]
  )

  const itemResults = useMemo(() => {
    const q = normalize(itemQuery.trim())
    if (!q) return []
    return services
      .filter(
        (s) =>
          normalize(s.name).includes(q) ||
          (s.code && normalize(s.code).includes(q)) ||
          (s.barcode && normalize(s.barcode).includes(q))
      )
      .slice(0, 8)
  }, [services, itemQuery])

  const total = useMemo(
    () => lineItems.reduce((sum, i) => sum + i.subtotal, 0),
    [lineItems]
  )

  const addItem = (service: ServiceItem) => {
    setLineItems((prev) => {
      const existing = prev.find((i) => i.itemId === service.id)
      if (existing) {
        return prev.map((i) =>
          i.itemId === service.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
            : i
        )
      }
      return [
        ...prev,
        {
          itemId: service.id,
          type: service.type,
          description: service.name,
          quantity: 1,
          unitPrice: service.price,
          subtotal: service.price,
        },
      ]
    })
    setItemQuery('')
    setShowItemResults(false)
    setHighlightedIndex(0)
  }

  const handleItemSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showItemResults || itemResults.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, itemResults.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      addItem(itemResults[highlightedIndex])
    } else if (e.key === 'Escape') {
      setShowItemResults(false)
    }
  }

  const removeItem = (itemId: string) => {
    setLineItems((prev) => prev.filter((i) => i.itemId !== itemId))
  }

  const addAvulsoItem = () => {
    const price = parseFloat(avulsoPrice.replace(',', '.'))
    if (!avulsoDesc || Number.isNaN(price)) return
    setLineItems((prev) => [
      ...prev,
      {
        itemId: crypto.randomUUID(),
        type: avulsoType,
        description: avulsoDesc,
        quantity: 1,
        unitPrice: price,
        subtotal: price,
      },
    ])
    setAvulsoDesc('')
    setAvulsoPrice('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (lineItems.length === 0) return
    setSaving(true)

    try {
      let finalCustomerId = customerId
      let finalCustomerName = customers.find((c) => c.id === customerId)?.name ?? ''

      if (!finalCustomerId && newCustomerName && newCustomerPhone) {
        const ref = await createCustomer(clientId, {
          name: newCustomerName,
          phone: newCustomerPhone,
        })
        finalCustomerId = ref.id
        finalCustomerName = newCustomerName
      }

      let finalVehicleId = vehicleId
      let finalPlate = vehicles.find((v) => v.id === vehicleId)?.plate ?? ''
      let finalModel = vehicles.find((v) => v.id === vehicleId)?.model ?? ''

      if (!finalVehicleId && newVehiclePlate && newVehicleModel) {
        const ref = await createVehicle(clientId, {
          plate: newVehiclePlate.toUpperCase(),
          model: newVehicleModel,
          brand: '',
          year: '',
          color: '',
          type: 'carro',
          customerId: finalCustomerId,
        })
        finalVehicleId = ref.id
        finalPlate = newVehiclePlate.toUpperCase()
        finalModel = newVehicleModel
      }

      if (!finalCustomerId || !finalVehicleId) {
        setSaving(false)
        return
      }

      await createOrder(clientId, {
        customerId: finalCustomerId,
        customerName: finalCustomerName,
        vehicleId: finalVehicleId,
        vehiclePlate: finalPlate,
        vehicleModel: finalModel,
        items: lineItems,
        totalValue: total,
      })

      setSaving(false)
      onDone()
    } catch (error) {
      console.error('Erro ao criar OS:', error)
      setSaving(false)
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mb-8 space-y-5 rounded-xl border border-gray-200 bg-white p-5"
    >
      {/* CLIENTE — PRIMEIRO, DESTAQUE */}
      <div>
        <label className="mb-2 block text-sm font-semibold text-gray-900">
          👤 Cliente
        </label>
        {!customerId ? (
          <>
            <CustomerAutocomplete
              customers={customers}
              value=""
              onChange={(cid) => {
                setCustomerId(cid)
                setNewCustomerName('')
                setNewCustomerPhone('')
                setVehicleId('')
              }}
              autoFocus
            />
            <p className="mt-2 text-xs text-gray-500">Ou preencha abaixo para criar novo</p>
            <div className="mt-2 grid grid-cols-2 gap-2">
              <input
                value={newCustomerName}
                onChange={(e) => setNewCustomerName(e.target.value)}
                placeholder="Nome do cliente"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <input
                value={newCustomerPhone}
                onChange={(e) => setNewCustomerPhone(e.target.value)}
                placeholder="Telefone"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2">
            <span className="text-sm font-medium text-blue-900">
              {customers.find((c) => c.id === customerId)?.name}
            </span>
            <button
              type="button"
              onClick={() => {
                setCustomerId('')
                setVehicleId('')
              }}
              className="text-xs text-blue-600 hover:underline"
            >
              Trocar
            </button>
          </div>
        )}
      </div>

      {/* VEÍCULO — SEGUNDO */}
      {customerId && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            🚗 Veículo
          </label>
          {!vehicleId ? (
            <>
              <VehicleAutocomplete
                vehicles={filteredVehicles}
                value=""
                onChange={(vid) => setVehicleId(vid)}
                autoFocus
              />
              <p className="mt-2 text-xs text-gray-500">Ou preencha abaixo para criar novo</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <input
                  value={newVehiclePlate}
                  onChange={(e) => setNewVehiclePlate(e.target.value)}
                  placeholder="Placa (ex: ABC1234)"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
                />
                <input
                  value={newVehicleModel}
                  onChange={(e) => setNewVehicleModel(e.target.value)}
                  placeholder="Modelo (ex: Gol 1.0)"
                  className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                />
              </div>
            </>
          ) : (
            <div className="flex items-center justify-between rounded-lg bg-green-50 px-3 py-2">
              <span className="text-sm font-medium text-green-900">
                {vehicles.find((v) => v.id === vehicleId)?.plate} ·{' '}
                {vehicles.find((v) => v.id === vehicleId)?.model}
              </span>
              <button
                type="button"
                onClick={() => setVehicleId('')}
                className="text-xs text-green-600 hover:underline"
              >
                Trocar
              </button>
            </div>
          )}
        </div>
      )}

      {/* SERVIÇOS — TERCEIRO, AUTOCOMPLETE */}
      {customerId && vehicleId && (
        <div>
          <label className="mb-2 block text-sm font-semibold text-gray-900">
            🔧 Serviços e Peças
          </label>
          <div className="relative">
            <input
              value={itemQuery}
              onChange={(e) => {
                setItemQuery(e.target.value)
                setShowItemResults(true)
                setHighlightedIndex(0)
              }}
              onFocus={() => setShowItemResults(true)}
              onBlur={() => setTimeout(() => setShowItemResults(false), 150)}
              onKeyDown={handleItemSearchKeyDown}
              placeholder="Nome, código ou código de barras..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {showItemResults && itemQuery.trim() && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {itemResults.length > 0 ? (
                  itemResults.map((s, idx) => (
                    <button
                      type="button"
                      key={s.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => addItem(s)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        idx === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="truncate">
                        {s.code && <span className="text-gray-400">{s.code} · </span>}
                        {s.name}
                      </span>
                      <span className="ml-2 shrink-0 text-gray-600">
                        {s.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                      </span>
                    </button>
                  ))
                ) : (
                  <p className="px-3 py-2 text-sm text-gray-400">Nenhum item encontrado.</p>
                )}
              </div>
            )}
          </div>

          {services.length === 0 && (
            <p className="mt-1 text-xs text-gray-400">
              Nenhum serviço cadastrado. Vá em "Serviços e Peças" para adicionar.
            </p>
          )}

          {/* ITEM AVULSO */}
          <details className="mt-3 rounded-lg border border-dashed border-gray-300 p-3">
            <summary className="cursor-pointer text-xs font-medium text-gray-600">
              ➕ Item avulso (sem serviço definido)
            </summary>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input
                value={avulsoDesc}
                onChange={(e) => setAvulsoDesc(e.target.value)}
                placeholder="Descrição"
                className="min-w-[180px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={avulsoType}
                onChange={(e) => setAvulsoType(e.target.value as 'service' | 'part')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="service">Serviço</option>
                <option value="part">Peça</option>
              </select>
              <input
                value={avulsoPrice}
                onChange={(e) => setAvulsoPrice(e.target.value)}
                type="number"
                step="0.01"
                placeholder="Preço"
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={addAvulsoItem}
                disabled={!avulsoDesc || !avulsoPrice}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </details>

          {/* ITENS ADICIONADOS */}
          {lineItems.length > 0 && (
            <div className="mt-3 space-y-1 rounded-lg border border-gray-200 bg-gray-50 p-3">
              <div className="mb-2 text-xs font-semibold text-gray-600 uppercase">
                {lineItems.length} item(ns) na OS
              </div>
              {lineItems.map((i) => (
                <div key={i.itemId} className="flex items-center justify-between text-sm">
                  <span className="flex-1">
                    {i.quantity}x {i.description}
                  </span>
                  <div className="flex items-center gap-3">
                    <span className="font-medium text-gray-900">
                      {i.subtotal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeItem(i.itemId)}
                      className="text-xs text-red-500 hover:underline"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
              <div className="border-t border-gray-300 pt-2">
                <div className="flex justify-between text-sm font-bold text-gray-900">
                  <span>TOTAL</span>
                  <span>
                    {total.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* BOTÃO SUBMIT */}
      <button
        type="submit"
        disabled={saving || lineItems.length === 0}
        className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50"
      >
        {saving ? '⏳ Criando diagnóstico...' : '✅ Criar diagnóstico / orçamento'}
      </button>
    </form>
  )
}
