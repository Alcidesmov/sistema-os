'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createOficinaComGestor } from '@/lib/firebase/provisioning'

function generatePassword() {
  return Math.random().toString(36).slice(-8)
}

export default function NovaOficinaPage() {
  const router = useRouter()
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [gestorNome, setGestorNome] = useState('')
  const [gestorEmail, setGestorEmail] = useState('')
  const [senha, setSenha] = useState(generatePassword())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [created, setCreated] = useState<{ clientId: string; email: string; senha: string } | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!nomeFantasia || !gestorNome || !gestorEmail || !senha) return
    setSaving(true)
    setError('')
    try {
      const { clientId } = await createOficinaComGestor({
        nomeFantasia,
        cnpj: cnpj || undefined,
        gestorNome,
        gestorEmail,
        senha,
      })
      setCreated({ clientId, email: gestorEmail, senha })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar a oficina.')
    } finally {
      setSaving(false)
    }
  }

  if (created) {
    return (
      <div className="max-w-lg">
        <h1 className="mb-4 text-2xl font-bold text-gray-900">Oficina criada</h1>
        <div className="rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          <p className="mb-2">Repasse essas credenciais pro gestor entrar:</p>
          <p>
            <strong>E-mail:</strong> {created.email}
          </p>
          <p>
            <strong>Senha:</strong> {created.senha}
          </p>
        </div>
        <div className="mt-4 flex gap-3">
          <button
            onClick={() => router.push(`/admin/${created.clientId}`)}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            Ver oficina
          </button>
          <button
            onClick={() => {
              setCreated(null)
              setNomeFantasia('')
              setCnpj('')
              setGestorNome('')
              setGestorEmail('')
              setSenha(generatePassword())
            }}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Cadastrar outra
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-lg">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Nova oficina</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">Nome fantasia</label>
          <input
            value={nomeFantasia}
            onChange={(e) => setNomeFantasia(e.target.value)}
            required
            autoFocus
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Ex: Auto Peças do João"
          />
        </div>
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">CNPJ (opcional)</label>
          <input
            value={cnpj}
            onChange={(e) => setCnpj(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="00.000.000/0001-00"
          />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <p className="mb-3 text-sm font-semibold text-gray-900">Gestor inicial</p>
          <div className="space-y-3">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nome</label>
              <input
                value={gestorNome}
                onChange={(e) => setGestorNome(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
              <input
                type="email"
                value={gestorEmail}
                onChange={(e) => setGestorEmail(e.target.value)}
                required
                className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Senha temporária
              </label>
              <input
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                minLength={6}
                className="w-40 rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </div>
          </div>
        </div>

        {error && <p className="text-sm text-red-600">{error}</p>}

        <button
          type="submit"
          disabled={saving}
          className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Criando...' : 'Criar oficina'}
        </button>
      </form>
    </div>
  )
}
