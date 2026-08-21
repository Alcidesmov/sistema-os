'use client'

import { useMemo, useState } from 'react'
import { Customer, Vehicle } from '@/lib/types'
import { normalize } from '@/lib/utils/search'

/**
 * O campo único do balcão. Quem chega na oficina fala uma coisa só —
 * "é o Gol prata do João", "ABC1D23", "(11) 99999-8888" — e não sabe se
 * isso é "cliente" ou "veículo". Ter dois campos separados obrigava o
 * atendente a decidir isso ANTES de digitar. Aqui é um campo só, que
 * procura nos dois cadastros ao mesmo tempo e sempre oferece cadastrar.
 */

interface BuscaBalcaoProps {
  customers: Customer[]
  vehicles: Vehicle[]
  onPickCustomer: (customer: Customer) => void
  /** Escolher o carro escolhe o dono junto — é sempre o mesmo gesto. */
  onPickVehicle: (vehicle: Vehicle, dono?: Customer) => void
  onCreate: (nome: string) => void
  placeholder?: string
  autoFocus?: boolean
  maxResults?: number
}

type Row =
  | { kind: 'vehicle'; key: string; vehicle: Vehicle; dono?: Customer }
  | { kind: 'customer'; key: string; customer: Customer }
  | { kind: 'create'; key: string }

export function BuscaBalcao({
  customers,
  vehicles,
  onPickCustomer,
  onPickVehicle,
  onCreate,
  placeholder = 'Placa, nome do cliente ou telefone',
  autoFocus = true,
  maxResults = 6,
}: BuscaBalcaoProps) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [highlighted, setHighlighted] = useState(0)

  const trimmed = query.trim()

  const byId = useMemo(() => {
    const m = new Map<string, Customer>()
    for (const c of customers) m.set(c.id, c)
    return m
  }, [customers])

  const { vehicleRows, customerRows } = useMemo(() => {
    const q = normalize(trimmed)
    if (!q) return { vehicleRows: [] as Vehicle[], customerRows: [] as Customer[] }

    const vs = vehicles
      .filter((v) => {
        const dono = byId.get(v.customerId)
        return (
          normalize(v.plate ?? '').includes(q) ||
          normalize(v.model ?? '').includes(q) ||
          normalize(v.brand ?? '').includes(q) ||
          normalize(dono?.name ?? '').includes(q)
        )
      })
      .slice(0, maxResults)

    const cs = customers
      .filter(
        (c) =>
          normalize(c.name ?? '').includes(q) ||
          normalize(c.phone ?? '').includes(q) ||
          normalize(c.document ?? '').includes(q)
      )
      .slice(0, maxResults)

    return { vehicleRows: vs, customerRows: cs }
  }, [trimmed, vehicles, customers, byId, maxResults])

  const rows: Row[] = useMemo(() => {
    const out: Row[] = []
    for (const v of vehicleRows) {
      out.push({ kind: 'vehicle', key: `v-${v.id}`, vehicle: v, dono: byId.get(v.customerId) })
    }
    for (const c of customerRows) {
      out.push({ kind: 'customer', key: `c-${c.id}`, customer: c })
    }
    if (trimmed) out.push({ kind: 'create', key: 'create' })
    return out
  }, [vehicleRows, customerRows, byId, trimmed])

  const reset = () => {
    setQuery('')
    setOpen(false)
    setHighlighted(0)
  }

  const pick = (row: Row) => {
    if (row.kind === 'vehicle') onPickVehicle(row.vehicle, row.dono)
    else if (row.kind === 'customer') onPickCustomer(row.customer)
    else onCreate(trimmed)
    reset()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setOpen(false)
      return
    }
    if (!open || rows.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlighted((i) => Math.min(i + 1, rows.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlighted((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (rows[highlighted]) pick(rows[highlighted])
    }
  }

  const rowClass = (idx: number) =>
    `flex w-full flex-col items-start px-3 py-2 text-left text-sm ${
      idx === highlighted ? 'bg-blue-50' : 'hover:bg-gray-50'
    }`

  const firstVehicleIdx = 0
  const firstCustomerIdx = vehicleRows.length
  const createIdx = vehicleRows.length + customerRows.length

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setOpen(true)
          setHighlighted(0)
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-gray-300 px-3 py-2.5 text-sm focus:border-blue-500 focus:outline-none"
      />

      {open && trimmed && (
        <div className="absolute z-20 mt-1 max-h-80 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {vehicleRows.length > 0 && (
            <p className="bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Veículos
            </p>
          )}
          {vehicleRows.map((v, i) => {
            const idx = firstVehicleIdx + i
            const dono = byId.get(v.customerId)
            return (
              <button
                type="button"
                key={`v-${v.id}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick({ kind: 'vehicle', key: `v-${v.id}`, vehicle: v, dono })}
                className={rowClass(idx)}
              >
                <span className="font-medium text-gray-900">
                  {v.plate}
                  {v.model ? ` · ${v.model}` : ''}
                  {dono ? ` — ${dono.name}` : ''}
                </span>
                <span className="text-xs text-gray-500">
                  {dono ? 'Escolhe o cliente e o veículo de uma vez' : 'Veículo sem dono cadastrado'}
                </span>
              </button>
            )
          })}

          {customerRows.length > 0 && (
            <p className="border-t border-gray-100 bg-gray-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
              Clientes
            </p>
          )}
          {customerRows.map((c, i) => {
            const idx = firstCustomerIdx + i
            return (
              <button
                type="button"
                key={`c-${c.id}`}
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => pick({ kind: 'customer', key: `c-${c.id}`, customer: c })}
                className={rowClass(idx)}
              >
                <span className="font-medium text-gray-900">
                  {c.name}
                  {c.phone ? ` · ${c.phone}` : ''}
                </span>
                <span className="text-xs text-gray-500">Só o cliente — o veículo entra depois</span>
              </button>
            )
          })}

          <button
            type="button"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => pick({ kind: 'create', key: 'create' })}
            className={`flex w-full items-center border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-blue-700 ${
              highlighted === createIdx ? 'bg-blue-50' : 'hover:bg-gray-50'
            }`}
          >
            ➕ Cadastrar «{trimmed}» como cliente novo
          </button>
        </div>
      )}
    </div>
  )
}
