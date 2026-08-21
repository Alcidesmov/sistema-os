'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchCustomers, watchOrders, watchVehicles } from '@/lib/firebase/firestore'
import { Customer, Order, Vehicle } from '@/lib/types'
import { statusLabelOf } from '@/lib/orders/status'
import { orderLabel, vehicleLabel } from '@/lib/orders/format'
import { normalize } from '@/lib/utils/search'

export interface BaseBusca {
  orders: Order[]
  customers: Customer[]
  vehicles: Vehicle[]
}

const VAZIO: BaseBusca = { orders: [], customers: [], vehicles: [] }

const soDigitos = (s: string) => s.replace(/\D/g, '')

/**
 * Filtro único da busca — usado pelo dropdown do topo E pela tela /busca,
 * pra que os dois nunca discordem sobre o que "achou".
 *
 * O.S. entra por número, por nome do cliente e por placa; cliente por nome
 * ou telefone (comparando só dígitos, senão "(11) 99999" nunca casa com o
 * que está gravado); veículo por placa, modelo ou marca.
 */
export function filtrarBusca(q: string, base: BaseBusca): BaseBusca {
  const nq = normalize(q.trim())
  if (!nq) return VAZIO
  const digitos = soDigitos(nq)

  const orders = base.orders.filter((o) => {
    if (digitos && o.number && String(o.number).includes(digitos)) return true
    if (normalize(o.customerName || '').includes(nq)) return true
    if (normalize(o.vehiclePlate || '').includes(nq)) return true
    if (normalize(o.vehicleModel || '').includes(nq)) return true
    return false
  })

  const customers = base.customers.filter((c) => {
    if (normalize(c.name || '').includes(nq)) return true
    if (digitos && soDigitos(c.phone || '').includes(digitos)) return true
    return false
  })

  const vehicles = base.vehicles.filter((v) => {
    if (normalize(v.plate || '').includes(nq)) return true
    if (normalize(v.model || '').includes(nq)) return true
    if (normalize(v.brand || '').includes(nq)) return true
    return false
  })

  return { orders, customers, vehicles }
}

/**
 * Para onde cada resultado leva. Cliente e veículo ainda não têm tela
 * própria de detalhe, então caem na listagem já filtrada por `q` — nunca
 * num beco: o usuário chega na tela certa com o termo em mãos.
 */
export function hrefDaOS(o: Order) {
  return `/orders/${o.id}`
}
export function hrefDoCliente(c: Customer) {
  return `/customers?q=${encodeURIComponent(c.name)}`
}
export function hrefDoVeiculo(v: Vehicle) {
  return `/vehicles?q=${encodeURIComponent(v.plate)}`
}

interface Linha {
  key: string
  grupo: string
  titulo: string
  sub: string
  href: string
}

const LIMITE_POR_GRUPO = 5

export default function BuscaGlobal({ className = '' }: { className?: string }) {
  const router = useRouter()
  const { clientId } = useClientId()
  const inputRef = useRef<HTMLInputElement>(null)

  const [q, setQ] = useState('')
  const [aberto, setAberto] = useState(false)
  const [cursor, setCursor] = useState(-1)
  // Só liga os listeners depois do primeiro foco: a casca fica em todas as
  // telas, e assinar 3 coleções em toda navegação sairia caro à toa.
  const [armado, setArmado] = useState(false)
  const [base, setBase] = useState<BaseBusca>(VAZIO)

  useEffect(() => {
    if (!clientId || !armado) return
    const unsubs = [
      watchOrders(clientId, (orders) => setBase((b) => ({ ...b, orders }))),
      watchCustomers(clientId, (customers) => setBase((b) => ({ ...b, customers }))),
      watchVehicles(clientId, (vehicles) => setBase((b) => ({ ...b, vehicles }))),
    ]
    return () => unsubs.forEach((u) => u())
  }, [clientId, armado])

  // Atalho "/" — mão no teclado, sem caçar o campo com o mouse.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const alvo = e.target as HTMLElement | null
      const tag = alvo?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || alvo?.isContentEditable) return
      e.preventDefault()
      inputRef.current?.focus()
      inputRef.current?.select()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const resultado = useMemo(() => filtrarBusca(q, base), [q, base])

  const linhas = useMemo<Linha[]>(() => {
    const out: Linha[] = []
    resultado.orders.slice(0, LIMITE_POR_GRUPO).forEach((o) =>
      out.push({
        key: `o-${o.id}`,
        grupo: 'Ordens de Serviço',
        titulo: `${orderLabel(o)} · ${o.customerName}`,
        sub: `${statusLabelOf(o)} · ${vehicleLabel(o)}`,
        href: hrefDaOS(o),
      })
    )
    resultado.customers.slice(0, LIMITE_POR_GRUPO).forEach((c) =>
      out.push({
        key: `c-${c.id}`,
        grupo: 'Clientes',
        titulo: c.name,
        sub: c.phone || 'Sem telefone',
        href: hrefDoCliente(c),
      })
    )
    resultado.vehicles.slice(0, LIMITE_POR_GRUPO).forEach((v) =>
      out.push({
        key: `v-${v.id}`,
        grupo: 'Veículos',
        titulo: v.plate,
        sub: [v.brand, v.model].filter(Boolean).join(' ') || 'Sem modelo',
        href: hrefDoVeiculo(v),
      })
    )
    return out
  }, [resultado])

  const temTermo = q.trim().length > 0
  const mostrarDropdown = aberto && temTermo

  const irPara = (href: string) => {
    setAberto(false)
    setCursor(-1)
    inputRef.current?.blur()
    router.push(href)
  }

  const verTodos = () => {
    if (!temTermo) return
    irPara(`/busca?q=${encodeURIComponent(q.trim())}`)
  }

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setAberto(false)
      setCursor(-1)
      inputRef.current?.blur()
      return
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setAberto(true)
      setCursor((c) => (linhas.length ? (c + 1) % linhas.length : -1))
      return
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault()
      setCursor((c) => (linhas.length ? (c <= 0 ? linhas.length - 1 : c - 1) : -1))
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      if (cursor >= 0 && linhas[cursor]) irPara(linhas[cursor].href)
      else verTodos()
    }
  }

  let grupoAtual = ''

  return (
    <div className={`relative ${className}`}>
      <input
        ref={inputRef}
        value={q}
        onChange={(e) => {
          setQ(e.target.value)
          setCursor(-1)
          setAberto(true)
        }}
        onFocus={() => {
          setArmado(true)
          setAberto(true)
        }}
        onBlur={() => setAberto(false)}
        onKeyDown={onKeyDown}
        placeholder="Buscar O.S., cliente ou placa…"
        aria-label="Busca geral"
        className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-3 pr-12 text-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
      />
      <span className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 rounded border border-gray-200 px-1.5 py-0.5 text-[11px] text-gray-400">
        /
      </span>

      {mostrarDropdown && (
        // onMouseDown preventDefault: sem isso o blur fecha o dropdown
        // antes do clique registrar e o resultado "não clica".
        <div
          onMouseDown={(e) => e.preventDefault()}
          className="absolute left-0 right-0 top-full z-30 mt-1 max-h-[70vh] overflow-y-auto rounded-xl border border-gray-200 bg-white py-1 shadow-xl"
        >
          {linhas.length === 0 ? (
            <div className="px-3 py-3">
              <p className="text-sm text-gray-600">
                Nada encontrado para “{q.trim()}”.
              </p>
              <p className="mt-0.5 text-xs text-gray-500">
                A busca cobre número da O.S., nome/telefone do cliente e placa do
                veículo.
              </p>
            </div>
          ) : (
            linhas.map((l, i) => {
              const novoGrupo = l.grupo !== grupoAtual
              grupoAtual = l.grupo
              return (
                <div key={l.key}>
                  {novoGrupo && (
                    <p className="px-3 pb-1 pt-2 text-[11px] font-semibold uppercase tracking-wide text-gray-400">
                      {l.grupo}
                    </p>
                  )}
                  <button
                    type="button"
                    onClick={() => irPara(l.href)}
                    onMouseEnter={() => setCursor(i)}
                    className={`block w-full px-3 py-2 text-left ${
                      i === cursor ? 'bg-blue-50' : 'hover:bg-gray-50'
                    }`}
                  >
                    <span className="block truncate text-sm font-medium text-gray-900">
                      {l.titulo}
                    </span>
                    <span className="block truncate text-xs text-gray-500">{l.sub}</span>
                  </button>
                </div>
              )
            })
          )}

          <button
            type="button"
            onClick={verTodos}
            className="mt-1 block w-full border-t border-gray-100 px-3 py-2 text-left text-xs font-medium text-blue-600 hover:bg-blue-50"
          >
            Ver todos os resultados de “{q.trim()}” (Enter)
          </button>
        </div>
      )}
    </div>
  )
}
