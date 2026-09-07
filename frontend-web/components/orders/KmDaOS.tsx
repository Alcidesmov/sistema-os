'use client'

import { useEffect, useMemo, useState } from 'react'
import { Order, Customer } from '@/lib/types'
import { isCancelled, statusOf } from '@/lib/orders/status'
import { setOrderKm } from '@/lib/firebase/firestore'
import { enviarAvisoRetorno } from '@/lib/firebase/notifications'
import { DEFAULT_REMINDER_KM_INTERVAL, kmAlertOf, kmTargetOf, lastKmOrderOf } from '@/lib/orders/km'
import { orderLabel } from '@/lib/orders/format'

interface KmDaOSProps {
  clientId: string
  order: Order
  /** Todas as O.S. da oficina — o filtro pelo mesmo veículo é feito aqui. */
  orders: Order[]
  customer?: Customer
  by: string
}

const ALERT_STYLE: Record<string, string> = {
  atrasado: 'border-red-300 bg-red-50 text-red-800',
  proximo: 'border-amber-300 bg-amber-50 text-amber-800',
  programado: 'border-blue-200 bg-blue-50 text-blue-800',
}

/**
 * Quilometragem de entrada + aviso de retorno (v0.6.0).
 *
 * Só existe km se houver veículo vinculado — o pedido de "anotar km na
 * entrada" é sobre O CARRO, não sobre a O.S. em si. Sem telemetria do
 * veículo, o "aviso de retorno" só é detectável quando ele volta pra
 * oficina de novo: por isso o alerta aqui compara com o km-alvo deixado
 * pela ÚLTIMA visita do mesmo veículo (ver lib/orders/km.ts), em vez de
 * tentar monitorar km em tempo real.
 */
export default function KmDaOS({ clientId, order, orders, customer, by }: KmDaOSProps) {
  const s = statusOf(order)
  const editavel = !isCancelled(order) && s !== 'entregue'

  const [editando, setEditando] = useState(false)
  const [km, setKm] = useState('')
  const [intervalo, setIntervalo] = useState(String(DEFAULT_REMINDER_KM_INTERVAL))
  const [salvando, setSalvando] = useState(false)
  const [erro, setErro] = useState('')

  const [enviando, setEnviando] = useState(false)
  const [avisoEnviado, setAvisoEnviado] = useState<string | null>(null)
  const [erroEnvio, setErroEnvio] = useState('')

  useEffect(() => {
    if (editando) return
    setKm(order.entryKm != null ? String(order.entryKm) : '')
    setIntervalo(String(order.reminderKmInterval ?? DEFAULT_REMINDER_KM_INTERVAL))
  }, [order.entryKm, order.reminderKmInterval, editando])

  const anterior = useMemo(
    () => (order.vehicleId ? lastKmOrderOf(orders, order.vehicleId, order.id) : null),
    [orders, order.vehicleId, order.id]
  )
  const alerta = useMemo(() => kmAlertOf(order, anterior), [order, anterior])
  const metaAtual = useMemo(() => kmTargetOf(order), [order])

  if (!order.vehicleId) {
    return (
      <section className="rounded-xl border border-gray-200 bg-white p-5">
        <h2 className="mb-2 text-sm font-semibold text-gray-900">Quilometragem</h2>
        <p className="text-sm text-gray-500">
          Defina o veículo desta O.S. para registrar o km de entrada.
        </p>
      </section>
    )
  }

  const salvar = async () => {
    const kmNum = km.trim() ? Number(km.replace(/\D/g, '')) : NaN
    if (!km.trim() || Number.isNaN(kmNum)) return
    const intervaloNum = Number(intervalo.replace(/\D/g, '')) || DEFAULT_REMINDER_KM_INTERVAL
    setSalvando(true)
    setErro('')
    try {
      await setOrderKm(clientId, order.id, { entryKm: kmNum, reminderKmInterval: intervaloNum }, by)
      setEditando(false)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível salvar a quilometragem.')
    }
    setSalvando(false)
  }

  const limpar = async () => {
    setSalvando(true)
    setErro('')
    try {
      await setOrderKm(clientId, order.id, { entryKm: null }, by)
      setEditando(false)
    } catch (e) {
      console.error(e)
      setErro('Não foi possível remover a quilometragem.')
    }
    setSalvando(false)
  }

  const enviarAviso = async () => {
    setEnviando(true)
    setErroEnvio('')
    setAvisoEnviado(null)
    try {
      const r = await enviarAvisoRetorno(clientId, order.id)
      setAvisoEnviado(r.testMode ? `Enviado em modo de teste para ${r.sentTo}.` : `Enviado para ${r.sentTo}.`)
    } catch (e) {
      console.error(e)
      setErroEnvio(
        e instanceof Error
          ? `Não foi possível enviar o aviso: ${e.message}`
          : 'Não foi possível enviar o aviso por e-mail.'
      )
    }
    setEnviando(false)
  }

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-5">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold text-gray-900">Quilometragem</h2>
        {!editavel && <span className="text-xs text-gray-500">O.S. encerrada — km travado.</span>}
      </div>

      {alerta && (
        <div className={`mb-3 rounded-lg border px-3 py-2 text-xs ${ALERT_STYLE[alerta.level]}`}>
          <p className="font-medium">
            {alerta.level === 'atrasado' && '⚠️ '}
            {alerta.message}
          </p>
          <p className="mt-0.5 opacity-80">Origem: O.S. {orderLabel(alerta.fromOrder)}</p>
        </div>
      )}

      {order.entryKm != null && !editando ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2">
          <div>
            <p className="text-sm font-medium text-gray-900">
              {order.entryKm.toLocaleString('pt-BR')} km na entrada
            </p>
            <p className="text-xs text-gray-500">
              {metaAtual != null
                ? `Avisar retorno aos ${metaAtual.toLocaleString('pt-BR')} km (a cada ${
                    (order.reminderKmInterval ?? DEFAULT_REMINDER_KM_INTERVAL).toLocaleString('pt-BR')
                  } km)`
                : '—'}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={enviarAviso}
              disabled={enviando || metaAtual == null}
              className="rounded-lg border border-blue-300 px-3 py-1.5 text-xs font-medium text-blue-700 hover:bg-blue-50 disabled:opacity-50"
            >
              {enviando ? 'Enviando...' : '📧 Enviar aviso de retorno'}
            </button>
            {editavel && (
              <button
                type="button"
                onClick={() => setEditando(true)}
                className="text-xs font-medium text-blue-600 hover:underline"
              >
                Editar
              </button>
            )}
          </div>
        </div>
      ) : editavel ? (
        <div className="flex flex-wrap items-end gap-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Km na entrada</label>
            <input
              inputMode="numeric"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              placeholder="Ex: 42500"
              className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">
              Avisar retorno a cada
            </label>
            <div className="flex items-center gap-1">
              <input
                inputMode="numeric"
                value={intervalo}
                onChange={(e) => setIntervalo(e.target.value)}
                className="w-24 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
              <span className="text-xs text-gray-500">km</span>
            </div>
          </div>
          <button
            type="button"
            onClick={salvar}
            disabled={salvando || !km.trim()}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {salvando ? 'Salvando...' : 'Salvar'}
          </button>
          {order.entryKm != null && (
            <button
              type="button"
              onClick={() => setEditando(false)}
              className="text-xs font-medium text-gray-500 hover:underline"
            >
              Cancelar
            </button>
          )}
          {order.entryKm != null && (
            <button type="button" onClick={limpar} className="text-xs font-medium text-red-600 hover:underline">
              Remover
            </button>
          )}
        </div>
      ) : (
        <p className="text-sm text-gray-500">Km não registrado nesta O.S.</p>
      )}

      {erro && <p className="mt-2 text-xs font-medium text-red-600">{erro}</p>}

      {order.entryKm != null && !customer?.email && (
        <p className="mt-2 text-xs text-amber-700">
          Este cliente não tem e-mail cadastrado — o envio ainda funciona em modo de teste
          (recebe você, ver CLAUDE.md), mas não vai alcançar o cliente real até cadastrar o e-mail
          dele.
        </p>
      )}
      {avisoEnviado && <p className="mt-2 text-xs font-medium text-green-700">✓ {avisoEnviado}</p>}
      {erroEnvio && <p className="mt-2 text-xs font-medium text-red-600">{erroEnvio}</p>}
    </section>
  )
}
