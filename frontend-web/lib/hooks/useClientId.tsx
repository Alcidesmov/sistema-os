'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/hooks/useAuth'
import { UserRole } from '@/lib/types'

interface ClientContextValue {
  clientId: string | null
  role: UserRole | null
  loading: boolean
}

const ClientContext = createContext<ClientContextValue>({
  clientId: null,
  role: null,
  loading: true,
})

/**
 * Each authenticated user belongs to exactly one oficina (clientId),
 * resolved via their users/{uid} lookup doc. MVP bootstrap: on first
 * login ever, if no users/{uid} doc exists, the user becomes the
 * gestor of a brand-new oficina with clientId === uid. Teammates
 * (supervisor/mecânico/recepcionista) are added later from the tela
 * "Usuários" — they log in with a users/{uid} doc that already points
 * at the gestor's clientId, so this bootstrap branch never runs for
 * them (ver lib/firebase/members.ts).
 */
export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [clientId, setClientId] = useState<string | null>(null)
  const [role, setRole] = useState<UserRole | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setClientId(null)
      setRole(null)
      setLoading(false)
      return
    }

    const userRef = doc(db, 'users', user.uid)

    getDoc(userRef).then(async (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setClientId(data.clientId)
        setRole(data.role ?? 'gestor')
      } else {
        const newClientId = user.uid
        const createdAt = Date.now()
        await setDoc(userRef, {
          clientId: newClientId,
          email: user.email,
          role: 'gestor' as UserRole,
          createdAt,
        })
        await setDoc(doc(db, 'clients', newClientId), {
          name: user.email?.split('@')[0] ?? 'Minha Oficina',
          ownerUid: user.uid,
          createdAt,
        })
        await setDoc(doc(db, 'clients', newClientId, 'members', user.uid), {
          name: user.email?.split('@')[0] ?? 'Gestor',
          email: user.email,
          role: 'gestor' as UserRole,
          createdAt,
        })
        setClientId(newClientId)
        setRole('gestor')
      }
      setLoading(false)
    })
  }, [user])

  return (
    <ClientContext.Provider value={{ clientId, role, loading }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClientId() {
  return useContext(ClientContext)
}
