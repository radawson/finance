'use client'

import { Vendor } from '@/types'
import { X, Edit, Building2, Mail, Phone, MapPin, Globe, CreditCard } from 'lucide-react'
import Link from 'next/link'

interface VendorViewModalProps {
  vendor: Vendor
  isOpen: boolean
  onClose: () => void
}

export default function VendorViewModal({ vendor, isOpen, onClose }: VendorViewModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full my-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{vendor.name}</h2>
            {vendor.description && (
              <p className="text-gray-600">{vendor.description}</p>
            )}
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          {vendor.email && (
            <div className="flex items-center text-gray-700">
              <Mail className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Email</div>
                <div className="font-semibold">{vendor.email}</div>
              </div>
            </div>
          )}

          {vendor.phone && (
            <div className="flex items-center text-gray-700">
              <Phone className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Phone</div>
                <div className="font-semibold">{vendor.phone}</div>
              </div>
            </div>
          )}

          {vendor.website && (
            <div className="flex items-center text-gray-700">
              <Globe className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Website</div>
                <div className="font-semibold">
                  <a href={vendor.website} target="_blank" rel="noopener noreferrer" className="text-primary-600 hover:text-primary-700">
                    {vendor.website}
                  </a>
                </div>
              </div>
            </div>
          )}

          {(vendor.address || vendor.city || vendor.state || vendor.zip) && (
            <div className="flex items-start text-gray-700">
              <MapPin className="w-5 h-5 mr-3 text-gray-400 mt-1" />
              <div>
                <div className="text-sm text-gray-500">Address</div>
                <div className="font-semibold">
                  {vendor.address && <div>{vendor.address}</div>}
                  {(vendor.city || vendor.state || vendor.zip) && (
                    <div>
                      {vendor.city && vendor.city}
                      {vendor.city && (vendor.state || vendor.zip) && ', '}
                      {vendor.state && vendor.state}
                      {vendor.state && vendor.zip && ' '}
                      {vendor.zip && vendor.zip}
                    </div>
                  )}
                  {vendor.country && <div>{vendor.country}</div>}
                </div>
              </div>
            </div>
          )}

          {vendor.accounts && vendor.accounts.length > 0 && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-2">Accounts</div>
              <div className="space-y-2">
                {vendor.accounts.filter(acc => acc.isActive).map((account) => (
                  <div key={account.id} className="flex items-center text-gray-700 bg-gray-50 rounded-lg p-3">
                    <CreditCard className="w-5 h-5 mr-3 text-gray-400" />
                    <div className="flex-1">
                      <div className="font-semibold">
                        {account.nickname || account.accountType || 'Account'}
                      </div>
                      <div className="text-sm text-gray-500">
                        {account.accountNumber}
                        {account.last4 && ` (Last 4: ${account.last4})`}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
          <Link
            href={`/vendors/${vendor.id}`}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit className="w-5 h-5 mr-2" />
            Edit Vendor
          </Link>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
