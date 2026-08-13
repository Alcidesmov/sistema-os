'use client'

import { useEffect, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchFeedback, Feedback } from '@/lib/firebase/firestore'
import { doc, updateDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase/config'

const STATUS_LABEL: Record<Feedback['status'], string> = {
  new: 'Nova',
  reviewing: 'Em análise',
  done: 'Implementada',
  rejected: 'Descartada',
}

const STATUS_COLOR: Record<Feedback['status'], string> = {
  new: 'bg-amber-100 text-amber-700',
  reviewing: 'bg-blue-100 text-blue-700',
  done: 'bg-green-100 text-green-700',
  rejected: 'bg-gray-100 text-gray-500',
}

export default function FeedbackPage() {
  const { clientId } = useClientId()
  const [items, setItems] = useState<Feedback[]>([])

  useEffect(() => {
    if (!clientId) return
    return watchFeedback(clientId, setItems)
  }, [clientId])

  const updateStatus = async (id: string, status: Feedback['status']) => {
    if (!clientId) return
    await updateDoc(doc(db, 'clients', clientId, 'feedback', id), { status })
  }

  const exportJSON = () => {
    const blob = new Blob([JSON.stringify(items, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `melhorias-${Date.now()}.json`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Sugestões de melhoria</h1>
        <button
          onClick={exportJSON}
          className="rounded-lg bg-gray-800 px-4 py-2 text-sm font-medium text-white hover:bg-gray-900"
        >
          Exportar JSON
        </button>
      </div>

      <div className="space-y-3">
        {items.map((f) => (
          <div key={f.id} className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-2 flex items-start justify-between">
              <span
                className={`rounded-full px-2 py-1 text-xs font-medium ${STATUS_COLOR[f.status]}`}
              >
                {STATUS_LABEL[f.status]}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(f.createdAt).toLocaleString('pt-BR')}
              </span>
            </div>
            <p className="mb-2 text-sm text-gray-900">{f.message}</p>
            <p className="mb-3 text-xs text-gray-400">
              Página: {f.page} · {f.userEmail}
            </p>
            <div className="flex gap-2">
              {(['new', 'reviewing', 'done', 'rejected'] as const).map((s) => (
                <button
                  key={s}
                  onClick={() => updateStatus(f.id, s)}
                  className={`rounded-full border px-2 py-1 text-xs ${
                    f.status === s
                      ? 'border-gray-800 bg-gray-800 text-white'
                      : 'border-gray-300 text-gray-600 hover:border-gray-500'
                  }`}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          </div>
        ))}
        {items.length === 0 && (
          <p className="py-8 text-center text-sm text-gray-400">
            Nenhuma sugestão enviada ainda. Use o botão &quot;💡 Sugerir melhoria&quot; em qualquer tela.
          </p>
        )}
      </div>
    </div>
  )
}
