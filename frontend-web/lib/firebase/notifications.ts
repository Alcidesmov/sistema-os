import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase/config'

interface AvisoRetornoResult {
  ok: boolean
  sentTo: string
  testMode: boolean
}

/**
 * Chama a Cloud Function `enviarAvisoRetorno` (firebase/src/index.ts).
 *
 * Ainda em modo de TESTE (v0.6.0): enquanto a config `aviso.test_override`
 * estiver setada no backend, todo aviso cai no e-mail de teste (hoje,
 * 35alcides@gmail.com) em vez do e-mail real do cliente — ver CLAUDE.md.
 * Não implantado em produção ainda (falta `firebase deploy --only
 * functions` manual, ver runbook no CLAUDE.md).
 */
export async function enviarAvisoRetorno(clientId: string, orderId: string): Promise<AvisoRetornoResult> {
  const fn = httpsCallable<{ clientId: string; orderId: string }, AvisoRetornoResult>(
    functions,
    'enviarAvisoRetorno'
  )
  const res = await fn({ clientId, orderId })
  return res.data
}
