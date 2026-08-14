'use client'

import { useEffect, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchMembers, createMember } from '@/lib/firebase/members'
import { Member, UserRole, USER_ROLE_LABEL } from '@/lib/types'

function generatePassword() {
  return Math.random().toString(36).slice(-8)
}

export default function UsuariosPage() {
  const { clientId, role } = useClientId()
  const [members, setMembers] = useState<Member[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState(generatePassword())
  const [memberRole, setMemberRole] = useState<UserRole>('recepcionista')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [lastCreated, setLastCreated] = useState<{ email: string; password: string } | null>(null)

  useEffect(() => {
    if (!clientId) return
    return watchMembers(clientId, setMembers)
  }, [clientId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !name || !email || !password) return
    setSaving(true)
    setError('')
    try {
      await createMember(clientId, { name, email, password, role: memberRole })
      setLastCreated({ email, password })
      setName('')
      setEmail('')
      setPassword(generatePassword())
      setMemberRole('recepcionista')
    } catch (err) {
      setError(
        err instanceof Error && err.message.includes('email-already-in-use')
          ? 'Já existe uma conta com esse e-mail.'
          : 'Não foi possível criar o usuário (verifique o e-mail e a senha, mínimo 6 caracteres).'
      )
    } finally {
      setSaving(false)
    }
  }

  if (role && role !== 'gestor') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">Só o gestor da oficina pode gerenciar usuários.</p>
      </div>
    )
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Usuários</h1>

      <form
        onSubmit={handleSubmit}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Nome</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Nome do funcionário"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">E-mail</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="funcionario@email.com"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Senha temporária</label>
          <input
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Papel</label>
          <select
            value={memberRole}
            onChange={(e) => setMemberRole(e.target.value as UserRole)}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            {(Object.keys(USER_ROLE_LABEL) as UserRole[]).map((r) => (
              <option key={r} value={r}>
                {USER_ROLE_LABEL[r]}
              </option>
            ))}
          </select>
        </div>
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
        >
          {saving ? 'Criando...' : '+ Criar usuário'}
        </button>
      </form>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {lastCreated && (
        <div className="mb-6 rounded-xl border border-teal-200 bg-teal-50 p-4 text-sm text-teal-900">
          Usuário criado. Repasse essas credenciais pra ele entrar (peça pra trocar a senha
          depois — ainda não existe tela de "trocar senha" no sistema):
          <br />
          <strong>E-mail:</strong> {lastCreated.email} · <strong>Senha:</strong>{' '}
          {lastCreated.password}
        </div>
      )}

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 text-left text-xs font-medium uppercase text-gray-500">
              <tr>
                <th className="px-4 py-3">Nome</th>
                <th className="px-4 py-3">E-mail</th>
                <th className="px-4 py-3">Papel</th>
                <th className="px-4 py-3">Desde</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {members.map((m) => (
                <tr key={m.id}>
                  <td className="px-4 py-3 font-medium text-gray-900">{m.name}</td>
                  <td className="px-4 py-3 text-gray-600">{m.email}</td>
                  <td className="px-4 py-3 text-gray-600">{USER_ROLE_LABEL[m.role]}</td>
                  <td className="px-4 py-3 text-gray-500">
                    {new Date(m.createdAt).toLocaleDateString('pt-BR')}
                  </td>
                </tr>
              ))}
              {members.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-gray-400">
                    Nenhum usuário cadastrado ainda
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
