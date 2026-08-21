'use client'

import { Suspense, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { useClientId } from '@/lib/hooks/useClientId'
import {
  watchCustomers,
  watchVehicles,
  watchOrders,
  createCustomer,
  createVehicle,
  createOrder,
  nextOrderNumber,
} from '@/lib/firebase/firestore'
import { Customer, Vehicle, Order, VehicleType, VEHICLE_TYPE_LABEL } from '@/lib/types'
import { BuscaBalcao } from '@/lib/components/BuscaBalcao'
import { dateBR } from '@/lib/orders/format'

/**
 * Abrir O.S. — a tela que motivou a reconcepção.
 *
 * O ÚNICO obrigatório é o cliente. Veículo, itens e prazo entram DENTRO da
 * O.S. depois: "um cliente pode ter mais de um carro, ou voltar com outro
 * carro" (Alcides). Os quatro blocos abaixo aparecem TODOS desde o
 * primeiro render — nada atrás de `{customerId && (`, que foi exatamente o
 * que reprovou a versão anterior: quem chegava na tela via só o campo de
 * cliente e achava que o sistema tinha travado.
 */

const plateKey = (p: string) => (p ?? '').replace(/[^a-zA-Z0-9]/g, '').toUpperCase()

export default function NovaOrdemPage() {
  return (
    <Suspense fallback={<p className="text-sm text-gray-500">Carregando…</p>}>
      <NovaOrdem />
    </Suspense>
  )
}

function NovaOrdem() {
  const router = useRouter()
  const params = useSearchParams()
  const { clientId } = useClientId()

  const [customers, setCustomers] = useState<Customer[]>([])
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [orders, setOrders] = useState<Order[]>([])

  // Cliente: ou um já cadastrado, ou um pendente (nada é gravado até "Abrir O.S.")
  const [customer, setCustomer] = useState<Customer | null>(null)
  const [novoNome, setNovoNome] = useState('')
  const [novoTelefone, setNovoTelefone] = useState('')

  // Veículo: ou um já cadastrado, ou um pendente digitado abaixo, ou nenhum.
  const [selectedVehicleId, setSelectedVehicleId] = useState('')
  const [novoPlaca, setNovoPlaca] = useState('')
  const [novoModelo, setNovoModelo] = useState('')
  const [novoTipo, setNovoTipo] = useState<VehicleType>('carro')
  const [semVeiculo, setSemVeiculo] = useState(false)

  const [queixa, setQueixa] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  const autoLinked = useRef<string | null>(null)
  const qsApplied = useRef(false)

  useEffect(() => {
    if (!clientId) return
    const u1 = watchCustomers(clientId, setCustomers)
    const u2 = watchVehicles(clientId, setVehicles)
    const u3 = watchOrders(clientId, setOrders)
    return () => {
      u1()
      u2()
      u3()
    }
  }, [clientId])

  // ?cliente=<id> e ?veiculo=<id> — o veículo resolve o dono sozinho.
  useEffect(() => {
    if (qsApplied.current) return
    const qsVeiculo = params.get('veiculo')
    const qsCliente = params.get('cliente')
    if (!qsVeiculo && !qsCliente) {
      qsApplied.current = true
      return
    }
    if (qsVeiculo) {
      const v = vehicles.find((x) => x.id === qsVeiculo)
      if (v) {
        qsApplied.current = true
        setSelectedVehicleId(v.id)
        const dono = customers.find((c) => c.id === v.customerId)
        if (dono) setCustomer(dono)
        return
      }
    }
    if (qsCliente) {
      const c = customers.find((x) => x.id === qsCliente)
      if (c) {
        qsApplied.current = true
        setCustomer(c)
      }
    }
  }, [params, customers, vehicles])

  const customerId = customer?.id ?? ''

  const ownVehicles = useMemo(
    () => (customerId ? vehicles.filter((v) => v.customerId === customerId) : []),
    [vehicles, customerId]
  )

  /** Cliente com UM carro só não precisa escolher nada — ele já entra vinculado. */
  useEffect(() => {
    if (!customerId) return
    if (autoLinked.current === customerId) return
    if (semVeiculo || selectedVehicleId || novoPlaca.trim()) return
    if (ownVehicles.length === 1) {
      autoLinked.current = customerId
      setSelectedVehicleId(ownVehicles[0].id)
    }
  }, [customerId, ownVehicles, semVeiculo, selectedVehicleId, novoPlaca])

  const lastOrderByVehicle = useMemo(() => {
    const m = new Map<string, number>()
    for (const o of orders) {
      if (!o.vehicleId) continue
      m.set(o.vehicleId, Math.max(m.get(o.vehicleId) ?? 0, o.createdAt))
    }
    return m
  }, [orders])

  const selectedVehicle = useMemo(
    () => vehicles.find((v) => v.id === selectedVehicleId) ?? null,
    [vehicles, selectedVehicleId]
  )

  /** Placa já cadastrada — avisar em vez de duplicar o carro na oficina. */
  const placaExistente = useMemo(() => {
    const k = plateKey(novoPlaca)
    if (!k) return null
    return vehicles.find((v) => plateKey(v.plate) === k) ?? null
  }, [vehicles, novoPlaca])

  const nomeCliente = customer ? customer.name : novoNome.trim()
  const podeAbrir = Boolean(nomeCliente) && !saving

  const veiculoPendente = !selectedVehicle && Boolean(novoPlaca.trim())

  const resumoVeiculo = selectedVehicle
    ? `${selectedVehicle.plate}${selectedVehicle.model ? ` · ${selectedVehicle.model}` : ''}`
    : veiculoPendente
      ? `${novoPlaca.trim().toUpperCase()}${novoModelo.trim() ? ` · ${novoModelo.trim()}` : ''}`
      : ''

  function trocarCliente() {
    setCustomer(null)
    setNovoNome('')
    setNovoTelefone('')
    // Trocar de cliente derruba TAMBÉM o veículo — o carro é dele, não da tela.
    setSelectedVehicleId('')
    setNovoPlaca('')
    setNovoModelo('')
    setNovoTipo('carro')
    setSemVeiculo(false)
    autoLinked.current = null
  }

  function escolherVeiculoExistente(id: string) {
    setSelectedVehicleId(id)
    setNovoPlaca('')
    setNovoModelo('')
    setSemVeiculo(false)
  }

  function usarPlacaExistente() {
    if (!placaExistente) return
    escolherVeiculoExistente(placaExistente.id)
    if (!customer) {
      const dono = customers.find((c) => c.id === placaExistente.customerId)
      if (dono) setCustomer(dono)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (!clientId) {
      setError('Não foi possível identificar a oficina. Recarregue a página e tente de novo.')
      return
    }
    if (!nomeCliente) {
      setError('Escolha um cliente já cadastrado ou digite o nome de um cliente novo.')
      return
    }

    setSaving(true)
    try {
      let finalCustomerId = customer?.id ?? ''
      if (!finalCustomerId) {
        const ref = await createCustomer(clientId, {
          name: nomeCliente,
          ...(novoTelefone.trim() ? { phone: novoTelefone.trim() } : {}),
        })
        finalCustomerId = ref.id
      }

      let veic: { id: string; plate: string; model: string; type: VehicleType } | null = null

      if (selectedVehicle) {
        veic = {
          id: selectedVehicle.id,
          plate: selectedVehicle.plate,
          model: selectedVehicle.model ?? '',
          type: selectedVehicle.type ?? 'carro',
        }
      } else if (novoPlaca.trim()) {
        const k = plateKey(novoPlaca)
        const dup = vehicles.find((v) => plateKey(v.plate) === k)
        if (dup) {
          veic = {
            id: dup.id,
            plate: dup.plate,
            model: dup.model ?? '',
            type: dup.type ?? 'carro',
          }
        } else {
          const ref = await createVehicle(clientId, {
            plate: novoPlaca.trim().toUpperCase(),
            model: novoModelo.trim(),
            customerId: finalCustomerId,
            type: novoTipo,
          })
          veic = {
            id: ref.id,
            plate: novoPlaca.trim().toUpperCase(),
            model: novoModelo.trim(),
            type: novoTipo,
          }
        }
      }

      // Nunca lança: se o contador falhar, a O.S. nasce sem número.
      const number = await nextOrderNumber(clientId)

      const ref = await createOrder(clientId, {
        customerId: finalCustomerId,
        customerName: nomeCliente,
        ...(veic
          ? {
              vehicleId: veic.id,
              vehiclePlate: veic.plate,
              vehicleModel: veic.model,
              vehicleType: veic.type,
            }
          : {}),
        ...(queixa.trim() ? { complaint: queixa.trim() } : {}),
        ...(number ? { number } : {}),
      })

      router.push(`/orders/${ref.id}`)
    } catch (err) {
      console.error('Erro ao abrir a O.S.:', err)
      setError(
        err instanceof Error
          ? `Não foi possível abrir a O.S.: ${err.message}`
          : 'Não foi possível abrir a O.S. Tente de novo.'
      )
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Abrir O.S.</h1>
          <p className="mt-1 text-sm text-gray-500">
            Só o cliente é obrigatório. Veículo, itens e prazo entram depois, dentro da O.S.
          </p>
        </div>
        <Link
          href="/orders"
          className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-gray-400"
        >
          Voltar
        </Link>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* 1 — CLIENTE */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-3 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-900">1. Cliente</h2>
            <span className="text-xs font-medium text-blue-700">obrigatório</span>
          </div>

          {customer ? (
            <div className="flex items-center justify-between rounded-lg bg-blue-50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-blue-900">{customer.name}</p>
                {customer.phone && <p className="text-xs text-blue-700">{customer.phone}</p>}
              </div>
              <button
                type="button"
                onClick={trocarCliente}
                className="text-xs font-medium text-blue-700 hover:underline"
              >
                Trocar
              </button>
            </div>
          ) : novoNome ? (
            <div className="rounded-lg border border-dashed border-blue-300 bg-blue-50/50 p-3">
              <div className="mb-2 flex items-center justify-between">
                <p className="text-xs font-semibold uppercase tracking-wide text-blue-700">
                  Cliente novo — vai ser cadastrado ao abrir a O.S.
                </p>
                <button
                  type="button"
                  onClick={trocarCliente}
                  className="text-xs font-medium text-blue-700 hover:underline"
                >
                  Trocar
                </button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs text-gray-600">Nome</label>
                  <input
                    value={novoNome}
                    onChange={(e) => setNovoNome(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs text-gray-600">
                    Telefone <span className="text-gray-400">(opcional)</span>
                  </label>
                  <input
                    value={novoTelefone}
                    onChange={(e) => setNovoTelefone(e.target.value)}
                    placeholder="(11) 99999-8888"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  />
                </div>
              </div>
            </div>
          ) : (
            <>
              <BuscaBalcao
                customers={customers}
                vehicles={vehicles}
                onPickCustomer={(c) => setCustomer(c)}
                onPickVehicle={(v, dono) => {
                  if (dono) setCustomer(dono)
                  escolherVeiculoExistente(v.id)
                }}
                onCreate={(nome) => setNovoNome(nome)}
              />
              <p className="mt-2 text-xs text-gray-500">
                Achou o carro? Escolher o carro já traz o dono junto. Não achou ninguém? A última
                linha da busca cadastra o cliente novo.
              </p>
            </>
          )}
        </section>

        {/* 2 — VEÍCULO */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-900">2. Veículo</h2>
            <span className="text-xs font-medium text-gray-500">opcional</span>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            Pode ficar pra depois. A O.S. abre sem carro e o veículo vira uma pendência dentro dela.
          </p>

          {selectedVehicle ? (
            <div className="mb-3 flex items-center justify-between rounded-lg bg-green-50 px-3 py-2.5">
              <div>
                <p className="text-sm font-medium text-green-900">
                  {selectedVehicle.plate}
                  {selectedVehicle.model ? ` · ${selectedVehicle.model}` : ''}
                </p>
                <p className="text-xs text-green-700">
                  {VEHICLE_TYPE_LABEL[selectedVehicle.type ?? 'carro']}
                  {ownVehicles.length === 1 ? ' — único carro deste cliente, já vinculado' : ''}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSelectedVehicleId('')
                  setSemVeiculo(false)
                }}
                className="text-xs font-medium text-green-700 hover:underline"
              >
                Trocar
              </button>
            </div>
          ) : (
            <div className="mb-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs text-gray-600">
              {semVeiculo
                ? 'Sem veículo por enquanto — vai aparecer como pendência dentro da O.S.'
                : veiculoPendente
                  ? `Vai entrar como veículo novo: ${resumoVeiculo}`
                  : 'Nenhum veículo escolhido ainda.'}
            </div>
          )}

          <div className="mb-3">
            <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
              Carros deste cliente
            </p>
            {!customerId ? (
              <p className="text-sm text-gray-400">
                Escolha o cliente acima para ver os carros dele — ou já cadastre a placa abaixo.
              </p>
            ) : ownVehicles.length === 0 ? (
              <p className="text-sm text-gray-400">
                Este cliente ainda não tem carro cadastrado. Use o cadastro abaixo, ou deixe pra
                depois.
              </p>
            ) : (
              <ul className="space-y-1">
                {ownVehicles.map((v) => {
                  const last = lastOrderByVehicle.get(v.id)
                  const active = v.id === selectedVehicleId
                  return (
                    <li key={v.id}>
                      <button
                        type="button"
                        onClick={() => escolherVeiculoExistente(v.id)}
                        className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm ${
                          active
                            ? 'border-green-400 bg-green-50'
                            : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50/40'
                        }`}
                      >
                        <span className="font-medium text-gray-900">
                          {v.plate}
                          {v.model ? ` · ${v.model}` : ''}
                        </span>
                        <span className="text-xs text-gray-500">
                          {last ? `última O.S. ${dateBR(last)}` : 'sem O.S. anterior'}
                        </span>
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-gray-300 p-3">
            <p className="mb-2 text-xs font-semibold text-gray-700">➕ Outro veículo</p>
            <div className="grid gap-2 sm:grid-cols-3">
              <input
                value={novoPlaca}
                onChange={(e) => {
                  setNovoPlaca(e.target.value)
                  if (e.target.value.trim()) {
                    setSelectedVehicleId('')
                    setSemVeiculo(false)
                  }
                }}
                placeholder="Placa (ABC1D23)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase focus:border-blue-500 focus:outline-none"
              />
              <input
                value={novoModelo}
                onChange={(e) => setNovoModelo(e.target.value)}
                placeholder="Modelo (Gol 1.0)"
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              />
              <select
                value={novoTipo}
                onChange={(e) => setNovoTipo(e.target.value as VehicleType)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
              >
                {(Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[]).map((t) => (
                  <option key={t} value={t}>
                    {VEHICLE_TYPE_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>

            {placaExistente && (
              <div className="mt-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                <p>
                  A placa <strong>{placaExistente.plate}</strong> já existe
                  {placaExistente.model ? ` (${placaExistente.model})` : ''}
                  {(() => {
                    const dono = customers.find((c) => c.id === placaExistente.customerId)
                    return dono ? ` — cadastrada para ${dono.name}` : ''
                  })()}
                  . Usar este veículo em vez de cadastrar outro igual?
                </p>
                <button
                  type="button"
                  onClick={usarPlacaExistente}
                  className="mt-2 rounded-lg border border-amber-400 bg-white px-3 py-1.5 text-xs font-medium text-amber-800 hover:bg-amber-100"
                >
                  Usar este veículo
                </button>
              </div>
            )}

            <button
              type="button"
              onClick={() => {
                setSelectedVehicleId('')
                setNovoPlaca('')
                setNovoModelo('')
                setSemVeiculo(true)
                autoLinked.current = customerId || null
              }}
              className="mt-3 rounded-lg border border-gray-300 px-3 py-2 text-xs font-medium text-gray-700 hover:border-gray-400"
            >
              Sem veículo por enquanto
            </button>
          </div>
        </section>

        {/* 3 — QUEIXA */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          <div className="mb-1 flex items-baseline justify-between">
            <h2 className="text-sm font-semibold text-gray-900">3. Queixa do cliente</h2>
            <span className="text-xs font-medium text-gray-500">opcional</span>
          </div>
          <p className="mb-3 text-xs text-gray-500">
            O que ele falou no balcão, nas palavras dele. Serve de referência no diagnóstico.
          </p>
          <textarea
            value={queixa}
            onChange={(e) => setQueixa(e.target.value)}
            rows={3}
            placeholder="Ex.: barulho na roda dianteira quando freia, e o painel acende luz de óleo."
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          />
        </section>

        {/* 4 — ABRIR */}
        <section className="rounded-xl border border-gray-200 bg-white p-5">
          {error && (
            <p className="mb-3 rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={!podeAbrir}
            className="w-full rounded-lg bg-blue-600 px-4 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving ? 'Abrindo O.S.…' : 'Abrir O.S.'}
          </button>

          {!nomeCliente ? (
            <p className="mt-2 text-center text-xs text-amber-700">
              Falta o cliente — é o único campo obrigatório. Busque acima ou cadastre um novo.
            </p>
          ) : (
            <p className="mt-2 text-center text-xs text-gray-500">
              A O.S. vai nascer em Diagnóstico, no nome de <strong>{nomeCliente}</strong>,{' '}
              {resumoVeiculo ? (
                <>
                  com o veículo <strong>{resumoVeiculo}</strong> e sem itens — os itens viram
                  pendência dentro dela.
                </>
              ) : (
                <>
                  sem veículo e sem itens — os dois viram pendências dentro dela, e dá pra resolver
                  a qualquer momento.
                </>
              )}
            </p>
          )}
        </section>
      </form>
    </div>
  )
}
