import type { Metadata } from 'next'
import './globals.css'
import { AuthProvider } from '@/lib/hooks/useAuth'

export const metadata: Metadata = {
  title: 'MecOS',
  description: 'Sistema de Ordem de Serviço para Oficinas Mecânicas',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body>
        <AuthProvider>{children}</AuthProvider>
      </body>
    </html>
  )
}
