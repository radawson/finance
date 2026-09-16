'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import QuickExpenseForm from '@/components/QuickExpenseForm'
import ExpenseEditModal from '@/components/ExpenseEditModal'
import { Category, Expense } from '@/types'
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Calendar,
  Edit,
  Filter,
  Link2,
  Receipt,
  Search,
  Trash2,
} from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCalendarDate, inCalendarYmdRange } from '@/lib/date-utils'

type SortColumn = 'date' | 'amount' | 'category' | 'payee' | 'note' | 'tax' | null
type SortDirection = 'asc' | 'desc' | null

export default function ExpensesPage() {
  const { data: session } = useSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [sortConfig, setSortConfig] = useState<{ column: SortColumn; direction: SortDirection }>({
    column: 'date',
    direction: 'desc',
  })
  const [filters, setFilters] = useState({
    search: '',
    categoryId: '',
    dateFrom: '',
    dateTo: '',
    isTaxItem: '',
    source: '',
  })
  const [editingExpense, setEditingExpense] = useState<Expense | null>(null)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)

  useEffect(() => {
    if (session) {
      fetchCategories()
      fetchExpenses()
    }
  }, [session])

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories')
      if (res.ok) setCategories(await res.json())
    } catch {
      // Silently fail
    }
  }

  const fetchExpenses = async () => {
    try {
      const res = await fetch('/api/expenses')
      if (res.ok) setExpenses(await res.json())
      else toast.error('Failed to load expenses')
    } catch {
      toast.error('Failed to load expenses')
    } finally {
      setIsLoading(false)
    }
  }

  const filteredAndSortedExpenses = useMemo(() => {
    let filtered = [...expenses]

    if (filters.search) {
      const searchLower = filters.search.toLowerCase()
      filtered = filtered.filter(
        (expense) =>
          expense.payee?.toLowerCase().includes(searchLower) ||
          expense.note?.toLowerCase().includes(searchLower) ||
          expense.bill?.title?.toLowerCase().includes(searchLower) ||
          expense.category?.name?.toLowerCase().includes(searchLower),
      )
    }

    if (filters.categoryId) {
      filtered = filtered.filter((expense) => expense.categoryId === filters.categoryId)
    }

    if (filters.dateFrom || filters.dateTo) {
      filtered = filtered.filter((expense) =>
        inCalendarYmdRange(expense.date, filters.dateFrom || undefined, filters.dateTo || undefined),
      )
    }

    if (filters.isTaxItem !== '') {
      const wantTax = filters.isTaxItem === 'true'
      filtered = filtered.filter((expense) => Boolean(expense.isTaxItem) === wantTax)
    }

    if (filters.source === 'standalone') {
      filtered = filtered.filter((expense) => !expense.billId)
    } else if (filters.source === 'bill') {
      filtered = filtered.filter((expense) => Boolean(expense.billId))
    }

    if (sortConfig.column && sortConfig.direction) {
      filtered.sort((a, b) => {
        let aValue: string | number
        let bValue: string | number

        switch (sortConfig.column) {
          case 'date':
            aValue = new Date(a.date).getTime()
            bValue = new Date(b.date).getTime()
            break
          case 'amount':
            aValue = Number(a.amount)
            bValue = Number(b.amount)
            break
          case 'category':
            aValue = (a.category?.name || '').toLowerCase()
            bValue = (b.category?.name || '').toLowerCase()
            break
          case 'payee':
            aValue = (a.payee || a.bill?.title || '').toLowerCase()
            bValue = (b.payee || b.bill?.title || '').toLowerCase()
            break
          case 'note':
            aValue = (a.note || '').toLowerCase()
            bValue = (b.note || '').toLowerCase()
            break
          case 'tax':
            aValue = a.isTaxItem ? 1 : 0
            bValue = b.isTaxItem ? 1 : 0
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
  }, [expenses, filters, sortConfig])

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

  const openEditModal = (expense: Expense) => {
    setEditingExpense(expense)
    setIsEditModalOpen(true)
  }

  const handleDelete = async (expense: Expense) => {
    if (expense.billId) {
      toast.error('This expense is a bill payment — edit it via the bill')
      return
    }
    if (!confirm('Are you sure you want to delete this expense?')) return
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
      if (res.ok) {
        toast.success('Expense deleted')
        setExpenses((prev) => prev.filter((e) => e.id !== expense.id))
      } else {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to delete expense')
      }
    } catch {
      toast.error('Failed to delete expense')
    }
  }

  const total = filteredAndSortedExpenses.reduce((sum, e) => sum + Number(e.amount), 0)
  const hasActiveFilters =
    filters.search ||
    filters.categoryId ||
    filters.dateFrom ||
    filters.dateTo ||
    filters.isTaxItem ||
    filters.source

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to track expenses</p>
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
      <main className="app-page-container-wide">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-2 text-gray-600">
            Log groceries, fuel and other day-to-day spend • {filteredAndSortedExpenses.length} entr
            {filteredAndSortedExpenses.length !== 1 ? 'ies' : 'y'} • ${total.toFixed(2)} total
          </p>
        </div>

        <div className="mb-6">
          <QuickExpenseForm
            categories={categories}
            onCreated={(expense) => setExpenses((prev) => [expense, ...prev])}
          />
        </div>

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
                placeholder="Search payee, note, category..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Filter className="inline w-4 h-4 mr-1" />
                Category
              </label>
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
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="inline w-4 h-4 mr-1" />
                From
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
                To
              </label>
              <input
                type="date"
                value={filters.dateTo}
                onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Tax item</label>
              <select
                value={filters.isTaxItem}
                onChange={(e) => setFilters({ ...filters, isTaxItem: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All expenses</option>
                <option value="true">Tax items only</option>
                <option value="false">Non-tax only</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Source</label>
              <select
                value={filters.source}
                onChange={(e) => setFilters({ ...filters, source: e.target.value })}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="">All sources</option>
                <option value="standalone">Standalone only</option>
                <option value="bill">Bill payments only</option>
              </select>
            </div>

            <div className="flex items-end md:col-span-2">
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    search: '',
                    categoryId: '',
                    dateFrom: '',
                    dateTo: '',
                    isTaxItem: '',
                    source: '',
                  })
                }
                className="w-full px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Clear Filters
              </button>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading expenses...</p>
            </div>
          </div>
        ) : expenses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <Receipt className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600">No expenses yet. Log your first one above.</p>
          </div>
        ) : filteredAndSortedExpenses.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <p className="text-gray-600 mb-4">No expenses found</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={() =>
                  setFilters({
                    search: '',
                    categoryId: '',
                    dateFrom: '',
                    dateTo: '',
                    isTaxItem: '',
                    source: '',
                  })
                }
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('date')}
                    >
                      <div className="flex items-center">
                        Date
                        {getSortIcon('date')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('amount')}
                    >
                      <div className="flex items-center justify-end">
                        Amount
                        {getSortIcon('amount')}
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
                      onClick={() => handleSort('payee')}
                    >
                      <div className="flex items-center">
                        Store / payee
                        {getSortIcon('payee')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('note')}
                    >
                      <div className="flex items-center">
                        Note
                        {getSortIcon('note')}
                      </div>
                    </th>
                    <th
                      className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                      onClick={() => handleSort('tax')}
                    >
                      <div className="flex items-center">
                        Tax
                        {getSortIcon('tax')}
                      </div>
                    </th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredAndSortedExpenses.map((expense) => (
                    <tr
                      key={expense.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openEditModal(expense)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCalendarDate(expense.date)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                        ${Number(expense.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {expense.category?.color && (
                            <div
                              className="w-3 h-3 rounded-full mr-2"
                              style={{ backgroundColor: expense.category.color }}
                            />
                          )}
                          <span className="text-sm text-gray-900">{expense.category?.name || 'N/A'}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="flex items-center gap-2">
                          {expense.payee || <span className="text-gray-400">—</span>}
                          {expense.billId && (
                            <span
                              title="Payment of a bill"
                              className="inline-flex items-center gap-1 text-xs text-gray-500 bg-gray-100 rounded-full px-2 py-0.5"
                            >
                              <Link2 className="w-3 h-3" /> bill
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs truncate">
                        {expense.note || <span className="text-gray-400">—</span>}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {expense.isTaxItem ? (
                          <span className="inline-flex items-center text-xs font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                            Tax
                          </span>
                        ) : (
                          <span className="text-gray-400 text-sm">—</span>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              openEditModal(expense)
                            }}
                            className="text-primary-600 hover:text-primary-900"
                            title={expense.billId ? 'View bill payment' : 'Edit'}
                          >
                            <Edit className="w-5 h-5" />
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              handleDelete(expense)
                            }}
                            className="text-red-600 hover:text-red-900 disabled:text-gray-300"
                            title={expense.billId ? 'Managed via its bill' : 'Delete'}
                            disabled={!!expense.billId}
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
      </main>

      {editingExpense && (
        <ExpenseEditModal
          expense={editingExpense}
          categories={categories}
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false)
            setEditingExpense(null)
          }}
          onSaved={(updated) => {
            setEditingExpense(updated)
            setExpenses((prev) => prev.map((e) => (e.id === updated.id ? { ...e, ...updated } : e)))
          }}
          onDeleted={(id) => {
            setExpenses((prev) => prev.filter((e) => e.id !== id))
          }}
        />
      )}
    </div>
  )
}
