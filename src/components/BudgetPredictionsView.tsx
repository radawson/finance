'use client'

import { useState } from 'react'
import React from 'react'
import { BudgetPredictionData, BudgetPredictionPeriodData } from '@/types'
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import MarkdownExporter from './MarkdownExporter'

interface BudgetPredictionsViewProps {
  data: BudgetPredictionData | null
  isLoading: boolean
  startDate: string
  endDate: string
  includeForecast: boolean
  onIncludeForecastChange: (value: boolean) => void
}

function PeriodTable({ periods, amountLabel }: { periods: BudgetPredictionPeriodData[]; amountLabel: string }) {
  const [expandedPeriods, setExpandedPeriods] = useState<Set<string>>(new Set())

  const togglePeriod = (periodLabel: string) => {
    const newExpanded = new Set(expandedPeriods)
    if (newExpanded.has(periodLabel)) {
      newExpanded.delete(periodLabel)
    } else {
      newExpanded.add(periodLabel)
    }
    setExpandedPeriods(newExpanded)
  }

  if (periods.length === 0) {
    return (
      <p className="text-sm text-gray-500 py-4">No bills in this view for the selected period.</p>
    )
  }

  return (
    <div className="bg-white rounded-lg shadow overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12" />
              <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Period
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                {amountLabel}
              </th>
              <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                Bill Count
              </th>
            </tr>
          </thead>
          <tbody className="bg-white divide-y divide-gray-200">
            {periods.map((period) => {
              const isExpanded = expandedPeriods.has(period.periodLabel)
              return (
                <React.Fragment key={period.periodLabel}>
                  <tr
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => togglePeriod(period.periodLabel)}
                  >
                    <td className="px-6 py-4 whitespace-nowrap">
                      {isExpanded ? (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronRight className="w-5 h-5 text-gray-400" />
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {period.periodLabel}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-900 font-semibold">
                      ${period.predictedAmount.toFixed(2)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-right text-gray-500">
                      {period.billCount}
                    </td>
                  </tr>
                  {isExpanded && (
                    <tr>
                      <td colSpan={4} className="px-6 py-4 bg-gray-50">
                        <div className="space-y-2">
                          <h4 className="text-sm font-semibold text-gray-700 mb-3">Bills in this period:</h4>
                          <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                              <thead className="bg-gray-100">
                                <tr>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                    Title
                                  </th>
                                  <th className="px-4 py-2 text-right text-xs font-medium text-gray-600 uppercase">
                                    Amount
                                  </th>
                                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                    Due Date
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="bg-white divide-y divide-gray-200">
                                {period.bills.map((bill, index) => {
                                  const dueDate =
                                    typeof bill.dueDate === 'string'
                                      ? new Date(bill.dueDate)
                                      : bill.dueDate
                                  return (
                                    <tr key={`${bill.billId}-${dueDate.getTime()}-${index}`}>
                                      <td className="px-4 py-2 text-sm text-gray-900">{bill.title}</td>
                                      <td className="px-4 py-2 text-sm text-right text-gray-900">
                                        ${bill.amount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-500">
                                        {format(dueDate, 'yyyy-MM-dd')}
                                      </td>
                                    </tr>
                                  )
                                })}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export default function BudgetPredictionsView({
  data,
  isLoading,
  startDate,
  endDate,
  includeForecast,
  onIncludeForecastChange,
}: BudgetPredictionsViewProps) {
  const displayPeriods = data
    ? includeForecast
      ? data.predictions
      : data.actuals
    : []

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading budget data...</p>
        </div>
      </div>
    )
  }

  const actualsBillCount =
    data?.actuals.reduce((sum, period) => sum + period.billCount, 0) ?? 0

  if (!data || (actualsBillCount === 0 && !includeForecast)) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">No bills in range</h3>
              <p className="text-sm text-yellow-700 mt-1">
                Enter bills with due dates in the selected period to build your budget view.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalAmount = displayPeriods.reduce((sum, period) => sum + period.predictedAmount, 0)
  const totalBills = displayPeriods.reduce((sum, period) => sum + period.billCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap justify-between items-start gap-4">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Periodic Budget</h2>
          <p className="text-gray-600 mt-1">
            {includeForecast ? 'Actuals + recurring forecast' : 'Actual bills only'}: $
            {totalAmount.toFixed(2)} across {totalBills} bills
          </p>
        </div>
        <div className="flex items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
            <input
              type="checkbox"
              checked={includeForecast}
              onChange={(e) => onIncludeForecastChange(e.target.checked)}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
            />
            Include recurring forecast
          </label>
          {data && (
            <MarkdownExporter type="budget" data={data} startDate={startDate} endDate={endDate} />
          )}
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
        <p className="text-sm text-blue-800">
          Default view shows only bills you entered (groceries, one-offs, scheduled payments).
          Enable the forecast overlay to add expected recurring charges without double-counting
          bills already on your calendar.
        </p>
      </div>

      <PeriodTable
        periods={displayPeriods}
        amountLabel={includeForecast ? 'Total (with forecast)' : 'Total'}
      />
    </div>
  )
}
