/**
 * Criação de contas: funcionário de uma oficina existente, e oficina
 * nova com seu gestor inicial (exclusivo do administrador do sistema).
 *
 * Absorve o antigo lib/firebase/members.ts com uma mudança de fundo: até
 * a v0.4.x, quem ESCREVIA users/{uid} e clients/{clientId}/members/{uid}
 * era o PRÓPRIO convidado, autenticado numa instância secundária do
 * Firebase App — porque a regra antiga só verificava `auth.uid == uid`,
 * sem checar quem pediu a criação. Isso é exatamente o furo fechado em
 * firebase/firestore.rules v0.5.0 (ver comentário no topo do arquivo):
 * qualquer usuário autenticado podia reescrever o PRÓPRIO users/{uid}
 * apontando pra outra oficina e virar "membro" dela.
 *
 * Agora a instância secundária serve só pra criar a CREDENCIAL de auth
 * (sem derrubar a sessão de quem está convidando) — todas as escritas no
 * Firestore são feitas pela sessão PRIMÁRIA, autenticada como quem tem
 * autoridade de verdade (o gestor da oficina, ou o admin do sistema).
 */

import { initializeApp, deleteApp } from 'firebase/app'
import {
  getAuth,
  createUserWithEmailAndPassword,
  signOut as secondarySignOut,
  deleteUser,
} from 'firebase/auth'
import { collection, doc, setDoc, onSnapshot } from 'firebase/firestore'
import { firebaseConfig } from '@/lib/firebase/config'
import { db } from '@/lib/firebase/config'
import { UserRole, Member } from '@/lib/types'

/**
 * Cria a credencial de autenticação numa instância descartável, isolada
 * da sessão de quem chamou. Sempre destrói a instância no fim (sucesso
 * ou erro) — nunca deixa um app secundário pendurado.
 */
async function createAuthAccount(email: string, password: string) {
  const secondaryApp = initializeApp(firebaseConfig, `provisioning-${Date.now()}`)
  try {
    const secondaryAuth = getAuth(secondaryApp)
    const cred = await createUserWithEmailAndPassword(secondaryAuth, email, password)
    await secondarySignOut(secondaryAuth)
    return cred.user.uid
  } finally {
    await deleteApp(secondaryApp)
  }
}

function friendlyAuthError(err: unknown): string {
  const msg = err instanceof Error ? err.message : String(err)
  if (msg.includes('email-already-in-use')) return 'Já existe uma conta com esse e-mail.'
  if (msg.includes('weak-password')) return 'Senha fraca — use pelo menos 6 caracteres.'
  if (msg.includes('invalid-email')) return 'E-mail inválido.'
  return 'Não foi possível criar a conta. Confira os dados e tente de novo.'
}

/**
 * Cria um funcionário para uma oficina EXISTENTE. Chamado pelo gestor
 * (sessão primária, já isGestor(clientId) — ver usuarios/page.tsx).
 */
export async function createMember(
  clientId: string,
  data: { name: string; email: string; password: string; role: UserRole }
) {
  let uid: string
  try {
    uid = await createAuthAccount(data.email, data.password)
  } catch (err) {
    throw new Error(friendlyAuthError(err))
  }

  try {
    const createdAt = Date.now()
    // Sessão PRIMÁRIA (o gestor) escreve os dois documentos — autorizado
    // por isGestor(clientId) em users/{uid} e por isMember(clientId) na
    // subárvore da oficina.
    await setDoc(doc(db, 'users', uid), {
      clientId,
      email: data.email,
      role: data.role,
      createdAt,
    })
    await setDoc(doc(db, 'clients', clientId, 'members', uid), {
      name: data.name,
      email: data.email,
      role: data.role,
      createdAt,
    })
    return uid
  } catch (err) {
    // A conta de auth já existe mas ficou sem users/{uid} — não deixar
    // órfã: apagar exige estar autenticado como ela, então reabrimos uma
    // instância secundária só pra isso.
    await cleanupOrphanAuthAccount(data.email, data.password)
    throw err
  }
}

async function cleanupOrphanAuthAccount(email: string, password: string) {
  const secondaryApp = initializeApp(firebaseConfig, `cleanup-${Date.now()}`)
  try {
    const secondaryAuth = getAuth(secondaryApp)
    const { signInWithEmailAndPassword } = await import('firebase/auth')
    const cred = await signInWithEmailAndPassword(secondaryAuth, email, password)
    await deleteUser(cred.user)
  } catch {
    // Melhor esforço — se não conseguir limpar, a conta órfã fica pro
    // admin resolver manualmente. Nunca deixar isso quebrar o fluxo
    // principal, que já está reportando o erro original pro usuário.
  } finally {
    await deleteApp(secondaryApp)
  }
}

/**
 * Cria uma OFICINA NOVA com seu gestor inicial. Exclusivo do
 * administrador do sistema (ver app/(admin)/admin/nova).
 *
 * Não escreve clients/{clientId}/members/{uid} — o admin não tem acesso
 * a essa subárvore de propósito (ver firebase/firestore.rules). O
 * próprio gestor fecha essa lacuna sozinho no primeiro login
 * (self-heal em lib/hooks/useClientId.tsx), usando o nome gravado aqui
 * em users/{uid}.name.
 */
export async function createOficinaComGestor(data: {
  nomeFantasia: string
  cnpj?: string
  gestorNome: string
  gestorEmail: string
  senha: string
}) {
  // Conta de auth primeiro: se falhar (e-mail já em uso, senha fraca),
  // nada mais foi criado e não sobra oficina órfã pro admin limpar.
  let uid: string
  try {
    uid = await createAuthAccount(data.gestorEmail, data.senha)
  } catch (err) {
    throw new Error(friendlyAuthError(err))
  }

  const clientRef = doc(collection(db, 'clients'))
  const clientId = clientRef.id
  const createdAt = Date.now()

  try {
    await setDoc(clientRef, {
      name: data.nomeFantasia,
      nomeFantasia: data.nomeFantasia,
      ...(data.cnpj ? { cnpj: data.cnpj } : {}),
      active: true,
      gestorNome: data.gestorNome,
      gestorEmail: data.gestorEmail,
      createdAt,
    })
    await setDoc(doc(db, 'users', uid), {
      clientId,
      email: data.gestorEmail,
      role: 'gestor' as UserRole,
      name: data.gestorNome,
      createdAt,
    })
    return { clientId, uid }
  } catch (err) {
    await cleanupOrphanAuthAccount(data.gestorEmail, data.senha)
    throw err
  }
}

export function watchMembers(clientId: string, cb: (items: Member[]) => void) {
  return onSnapshot(collection(db, 'clients', clientId, 'members'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member)))
  })
}
