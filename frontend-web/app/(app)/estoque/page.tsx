'use client'

import { useEffect, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { useAuth } from '@/lib/hooks/useAuth'
import {
  watchInventory,
  watchServices,
  createInventoryItem,
  updateInventoryItem,
  deleteInventoryItem,
} from '@/lib/firebase/firestore'
import { InventoryItem, ServiceItem } from '@/lib/types'
import { normalize } from '@/lib/utils/search'

type FormMode = 'hidden' | 'new' | 'edit'

const BRL = (v: number) =>
  v.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })

function statusLabel(item: InventoryItem, minQty?: number): {
  label: string
  cls: string
} {
  const min = minQty ?? item.minQuantity ?? 0
  if (item.quantity < 0) return { label: 'Crítico', cls: 'bg-red-100 text-red-700' }
  if (min > 0 && item.quantity <= min) return { label: 'Baixo', cls: 'bg-amber-100 text-amber-700' }
  return { label: 'OK', cls: 'bg-green-100 text-green-700' }
}

export default function EstoquePage() {
  const { clientId } = useClientId()
  const { user } = useAuth()

  const [items, setItems] = useState<InventoryItem[]>([])
  const [services, setServices] = useState<ServiceItem[]>([])
  const [busca, setBusca] = useState('')
  const [formMode, setFormMode] = useState<FormMode>('hidden')
  const [editId, setEditId] = useState<string | null>(null)

  // Campos do formulário
  const [selServiceId, setSelServiceId] = useState('')
  const [qty, setQty] = useState('')
  const [unitPrice, setUnitPrice] = useState('')
  const [minQty, setMinQty] = useState('')
  const [entryDate, setEntryDate] = useState(() => new Date().toISOString().slice(0, 10))
  const [buscaServico, setBuscaServico] = useState('')
  const [saving, setSaving] = useState(false)
  const [erro, setErro] = useState('')

  // CSV import
  const [csvText, setCsvText] = useState('')
  const [csvMode, setCsvMode] = useState(false)

  useEffect(() => {
    if (!clientId) return
    const unsub1 = watchInventory(clientId, setItems)
    const unsub2 = watchServices(clientId, setServices)
    return () => { unsub1(); unsub2() }
  }, [clientId])

  // Mapa serviceItemId → ServiceItem para lookup rápido
  const serviceMap = new Map(services.map((s) => [s.id, s]))

  // Filtrar itens pela busca
  const filtered = items.filter((item) => {
    if (!busca) return true
    const svc = serviceMap.get(item.serviceItemId)
    const nome = svc?.name ?? ''
    const codigo = svc?.code ?? ''
    const q = normalize(busca)
    return normalize(nome).includes(q) || normalize(codigo).includes(q)
  })

  // Peças disponíveis para selecionar (apenas type==='part' ou todas)
  const servicosFiltrados = services.filter((s) => {
    if (!buscaServico) return true
    const q = normalize(buscaServico)
    return normalize(s.name).includes(q) || normalize(s.code ?? '').includes(q)
  })

  function resetForm() {
    setSelServiceId('')
    setQty('')
    setUnitPrice('')
    setMinQty('')
    setEntryDate(new Date().toISOString().slice(0, 10))
    setBuscaServico('')
    setErro('')
    setEditId(null)
  }

  function openNew() {
    resetForm()
    setFormMode('new')
  }

  function openEdit(item: InventoryItem) {
    const svc = serviceMap.get(item.serviceItemId)
    setEditId(item.id)
    setSelServiceId(item.serviceItemId)
    setBuscaServico(svc?.name ?? '')
    setQty(String(item.quantity))
    setUnitPrice(String(item.unitPrice))
    setMinQty(item.minQuantity !== undefined ? String(item.minQuantity) : '')
    setEntryDate(new Date(item.entryDate).toISOString().slice(0, 10))
    setErro('')
    setFormMode('edit')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!clientId || !user) return
    if (!selServiceId) { setErro('Selecione uma peça/serviço'); return }
    const qtyNum = parseFloat(qty)
    const priceNum = parseFloat(unitPrice.replace(',', '.'))
    if (isNaN(qtyNum)) { setErro('Quantidade inválida'); return }
    if (isNaN(priceNum) || priceNum < 0) { setErro('Preço inválido'); return }

    setSaving(true)
    setErro('')
    try {
      if (formMode === 'new') {
        await createInventoryItem(
          clientId,
          {
            serviceItemId: selServiceId,
            quantity: qtyNum,
            unitPrice: priceNum,
            entryDate: new Date(entryDate).getTime(),
            ...(minQty ? { minQuantity: parseFloat(minQty) } : {}),
          },
          user.email ?? 'sistema'
        )
      } else if (formMode === 'edit' && editId) {
        await updateInventoryItem(
          clientId,
          editId,
          {
            quantity: qtyNum,
            unitPrice: priceNum,
            ...(minQty ? { minQuantity: parseFloat(minQty) } : {}),
          },
          user.email ?? 'sistema'
        )
      }
      setFormMode('hidden')
      resetForm()
    } catch (err) {
      setErro('Erro ao salvar. Tente novamente.')
      console.error(err)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(item: InventoryItem) {
    if (!clientId || !user) return
    if (!confirm(`Remover ${serviceMap.get(item.serviceItemId)?.name ?? 'item'} do estoque?`)) return
    await deleteInventoryItem(clientId, item.id, user.email ?? 'sistema')
  }

  async function handleCsvImport() {
    if (!clientId || !user || !csvText.trim()) return
    const linhas = csvText.trim().split('\n').map((l) => l.trim()).filter(Boolean)
    let ok = 0
    const erros: string[] = []
    for (const linha of linhas) {
      const partes = linha.split(';')
      if (partes.length < 3) { erros.push(`Linha inválida: ${linha}`); continue }
      const [codigoOuNome, qtyStr, priceStr, dateStr] = partes
      const q = normalize(codigoOuNome)
      const svc = services.find(
        (s) => normalize(s.code ?? '') === q || normalize(s.name) === q
      )
      if (!svc) { erros.push(`Peça não encontrada: ${codigoOuNome}`); continue }
      const quantidade = parseFloat(qtyStr)
      const preco = parseFloat(priceStr.replace(',', '.'))
      if (isNaN(quantidade) || isNaN(preco)) { erros.push(`Valores inválidos: ${linha}`); continue }
      const data = dateStr ? new Date(dateStr).getTime() : Date.now()
      try {
        await createInventoryItem(
          clientId,
          { serviceItemId: svc.id, quantity: quantidade, unitPrice: preco, entryDate: data },
          user.email ?? 'sistema'
        )
        ok++
      } catch {
        erros.push(`Erro ao importar: ${codigoOuNome}`)
      }
    }
    alert(`${ok} item(ns) importado(s).${erros.length ? '\n\nErros:\n' + erros.join('\n') : ''}`)
    setCsvText('')
    setCsvMode(false)
  }

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Estoque</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setCsvMode(!csvMode)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-600 hover:bg-gray-50"
          >
            {csvMode ? 'Fechar CSV' : 'Importar CSV'}
          </button>
          <button
            onClick={openNew}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            + Novo item
          </button>
        </div>
      </div>

      {/* Busca */}
      <div>
        <input
          type="text"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          placeholder="Buscar peça por nome ou código…"
          autoFocus
          className="w-full rounded-lg border border-gray-300 px-4 py-2.5 text-sm shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {/* CSV Import */}
      {csvMode && (
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 space-y-3">
          <p className="text-sm font-medium text-gray-700">
            Formato: <code className="text-xs bg-white border rounded px-1">código_ou_nome;quantidade;preço_unitário;data_entrada(YYYY-MM-DD)</code>
          </p>
          <p className="text-xs text-gray-500">
            A data é opcional (usa hoje se omitida). O código/nome deve bater com o catálogo de Serviços e Peças.
          </p>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            rows={6}
            placeholder={'ADITIVO RADIEX;10;70,00;2026-11-25\nFILTRO DE ÓLEO;20;15,50'}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-sm focus:border-blue-500 focus:outline-none"
          />
          <button
            onClick={handleCsvImport}
            disabled={!csvText.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            Importar
          </button>
        </div>
      )}

      {/* Formulário de criação/edição */}
      {formMode !== 'hidden' && (
        <form onSubmit={handleSave} className="rounded-lg border border-blue-200 bg-blue-50 p-4 space-y-4">
          <h2 className="font-semibold text-blue-800">
            {formMode === 'new' ? 'Novo item de estoque' : 'Editar item de estoque'}
          </h2>

          {formMode === 'new' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Peça / Serviço *
              </label>
              <input
                type="text"
                value={buscaServico}
                onChange={(e) => { setBuscaServico(e.target.value); setSelServiceId('') }}
                placeholder="Buscar no catálogo…"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              {buscaServico && !selServiceId && (
                <div className="mt-1 max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
                  {servicosFiltrados.slice(0, 10).map((s) => (
                    <button
                      key={s.id}
                      type="button"
                      onClick={() => { setSelServiceId(s.id); setBuscaServico(s.name) }}
                      className="block w-full px-3 py-2 text-left text-sm hover:bg-blue-50"
                    >
                      <span className="font-medium">{s.name}</span>
                      {s.code && <span className="ml-2 text-xs text-gray-400">{s.code}</span>}
                      <span className="ml-2 text-xs text-gray-500">
                        {s.type === 'part' ? 'Peça' : 'Serviço'}
                      </span>
                    </button>
                  ))}
                  {servicosFiltrados.length === 0 && (
                    <p className="px-3 py-2 text-sm text-gray-400">Nenhum item encontrado</p>
                  )}
                </div>
              )}
              {selServiceId && (
                <p className="mt-1 text-xs text-green-600">✓ {serviceMap.get(selServiceId)?.name}</p>
              )}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Quantidade *</label>
              <input
                type="number"
                step="1"
                value={qty}
                onChange={(e) => setQty(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Preço unitário (R$) *</label>
              <input
                type="text"
                inputMode="decimal"
                value={unitPrice}
                onChange={(e) => setUnitPrice(e.target.value)}
                required
                placeholder="0,00"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Qtd. mínima</label>
              <input
                type="number"
                step="1"
                value={minQty}
                onChange={(e) => setMinQty(e.target.value)}
                placeholder="0"
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Data entrada</label>
              <input
                type="date"
                value={entryDate}
                onChange={(e) => setEntryDate(e.target.value)}
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
            </div>
          </div>

          {erro && <p className="text-sm text-red-600">{erro}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={() => { setFormMode('hidden'); resetForm() }}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-600 hover:bg-gray-50"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Tabela */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Peça / Serviço</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Qtd.</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Preço unit.</th>
              <th className="px-4 py-3 text-right font-semibold text-gray-600">Total</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Status</th>
              <th className="px-4 py-3 text-left font-semibold text-gray-600">Entrada</th>
              <th className="px-4 py-3"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {filtered.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-gray-400">
                  {busca ? 'Nenhum item encontrado para essa busca.' : 'Nenhum item em estoque ainda.'}
                </td>
              </tr>
            )}
            {filtered.map((item) => {
              const svc = serviceMap.get(item.serviceItemId)
              const total = item.quantity * item.unitPrice
              const st = statusLabel(item)
              return (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <p className="font-medium text-gray-900">{svc?.name ?? '—'}</p>
                    {svc?.code && <p className="text-xs text-gray-400">{svc.code}</p>}
                    <p className="text-xs text-gray-400">{svc?.type === 'part' ? 'Peça' : 'Serviço'}</p>
                  </td>
                  <td className={`px-4 py-3 text-right font-mono ${item.quantity < 0 ? 'text-red-600 font-semibold' : 'text-gray-900'}`}>
                    {item.quantity}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{BRL(item.unitPrice)}</td>
                  <td className="px-4 py-3 text-right font-mono text-gray-900">{BRL(total)}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${st.cls}`}>
                      {st.label}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(item.entryDate).toLocaleDateString('pt-BR')}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-2">
                      <button
                        onClick={() => openEdit(item)}
                        className="text-xs text-blue-600 hover:underline"
                      >
                        Editar
                      </button>
                      <button
                        onClick={() => handleDelete(item)}
                        className="text-xs text-red-500 hover:underline"
                      >
                        Remover
                      </button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
          {filtered.length > 0 && (
            <tfoot className="bg-gray-50">
              <tr>
                <td className="px-4 py-2 text-sm font-semibold text-gray-700">
                  Total ({filtered.length} {filtered.length === 1 ? 'item' : 'itens'})
                </td>
                <td />
                <td />
                <td className="px-4 py-2 text-right font-mono font-semibold text-gray-900">
                  {BRL(filtered.reduce((s, i) => s + i.quantity * i.unitPrice, 0))}
                </td>
                <td colSpan={3} />
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
