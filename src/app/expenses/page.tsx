'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import QuickExpenseForm from '@/components/QuickExpenseForm'
import { Category, Expense } from '@/types'
import { Trash2, Receipt, Link2 } from 'lucide-react'
import toast from 'react-hot-toast'
import { format } from 'date-fns'

export default function ExpensesPage() {
  const { data: session } = useSession()
  const [categories, setCategories] = useState<Category[]>([])
  const [expenses, setExpenses] = useState<Expense[]>([])
  const [isLoading, setIsLoading] = useState(true)

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

  const handleDelete = async (expense: Expense) => {
    if (expense.billId) {
      toast.error('This expense is a bill payment — edit it via the bill')
      return
    }
    if (!confirm('Delete this expense?')) return
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

  const total = expenses.reduce((sum, e) => sum + Number(e.amount), 0)

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
      <main className="app-page-container">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Expenses</h1>
          <p className="mt-2 text-gray-600">
            Log groceries, fuel and other day-to-day spend • {expenses.length} entr
            {expenses.length !== 1 ? 'ies' : 'y'} • ${total.toFixed(2)} total
          </p>
        </div>

        <div className="mb-6">
          <QuickExpenseForm
            categories={categories}
            onCreated={(expense) => setExpenses((prev) => [expense, ...prev])}
          />
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
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Store / payee</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Note</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {expenses.map((expense) => (
                    <tr key={expense.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {format(new Date(expense.date), 'MMM d, yyyy')}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-right font-semibold text-gray-900">
                        ${Number(expense.amount).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {expense.category?.color && (
                            <div className="w-3 h-3 rounded-full mr-2" style={{ backgroundColor: expense.category.color }} />
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
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button
                          onClick={() => handleDelete(expense)}
                          className="text-red-600 hover:text-red-900 disabled:text-gray-300"
                          title={expense.billId ? 'Managed via its bill' : 'Delete'}
                          disabled={!!expense.billId}
                        >
                          <Trash2 className="w-5 h-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
