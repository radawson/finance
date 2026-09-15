'use client'

import { useEffect, useState } from 'react'
import { Category, Expense } from '@/types'
import { format } from 'date-fns'
import { Calendar, DollarSign, Link2, Save, Tag, Trash2, X } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

interface ExpenseEditModalProps {
  expense: Expense
  categories: Category[]
  isOpen: boolean
  onClose: () => void
  onSaved: (expense: Expense) => void
  onDeleted: (id: string) => void
}

function toDateInput(value: Date | string) {
  return format(new Date(value), 'yyyy-MM-dd')
}

export default function ExpenseEditModal({
  expense,
  categories,
  isOpen,
  onClose,
  onSaved,
  onDeleted,
}: ExpenseEditModalProps) {
  const linkedToBill = Boolean(expense.billId)
  const [form, setForm] = useState({
    date: toDateInput(expense.date),
    amount: Number(expense.amount).toFixed(2),
    categoryId: expense.categoryId,
    payee: expense.payee || '',
    note: expense.note || '',
    isTaxItem: Boolean(expense.isTaxItem),
  })
  const [isSaving, setIsSaving] = useState(false)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    setForm({
      date: toDateInput(expense.date),
      amount: Number(expense.amount).toFixed(2),
      categoryId: expense.categoryId,
      payee: expense.payee || '',
      note: expense.note || '',
      isTaxItem: Boolean(expense.isTaxItem),
    })
  }, [expense])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = previousOverflow
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    if (linkedToBill) return
    if (!form.amount || isNaN(Number(form.amount)) || Number(form.amount) <= 0) {
      toast.error('Please enter a valid amount')
      return
    }
    if (!form.categoryId) {
      toast.error('Please choose a category')
      return
    }

    setIsSaving(true)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: form.amount,
          date: new Date(`${form.date}T12:00:00`).toISOString(),
          categoryId: form.categoryId,
          payee: form.payee.trim() || null,
          note: form.note.trim() || null,
          isTaxItem: form.isTaxItem,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to update expense')
        return
      }
      const updated: Expense = await res.json()
      toast.success('Expense updated')
      onSaved({ ...expense, ...updated })
      onClose()
    } catch {
      toast.error('Failed to update expense')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (linkedToBill) return
    if (!confirm('Delete this expense? This cannot be undone.')) return
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to delete expense')
        return
      }
      toast.success('Expense deleted')
      onDeleted(expense.id)
      onClose()
    } catch {
      toast.error('Failed to delete expense')
    } finally {
      setIsDeleting(false)
    }
  }

  const inputClass =
    'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent'

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full my-8 mx-4">
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">
              {linkedToBill ? 'Bill payment' : 'Edit expense'}
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              {linkedToBill
                ? 'This row is the payment of a bill. Change it on the bill instead.'
                : 'Update the details, then save.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {linkedToBill ? (
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center text-gray-700">
                <DollarSign className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Amount</div>
                  <div className="font-semibold text-lg">${Number(expense.amount).toFixed(2)}</div>
                </div>
              </div>
              <div className="flex items-center text-gray-700">
                <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Date</div>
                  <div className="font-medium">{format(new Date(expense.date), 'MMM d, yyyy')}</div>
                </div>
              </div>
              <div className="flex items-center text-gray-700">
                <Tag className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Category</div>
                  <div className="font-medium">{expense.category?.name || 'N/A'}</div>
                </div>
              </div>
              <div className="flex items-center text-gray-700">
                <Link2 className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Bill</div>
                  <div className="font-medium">{expense.bill?.title || expense.payee || 'Linked bill'}</div>
                </div>
              </div>
            </div>
            {expense.isTaxItem && (
              <span className="inline-flex items-center text-xs font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                Tax item
              </span>
            )}
            <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
              {expense.billId && (
                <Link
                  href={`/bills/${expense.billId}`}
                  className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
                >
                  Open bill
                </Link>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Close
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
                <input
                  type="date"
                  required
                  value={form.date}
                  onChange={(e) => setForm({ ...form, date: e.target.value })}
                  className={inputClass}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                <div className="relative">
                  <span className="absolute inset-y-0 left-0 flex items-center pl-3 text-gray-500">$</span>
                  <input
                    type="number"
                    required
                    min="0"
                    step="0.01"
                    value={form.amount}
                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                    className={`${inputClass} pl-7`}
                  />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
                <select
                  required
                  value={form.categoryId}
                  onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
                  className={inputClass}
                >
                  <option value="">Select a category</option>
                  {categories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Store / payee</label>
                <input
                  type="text"
                  value={form.payee}
                  onChange={(e) => setForm({ ...form, payee: e.target.value })}
                  className={inputClass}
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
              <input
                type="text"
                value={form.note}
                onChange={(e) => setForm({ ...form, note: e.target.value })}
                className={inputClass}
              />
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.isTaxItem}
                onChange={(e) => setForm({ ...form, isTaxItem: e.target.checked })}
                className="w-4 h-4 text-primary-600 border-gray-300 rounded focus:ring-primary-500"
              />
              <span className="text-sm font-medium text-gray-700">Tax item</span>
            </label>

            <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
              <button
                type="submit"
                disabled={isSaving || isDeleting}
                className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                <Save className="w-5 h-5 mr-2" />
                {isSaving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleDelete}
                disabled={isSaving || isDeleting}
                className="inline-flex items-center justify-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                <Trash2 className="w-5 h-5 mr-2" />
                {isDeleting ? 'Deleting…' : 'Delete'}
              </button>
              <button
                type="button"
                onClick={onClose}
                disabled={isSaving || isDeleting}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
