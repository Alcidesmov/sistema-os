import { httpsCallable } from 'firebase/functions'
import { functions } from '@/lib/firebase/config'

interface AvisoRetornoResult {
  ok: boolean
  sentTo: string
}

/**
 * Chama a Cloud Function `enviarAvisoRetorno` (firebase/src/index.ts).
 * Sempre envia para o e-mail cadastrado do cliente — sem modo de teste
 * (ver CLAUDE.md). Não implantado em produção ainda (falta `firebase
 * deploy --only functions` manual, ver runbook no CLAUDE.md).
 */
export async function enviarAvisoRetorno(clientId: string, orderId: string): Promise<AvisoRetornoResult> {
  const fn = httpsCallable<{ clientId: string; orderId: string }, AvisoRetornoResult>(
    functions,
    'enviarAvisoRetorno'
  )
  const res = await fn({ clientId, orderId })
  return res.data
}
