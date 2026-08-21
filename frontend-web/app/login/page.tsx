'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'

/**
 * Sem modo de cadastro. Até a v0.4.x esta tela tinha um toggle "Cadastre
 * sua oficina" que criava uma oficina nova pra qualquer visitante — foi
 * exatamente isso que o dono pediu pra fechar: "é ele quem cadastra
 * novas oficinas, ninguém mais" (o "ele" é o administrador do sistema,
 * ver app/(admin)/admin/nova). Criar oficina agora é exclusivo de quem
 * tem platformAdmins/{uid} — ver firebase/firestore.rules.
 */
export default function LoginPage() {
  const router = useRouter()
  const { signIn, resetPassword } = useAuth()
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)
    try {
      if (mode === 'login') {
        await signIn(email, password)
        router.push('/dashboard')
      } else {
        await resetPassword(email)
        setResetSent(true)
      }
    } catch {
      setError(
        mode === 'login'
          ? 'E-mail ou senha inválidos'
          : 'Não foi possível enviar o e-mail (confira se o endereço está certo)'
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="w-full max-w-sm rounded-xl border border-gray-200 bg-white p-8 shadow-lg">
        <div className="mb-6 text-center">
          <div className="mb-3 text-4xl">🔧</div>
          <h1 className="mb-1 text-3xl font-bold text-gray-900">MecOS</h1>
          <p className="text-xs font-semibold uppercase tracking-wide text-blue-600">
            Gestão de Ordens de Serviço
          </p>
        </div>

        {mode === 'reset' && resetSent ? (
          <div className="space-y-4 text-center">
            <p className="text-sm text-gray-700">
              Enviamos um link de redefinição para <strong>{email}</strong>. Verifique também a
              caixa de spam.
            </p>
            <button
              onClick={() => {
                setMode('login')
                setResetSent(false)
              }}
              className="text-sm text-blue-600 hover:underline"
            >
              ← Voltar para o login
            </button>
          </div>
        ) : (
          <>
            <p className="mb-6 text-center text-sm text-gray-500">
              {mode === 'login' ? 'Entre para acessar o sistema' : 'Informe seu e-mail de acesso'}
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-gray-700">E-mail</label>
                <input
                  type="email"
                  required
                  autoFocus
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                  placeholder="voce@oficina.com"
                />
              </div>

              {mode === 'login' && (
                <div>
                  <label className="mb-1 block text-sm font-medium text-gray-700">Senha</label>
                  <input
                    type="password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
                    placeholder="••••••••"
                  />
                </div>
              )}

              {error && <p className="text-sm text-red-600">{error}</p>}

              <button
                type="submit"
                disabled={loading}
                className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
              >
                {loading
                  ? 'Aguarde...'
                  : mode === 'login'
                    ? 'Entrar'
                    : 'Enviar link de redefinição'}
              </button>
            </form>

            <button
              onClick={() => {
                setMode(mode === 'login' ? 'reset' : 'login')
                setError('')
              }}
              className="mt-4 w-full text-center text-xs text-gray-500 hover:text-gray-700"
            >
              {mode === 'login' ? 'Esqueci minha senha' : '← Voltar para o login'}
            </button>
          </>
        )}
      </div>
    </main>
  )
}
