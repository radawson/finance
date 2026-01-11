'use client'

import { useState, useEffect } from 'react'
import { Bill, Category, Vendor, RecurrenceFrequencyEnum } from '@/types'
import { BillStatus } from '@/generated/prisma/client'
import { format } from 'date-fns'

interface BillFormProps {
  bill?: Bill | null
  categories: Category[]
  vendors: Vendor[]
  onSubmit: (data: BillFormData, recurrenceData?: RecurrenceFormData) => Promise<void>
  onCancel: () => void
}

export interface BillFormData {
  title: string
  amount: string
  dueDate: string
  categoryId: string
  vendorId: string
  description: string
  status: BillStatus
  paidDate: string
  invoiceNumber: string
}

export interface RecurrenceFormData {
  isRecurring: boolean
  frequency: RecurrenceFrequencyEnum
  dayOfMonth: number
  startDate: string
  endDate: string
}

export default function BillForm({ bill, categories, vendors, onSubmit, onCancel }: BillFormProps) {
  const [formData, setFormData] = useState<BillFormData>({
    title: '',
    amount: '',
    dueDate: '',
    categoryId: '',
    vendorId: '',
    description: '',
    status: BillStatus.PENDING,
    paidDate: '',
    invoiceNumber: '',
  })
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isRecurring, setIsRecurring] = useState(false)
  const [showRecurrenceSection, setShowRecurrenceSection] = useState(false)
  const [recurrenceFormData, setRecurrenceFormData] = useState<RecurrenceFormData>({
    isRecurring: false,
    frequency: RecurrenceFrequencyEnum.MONTHLY,
    dayOfMonth: 1,
    startDate: '',
    endDate: '',
  })

  useEffect(() => {
    if (bill) {
      const dueDate = new Date(bill.dueDate)
      setFormData({
        title: bill.title,
        amount: Number(bill.amount).toFixed(2),
        dueDate: format(dueDate, 'yyyy-MM-dd'),
        categoryId: bill.categoryId,
        vendorId: bill.vendorId || '',
        description: bill.description || '',
        status: bill.status,
        paidDate: bill.paidDate ? format(new Date(bill.paidDate), 'yyyy-MM-dd') : '',
        invoiceNumber: bill.invoiceNumber || '',
      })
      
      // Set recurrence state if bill has recurrence pattern
      if (bill.recurrencePattern) {
        setIsRecurring(true)
        setShowRecurrenceSection(true)
        setRecurrenceFormData({
          isRecurring: true,
          frequency: bill.recurrencePattern.frequency as RecurrenceFrequencyEnum,
          dayOfMonth: bill.recurrencePattern.dayOfMonth,
          startDate: format(new Date(bill.recurrencePattern.startDate), 'yyyy-MM-dd'),
          endDate: bill.recurrencePattern.endDate ? format(new Date(bill.recurrencePattern.endDate), 'yyyy-MM-dd') : '',
        })
      } else {
        setIsRecurring(false)
        setShowRecurrenceSection(false)
        setRecurrenceFormData({
          isRecurring: false,
          frequency: RecurrenceFrequencyEnum.MONTHLY,
          dayOfMonth: dueDate.getDate(),
          startDate: format(dueDate, 'yyyy-MM-dd'),
          endDate: '',
        })
      }
    } else {
      // Reset for new bill
      setIsRecurring(false)
      setShowRecurrenceSection(false)
    }
  }, [bill])

  // Update recurrence defaults when due date changes
  useEffect(() => {
    if (isRecurring && formData.dueDate && !bill?.recurrencePatternId) {
      const dueDate = new Date(formData.dueDate)
      setRecurrenceFormData(prev => ({
        ...prev,
        dayOfMonth: dueDate.getDate(),
        startDate: format(dueDate, 'yyyy-MM-dd'),
      }))
    }
  }, [formData.dueDate, isRecurring, bill?.recurrencePatternId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      const recurrenceData = isRecurring && showRecurrenceSection ? {
        ...recurrenceFormData,
        isRecurring: true,
      } : undefined
      await onSubmit(formData, recurrenceData)
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
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
            onChange={(e) => setFormData({ ...formData, vendorId: e.target.value })}
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
            <option value={BillStatus.PENDING}>Pending</option>
            <option value={BillStatus.DUE_SOON}>Due Soon</option>
            <option value={BillStatus.OVERDUE}>Overdue</option>
            <option value={BillStatus.PAID}>Paid</option>
            <option value={BillStatus.SKIPPED}>Skipped</option>
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
                setRecurrenceFormData({
                  isRecurring: true,
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
                value={recurrenceFormData.frequency}
                onChange={(e) =>
                  setRecurrenceFormData({
                    ...recurrenceFormData,
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
                value={recurrenceFormData.dayOfMonth}
                onChange={(e) =>
                  setRecurrenceFormData({
                    ...recurrenceFormData,
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
                  value={recurrenceFormData.startDate}
                  onChange={(e) =>
                    setRecurrenceFormData({
                      ...recurrenceFormData,
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
                  value={recurrenceFormData.endDate}
                  onChange={(e) =>
                    setRecurrenceFormData({
                      ...recurrenceFormData,
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
          disabled={isSubmitting}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? 'Saving...' : bill ? 'Update' : 'Create'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}
