import { initializeApp, deleteApp } from 'firebase/app'
import { getAuth, createUserWithEmailAndPassword, signOut } from 'firebase/auth'
import { getFirestore, doc, setDoc, collection, onSnapshot } from 'firebase/firestore'
import { firebaseConfig } from '@/lib/firebase/config'
import { db } from '@/lib/firebase/config'
import { UserRole, Member } from '@/lib/types'

/**
 * Creates a login (Firebase Auth) for a teammate and links it to the
 * gestor's oficina, without touching the gestor's own session.
 *
 * The Firebase client SDK signs you in as whichever user you just
 * created — there's no "create user for someone else" call without the
 * Admin SDK (which this project doesn't have, see CLAUDE.md). Workaround:
 * run createUserWithEmailAndPassword on a throwaway secondary Firebase
 * app instance (same project, isolated auth state), so the primary
 * app's auth.currentUser (the gestor) never changes.
 */
export async function createMember(
  clientId: string,
  data: { name: string; email: string; password: string; role: UserRole }
) {
  const secondaryApp = initializeApp(firebaseConfig, `invite-${Date.now()}`)
  try {
    const secondaryAuth = getAuth(secondaryApp)
    const secondaryDb = getFirestore(secondaryApp)

    const cred = await createUserWithEmailAndPassword(secondaryAuth, data.email, data.password)
    const uid = cred.user.uid
    const createdAt = Date.now()

    // Written while still authenticated as the new user (secondaryAuth),
    // so it satisfies "users/{uid}: allow write if auth.uid == uid".
    await setDoc(doc(secondaryDb, 'users', uid), {
      clientId,
      email: data.email,
      role: data.role,
      createdAt,
    })
    // Now that users/{uid} exists and points at clientId, this same
    // session counts as a member of the tenant (see isMember() in
    // firestore.rules) and can write the member record used for listing.
    await setDoc(doc(secondaryDb, 'clients', clientId, 'members', uid), {
      name: data.name,
      email: data.email,
      role: data.role,
      createdAt,
    })

    await signOut(secondaryAuth)
    return uid
  } finally {
    await deleteApp(secondaryApp)
  }
}

export function watchMembers(clientId: string, cb: (items: Member[]) => void) {
  return onSnapshot(collection(db, 'clients', clientId, 'members'), (snap) => {
    cb(snap.docs.map((d) => ({ id: d.id, ...d.data() } as Member)))
  })
}
