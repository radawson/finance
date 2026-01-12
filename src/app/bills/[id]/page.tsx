'use client'

import { useEffect, useState, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import BillStatusBadge from '@/components/BillStatusBadge'
import CategoryModal from '@/components/CategoryModal'
import { Bill, Category, Vendor, VendorAccount, BillStatus, RecurrenceFrequencyEnum } from '@/types'
import { ArrowLeft, Save, X, ChevronDown, ChevronUp, Plus } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { useSocket } from '@/components/SocketProvider'
import { SocketEvents } from '@/lib/socketio-server'
import { addTemporaryClass } from '@/lib/visual-feedback'

export default function BillDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const billId = params.id as string

  const [bill, setBill] = useState<Bill | null>(null)
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

  const { socket, isConnected } = useSocket()
  const billFormRef = useRef<HTMLFormElement>(null)

  useEffect(() => {
    if (session && billId) {
      fetchBill()
      fetchCategories()
      fetchVendors()
    }
  }, [session, billId])

  // WebSocket: Join bill room and listen for updates
  useEffect(() => {
    if (!socket || !isConnected || !billId) return

    // Join bill room
    socket.emit('join', `bill:${billId}`)

    // Listen for bill updates (silent UI update)
    const handleBillUpdated = (data: { bill: Bill; changedBy: { id: string; name: string } }) => {
      // Only update if changed by someone else (not the current user)
      if (data.changedBy.id !== session?.user?.id) {
        setBill(data.bill)
        
        // Update form data
        const dueDate = new Date(data.bill.dueDate)
        setFormData((prev) => ({
          ...prev,
          title: data.bill.title,
          amount: Number(data.bill.amount).toFixed(2),
          dueDate: format(dueDate, 'yyyy-MM-dd'),
          categoryId: data.bill.categoryId,
          vendorId: data.bill.vendorId || '',
          vendorAccountId: data.bill.vendorAccountId || '',
          description: data.bill.description || '',
          status: data.bill.status,
          paidDate: data.bill.paidDate ? format(new Date(data.bill.paidDate), 'yyyy-MM-dd') : '',
          invoiceNumber: data.bill.invoiceNumber || '',
        }))

        // Visual feedback: flash the form
        if (billFormRef.current) {
          addTemporaryClass(billFormRef.current, 'flash-highlight', 1000)
        }
      }
    }

    socket.on(SocketEvents.BILL_UPDATED, handleBillUpdated)

    return () => {
      socket.emit('leave', `bill:${billId}`)
      socket.off(SocketEvents.BILL_UPDATED, handleBillUpdated)
    }
  }, [socket, isConnected, billId, session?.user?.id])

  // Add bill's vendor to vendors list after both bill and vendors are loaded
  useEffect(() => {
    if (bill && bill.vendor && bill.vendorId && vendors.length > 0) {
      const vendorExists = vendors.some((v) => v.id === bill.vendorId)
      if (!vendorExists) {
        // Add the vendor from the bill to the vendors list
        // Include accounts from vendorAccount if available
        const vendorWithAccounts: Vendor = {
          ...bill.vendor,
          accounts: bill.vendorAccount
            ? [
                {
                  id: bill.vendorAccount.id,
                  vendorId: bill.vendorAccount.vendorId,
                  accountNumber: bill.vendorAccount.accountNumber,
                  accountTypeId: bill.vendorAccount.accountTypeId || null,
                  accountType: bill.vendorAccount.type?.name || bill.vendorAccount.accountType || null,
                  nickname: bill.vendorAccount.nickname || null,
                  notes: bill.vendorAccount.notes || null,
                  isActive: bill.vendorAccount.isActive,
                  createdAt: new Date(bill.vendorAccount.createdAt),
                  updatedAt: new Date(bill.vendorAccount.updatedAt),
                  type: bill.vendorAccount.type || null,
                },
              ]
            : [],
        }
        setVendors((prev) => [...prev, vendorWithAccounts])
      }
    }
  }, [bill, vendors])

  const fetchBill = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}`)
      if (response.ok) {
        const data = await response.json()
        setBill(data)
        const dueDate = new Date(data.dueDate)
        setFormData({
          title: data.title,
          amount: Number(data.amount).toFixed(2),
          dueDate: format(dueDate, 'yyyy-MM-dd'),
          categoryId: data.categoryId,
          vendorId: data.vendorId || '',
          vendorAccountId: data.vendorAccountId || '',
          description: data.description || '',
          status: data.status,
          paidDate: data.paidDate ? format(new Date(data.paidDate), 'yyyy-MM-dd') : '',
          invoiceNumber: data.invoiceNumber || '',
        })
        
        // Set recurrence state if bill has recurrence pattern
        if (data.recurrencePattern) {
          setIsRecurring(true)
          setShowRecurrenceSection(true)
          setRecurrenceData({
            frequency: data.recurrencePattern.frequency as RecurrenceFrequencyEnum,
            dayOfMonth: data.recurrencePattern.dayOfMonth,
            startDate: format(new Date(data.recurrencePattern.startDate), 'yyyy-MM-dd'),
            endDate: data.recurrencePattern.endDate ? format(new Date(data.recurrencePattern.endDate), 'yyyy-MM-dd') : '',
          })
        } else {
          // Initialize with defaults based on due date
          setIsRecurring(false)
          setShowRecurrenceSection(false)
          setRecurrenceData({
            frequency: RecurrenceFrequencyEnum.MONTHLY,
            dayOfMonth: dueDate.getDate(),
            startDate: format(dueDate, 'yyyy-MM-dd'),
            endDate: '',
          })
        }
        
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

  // Update recurrence defaults when due date changes (if recurrence is enabled but not yet configured)
  useEffect(() => {
    if (isRecurring && formData.dueDate && !bill?.recurrencePatternId) {
      const dueDate = new Date(formData.dueDate)
      setRecurrenceData(prev => ({
        ...prev,
        dayOfMonth: dueDate.getDate(),
        startDate: format(dueDate, 'yyyy-MM-dd'),
      }))
    }
  }, [formData.dueDate, isRecurring, bill?.recurrencePatternId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)

    try {
      // First, update the bill
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
          invoiceNumber: formData.invoiceNumber || null,
          isRecurring: isRecurring,
        }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('You do not have permission to edit this bill')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Failed to update bill')
        }
        return
      }

      // Handle recurrence pattern
      const hasExistingRecurrence = bill?.recurrencePatternId !== null

      if (isRecurring && showRecurrenceSection) {
        // Create or update recurrence pattern
        if (hasExistingRecurrence) {
          // Update existing recurrence pattern
          const recurrenceResponse = await fetch(`/api/bills/${billId}/recurrence`, {
            method: 'PATCH',
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
            toast.error(errorData.error || 'Failed to update recurrence pattern')
            return
          }
        } else {
          // Create new recurrence pattern
          const recurrenceResponse = await fetch(`/api/bills/${billId}/recurrence`, {
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
            toast.error(errorData.error || 'Failed to create recurrence pattern')
            return
          }
        }
      } else if (hasExistingRecurrence && !isRecurring) {
        // Delete recurrence pattern if unchecked
        const deleteResponse = await fetch(`/api/bills/${billId}/recurrence`, {
          method: 'DELETE',
        })

        if (!deleteResponse.ok) {
          toast.error('Failed to remove recurrence pattern')
          return
        }
      }

      toast.success('Bill updated successfully')
      // Refresh bill data
      await fetchBill()
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
          <form ref={billFormRef} onSubmit={handleSubmit} className="space-y-4">
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
