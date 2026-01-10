'use client'

import { Vendor } from '@/types'

interface VendorSelectorProps {
  vendors: Vendor[]
  value: string
  onChange: (vendorId: string) => void
  required?: boolean
  allowNone?: boolean
}

export default function VendorSelector({
  vendors,
  value,
  onChange,
  required = false,
  allowNone = true,
}: VendorSelectorProps) {
  return (
    <select
      required={required}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
    >
      {allowNone && <option value="">No vendor</option>}
      {vendors.map((vendor) => (
        <option key={vendor.id} value={vendor.id}>
          {vendor.name}
        </option>
      ))}
    </select>
  )
}
