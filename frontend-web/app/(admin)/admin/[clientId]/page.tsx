'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { watchOficina, setOficinaActive } from '@/lib/firebase/platform'
import { Client } from '@/lib/types'

export default function AdminOficinaDetailPage() {
  const params = useParams<{ clientId: string }>()
  const router = useRouter()
  const [oficina, setOficina] = useState<Client | null>(null)
  const [notFound, setNotFound] = useState(false)
  const [toggling, setToggling] = useState(false)

  useEffect(() => {
    if (!params.clientId) return
    return watchOficina(params.clientId, (c) => {
      setOficina(c)
      if (!c) setNotFound(true)
    })
  }, [params.clientId])

  if (notFound) {
    return (
      <div>
        <p className="text-sm text-gray-500">Oficina não encontrada.</p>
        <button onClick={() => router.push('/admin')} className="mt-2 text-sm text-blue-600 hover:underline">
          ← Voltar
        </button>
      </div>
    )
  }

  if (!oficina) {
    return <p className="text-sm text-gray-500">Carregando...</p>
  }

  const active = oficina.active !== false

  const toggleActive = async () => {
    setToggling(true)
    try {
      await setOficinaActive(oficina.id, !active)
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="max-w-lg">
      <button onClick={() => router.push('/admin')} className="mb-4 text-sm text-gray-500 hover:text-gray-700">
        ← Voltar
      </button>

      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <div className="mb-4 flex items-start justify-between">
          <div>
            <h1 className="text-xl font-bold text-gray-900">{oficina.nomeFantasia || oficina.name}</h1>
            {oficina.cnpj && <p className="text-sm text-gray-500">{oficina.cnpj}</p>}
          </div>
          <span
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              active ? 'bg-green-100 text-green-700' : 'bg-gray-200 text-gray-600'
            }`}
          >
            {active ? 'Ativa' : 'Suspensa'}
          </span>
        </div>

        <div className="space-y-2 border-t border-gray-100 pt-4 text-sm">
          <p>
            <span className="text-gray-500">Gestor inicial:</span>{' '}
            {oficina.gestorNome ? `${oficina.gestorNome} · ${oficina.gestorEmail}` : oficina.gestorEmail || '—'}
          </p>
          <p>
            <span className="text-gray-500">Criada em:</span>{' '}
            {oficina.createdAt ? new Date(oficina.createdAt).toLocaleDateString('pt-BR') : '—'}
          </p>
          <p className="text-xs text-gray-400">
            O administrador do sistema não enxerga clientes, veículos ou O.S. desta oficina —
            só o cadastro acima.
          </p>
        </div>

        <div className="mt-6 border-t border-gray-100 pt-4">
          <button
            onClick={toggleActive}
            disabled={toggling}
            className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-50 ${
              active ? 'bg-red-600 hover:bg-red-700' : 'bg-green-600 hover:bg-green-700'
            }`}
          >
            {toggling ? 'Aguarde...' : active ? 'Suspender oficina' : 'Reativar oficina'}
          </button>
        </div>
      </div>
    </div>
  )
}
