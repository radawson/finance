'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import CategoryModal from '@/components/CategoryModal'
import { Category, Vendor, BillStatus, RecurrenceFrequencyEnum } from '@/types'
import { ArrowLeft, Save, X, Plus } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function NewBillPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [categories, setCategories] = useState<Category[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [vendorAccounts, setVendorAccounts] = useState<{ id: string; nickname?: string | null; accountType?: string | null; accountNumber?: string | null }[]>([])
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
    invoiceNumber: '',
  })
  const [isRecurring, setIsRecurring] = useState(false)
  const [showRecurrenceSection, setShowRecurrenceSection] = useState(false)
  const [recurrenceData, setRecurrenceData] = useState({
    frequency: RecurrenceFrequencyEnum.MONTHLY,
    dayOfMonth: 1,
    startDate: '',
    endDate: '',
  })
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false)

  useEffect(() => {
    if (session) {
      fetchCategories()
      fetchVendors()
      setIsLoading(false)
    }
  }, [session])

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

  // Auto-populate vendorAccountId when vendor has exactly one account
  useEffect(() => {
    if (formData.vendorId && !formData.vendorAccountId) {
      // Check vendorAccounts first (from API)
      if (vendorAccounts.length === 1) {
        setFormData(prev => ({ ...prev, vendorAccountId: vendorAccounts[0].id }))
        return
      }
      // Fallback: check vendors list (might have accounts from bill data)
      const vendor = vendors.find(v => v.id === formData.vendorId)
      const accounts = vendor?.accounts || []
      if (accounts.length === 1) {
        setFormData(prev => ({ ...prev, vendorAccountId: accounts[0].id }))
      }
    }
  }, [formData.vendorId, vendorAccounts, vendors, formData.vendorAccountId])

  // Update recurrence defaults when due date changes
  useEffect(() => {
    if (isRecurring && formData.dueDate) {
      const dueDate = new Date(formData.dueDate)
      setRecurrenceData(prev => ({
        ...prev,
        dayOfMonth: dueDate.getDate(),
        startDate: format(dueDate, 'yyyy-MM-dd'),
      }))
    }
  }, [formData.dueDate, isRecurring])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // Validate amount before sending
      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount')
        setIsSaving(false)
        return
      }

      // Create the bill
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          amount: amount,
          dueDate: new Date(formData.dueDate).toISOString(),
          categoryId: formData.categoryId,
          vendorId: formData.vendorId || undefined,
          vendorAccountId: formData.vendorAccountId || undefined,
          description: formData.description || undefined,
          status: formData.status,
          paidDate: formData.paidDate ? new Date(formData.paidDate).toISOString() : undefined,
          invoiceNumber: formData.invoiceNumber || undefined,
          isRecurring: isRecurring,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMessage = data.details && data.details.length > 0
          ? `${data.error || 'Validation error'}: ${data.details.map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`).join(', ')}`
          : data.error || 'Failed to create bill'
        toast.error(errorMessage)
        setIsSaving(false)
        return
      }

      const createdBill = await response.json()

      // Create recurrence pattern if enabled
      if (isRecurring && showRecurrenceSection) {
        try {
          const recurrenceResponse = await fetch(`/api/bills/${createdBill.id}/recurrence`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              frequency: recurrenceData.frequency,
              dayOfMonth: recurrenceData.dayOfMonth,
              startDate: recurrenceData.startDate,
              endDate: recurrenceData.endDate || null,
            }),
          })

          if (!recurrenceResponse.ok) {
            const errorData = await recurrenceResponse.json()
            toast.error(errorData.error || 'Bill created but failed to set recurrence pattern')
          }
        } catch (error) {
          toast.error('Bill created but failed to set recurrence pattern')
        }
      }

      toast.success('Bill created successfully')
      // Redirect to the new bill's detail page
      router.push(`/bills/${createdBill.id}`)
    } catch (error) {
      toast.error('Failed to create bill')
      setIsSaving(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to create a bill</p>
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
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
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

        {/* Create Form */}
        <div className="bg-white rounded-lg shadow-md p-6">
          <h2 className="text-2xl font-bold text-gray-900 mb-6">Create New Bill</h2>
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
                <div className="flex gap-2">
                  <select
                    required
                    value={formData.categoryId}
                    onChange={(e) => setFormData({ ...formData, categoryId: e.target.value })}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  >
                    <option value="">Select a category</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCategoryModalOpen(true)
                    }}
                    className="px-3 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                    title="Create new category"
                  >
                    <Plus className="w-5 h-5" />
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Vendor
                </label>
                <select
                  value={(() => {
                    if (!formData.vendorId) return ''
                    // Check if vendor has exactly one account
                    const vendor = vendors.find(v => v.id === formData.vendorId)
                    const accounts = vendor?.accounts || []
                    if (accounts.length === 1 && formData.vendorAccountId === accounts[0].id) {
                      // Single account vendor - use just vendor ID to match option value
                      return formData.vendorId
                    }
                    // Multiple accounts or no account - use vendor:account format or just vendor ID
                    return formData.vendorId && formData.vendorAccountId 
                      ? `${formData.vendorId}:${formData.vendorAccountId}` 
                      : formData.vendorId
                  })()}
                  onChange={(e) => {
                    const value = e.target.value
                    if (!value) {
                      setFormData({ ...formData, vendorId: '', vendorAccountId: '' })
                      return
                    }
                    // Check if value contains account separator
                    if (value.includes(':')) {
                      const [vendorId, accountId] = value.split(':')
                      setFormData({ ...formData, vendorId, vendorAccountId: accountId })
                    } else {
                      // Vendor selected - check if it has exactly one account
                      const vendor = vendors.find(v => v.id === value)
                      const accounts = vendor?.accounts || []
                      if (accounts.length === 1) {
                        // Auto-select the single account
                        setFormData({ ...formData, vendorId: value, vendorAccountId: accounts[0].id })
                      } else {
                        setFormData({ ...formData, vendorId: value, vendorAccountId: '' })
                      }
                    }
                  }}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                >
                  <option value="">No vendor</option>
                  {vendors.map((vendor) => {
                    const accounts = vendor.accounts || []
                    if (accounts.length === 0) {
                      // No accounts - show just vendor name
                      return (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      )
                    } else if (accounts.length === 1) {
                      // Single account - show vendor name (will auto-select account)
                      return (
                        <option key={vendor.id} value={vendor.id}>
                          {vendor.name}
                        </option>
                      )
                    } else {
                      // Multiple accounts - show each account as separate option
                      return accounts.map((account) => {
                        const last4 = account.accountNumber && account.accountNumber.length >= 4 ? account.accountNumber.slice(-4) : null
                        const accountTypeName = account.type?.name || account.accountType
                        const label = `${vendor.name} - ${account.nickname || accountTypeName || 'Account'}${last4 ? ` (${last4})` : ''}`
                        return (
                          <option key={`${vendor.id}:${account.id}`} value={`${vendor.id}:${account.id}`}>
                            {label}
                          </option>
                        )
                      })
                    }
                  })}
                </select>
              </div>
            </div>

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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Invoice Number
              </label>
              <input
                type="text"
                value={formData.invoiceNumber}
                onChange={(e) => setFormData({ ...formData, invoiceNumber: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                placeholder="Optional invoice number from vendor"
              />
            </div>

            {/* Recurrence Section */}
            <div className="border-t border-gray-200 pt-4">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={isRecurring}
                  onChange={(e) => {
                    setIsRecurring(e.target.checked)
                    setShowRecurrenceSection(e.target.checked)
                    // If enabling, update defaults based on current due date
                    if (e.target.checked && formData.dueDate) {
                      const dueDate = new Date(formData.dueDate)
                      setRecurrenceData({
                        frequency: RecurrenceFrequencyEnum.MONTHLY,
                        dayOfMonth: dueDate.getDate(),
                        startDate: format(dueDate, 'yyyy-MM-dd'),
                        endDate: '',
                      })
                    }
                  }}
                  className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-gray-700">This is a recurring bill</span>
              </label>

              {showRecurrenceSection && (
                <div className="mt-4 p-4 bg-gray-50 rounded-lg space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Frequency *
                    </label>
                    <select
                      required
                      value={recurrenceData.frequency}
                      onChange={(e) =>
                        setRecurrenceData({
                          ...recurrenceData,
                          frequency: e.target.value as RecurrenceFrequencyEnum,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    >
                      <option value={RecurrenceFrequencyEnum.MONTHLY}>Monthly</option>
                      <option value={RecurrenceFrequencyEnum.QUARTERLY}>Quarterly</option>
                      <option value={RecurrenceFrequencyEnum.BIANNUALLY}>Biannually</option>
                      <option value={RecurrenceFrequencyEnum.YEARLY}>Yearly</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Day of Month (1-31) *
                    </label>
                    <input
                      type="number"
                      required
                      min="1"
                      max="31"
                      value={recurrenceData.dayOfMonth}
                      onChange={(e) =>
                        setRecurrenceData({
                          ...recurrenceData,
                          dayOfMonth: parseInt(e.target.value) || 1,
                        })
                      }
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    />
                    <p className="mt-1 text-sm text-gray-500">
                      The day of the month when this bill is due
                    </p>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Start Date *
                      </label>
                      <input
                        type="date"
                        required
                        value={recurrenceData.startDate}
                        onChange={(e) =>
                          setRecurrenceData({
                            ...recurrenceData,
                            startDate: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        End Date (optional)
                      </label>
                      <input
                        type="date"
                        value={recurrenceData.endDate}
                        onChange={(e) =>
                          setRecurrenceData({
                            ...recurrenceData,
                            endDate: e.target.value,
                          })
                        }
                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      />
                      <p className="mt-1 text-sm text-gray-500">
                        Leave empty for indefinite recurrence
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={isSaving}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save className="w-5 h-5 mr-2" />
                {isSaving ? 'Creating...' : 'Create Bill'}
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

        {/* Category Creation Modal */}
        <CategoryModal
          isOpen={isCategoryModalOpen}
          onClose={() => {
            setIsCategoryModalOpen(false)
          }}
          onSuccess={async (newCategory) => {
            // Refresh categories and select the new one
            await fetchCategories()
            setFormData(prev => ({ ...prev, categoryId: newCategory.id }))
          }}
        />
      </main>
    </div>
  )
}
