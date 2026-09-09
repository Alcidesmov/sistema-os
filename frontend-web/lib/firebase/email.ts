import { auth } from './config'

export async function sendReturnReminder(orderId: string, clientId: string) {
  const user = auth.currentUser
  if (!user) {
    throw new Error('Usuário não autenticado')
  }

  const token = await user.getIdToken()

  const res = await fetch('/api/send-return-reminder', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
    },
    body: JSON.stringify({ orderId, clientId }),
  })

  if (!res.ok) {
    const error = await res.json()
    throw new Error(error.error || 'Erro ao enviar aviso de retorno')
  }

  return res.json()
}
