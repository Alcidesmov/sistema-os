'use client'

import { useMemo, useState } from 'react'
import { Order, OrderLineItem, ServiceItem } from '@/lib/types'
import { statusOf } from '@/lib/orders/status'
import { money } from '@/lib/orders/format'
import { normalize } from '@/lib/utils/search'
import { updateOrderItems } from '@/lib/firebase/firestore'

interface ItensDaOSProps {
  clientId: string
  order: Order
  services: ServiceItem[]
  by: string
}

/**
 * Os itens da O.S. são editáveis DENTRO dela enquanto o trabalho está vivo
 * (diagnóstico e em serviço) — peça que aparece no meio do serviço entra
 * aqui, sem abrir outra O.S. Depois de finalizada, vira só leitura: o
 * documento já foi fechado com o cliente.
 */
export default function ItensDaOS({ clientId, order, services, by }: ItensDaOSProps) {
  const [busca, setBusca] = useState('')
  const [mostrarResultados, setMostrarResultados] = useState(false)
  const [destaque, setDestaque] = useState(0)
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [avulsoDesc, setAvulsoDesc] = useState('')
  const [avulsoTipo, setAvulsoTipo] = useState<'service' | 'part'>('service')
  const [avulsoPreco, setAvulsoPreco] = useState('')

  const s = statusOf(order)
  const editavel = s === 'diagnostico' || s === 'em_servico'
  const itens = order.items ?? []
  const total = useMemo(() => itens.reduce((sum, i) => sum + (i.subtotal || 0), 0), [itens])

  const resultados = useMemo(() => {
    const q = normalize(busca.trim())
    if (!q) return []
    return services
      .filter(
        (item) =>
          normalize(item.name).includes(q) ||
          (item.code && normalize(item.code).includes(q)) ||
          (item.barcode && normalize(item.barcode).includes(q))
      )
      .slice(0, 8)
  }, [services, busca])

  const gravar = async (novos: OrderLineItem[]) => {
    setSalvando(true)
    setErro('')
    try {
      await updateOrderItems(clientId, order.id, novos, by)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível salvar os itens.')
    }
    setSalvando(false)
  }

  const adicionarDoCatalogo = (item: ServiceItem) => {
    const existente = itens.find((i) => i.itemId === item.id)
    const novos = existente
      ? itens.map((i) =>
          i.itemId === item.id
            ? { ...i, quantity: i.quantity + 1, subtotal: (i.quantity + 1) * i.unitPrice }
            : i
        )
      : [
          ...itens,
          {
            itemId: item.id,
            type: item.type,
            description: item.name,
            quantity: 1,
            unitPrice: item.price,
            subtotal: item.price,
          },
        ]
    setBusca('')
    setMostrarResultados(false)
    setDestaque(0)
    gravar(novos)
  }

  const adicionarAvulso = () => {
    const preco = parseFloat(avulsoPreco.replace(',', '.'))
    if (!avulsoDesc.trim() || Number.isNaN(preco)) return
    gravar([
      ...itens,
      {
        itemId: crypto.randomUUID(),
        type: avulsoTipo,
        description: avulsoDesc.trim(),
        quantity: 1,
        unitPrice: preco,
        subtotal: preco,
      },
    ])
    setAvulsoDesc('')
    setAvulsoPreco('')
  }

  const mudarQuantidade = (itemId: string, delta: number) => {
    const alvo = itens.find((i) => i.itemId === itemId)
    if (!alvo) return
    const nova = alvo.quantity + delta
    if (nova < 1) return
    gravar(
      itens.map((i) =>
        i.itemId === itemId ? { ...i, quantity: nova, subtotal: nova * i.unitPrice } : i
      )
    )
  }

  const remover = (itemId: string) => {
    gravar(itens.filter((i) => i.itemId !== itemId))
  }

  const teclado = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!mostrarResultados || resultados.length === 0) return
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setDestaque((i) => Math.min(i + 1, resultados.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setDestaque((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      adicionarDoCatalogo(resultados[destaque])
    } else if (e.key === 'Escape') {
      setMostrarResultados(false)
    }
  }

  return (
    <section id="bloco-itens" className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Serviços e peças</h2>
        <span className="text-xs text-gray-500">
          {editavel
            ? 'Editável enquanto a O.S. estiver em diagnóstico ou em serviço.'
            : 'Somente leitura — a O.S. já saiu da bancada.'}
        </span>
      </div>

      {editavel && (
        <>
          <label className="mb-1 block text-xs font-medium text-gray-600">
            Buscar no catálogo
          </label>
          <div className="relative">
            <input
              value={busca}
              onChange={(e) => {
                setBusca(e.target.value)
                setMostrarResultados(true)
                setDestaque(0)
              }}
              onFocus={() => setMostrarResultados(true)}
              onBlur={() => setTimeout(() => setMostrarResultados(false), 150)}
              onKeyDown={teclado}
              placeholder="Nome, código ou código de barras..."
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
            {mostrarResultados && busca.trim() && (
              <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
                {resultados.length > 0 ? (
                  resultados.map((item, idx) => (
                    <button
                      type="button"
                      key={item.id}
                      onMouseDown={(e) => e.preventDefault()}
                      onClick={() => adicionarDoCatalogo(item)}
                      className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm ${
                        idx === destaque ? 'bg-blue-50' : 'hover:bg-gray-50'
                      }`}
                    >
                      <span className="truncate">
                        {item.code && <span className="text-gray-400">{item.code} · </span>}
                        {item.name}
                      </span>
                      <span className="ml-2 shrink-0 text-gray-600">{money(item.price)}</span>
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
              Catálogo vazio. Cadastre em "Serviços e Peças" — ou lance um item avulso abaixo.
            </p>
          )}

          <details className="mt-3 rounded-lg border border-dashed border-gray-300 p-3">
            <summary className="cursor-pointer text-xs font-medium text-gray-600">
              ➕ Item avulso (fora do catálogo)
            </summary>
            <div className="mt-3 flex flex-wrap items-end gap-2">
              <input
                value={avulsoDesc}
                onChange={(e) => setAvulsoDesc(e.target.value)}
                placeholder="Descrição"
                className="min-w-[180px] flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <select
                value={avulsoTipo}
                onChange={(e) => setAvulsoTipo(e.target.value as 'service' | 'part')}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="service">Serviço</option>
                <option value="part">Peça</option>
              </select>
              <input
                value={avulsoPreco}
                onChange={(e) => setAvulsoPreco(e.target.value)}
                type="number"
                step="0.01"
                placeholder="Preço"
                className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={adicionarAvulso}
                disabled={salvando || !avulsoDesc.trim() || !avulsoPreco}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm font-medium text-gray-700 hover:border-blue-500 hover:text-blue-600 disabled:opacity-50"
              >
                Adicionar
              </button>
            </div>
          </details>
        </>
      )}

      {/* LISTA */}
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-200 text-left text-xs uppercase tracking-wide text-gray-500">
              <th className="py-2 pr-2 font-medium">Item</th>
              <th className="py-2 pr-2 font-medium">Qtd</th>
              <th className="py-2 pr-2 text-right font-medium">Unitário</th>
              <th className="py-2 pr-2 text-right font-medium">Subtotal</th>
              {editavel && <th className="py-2 w-8" />}
            </tr>
          </thead>
          <tbody>
            {itens.length === 0 ? (
              <tr>
                <td colSpan={editavel ? 5 : 4} className="py-4 text-sm text-gray-500">
                  Nenhum item lançado ainda.
                  {editavel && ' Use a busca acima ou lance um item avulso.'}
                </td>
              </tr>
            ) : (
              itens.map((i) => (
                <tr key={i.itemId} className="border-b border-gray-100">
                  <td className="py-2 pr-2">
                    <span className="text-gray-900">{i.description}</span>
                    <span className="ml-2 text-xs text-gray-400">
                      {i.type === 'part' ? 'peça' : 'serviço'}
                    </span>
                  </td>
                  <td className="py-2 pr-2">
                    {editavel ? (
                      <span className="inline-flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => mudarQuantidade(i.itemId, -1)}
                          disabled={salvando || i.quantity <= 1}
                          className="h-6 w-6 rounded border border-gray-300 text-xs text-gray-600 hover:border-blue-500 hover:text-blue-600 disabled:opacity-40"
                        >
                          −
                        </button>
                        <span className="w-6 text-center tabular-nums">{i.quantity}</span>
                        <button
                          type="button"
                          onClick={() => mudarQuantidade(i.itemId, 1)}
                          disabled={salvando}
                          className="h-6 w-6 rounded border border-gray-300 text-xs text-gray-600 hover:border-blue-500 hover:text-blue-600 disabled:opacity-40"
                        >
                          +
                        </button>
                      </span>
                    ) : (
                      <span className="tabular-nums">{i.quantity}</span>
                    )}
                  </td>
                  <td className="py-2 pr-2 text-right text-gray-600">{money(i.unitPrice)}</td>
                  <td className="py-2 pr-2 text-right font-medium text-gray-900">
                    {money(i.subtotal)}
                  </td>
                  {editavel && (
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => remover(i.itemId)}
                        disabled={salvando}
                        className="text-xs text-red-500 hover:underline disabled:opacity-50"
                        title="Remover item"
                      >
                        ✕
                      </button>
                    </td>
                  )}
                </tr>
              ))
            )}
          </tbody>
          <tfoot>
            <tr>
              <td colSpan={editavel ? 3 : 2} className="pt-3 text-sm font-semibold text-gray-900">
                Total
              </td>
              <td className="pt-3 text-right text-base font-bold text-gray-900">
                {money(total)}
              </td>
              {editavel && <td />}
            </tr>
          </tfoot>
        </table>
      </div>

      {salvando && <p className="mt-2 text-xs text-gray-400">Salvando...</p>}
      {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
    </section>
  )
}
