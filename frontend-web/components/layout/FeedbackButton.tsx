'use client'

import { useState } from 'react'
import { usePathname } from 'next/navigation'
import { useAuth } from '@/lib/hooks/useAuth'
import { useClientId } from '@/lib/hooks/useClientId'
import { createFeedback } from '@/lib/firebase/firestore'

export default function FeedbackButton() {
  const pathname = usePathname()
  const { user } = useAuth()
  const { clientId } = useClientId()
  const [open, setOpen] = useState(false)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId || !message.trim()) return
    setSending(true)
    await createFeedback(clientId, {
      message: message.trim(),
      page: pathname,
      userEmail: user?.email ?? '',
    })
    setSending(false)
    setSent(true)
    setMessage('')
    setTimeout(() => {
      setSent(false)
      setOpen(false)
    }, 1500)
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-5 right-5 flex items-center gap-2 rounded-full bg-gray-900 px-4 py-2.5 text-sm font-medium text-white shadow-lg hover:bg-gray-800"
      >
        💡 Sugerir melhoria
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 p-4">
          <div className="w-full max-w-sm rounded-xl bg-white p-5 shadow-xl">
            <h3 className="mb-1 text-base font-semibold text-gray-900">Sugerir melhoria</h3>
            <p className="mb-3 text-xs text-gray-500">
              O que podemos melhorar nesta tela? Sua sugestão vai para análise.
            </p>
            {sent ? (
              <p className="py-4 text-center text-sm font-medium text-green-600">
                Enviado, obrigado!
              </p>
            ) : (
              <form onSubmit={handleSubmit}>
                <textarea
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  required
                  rows={4}
                  className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
                  placeholder="Ex: seria bom poder duplicar uma OS existente..."
                />
                <div className="mt-3 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setOpen(false)}
                    className="rounded-lg px-3 py-2 text-sm text-gray-600 hover:bg-gray-100"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={sending}
                    className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {sending ? 'Enviando...' : 'Enviar'}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </>
  )
}
