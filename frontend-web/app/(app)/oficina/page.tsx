'use client'

import { useEffect, useState } from 'react'
import { useClientId } from '@/lib/hooks/useClientId'
import { watchClient, updateClient } from '@/lib/firebase/firestore'
import { Client } from '@/lib/types'

export default function OficinaPage() {
  const { clientId, role } = useClientId()
  const [client, setClient] = useState<Client | null>(null)
  const [nomeFantasia, setNomeFantasia] = useState('')
  const [razaoSocial, setRazaoSocial] = useState('')
  const [cnpj, setCnpj] = useState('')
  const [address, setAddress] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    if (!clientId) return
    return watchClient(clientId, (c) => {
      setClient(c)
      setNomeFantasia(c.nomeFantasia ?? c.name ?? '')
      setRazaoSocial(c.razaoSocial ?? '')
      setCnpj(c.cnpj ?? '')
      setAddress(c.address ?? '')
      setPhone(c.phone ?? '')
      setEmail(c.email ?? '')
    })
  }, [clientId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!clientId) return
    setSaving(true)
    setSaved(false)
    const data: Partial<Omit<Client, 'id'>> = { name: nomeFantasia || client?.name || 'Minha Oficina' }
    if (nomeFantasia) data.nomeFantasia = nomeFantasia
    if (razaoSocial) data.razaoSocial = razaoSocial
    if (cnpj) data.cnpj = cnpj
    if (address) data.address = address
    if (phone) data.phone = phone
    if (email) data.email = email
    await updateClient(clientId, data)
    setSaving(false)
    setSaved(true)
  }

  if (role && role !== 'gestor') {
    return (
      <div className="rounded-xl border border-gray-200 bg-white p-6">
        <p className="text-sm text-gray-500">
          Só o gestor da oficina pode ver e editar essas informações.
        </p>
      </div>
    )
  }

  return (
    <div className="max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-gray-900">Oficina</h1>

      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-200 bg-white p-6"
      >
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Nome fantasia</label>
            <input
              value={nomeFantasia}
              onChange={(e) => setNomeFantasia(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="RRadiadores"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Razão social</label>
            <input
              value={razaoSocial}
              onChange={(e) => setRazaoSocial(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="RRadiadores Ltda"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">CNPJ</label>
            <input
              value={cnpj}
              onChange={(e) => setCnpj(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="00.000.000/0001-00"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-gray-600">Telefone</label>
            <input
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
              placeholder="(00) 00000-0000"
            />
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">Endereço</label>
          <input
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="Rua, número, bairro, cidade - UF"
          />
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-gray-600">E-mail de contato</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            placeholder="contato@suaoficina.com"
          />
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={saving}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {saving ? 'Salvando...' : 'Salvar'}
          </button>
          {saved && <p className="text-sm text-green-600">Salvo.</p>}
        </div>
      </form>
    </div>
  )
}
