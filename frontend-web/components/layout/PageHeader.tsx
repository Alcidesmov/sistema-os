'use client'

import { ReactNode } from 'react'
import Link from 'next/link'

export interface Crumb {
  label: string
  href: string
}

export interface PageHeaderProps {
  titulo: string
  /** Ancestrais clicáveis, do mais geral pro mais específico. O título
   *  entra sozinho no fim da trilha — não repetir aqui. */
  breadcrumb?: Crumb[]
  /** Subtítulo curto: pra que serve a tela, ou o que o número em foco significa. */
  descricao?: string
  /** Botões da direita (ações da tela). */
  acoes?: ReactNode
}

/**
 * Cabeçalho padrão de tela, com trilha de volta.
 *
 * Existe porque o dono reclamou que "o sistema está carente de navegação":
 * telas de detalhe (O.S. #1042, cliente, veículo) não diziam de onde
 * vieram nem tinham caminho de volta — só o botão do navegador.
 */
export default function PageHeader({
  titulo,
  breadcrumb,
  descricao,
  acoes,
}: PageHeaderProps) {
  return (
    <div className="mb-5">
      {breadcrumb && breadcrumb.length > 0 && (
        <nav aria-label="Trilha de navegação" className="mb-1.5">
          <ol className="flex flex-wrap items-center gap-1 text-xs text-gray-500">
            {breadcrumb.map((c) => (
              <li key={c.href} className="flex items-center gap-1">
                <Link href={c.href} className="rounded hover:text-blue-700 hover:underline">
                  {c.label}
                </Link>
                <span aria-hidden className="text-gray-300">
                  ›
                </span>
              </li>
            ))}
            <li className="font-medium text-gray-700" aria-current="page">
              {titulo}
            </li>
          </ol>
        </nav>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold text-gray-900 sm:text-2xl">{titulo}</h1>
          {descricao && <p className="mt-0.5 text-sm text-gray-500">{descricao}</p>}
        </div>
        {acoes && <div className="flex flex-wrap items-center gap-2">{acoes}</div>}
      </div>
    </div>
  )
}
