'use client'

import { useState, useEffect } from 'react'
import { RecurrenceFrequency } from '@/generated/prisma/client'
import { format } from 'date-fns'

interface RecurrenceFormProps {
  billDueDate: Date
  recurrencePattern?: {
    frequency: RecurrenceFrequency
    dayOfMonth: number
    startDate: Date
    endDate?: Date | null
  } | null
  onSubmit: (data: RecurrenceFormData) => void
  onCancel: () => void
  onDelete?: () => void
}

export interface RecurrenceFormData {
  frequency: RecurrenceFrequency
  dayOfMonth: number
  startDate: string
  endDate: string
}

export default function RecurrenceForm({
  billDueDate,
  recurrencePattern,
  onSubmit,
  onCancel,
  onDelete,
}: RecurrenceFormProps) {
  const [formData, setFormData] = useState<RecurrenceFormData>({
    frequency: RecurrenceFrequency.MONTHLY,
    dayOfMonth: new Date(billDueDate).getDate(),
    startDate: format(new Date(billDueDate), 'yyyy-MM-dd'),
    endDate: '',
  })

  useEffect(() => {
    if (recurrencePattern) {
      setFormData({
        frequency: recurrencePattern.frequency,
        dayOfMonth: recurrencePattern.dayOfMonth,
        startDate: format(new Date(recurrencePattern.startDate), 'yyyy-MM-dd'),
        endDate: recurrencePattern.endDate
          ? format(new Date(recurrencePattern.endDate), 'yyyy-MM-dd')
          : '',
      })
    } else {
      // Initialize with bill's due date
      const dueDate = new Date(billDueDate)
      setFormData({
        frequency: RecurrenceFrequency.MONTHLY,
        dayOfMonth: dueDate.getDate(),
        startDate: format(dueDate, 'yyyy-MM-dd'),
        endDate: '',
      })
    }
  }, [recurrencePattern, billDueDate])

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSubmit(formData)
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Frequency *
        </label>
        <select
          required
          value={formData.frequency}
          onChange={(e) =>
            setFormData({ ...formData, frequency: e.target.value as RecurrenceFrequency })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        >
          <option value={RecurrenceFrequency.MONTHLY}>Monthly</option>
          <option value={RecurrenceFrequency.QUARTERLY}>Quarterly</option>
          <option value={RecurrenceFrequency.BIANNUALLY}>Biannually</option>
          <option value={RecurrenceFrequency.YEARLY}>Yearly</option>
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
          value={formData.dayOfMonth}
          onChange={(e) =>
            setFormData({ ...formData, dayOfMonth: parseInt(e.target.value) || 1 })
          }
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="mt-1 text-sm text-gray-500">
          The day of the month when this bill is due
        </p>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Start Date *
        </label>
        <input
          type="date"
          required
          value={formData.startDate}
          onChange={(e) => setFormData({ ...formData, startDate: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          End Date (optional)
        </label>
        <input
          type="date"
          value={formData.endDate}
          onChange={(e) => setFormData({ ...formData, endDate: e.target.value })}
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
        />
        <p className="mt-1 text-sm text-gray-500">
          Leave empty for indefinite recurrence
        </p>
      </div>

      <div className="flex gap-4">
        <button
          type="submit"
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {recurrencePattern ? 'Update' : 'Create'} Recurrence
        </button>
        {recurrencePattern && onDelete && (
          <button
            type="button"
            onClick={onDelete}
            className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
          >
            Delete
          </button>
        )}
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
