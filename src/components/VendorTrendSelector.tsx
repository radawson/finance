'use client'

import { useEffect, useState } from 'react'
import { Vendor } from '@/types'
import { Search, X, Check } from 'lucide-react'

interface VendorTrendSelectorProps {
  selectedVendorIds: string[]
  onSelectionChange: (vendorIds: string[]) => void
  maxSelection?: number
}

export default function VendorTrendSelector({
  selectedVendorIds,
  onSelectionChange,
  maxSelection = 10,
}: VendorTrendSelectorProps) {
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    fetchVendors()
  }, [])

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors')
      if (response.ok) {
        const data = await response.json()
        setVendors(data)
      }
    } catch (error) {
      console.error('Failed to fetch vendors:', error)
    } finally {
      setIsLoading(false)
    }
  }

  const filteredVendors = vendors.filter((vendor) =>
    vendor.name.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const handleToggleVendor = (vendorId: string) => {
    if (selectedVendorIds.includes(vendorId)) {
      onSelectionChange(selectedVendorIds.filter((id) => id !== vendorId))
    } else {
      if (selectedVendorIds.length >= maxSelection) {
        return // Don't allow more selections
      }
      onSelectionChange([...selectedVendorIds, vendorId])
    }
  }

  const handleSelectAll = () => {
    const availableIds = filteredVendors
      .map((v) => v.id)
      .slice(0, maxSelection - selectedVendorIds.length)
    onSelectionChange([...selectedVendorIds, ...availableIds])
  }

  const handleClearAll = () => {
    onSelectionChange([])
  }

  const handleRemoveVendor = (vendorId: string) => {
    onSelectionChange(selectedVendorIds.filter((id) => id !== vendorId))
  }

  const selectedVendors = vendors.filter((v) => selectedVendorIds.includes(v.id))

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Select Vendors ({selectedVendorIds.length}/{maxSelection} selected)
        </label>

        {/* Selected Vendors Display */}
        {selectedVendors.length > 0 && (
          <div className="mb-3 flex flex-wrap gap-2">
            {selectedVendors.map((vendor) => (
              <span
                key={vendor.id}
                className="inline-flex items-center gap-1 px-3 py-1 bg-primary-100 text-primary-800 rounded-full text-sm"
              >
                {vendor.name}
                <button
                  type="button"
                  onClick={() => handleRemoveVendor(vendor.id)}
                  className="hover:text-primary-900"
                  aria-label={`Remove ${vendor.name}`}
                >
                  <X className="w-4 h-4" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Search and Selection Dropdown */}
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search vendors..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => setIsOpen(true)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>

          {isOpen && (
            <>
              <div
                className="fixed inset-0 z-10"
                onClick={() => setIsOpen(false)}
              />
              <div className="absolute z-20 w-full mt-1 bg-white border border-gray-300 rounded-lg shadow-lg max-h-64 overflow-y-auto">
                {/* Action Buttons */}
                <div className="sticky top-0 bg-white border-b border-gray-200 p-2 flex gap-2">
                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="flex-1 px-3 py-1 text-sm text-primary-600 hover:bg-primary-50 rounded"
                    disabled={selectedVendorIds.length >= maxSelection}
                  >
                    Select All
                  </button>
                  <button
                    type="button"
                    onClick={handleClearAll}
                    className="flex-1 px-3 py-1 text-sm text-gray-600 hover:bg-gray-50 rounded"
                  >
                    Clear All
                  </button>
                </div>

                {/* Vendor List */}
                {isLoading ? (
                  <div className="p-4 text-center text-gray-500">Loading vendors...</div>
                ) : filteredVendors.length === 0 ? (
                  <div className="p-4 text-center text-gray-500">No vendors found</div>
                ) : (
                  <div className="p-2">
                    {filteredVendors.map((vendor) => {
                      const isSelected = selectedVendorIds.includes(vendor.id)
                      const isDisabled = !isSelected && selectedVendorIds.length >= maxSelection

                      return (
                        <label
                          key={vendor.id}
                          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-gray-50 ${
                            isDisabled ? 'opacity-50 cursor-not-allowed' : ''
                          }`}
                        >
                          <div className="relative">
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => handleToggleVendor(vendor.id)}
                              disabled={isDisabled}
                              className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                            />
                            {isSelected && (
                              <Check className="absolute top-0 left-0 w-4 h-4 text-primary-600 pointer-events-none" />
                            )}
                          </div>
                          <span className="text-sm text-gray-700">{vendor.name}</span>
                        </label>
                      )
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>

        {selectedVendorIds.length >= maxSelection && (
          <p className="mt-2 text-sm text-yellow-600">
            Maximum {maxSelection} vendors selected. Remove some to select others.
          </p>
        )}
      </div>
    </div>
  )
}
