'use client'

import { useMemo, useState } from 'react'
import { normalize } from '@/lib/utils/search'

export interface AutocompleteOption {
  id: string
  label: string
  secondary?: string
}

interface AutocompleteProps {
  options: AutocompleteOption[]
  onChange: (option: AutocompleteOption) => void
  onQueryChange?: (query: string) => void
  placeholder?: string
  maxResults?: number
  autoFocus?: boolean
  /**
   * Rótulo da linha de CRIAR, renderizada SEMPRE como última linha do
   * dropdown — inclusive quando há resultados. Antes disso, cadastrar algo
   * novo só era possível quando a busca não achava nada, e quem tinha um
   * homônimo na lista ficava sem saída.
   */
  createLabel?: (query: string) => string
  onCreate?: (query: string) => void
  /**
   * Lista as opções sem exigir digitação (usado quando a lista já vem
   * escopada — os carros DAQUELE cliente, por exemplo).
   */
  showAllWhenEmpty?: boolean
  emptyLabel?: string
}

export function Autocomplete({
  options,
  onChange,
  onQueryChange,
  placeholder = 'Digite para buscar...',
  maxResults = 8,
  autoFocus = true,
  createLabel,
  onCreate,
  showAllWhenEmpty = false,
  emptyLabel = 'Nenhum resultado encontrado.',
}: AutocompleteProps) {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const trimmed = query.trim()

  const results = useMemo(() => {
    const q = normalize(trimmed)
    if (!q) return showAllWhenEmpty ? options.slice(0, maxResults) : []
    return options
      .filter(
        (opt) =>
          normalize(opt.label).includes(q) ||
          (opt.secondary && normalize(opt.secondary).includes(q))
      )
      .slice(0, maxResults)
  }, [options, trimmed, maxResults, showAllWhenEmpty])

  const canCreate = Boolean(createLabel && onCreate && trimmed)
  const createIndex = results.length
  const totalRows = results.length + (canCreate ? 1 : 0)
  const open = showResults && (Boolean(trimmed) || showAllWhenEmpty)

  const reset = () => {
    setQuery('')
    setShowResults(false)
    setHighlightedIndex(0)
  }

  const handleSelect = (option: AutocompleteOption) => {
    onChange(option)
    reset()
  }

  const handleCreate = () => {
    onCreate?.(trimmed)
    reset()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Escape') {
      setShowResults(false)
      return
    }
    if (!open || totalRows === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, totalRows - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (canCreate && highlightedIndex === createIndex) handleCreate()
      else if (results[highlightedIndex]) handleSelect(results[highlightedIndex])
    }
  }

  return (
    <div className="relative w-full">
      <input
        type="text"
        value={query}
        onChange={(e) => {
          setQuery(e.target.value)
          setShowResults(true)
          setHighlightedIndex(0)
          onQueryChange?.(e.target.value)
        }}
        onFocus={() => setShowResults(true)}
        onBlur={() => setTimeout(() => setShowResults(false), 150)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
      />

      {open && (
        <div className="absolute z-10 mt-1 max-h-72 w-full overflow-y-auto rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.map((opt, idx) => (
            <button
              type="button"
              key={opt.id}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => handleSelect(opt)}
              className={`flex w-full flex-col items-start justify-between px-3 py-2 text-left text-sm ${
                idx === highlightedIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              <span className="font-medium text-gray-900">{opt.label}</span>
              {opt.secondary && (
                <span className="text-xs text-gray-500">{opt.secondary}</span>
              )}
            </button>
          ))}

          {results.length === 0 && !canCreate && (
            <p className="px-3 py-2 text-sm text-gray-400">{emptyLabel}</p>
          )}

          {canCreate && (
            <button
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={handleCreate}
              className={`flex w-full items-center border-t border-gray-100 px-3 py-2 text-left text-sm font-medium text-blue-700 ${
                highlightedIndex === createIndex ? 'bg-blue-50' : 'hover:bg-gray-50'
              }`}
            >
              {createLabel!(trimmed)}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
