'use client'

import { createContext, useContext, useEffect, useState, ReactNode } from 'react'
import { doc, getDoc, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { useAuth } from '@/lib/hooks/useAuth'

interface ClientContextValue {
  clientId: string | null
  loading: boolean
}

const ClientContext = createContext<ClientContextValue>({ clientId: null, loading: true })

/**
 * Each authenticated user belongs to exactly one client (oficina).
 * MVP bootstrap: on first login, if no users/{uid} doc exists, the user
 * becomes the owner of a new client with clientId === uid. Inviting
 * teammates into the same clientId is a later enhancement.
 */
export function ClientProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth()
  const [clientId, setClientId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) {
      setClientId(null)
      setLoading(false)
      return
    }

    const userRef = doc(db, 'users', user.uid)

    getDoc(userRef).then(async (snap) => {
      if (snap.exists()) {
        setClientId(snap.data().clientId)
      } else {
        const newClientId = user.uid
        await setDoc(userRef, {
          clientId: newClientId,
          email: user.email,
          role: 'owner',
          createdAt: Date.now(),
        })
        await setDoc(doc(db, 'clients', newClientId), {
          name: user.email?.split('@')[0] ?? 'Minha Oficina',
          ownerUid: user.uid,
          createdAt: Date.now(),
        })
        setClientId(newClientId)
      }
      setLoading(false)
    })
  }, [user])

  return (
    <ClientContext.Provider value={{ clientId, loading }}>
      {children}
    </ClientContext.Provider>
  )
}

export function useClientId() {
  return useContext(ClientContext)
}
