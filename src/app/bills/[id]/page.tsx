'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import BillStatusBadge from '@/components/BillStatusBadge'
import { Bill, Category, Vendor, VendorAccount, BillStatus } from '@/types'
import { ArrowLeft, Save, X } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function BillDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const billId = params.id as string

  const [bill, setBill] = useState<Bill | null>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorAccounts, setVendorAccounts] = useState<{ id: string; nickname?: string | null; last4?: string; accountType?: string | null }[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [formData, setFormData] = useState({
    title: '',
    amount: '',
    dueDate: '',
    categoryId: '',
    vendorId: '',
    vendorAccountId: '',
    description: '',
    status: 'PENDING' as BillStatus,
    paidDate: '',
  })

  useEffect(() => {
    if (session && billId) {
      fetchBill()
      fetchCategories()
      fetchVendors()
    }
  }, [session, billId])

  const fetchBill = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}`)
      if (response.ok) {
        const data = await response.json()
        setBill(data)
        setFormData({
          title: data.title,
          amount: Number(data.amount).toFixed(2),
          dueDate: format(new Date(data.dueDate), 'yyyy-MM-dd'),
          categoryId: data.categoryId,
          vendorId: data.vendorId || '',
          vendorAccountId: data.vendorAccountId || '',
          description: data.description || '',
          status: data.status,
          paidDate: data.paidDate ? format(new Date(data.paidDate), 'yyyy-MM-dd') : '',
        })
        // Fetch accounts for the vendor if vendor is set
        if (data.vendorId) {
          await fetchVendorAccounts(data.vendorId)
        }
      } else if (response.status === 403) {
        toast.error('You do not have permission to view this bill')
        router.push('/dashboard')
      } else if (response.status === 404) {
        toast.error('Bill not found')
        router.push('/dashboard')
      } else {
        toast.error('Failed to load bill')
        router.push('/dashboard')
      }
    } catch (error) {
      toast.error('Failed to load bill')
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const fetchCategories = async () => {
    try {
      const response = await fetch('/api/categories')
      if (response.ok) {
        const data = await response.json()
        setCategories(data)
      }
    } catch (error) {
      // Silently fail
    }
  }

  const fetchVendors = async () => {
    try {
      const response = await fetch('/api/vendors')
      if (response.ok) {
        const data = await response.json()
        setVendors(data)
      }
    } catch (error) {
      // Silently fail
    }
  }

  const fetchVendorAccounts = async (vendorId: string) => {
    if (!vendorId) {
      setVendorAccounts([])
      return
    }
    try {
      const response = await fetch(`/api/vendors/${vendorId}/accounts`)
      if (response.ok) {
        const data = await response.json()
        setVendorAccounts(data)
      } else {
        setVendorAccounts([])
      }
    } catch (error) {
      setVendorAccounts([])
    }
  }

  // Fetch accounts when vendor changes
  useEffect(() => {
    if (formData.vendorId) {
      fetchVendorAccounts(formData.vendorId)
    } else {
      setVendorAccounts([])
      setFormData(prev => ({ ...prev, vendorAccountId: '' }))
    }
  }, [formData.vendorId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      const response = await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          amount: parseFloat(formData.amount),
          dueDate: new Date(formData.dueDate).toISOString(),
          categoryId: formData.categoryId,
          vendorId: formData.vendorId || null,
          vendorAccountId: formData.vendorAccountId || null,
          description: formData.description || null,
          status: formData.status,
          paidDate: formData.paidDate ? new Date(formData.paidDate).toISOString() : null,
        }),
      })

      if (response.ok) {
        toast.success('Bill updated successfully')
        // Refresh bill data
        await fetchBill()
      } else if (response.status === 403) {
        toast.error('You do not have permission to edit this bill')
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to update bill')
      }
    } catch (error) {
      toast.error('Failed to update bill')
    } finally {
      setIsSaving(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to view bill details</p>
            <Link href="/login" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
              Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading bill...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!bill) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Bill Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{bill.title}</h1>
              <div className="flex items-center gap-4">
                <BillStatusBadge status={bill.status} />
                {bill.createdBy && (
                  <span className="text-sm text-gray-500">
                    Created by {bill.createdBy.name}
                  </span>
                )}
                {!bill.createdById && (
                  <span className="text-sm text-gray-500 italic">
                    Unassigned bill
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Edit Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Edit Bill</h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Title *
              </label>
              <input
                type="text"
                required
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount *
                </label>
                <input
                  type="number"
                  required
                  min="0"
                  step="0.01"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Due Date *
                </label>
                <input
                  type="date"
                  required
                  value={formData.dueDate}
                  onChange={(e) => setFormData({ ...formData, dueDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Category *
                </label>
                <select
                  required
                  value={formData.categoryId}
                  onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">Select a category</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor
                </label>
                <select
                  value={formData.vendorId}
                  onChange={(e) => setFormData({ ...formData, vendorId: e.target.value, vendorAccountId: '' })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">No vendor</option>
                  {vendors.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Optional Account Selection - Only shows if vendor has accounts */}
            {formData.vendorId && vendorAccounts.length > 0 && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Account (optional)
                </label>
                <select
                  value={formData.vendorAccountId}
                  onChange={(e) => setFormData({ ...formData, vendorAccountId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">No account specified</option>
                  {vendorAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.nickname || account.accountType || 'Account'} {account.last4 ? `(${account.last4})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Status *
                </label>
                <select
                  required
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as BillStatus })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="PENDING">Pending</option>
                  <option value="DUE_SOON">Due Soon</option>
                  <option value="OVERDUE">Overdue</option>
                  <option value="PAID">Paid</option>
                  <option value="SKIPPED">Skipped</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Paid Date
                </label>
                <input
                  type="date"
                  value={formData.paidDate}
                  onChange={(e) => setFormData({ ...formData, paidDate: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description
              </label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                rows={4}
              />
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5 mr-2" />
                {isSaving ? 'Saving...' : 'Save Changes'}
              </button>
              <Link
                href="/dashboard"
                className="flex-1 inline-flex items-center justify-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                <X className="w-5 h-5 mr-2" />
                Cancel
              </Link>
            </div>
          </form>
        </div>
      </main>
    </div>
  )
}
