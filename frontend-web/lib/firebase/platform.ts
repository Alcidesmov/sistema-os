/**
 * Camada de dados do ADMINISTRADOR SISTÊMICO.
 *
 * Vive num arquivo separado de lib/firebase/firestore.ts de propósito:
 * tudo aqui é CROSS-TENANT no sentido de "enxerga o CADASTRO de mais de
 * uma oficina", e isso precisa ficar óbvio em qualquer review.
 *
 * ESCOPO DELIBERADAMENTE ESTREITO: o pedido foi "é ele quem cadastra
 * novas oficinas, ninguém mais" — não visibilidade sobre o negócio de
 * cada oficina. Por isso este arquivo só lê/escreve o documento raso
 * clients/{clientId} (nome, CNPJ, situação, e-mail/nome do gestor
 * snapshotados na criação) e nunca a subárvore de dentro dela
 * (customers/vehicles/orders/invoices/members). A regra do Firestore
 * (firebase/firestore.rules) reforça isso: platformAdmin não tem
 * read/write em clients/{clientId}/{document=**}.
 *
 * Quem pode chamar: só quem tem platformAdmins/{uid} (ver
 * firebase/firestore.rules e docs/ADMIN-RUNBOOK.md). O gate de UI está em
 * app/(admin)/layout.tsx; o gate de verdade é a regra.
 */

import { collection, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'
import { Client } from '@/lib/types'

/**
 * O usuário logado é administrador do sistema?
 *
 * NUNCA lança: um usuário comum tem permissão de ler o próprio doc em
 * platformAdmins (que simplesmente não existe), mas se a regra ainda não
 * tiver sido publicada, ou se o app estiver offline, a leitura falha — e
 * "não consegui verificar" tem que significar "não é admin", nunca uma
 * tela branca no login.
 */
export async function isPlatformAdmin(uid: string): Promise<boolean> {
  try {
    const snap = await getDoc(doc(db, 'platformAdmins', uid))
    return snap.exists()
  } catch {
    return false
  }
}

/** Lista TODAS as oficinas da plataforma, em tempo real. Só admin. */
export function watchOficinas(cb: (items: Client[]) => void) {
  return onSnapshot(collection(db, 'clients'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...(d.data() as Omit<Client, 'id'>) })))
  })
}

export function watchOficina(clientId: string, cb: (client: Client | null) => void) {
  return onSnapshot(doc(db, 'clients', clientId), (snap) => {
    cb(snap.exists() ? { id: clientId, ...(snap.data() as Omit<Client, 'id'>) } : null)
  })
}

/**
 * Suspende (active:false) ou reativa uma oficina. Hoje é um marcador
 * administrativo visível na área /admin — o bloqueio efetivo do login da
 * oficina suspensa ainda não está ligado (ver docs/ADMIN-RUNBOOK.md).
 */
export async function setOficinaActive(clientId: string, active: boolean) {
  return updateDoc(doc(db, 'clients', clientId), { active })
}
