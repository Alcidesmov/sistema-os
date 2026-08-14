'use client'

import { useEffect, useMemo, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchServices, createService, createServicesBulk, deleteService } from '@/lib/firebase/firestore'
import { ServiceItem } from '@/lib/types'
import { normalize } from '@/lib/utils/search'

function parseBulkLine(line: string): Omit<ServiceItem, 'id' | 'clientId'> | null {
  const parts = line.split(';').map((p) => p.trim())
  const [code, barcode, name, typeRaw, priceRaw] = parts
  if (!name || !priceRaw) return null
  const price = parseFloat(priceRaw.replace(/\./g, '').replace(',', '.'))
  if (Number.isNaN(price)) return null
  const type: ServiceItem['type'] = typeRaw?.toUpperCase().startsWith('P') ? 'part' : 'service'
  const data: Omit<ServiceItem, 'id' | 'clientId'> = { name, price, type }
  if (code) data.code = code
  if (barcode) data.barcode = barcode
  return data
}

export default function ServicesPage() {
  const { clientId } = useClientId()
  const [items, setItems] = useState<ServiceItem[]>([])
  const [code, setCode] = useState('')
  const [barcode, setBarcode] = useState('')
  const [name, setName] = useState('')
  const [price, setPrice] = useState('')
  const [type, setType] = useState<ServiceItem['type']>('service')
  const [saving, setSaving] = useState(false)
  const [showBulk, setShowBulk] = useState(false)
  const [showAddForm, setShowAddForm] = useState(false)
  const [bulkText, setBulkText] = useState('')
  const [bulkImporting, setBulkImporting] = useState(false)
  const [bulkResult, setBulkResult] = useState('')
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (!clientId) return
    return watchServices(clientId, setItems)
  }, [clientId])

  const filteredItems = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return items
    return items.filter(
      (s) =>
        normalize(s.name).includes(q) ||
        (s.code && normalize(s.code).includes(q)) ||
        (s.barcode && normalize(s.barcode).includes(q))
    )
  }, [items, query])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !name || !price) return
    setSaving(true)
    const data: Omit<ServiceItem, 'id' | 'clientId'> = {
      name,
      price: parseFloat(price),
      type,
    }
    if (code) data.code = code
    if (barcode) data.barcode = barcode
    await createService(clientId, data)
    setCode('')
    setBarcode('')
    setName('')
    setPrice('')
    setSaving(false)
  }

  const handleBulkImport = async () => {
    if (!clientId) return
    const lines = bulkText.split('\n').map((l) => l.trim()).filter(Boolean)
    const parsed = lines.map(parseBulkLine).filter((d): d is Omit<ServiceItem, 'id' | 'clientId'> => d !== null)
    const skipped = lines.length - parsed.length
    setBulkImporting(true)
    setBulkResult('')
    await createServicesBulk(clientId, parsed)
    setBulkImporting(false)
    setBulkResult(
      `${parsed.length} importado(s)${skipped > 0 ? `, ${skipped} linha(s) ignorada(s) por formato inválido` : ''}.`
    )
    setBulkText('')
  }

  return (
    <div>
      <h1 className="mb-4 text-2xl font-bold text-gray-900">Serviços e Peças</h1>

      <div className="mb-6">
        <label className="mb-1 block text-xs font-medium text-gray-600">
          Buscar no catálogo
        </label>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Digite o nome, código ou código de barras..."
          autoFocus
          className="w-full max-w-lg rounded-lg border border-gray-300 px-4 py-3 text-base shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
        {query.trim() && (
          <p className="mt-1 text-xs text-gray-500">
            {filteredItems.length} de {items.length} itens
          </p>
        )}
      </div>

      <div className="mb-6 flex items-center gap-4 border-t border-gray-200 pt-4">
        <button
          onClick={() => setShowAddForm((s) => !s)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {showAddForm ? 'Fechar cadastro' : '+ Cadastrar novo item'}
        </button>
        <button
          onClick={() => setShowBulk((s) => !s)}
          className="text-sm font-medium text-blue-600 hover:underline"
        >
          {showBulk ? 'Fechar importação em lote' : 'Importar em lote'}
        </button>
      </div>

      {showBulk && (
        <div className="mb-8 rounded-xl border border-gray-200 bg-white p-4">
          <p className="mb-2 text-xs text-gray-500">
            Uma linha por item, campos separados por <code>;</code>:{' '}
            <code>código;cód.barras;nome;tipo(S ou P);preço</code>. Código e código de barras
            podem ficar vazios.
          </p>
          <textarea
            value={bulkText}
            onChange={(e) => setBulkText(e.target.value)}
            rows={8}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
            placeholder={'10;RDX-18066;ADITIVO RADIEX HOMOLOGADO;P;70,00\n21;;ADITIVO TEC COOL;P;15,00'}
          />
          <div className="mt-3 flex items-center gap-3">
            <button
              onClick={handleBulkImport}
              disabled={bulkImporting || !bulkText.trim()}
              className="rounded-lg bg-teal-600 px-4 py-2 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
            >
              {bulkImporting ? 'Importando...' : 'Importar'}
            </button>
            {bulkResult && <p className="text-sm text-gray-600">{bulkResult}</p>}
          </div>
        </div>
      )}

      {showAddForm && (
      <form
        onSubmit={handleSubmit}
        className="mb-8 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Código</label>
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="10"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Cód. barras</label>
          <input
            value={barcode}
            onChange={(e) => setBarcode(e.target.value)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="7898173503434"
          />
        </div>
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
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Código</th>
              <th className="px-4 py-3">Cód. barras</th>
              <th className="px-4 py-3">Nome</th>
              <th className="px-4 py-3">Tipo</th>
              <th className="px-4 py-3">Preço</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {filteredItems.map((s) => (
              <tr key={s.id}>
                <td className="px-4 py-3 text-gray-600">{s.code || '—'}</td>
                <td className="px-4 py-3 text-gray-600">{s.barcode || '—'}</td>
                <td className="px-4 py-3 font-medium text-gray-900">{s.name}</td>
                <td className="px-4 py-3 text-gray-600">
                  {s.type === 'service' ? 'Serviço' : 'Peça'}
                </td>
                <td className="px-4 py-3 text-gray-600">
                  {s.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
                </td>
                <td className="px-4 py-3">
                  <button
                    onClick={() => clientId && deleteService(clientId, s.id)}
                    className="text-xs text-red-500 hover:underline"
                  >
                    excluir
                  </button>
                </td>
              </tr>
            ))}
            {filteredItems.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-8 text-center text-gray-400">
                  {items.length === 0
                    ? 'Nenhum serviço/peça cadastrado ainda'
                    : 'Nenhum item encontrado pra essa busca'}
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
