'use client'

import { useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { watchOficinas } from '@/lib/firebase/platform'
import { Client } from '@/lib/types'
import { normalize } from '@/lib/utils/search'

export default function AdminOficinasPage() {
  const [oficinas, setOficinas] = useState<Client[]>([])
  const [q, setQ] = useState('')

  useEffect(() => watchOficinas(setOficinas), [])

  const filtered = useMemo(() => {
    const nq = normalize(q.trim())
    if (!nq) return oficinas
    return oficinas.filter((o) =>
      [o.nomeFantasia, o.name, o.cnpj, o.gestorEmail, o.gestorNome]
        .filter(Boolean)
        .some((v) => normalize(String(v)).includes(nq))
    )
  }, [oficinas, q])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Oficinas</h1>
        <Link
          href="/admin/nova"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Nova oficina
        </Link>
      </div>

      <input
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        placeholder="Buscar por nome, CNPJ ou e-mail do gestor..."
        className="mb-4 w-full max-w-md rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Oficina</th>
                <th className="px-4 py-3">CNPJ</th>
                <th className="px-4 py-3">Gestor</th>
                <th className="px-4 py-3">Situação</th>
                <th className="px-4 py-3">Criada em</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((o) => (
                <tr key={o.id} className="cursor-pointer hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link href={`/admin/${o.id}`} className="font-medium text-gray-900">
                      {o.nomeFantasia || o.name || 'Sem nome'}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">{o.cnpj || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {o.gestorNome ? `${o.gestorNome} · ${o.gestorEmail}` : o.gestorEmail || '—'}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`rounded-full px-2 py-1 text-xs font-medium ${
                        o.active === false
                          ? 'bg-gray-200 text-gray-600'
                          : 'bg-green-100 text-green-700'
                      }`}
                    >
                      {o.active === false ? 'Suspensa' : 'Ativa'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-500">
                    {o.createdAt ? new Date(o.createdAt).toLocaleDateString('pt-BR') : '—'}
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-gray-400">
                    {oficinas.length === 0 ? 'Nenhuma oficina cadastrada ainda' : 'Nada encontrado'}
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
