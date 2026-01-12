'use client'

import { useEffect, useState, useMemo } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import BillStatusBadge from '@/components/BillStatusBadge'
import BillViewModal from '@/components/BillViewModal'
import { Bill, Category, Vendor, VendorAccount, BillStatus, RecurrenceFrequencyEnum } from '@/types'
import { Plus, Filter, Search, Edit, Trash2, ArrowUpDown, ArrowUp, ArrowDown, Calendar, Repeat } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

type SortColumn = 'title' | 'amount' | 'dueDate' | 'status' | 'category' | 'vendor' | null
type SortDirection = 'asc' | 'desc' | null

export default function BillsPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [bills, setBills] = useState<Bill[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [vendors, setVendors] = useState<Vendor[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'dueDate',
    direction: 'asc',
  })
  const [filters, setFilters] = useState({
    status: '',
    categoryId: '',
    vendorId: '',
    dateFrom: '',
    dateTo: '',
    isRecurring: '',
    search: '',
  })
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [viewingBill, setViewingBill] = useState<Bill | null>(null)
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

  useEffect(() => {
    if (session) {
      fetchBills()
      fetchCategories()
      fetchVendors()
    }
  }, [session])

  // Update recurrence defaults when due date changes (if recurrence is enabled)
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

  const fetchBills = async () => {
    try {
      const response = await fetch('/api/bills')
      if (response.ok) {
        const data = await response.json()
        setBills(data)
      } else {
        toast.error('Failed to load bills')
      }
    } catch (error) {
      toast.error('Failed to load bills')
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


  // Filter and sort bills
  const filteredAndSortedBills = useMemo(() => {
    let filtered = [...bills]

    // Apply filters
    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(
        (bill) =>
          bill.title.toLowerCase().includes(searchLower) ||
          bill.description?.toLowerCase().includes(searchLower)
      )
    }

    if (filters.status) {
      filtered = filtered.filter((bill) => bill.status === filters.status)
    }

    if (filters.categoryId) {
      filtered = filtered.filter((bill) => bill.categoryId === filters.categoryId)
    }

    if (filters.vendorId) {
      if (filters.vendorId === 'none') {
        filtered = filtered.filter((bill) => !bill.vendorId)
      } else {
        filtered = filtered.filter((bill) => bill.vendorId === filters.vendorId)
      }
    }

    if (filters.dateFrom) {
      const fromDate = new Date(filters.dateFrom)
      filtered = filtered.filter((bill) => new Date(bill.dueDate) >= fromDate)
    }

    if (filters.dateTo) {
      const toDate = new Date(filters.dateTo)
      toDate.setHours(23, 59, 59, 999)
      filtered = filtered.filter((bill) => new Date(bill.dueDate) <= toDate)
    }

    if (filters.isRecurring !== '') {
      const isRecurring = filters.isRecurring === 'true'
      filtered = filtered.filter((bill) => bill.isRecurring === isRecurring)
    }

    // Apply sorting
    if (sortConfig.column && sortConfig.direction) {
      filtered.sort((a, b) => {
        let aValue: any
        let bValue: any

        switch (sortConfig.column) {
          case 'title':
            aValue = a.title.toLowerCase()
            bValue = b.title.toLowerCase()
            break
          case 'amount':
            aValue = Number(a.amount)
            bValue = Number(b.amount)
            break
          case 'dueDate':
            aValue = new Date(a.dueDate).getTime()
            bValue = new Date(b.dueDate).getTime()
            break
          case 'status':
            aValue = a.status
            bValue = b.status
            break
          case 'category':
            aValue = a.category?.name || ''
            bValue = b.category?.name || ''
            break
          case 'vendor':
            aValue = a.vendor?.name || ''
            bValue = b.vendor?.name || ''
            break
          default:
            return 0
        }

        if (aValue < bValue) return sortConfig.direction === 'asc' ? -1 : 1
        if (aValue > bValue) return sortConfig.direction === 'asc' ? 1 : -1
        return 0
      })
    }

    return filtered
  }, [bills, filters, sortConfig])

  const handleSort = (column: SortColumn) => {
    if (sortConfig.column === column) {
      if (sortConfig.direction === 'asc') {
        setSortConfig({ column, direction: 'desc' })
      } else if (sortConfig.direction === 'desc') {
        setSortConfig({ column: null, direction: null })
      } else {
        setSortConfig({ column, direction: 'asc' })
      }
    } else {
      setSortConfig({ column, direction: 'asc' })
    }
  }

  const getSortIcon = (column: SortColumn) => {
    if (sortConfig.column !== column) {
      return <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400" />
    }
    if (sortConfig.direction === 'asc') {
      return <ArrowUp className="w-4 h-4 ml-1 text-primary-600" />
    }
    if (sortConfig.direction === 'desc') {
      return <ArrowDown className="w-4 h-4 ml-1 text-primary-600" />
    }
    return <ArrowUpDown className="w-4 h-4 ml-1 text-gray-400" />
  }

  const openViewModal = (bill: Bill) => {
    setViewingBill(bill)
    setIsViewModalOpen(true)
  }


  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    try {
      // Validate amount before sending
      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount')
        return
      }

      const requestBody = {
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
      }
      
      console.log('Submitting bill:', requestBody)

      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const data = await response.json()
        console.error('Bill creation error:', data)
        console.error('Validation details:', data.details)
        const errorMessage = data.details && data.details.length > 0
          ? `${data.error || 'Validation error'}: ${data.details.map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`).join(', ')}`
          : data.error || 'Failed to create bill'
        toast.error(errorMessage)
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

      toast.success('Bill created')
      setIsCreateModalOpen(false)
      setFormData({
        title: '',
        amount: '',
        dueDate: '',
        categoryId: '',
        vendorId: '',
        vendorAccountId: '',
        description: '',
        status: 'PENDING',
        paidDate: '',
        invoiceNumber: '',
      })
      setIsRecurring(false)
      setShowRecurrenceSection(false)
      setRecurrenceData({
        frequency: RecurrenceFrequencyEnum.MONTHLY,
        dayOfMonth: 1,
        startDate: '',
        endDate: '',
      })
      fetchBills()
    } catch (error) {
      toast.error('Failed to create bill')
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this bill?')) {
      return
    }

    try {
      const response = await fetch(`/api/bills/${id}`, {
        method: 'DELETE',
      })

      if (response.ok) {
        toast.success('Bill deleted')
        fetchBills()
      } else {
        const data = await response.json()
        toast.error(data.error || 'Failed to delete bill')
      }
    } catch (error) {
      toast.error('Failed to delete bill')
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to view bills</p>
            <Link href="/login" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
              Login
            </Link>
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
            <h1 className="text-3xl font-bold text-gray-900">Bills</h1>
            <p className="mt-2 text-gray-600">
              Manage your bills and expenses • {filteredAndSortedBills.length} bill{filteredAndSortedBills.length !== 1 ? 's' : ''}
            </p>
          </div>
          <button
            onClick={() => {
              setFormData({
                title: '',
                amount: '',
                dueDate: '',
                categoryId: '',
                vendorId: '',
                vendorAccountId: '',
                description: '',
                status: 'PENDING',
                paidDate: '',
                invoiceNumber: '',
              })
              setIsCreateModalOpen(true)
            }}
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="w-5 h-5 mr-2" />
            New Bill
          </button>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Search className="inline w-4 h-4 mr-1" />
                Search
              </label>
              <input
                type="text"
                value={filters.search}
                onChange={(e) => setFilters({ ...filters, search: e.target.value })}
                placeholder="Search bills..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Status
              </label>
              <select
                value={filters.status}
                onChange={(e) => setFilters({ ...filters, status: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="DUE_SOON">Due Soon</option>
                <option value="OVERDUE">Overdue</option>
                <option value="PAID">Paid</option>
                <option value="SKIPPED">Skipped</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={filters.categoryId}
                onChange={(e) => setFilters({ ...filters, categoryId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Categories</option>
                {categories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Vendor</label>
              <select
                value={filters.vendorId}
                onChange={(e) => setFilters({ ...filters, vendorId: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Vendors</option>
                <option value="none">No Vendor</option>
                {vendors.map((vendor) => (
                  <option key={vendor.id} value={vendor.id}>
                    {vendor.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Due From
              </label>
              <input
                type="date"
                value={filters.dateFrom}
                onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                Due To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Repeat className="inline w-4 h-4 mr-1" />
                Recurring
              </label>
              <select
                value={filters.isRecurring}
                onChange={(e) => setFilters({ ...filters, isRecurring: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All Bills</option>
                <option value="true">Recurring Only</option>
                <option value="false">Non-Recurring Only</option>
              </select>
            </div>

            <div className="flex items-end">
              <button
                onClick={() =>
                  setFilters({
                    status: '',
                    categoryId: '',
                    vendorId: '',
                    dateFrom: '',
                    dateTo: '',
                    isRecurring: '',
                    search: '',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {/* Bills Table */}
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading bills...</p>
            </div>
          </div>
        ) : filteredAndSortedBills.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 mb-4">No bills found</p>
            <button
              onClick={() => {
                setFormData({
                  title: '',
                  amount: '',
                  dueDate: '',
                  categoryId: '',
                  vendorId: '',
                  vendorAccountId: '',
                  description: '',
                  status: 'PENDING',
                  paidDate: '',
                  invoiceNumber: '',
                })
                setIsCreateModalOpen(true)
              }}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Plus className="w-5 h-5 mr-2" />
              Create Your First Bill
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('title')}
                    >
                      <div className="flex items-center">
                        Title
                        {getSortIcon('title')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center">
                        Amount
                        {getSortIcon('amount')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('dueDate')}
                    >
                      <div className="flex items-center">
                        Due Date
                        {getSortIcon('dueDate')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('status')}
                    >
                      <div className="flex items-center">
                        Status
                        {getSortIcon('status')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('category')}
                    >
                      <div className="flex items-center">
                        Category
                        {getSortIcon('category')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('vendor')}
                    >
                      <div className="flex items-center">
                        Vendor
                        {getSortIcon('vendor')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Invoice #
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recurring
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedBills.map((bill) => (
                    <tr 
                      key={bill.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openViewModal(bill)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">{bill.title}</div>
                        {bill.description && (
                          <div className="text-sm text-gray-500 truncate max-w-xs">
                            {bill.description}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-semibold text-gray-900">
                          ${Number(bill.amount).toFixed(2)}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {format(new Date(bill.dueDate), 'MMM d, yyyy')}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <BillStatusBadge status={bill.status} />
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {bill.category?.color && (
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: bill.category.color }}
                            />
                          )}
                          <span className="text-sm text-gray-900">{bill.category?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {bill.vendor?.name || <span className="text-gray-400">No vendor</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm text-gray-900">
                          {bill.invoiceNumber || <span className="text-gray-400">—</span>}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {bill.isRecurring ? (
                          <Repeat className="w-5 h-5 text-primary-600" />
                        ) : (
                          <span className="text-gray-400">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => router.push(`/bills/${bill.id}`)}
                            className="text-primary-600 hover:text-primary-900"
                            title="Edit"
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            onClick={() => handleDelete(bill.id)}
                            className="text-red-600 hover:text-red-900"
                            title="Delete"
                          >
                            <Trash2 className="w-5 h-5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Bill View Modal */}
        {viewingBill && (
          <BillViewModal
            bill={viewingBill}
            isOpen={isViewModalOpen}
            onClose={() => {
              setIsViewModalOpen(false)
              setViewingBill(null)
            }}
            onUpdate={(updatedBill) => {
              setViewingBill(updatedBill)
              // Update the bill in the bills list
              setBills((prev) =>
                prev.map((b) => (b.id === updatedBill.id ? updatedBill : b))
              )
            }}
          />
        )}

        {/* Create Modal */}
        {isCreateModalOpen && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
            <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full my-8">
              <h2 className="text-2xl font-bold text-gray-900 mb-4">
                New Bill
              </h2>
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
                      value={formData.vendorId && formData.vendorAccountId 
                        ? `${formData.vendorId}:${formData.vendorAccountId}` 
                        : formData.vendorId || ''}
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
                      onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
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
                    rows={3}
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Additional notes..."
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

                <div className="flex gap-4">
                  <button
                    type="submit"
                    className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
                  >
                    Create
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setIsCreateModalOpen(false)
                      setFormData({
                        title: '',
                        amount: '',
                        dueDate: '',
                        categoryId: '',
                        vendorId: '',
                        vendorAccountId: '',
                        description: '',
                        status: 'PENDING',
                        paidDate: '',
                        invoiceNumber: '',
                      })
                      setIsRecurring(false)
                      setShowRecurrenceSection(false)
                      setRecurrenceData({
                        frequency: RecurrenceFrequencyEnum.MONTHLY,
                        dayOfMonth: 1,
                        startDate: '',
                        endDate: '',
                      })
                    }}
                    className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
