'use client'

import { useEffect, useState } from 'react'
import { Category, Expense } from '@/types'
import toast from 'react-hot-toast'
import { format } from 'date-fns'
import { Plus } from 'lucide-react'

interface QuickExpenseFormProps {
  categories: Category[]
  onCreated?: (expense: Expense) => void
  /** Category name to preselect (default "Food" — the groceries category). */
  defaultCategoryName?: string
}

const emptyForm = (date: string, categoryId: string) => ({
  date,
  amount: '',
  categoryId,
  payee: '',
  note: '',
})

export default function QuickExpenseForm({
  categories,
  onCreated,
  defaultCategoryName = 'Food',
}: QuickExpenseFormProps) {
  const today = format(new Date(), 'yyyy-MM-dd')
  const [form, setForm] = useState(emptyForm(today, ''))
  const [isSaving, setIsSaving] = useState(false)

  // Preselect a sensible default category once categories load.
  useEffect(() => {
    if (form.categoryId || categories.length === 0) return
    const preferred =
      categories.find((c) => c.name === defaultCategoryName) ??
      categories.find((c) => c.kind === 'VARIABLE') ??
      categories[0]
    if (preferred) setForm((f) => ({ ...f, categoryId: preferred.id }))
  }, [categories, defaultCategoryName, form.categoryId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
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
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount: form.amount,
          date: new Date(form.date).toISOString(),
          categoryId: form.categoryId,
          payee: form.payee.trim() || undefined,
          note: form.note.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to log expense')
        return
      }
      const created: Expense = await res.json()
      toast.success('Expense logged')
      // Keep date + category for fast repeated entry; clear the rest.
      setForm((f) => ({ ...f, amount: '', payee: '', note: '' }))
      onCreated?.(created)
    } catch {
      toast.error('Failed to log expense')
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="bg-white rounded-lg shadow-md p-6 space-y-4">
      <h2 className="text-lg font-semibold text-gray-900">Log an expense</h2>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Date *</label>
          <input
            type="date"
            required
            value={form.date}
            onChange={(e) => setForm({ ...form, date: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
              placeholder="0.00"
              className="w-full pl-7 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Category *</label>
          <select
            required
            value={form.categoryId}
            onChange={(e) => setForm({ ...form, categoryId: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
            placeholder="e.g. Tesco"
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Note</label>
        <input
          type="text"
          value={form.note}
          onChange={(e) => setForm({ ...form, note: e.target.value })}
          placeholder="Optional"
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <button
        type="submit"
        disabled={isSaving}
        className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50"
      >
        <Plus className="w-5 h-5 mr-2" />
        {isSaving ? 'Saving…' : 'Log expense'}
      </button>
    </form>
  )
}
