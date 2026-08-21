'use client'

import Link from 'next/link'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * 404 do MecOS. Antes disso, uma rota errada (link velho, digitação,
 * favorito quebrado) caía na tela crua do Next — sem marca, sem volta.
 * Isso é a mesma reclamação de "navegação carente": também vale para
 * quando o usuário se perde.
 */
export default function NotFound() {
  const { user, loading } = useAuth()
  const destino = !loading && !user ? '/login' : '/esteira'

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 px-4 text-center">
      <p className="text-sm font-semibold text-blue-600">MecOS</p>
      <h1 className="mt-2 text-3xl font-bold text-gray-900">Página não encontrada</h1>
      <p className="mt-2 max-w-sm text-sm text-gray-500">
        Esse endereço não existe ou a O.S., cliente ou veículo que você procura
        pode ter mudado de lugar.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
        <Link
          href={destino}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Voltar para a Esteira
        </Link>
        <Link
          href="/busca"
          className="rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Buscar O.S., cliente ou veículo
        </Link>
      </div>
    </div>
  )
}
