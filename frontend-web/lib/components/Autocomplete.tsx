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
  value: string
  onChange: (option: AutocompleteOption) => void
  onQueryChange?: (query: string) => void
  placeholder?: string
  maxResults?: number
  autoFocus?: boolean
}

export function Autocomplete({
  options,
  value,
  onChange,
  onQueryChange,
  placeholder = 'Digite para buscar...',
  maxResults = 8,
  autoFocus = true,
}: AutocompleteProps) {
  const [query, setQuery] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [highlightedIndex, setHighlightedIndex] = useState(0)

  const results = useMemo(() => {
    const q = normalize(query.trim())
    if (!q) return []
    return options
      .filter((opt) =>
        normalize(opt.label).includes(q) ||
        (opt.secondary && normalize(opt.secondary).includes(q))
      )
      .slice(0, maxResults)
  }, [options, query, maxResults])

  const handleSelect = (option: AutocompleteOption) => {
    onChange(option)
    setQuery('')
    setShowResults(false)
    setHighlightedIndex(0)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showResults || results.length === 0) return

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.min(i + 1, results.length - 1))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setHighlightedIndex((i) => Math.max(i - 1, 0))
    } else if (e.key === 'Enter') {
      e.preventDefault()
      handleSelect(results[highlightedIndex])
    } else if (e.key === 'Escape') {
      setShowResults(false)
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

      {showResults && query.trim() && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-gray-200 bg-white shadow-lg">
          {results.length > 0 ? (
            results.map((opt, idx) => (
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
            ))
          ) : (
            <p className="px-3 py-2 text-sm text-gray-400">
              {query.trim() ? 'Nenhum resultado encontrado.' : 'Digite para buscar...'}
            </p>
          )}
        </div>
      )}
    </div>
  )
}
