'use client'

import { Vehicle } from '@/lib/types'
import { Autocomplete, AutocompleteOption } from './Autocomplete'

interface VehicleAutocompleteProps {
  vehicles: Vehicle[]
  value: string
  onChange: (vehicleId: string, vehicle: Vehicle) => void
  placeholder?: string
  autoFocus?: boolean
}

export function VehicleAutocomplete({
  vehicles,
  value,
  onChange,
  placeholder = 'Digite placa ou modelo...',
  autoFocus = true,
}: VehicleAutocompleteProps) {
  const options: AutocompleteOption[] = vehicles.map((v) => ({
    id: v.id,
    label: `${v.plate} · ${v.model}`,
    secondary: `${v.brand} ${v.year}`,
  }))

  const handleSelect = (option: AutocompleteOption) => {
    const vehicle = vehicles.find((v) => v.id === option.id)
    if (vehicle) {
      onChange(option.id, vehicle)
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
