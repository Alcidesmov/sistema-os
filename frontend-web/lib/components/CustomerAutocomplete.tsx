'use client'

import { Customer } from '@/lib/types'
import { Autocomplete, AutocompleteOption } from './Autocomplete'

interface CustomerAutocompleteProps {
  customers: Customer[]
  value: string
  onChange: (customerId: string, customer: Customer) => void
  placeholder?: string
  autoFocus?: boolean
}

export function CustomerAutocomplete({
  customers,
  value,
  onChange,
  placeholder = 'Digite nome ou telefone...',
  autoFocus = true,
}: CustomerAutocompleteProps) {
  const options: AutocompleteOption[] = customers.map((c) => ({
    id: c.id,
    label: c.name,
    secondary: c.phone,
  }))

  const handleSelect = (option: AutocompleteOption) => {
    const customer = customers.find((c) => c.id === option.id)
    if (customer) {
      onChange(option.id, customer)
    }
  }

  return (
    <Autocomplete
      options={options}
      value={value}
      onChange={(opt) => handleSelect(opt)}
      placeholder={placeholder}
      maxResults={8}
      autoFocus={autoFocus}
    />
  )
}
