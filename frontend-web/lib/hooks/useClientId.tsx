'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/hooks/useAuth'
import { UserRole } from '@/lib/types'
import { isPlatformAdmin } from '@/lib/firebase/platform'

export type ClientStatus = 'loading' | 'ok' | 'sem-oficina' | 'admin'

interface ClientContextValue {
  clientId: string | null
  role: UserRole | null
  loading: boolean
  isPlatformAdmin: boolean
  /**
   * 'ok' — tem oficina, use normalmente.
   * 'sem-oficina' — logou mas nenhum users/{uid} aponta pra oficina
   *   nenhuma, e não é admin. Vai pra /sem-oficina.
   * 'admin' — é administrador do sistema e NÃO tem oficina própria
   *   vinculada. Vai pra /admin. (Se também tiver oficina, `clientId`
   *   vem preenchido e a pessoa pode circular entre as duas áreas.)
   */
  status: ClientStatus
}

const ClientContext = createContext<ClientContextValue>({
  clientId: null,
  role: null,
  loading: true,
  isPlatformAdmin: false,
  status: 'loading',
})

/**
 * Cada usuário autenticado pertence a NO MÁXIMO uma oficina (clientId),
 * resolvido via o doc de lookup users/{uid}.
 *
 * NÃO existe mais bootstrap automático de oficina nova aqui. Até a
 * v0.4.x, o primeiro login de qualquer e-mail sem users/{uid} criava uma
 * oficina vazia na hora — foi assim, não pelo botão de cadastro da tela
 * de login, que nasceu o tenant órfão "35alcides" (ver CLAUDE.md). Criar
 * oficina agora é ação exclusiva do administrador do sistema, pela área
 * /admin (ver lib/firebase/provisioning.ts).
 */
export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [clientId, setClientId] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [admin, setAdmin] = useState(false)
  const [status, setStatus] = useState<ClientStatus>('loading')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setClientId(null)
      setRole(null)
      setAdmin(false)
      setStatus('loading')
      setLoading(false)
      return
    }

    let cancelled = false

    ;(async () => {
      const [userSnap, admin] = await Promise.all([
        getDoc(doc(db, 'users', user.uid)),
        isPlatformAdmin(user.uid),
      ])
      if (cancelled) return

      if (!userSnap.exists()) {
        setClientId(null)
        setRole(null)
        setAdmin(admin)
        setStatus(admin ? 'admin' : 'sem-oficina')
        setLoading(false)
        return
      }

      const data = userSnap.data()
      const resolvedRole: UserRole = data.role ?? 'gestor'
      setClientId(data.clientId)
      setRole(resolvedRole)
      setAdmin(admin)
      setStatus('ok')
      setLoading(false)

      // Self-heal: quem entrou porque o admin criou a oficina, ou porque
      // um gestor criou o login, ainda não tem o próprio registro em
      // clients/{clientId}/members — quem escreveu users/{uid} não tem
      // permissão de escrever ali (só isMember escreve, e essa pessoa só
      // vira isMember quando o passo anterior já commitou). Assim que
      // isMember(clientId) é verdade, a própria pessoa fecha essa lacuna
      // com os dados do próprio doc de lookup.
      const memberRef = doc(db, 'clients', data.clientId, 'members', user.uid)
      const memberSnap = await getDoc(memberRef)
      if (!cancelled && !memberSnap.exists()) {
        await setDoc(memberRef, {
          name: data.name || user.email?.split('@')[0] || 'Usuário',
          email: data.email ?? user.email,
          role: resolvedRole,
          createdAt: Date.now(),
        })
      }
    })()

    return () => {
      cancelled = true
    }
  }, [user])

  return (
    <ClientContext.Provider value={{ clientId, role, loading, isPlatformAdmin: admin, status }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClientId() {
  return useContext(ClientContext)
}
