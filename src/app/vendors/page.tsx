'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import VendorViewModal from '@/components/VendorViewModal'
import VendorEditForm, { VendorFormData } from '@/components/VendorEditForm'
import { Vendor } from '@/types'
import { Plus, Edit, Trash2, Building2 } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { formatPhoneForDisplay } from '@/lib/phone-formatting'

export default function VendorsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [viewingVendor, setViewingVendor] = useState<Vendor | null>(null)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    if (session) {
      fetchVendors()
    }
  }, [session])

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors')
      if (response.ok) {
        const data = await response.json()
        setVendors(data)
      } else {
        toast.error('Failed to load vendors')
      }
    } catch (error) {
      toast.error('Failed to load vendors')
    } finally {
      setIsLoading(false)
    }
  }

  const handleCreateVendor = async (formData: VendorFormData) => {
    setIsSaving(true)

    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      })

      if (response.ok) {
        toast.success('Vendor created')
        setIsCreateModalOpen(false)
        fetchVendors()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to create vendor')
      }
    } catch (error) {
      toast.error('Failed to create vendor')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this vendor?')) {
      return
    }

    try {
      const response = await fetch(`/api/vendors/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Vendor deleted')
        fetchVendors()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete vendor')
      }
    } catch (error) {
      toast.error('Failed to delete vendor')
    }
  }

  const openViewModal = (vendor: Vendor) => {
    setViewingVendor(vendor)
    setIsViewModalOpen(true)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to manage vendors</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Vendors</h1>
            <p className="mt-2 text-gray-600">Manage your bill vendors</p>
          </div>
          <button
            onClick={() => {
              setIsCreateModalOpen(true)
            }}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Vendor
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading vendors...</p>
            </div>
          </div>
        ) : vendors.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 mb-4">No vendors yet</p>
            <button
              onClick={() => {
                setIsCreateModalOpen(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Vendor
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {vendors.map((vendor) => (
              <div 
                key={vendor.id} 
                className="bg-white rounded-lg shadow-md p-6 cursor-pointer hover:shadow-lg transition-shadow"
                onClick={() => openViewModal(vendor)}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-center flex-1">
                    <Building2 className="w-6 h-6 text-gray-400 mr-3" />
                    <h3 className="text-lg font-semibold text-gray-900">{vendor.name}</h3>
                  </div>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={() => router.push(`/vendors/${vendor.id}`)}
                      className="p-2 text-gray-600 hover:text-primary-600 transition-colors"
                      title="Edit vendor"
                    >
                      <Edit className="w-5 h-5" />
                    </button>
                    <button
                      onClick={() => handleDelete(vendor.id)}
                      className="p-2 text-gray-600 hover:text-red-600 transition-colors"
                      title="Delete vendor"
                    >
                      <Trash2 className="w-5 h-5" />
                    </button>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-gray-600">
                  {vendor.email && <div>Email: {vendor.email}</div>}
                  {vendor.phone && <div>Phone: {formatPhoneForDisplay(vendor.phone)}</div>}
                  {vendor.accounts && vendor.accounts.length > 0 && (
                    <div className="text-primary-600 font-medium">
                      {vendor.accounts.length} account{vendor.accounts.length !== 1 ? 's' : ''}
                    </div>
                  )}
                  {(vendor.address || vendor.addressLine2) && (
                    <div>
                      Address: {vendor.address}
                      {vendor.addressLine2 && `, ${vendor.addressLine2}`}
                      {vendor.city && `, ${vendor.city}`}
                      {vendor.state && `, ${vendor.state}`}
                      {vendor.zip && ` ${vendor.zip}`}
                    </div>
                  )}
                  {vendor.website && (
                    <div>
                      <a
                        href={vendor.website}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary-600 hover:text-primary-700"
                      >
                        Website
                      </a>
                    </div>
                  )}
                  {vendor.description && (
                    <p className="text-gray-500 mt-2">{vendor.description}</p>
                  )}
                </div>
                <div className="mt-4 pt-4 border-t border-gray-200">
                  <Link
                    href={`/vendors/${vendor.id}`}
                    className="text-sm text-primary-600 hover:text-primary-700 font-medium"
                  >
                    View Details & Accounts →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Vendor View Modal */}
        {viewingVendor && (
          <VendorViewModal
            vendor={viewingVendor}
            isOpen={isViewModalOpen}
            onClose={() => {
              setIsViewModalOpen(false)
              setViewingVendor(null)
            }}
          />
        )}

        {/* Create Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full my-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                New Vendor
              </h2>
              <VendorEditForm
                vendor={null}
                onSave={handleCreateVendor}
                onCancel={() => setIsCreateModalOpen(false)}
                isSaving={isSaving}
              />
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
