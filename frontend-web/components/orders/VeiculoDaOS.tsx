'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { Order, Vehicle, VehicleType, VEHICLE_TYPE_LABEL } from '@/lib/types'
import { isCancelled, statusOf } from '@/lib/orders/status'
import { vehicleLabel } from '@/lib/orders/format'
import { normalize } from '@/lib/utils/search'
import { createVehicle, setOrderVehicle } from '@/lib/firebase/firestore'

interface VeiculoDaOSProps {
  clientId: string
  order: Order
  /** Todos os veículos da oficina — a escopagem por cliente é feita aqui. */
  vehicles: Vehicle[]
  by: string
}

/**
 * O veículo entra DENTRO da O.S., não antes dela.
 *
 * O cliente pode ter mais de um carro, ou voltar com outro — por isso a
 * lista já vem escopada no cliente da O.S., trocar é um clique, e dá para
 * tirar o veículo se ele foi vinculado errado.
 */
export default function VeiculoDaOS({ clientId, order, vehicles, by }: VeiculoDaOSProps) {
  const [busca, setBusca] = useState('')
  const [novoAberto, setNovoAberto] = useState(false)
  const [placa, setPlaca] = useState('')
  const [modelo, setModelo] = useState('')
  const [tipo, setTipo] = useState<VehicleType>('carro')
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const s = statusOf(order)
  const editavel = !isCancelled(order) && s !== 'entregue'

  const doCliente = useMemo(
    () => vehicles.filter((v) => v.customerId === order.customerId),
    [vehicles, order.customerId]
  )

  const listados = useMemo(() => {
    const q = normalize(busca.trim())
    if (!q) return doCliente
    return doCliente.filter(
      (v) => normalize(v.plate).includes(q) || normalize(v.model).includes(q)
    )
  }, [doCliente, busca])

  const vincular = async (v: Vehicle) => {
    setSalvando(true)
    setErro('')
    try {
      await setOrderVehicle(
        clientId,
        order.id,
        { id: v.id, plate: v.plate, model: v.model, type: v.type },
        by
      )
    } catch (e) {
      console.error(e)
      setErro('Não foi possível vincular o veículo.')
    }
    setSalvando(false)
  }

  const tirar = async () => {
    setSalvando(true)
    setErro('')
    try {
      await setOrderVehicle(clientId, order.id, null, by)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível tirar o veículo.')
    }
    setSalvando(false)
  }

  const criarEVincular = async () => {
    if (!placa.trim() || !modelo.trim()) return
    setSalvando(true)
    setErro('')
    try {
      const ref = await createVehicle(clientId, {
        plate: placa.trim().toUpperCase(),
        model: modelo.trim(),
        customerId: order.customerId,
        type: tipo,
      })
      await setOrderVehicle(
        clientId,
        order.id,
        { id: ref.id, plate: placa.trim().toUpperCase(), model: modelo.trim(), type: tipo },
        by
      )
      setPlaca('')
      setModelo('')
      setTipo('carro')
      setNovoAberto(false)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível cadastrar o veículo.')
    }
    setSalvando(false)
  }

  return (
    <section id="bloco-veiculo" className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Veículo</h2>
        {!editavel && (
          <span className="text-xs text-gray-500">
            {isCancelled(order)
              ? 'O.S. cancelada — veículo travado.'
              : 'O.S. já entregue — veículo travado.'}
          </span>
        )}
      </div>

      {/* VEÍCULO ATUAL */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
        <div>
          <p className="text-sm font-medium text-gray-900">{vehicleLabel(order)}</p>
          <p className="text-xs text-gray-500">
            {order.vehicleId
              ? `Tipo: ${VEHICLE_TYPE_LABEL[order.vehicleType ?? 'carro']}`
              : 'A O.S. está aberta só no nome do cliente.'}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {order.vehicleId && (
            <Link
              href={`/vehicles/${order.vehicleId}`}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              Ver histórico do veículo
            </Link>
          )}
          {order.vehicleId && editavel && (
            <button
              type="button"
              onClick={tirar}
              disabled={salvando}
              className="rounded-lg border border-gray-300 px-3 py-1.5 text-xs font-medium text-gray-600 hover:border-red-400 hover:text-red-600 disabled:opacity-50"
            >
              Tirar veículo
            </button>
          )}
        </div>
      </div>

      {editavel && (
        <>
          {/* VEÍCULOS DO CLIENTE */}
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-gray-500">
            Veículos de {order.customerName}
          </p>

          {doCliente.length > 5 && (
            <input
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
              placeholder="Filtrar por placa ou modelo..."
              className="mb-2 w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            />
          )}

          {doCliente.length === 0 ? (
            <p className="text-sm text-gray-500">
              Este cliente ainda não tem nenhum veículo cadastrado. Use "Outro veículo"
              abaixo.
            </p>
          ) : listados.length === 0 ? (
            <p className="text-sm text-gray-500">Nenhum veículo bate com a busca.</p>
          ) : (
            <div className="space-y-1">
              {listados.map((v) => {
                const atual = v.id === order.vehicleId
                return (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => vincular(v)}
                    disabled={salvando || atual}
                    className={`flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                      atual
                        ? 'border-blue-200 bg-blue-50 text-blue-800'
                        : 'border-gray-200 hover:border-blue-400 hover:bg-blue-50'
                    } disabled:cursor-default`}
                  >
                    <span>
                      <span className="font-medium">{v.plate}</span>
                      <span className="text-gray-500"> · {v.model}</span>
                    </span>
                    <span className="text-xs text-gray-500">
                      {atual ? 'nesta O.S.' : VEHICLE_TYPE_LABEL[v.type ?? 'carro']}
                    </span>
                  </button>
                )
              })}
            </div>
          )}

          {/* NOVO VEÍCULO */}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => setNovoAberto((o) => !o)}
              className="text-xs font-medium text-blue-600 hover:underline"
            >
              {novoAberto ? '− Fechar' : '➕ Outro veículo'}
            </button>

            {novoAberto && (
              <div className="mt-2 flex flex-wrap items-end gap-2 rounded-lg border border-dashed border-gray-300 p-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Placa</label>
                  <input
                    value={placa}
                    onChange={(e) => setPlaca(e.target.value)}
                    placeholder="ABC1234"
                    className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm uppercase"
                  />
                </div>
                <div className="min-w-[160px] flex-1">
                  <label className="mb-1 block text-xs font-medium text-gray-600">Modelo</label>
                  <input
                    value={modelo}
                    onChange={(e) => setModelo(e.target.value)}
                    placeholder="Gol 1.0"
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-gray-600">Tipo</label>
                  <select
                    value={tipo}
                    onChange={(e) => setTipo(e.target.value as VehicleType)}
                    className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  >
                    {(Object.keys(VEHICLE_TYPE_LABEL) as VehicleType[]).map((t) => (
                      <option key={t} value={t}>
                        {VEHICLE_TYPE_LABEL[t]}
                      </option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  onClick={criarEVincular}
                  disabled={salvando || !placa.trim() || !modelo.trim()}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                >
                  {salvando ? 'Salvando...' : 'Cadastrar e vincular'}
                </button>
                {(!placa.trim() || !modelo.trim()) && (
                  <p className="w-full text-xs text-gray-500">
                    Placa e modelo são o mínimo para cadastrar o veículo — marca, ano e cor
                    ficam para depois, na tela de Veículos.
                  </p>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}
    </section>
  )
}
