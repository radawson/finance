'use client'

import { useState } from 'react'
import { BudgetPredictionData, PredictedBill } from '@/types'
import { ChevronDown, ChevronRight, AlertCircle } from 'lucide-react'
import { format } from 'date-fns'
import MarkdownExporter from './MarkdownExporter'

interface BudgetPredictionsViewProps {
  data: BudgetPredictionData | null
  isLoading: boolean
  startDate: string
  endDate: string
}

export default function BudgetPredictionsView({
  data,
  isLoading,
  startDate,
  endDate,
}: BudgetPredictionsViewProps) {
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

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading budget predictions...</p>
        </div>
      </div>
    )
  }

  if (!data || data.predictions.length === 0) {
    return (
      <div className="space-y-4">
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">No predictions available</h3>
              <p className="text-sm text-yellow-700 mt-1">
                No recurring bills found for the selected period. Mark bills as recurring to see budget predictions.
              </p>
            </div>
          </div>
        </div>
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Future Enhancement</h3>
              <p className="text-sm text-blue-700 mt-1">
                Historical pattern analysis is planned for future implementation. This will automatically detect
                recurring patterns in bills even without explicit recurrence settings.
              </p>
            </div>
          </div>
        </div>
      </div>
    )
  }

  const totalPredicted = data.predictions.reduce((sum, period) => sum + period.predictedAmount, 0)
  const totalBills = data.predictions.reduce((sum, period) => sum + period.billCount, 0)
  const hasHistoricalAnalysis = data.predictions.some((p) =>
    p.bills.some((b) => b.source === 'historical-analysis')
  )

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Budget Predictions</h2>
          <p className="text-gray-600 mt-1">
            Total: ${totalPredicted.toFixed(2)} across {totalBills} predicted bills
          </p>
        </div>
        {data && <MarkdownExporter type="budget" data={data} startDate={startDate} endDate={endDate} />}
      </div>

      {!hasHistoricalAnalysis && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-blue-600 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-blue-800">Note</h3>
              <p className="text-sm text-blue-700 mt-1">
                Predictions are currently based only on bills with explicit recurrence patterns. Historical pattern
                analysis is planned for future implementation.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-12">
                  {/* Expand/collapse column */}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Period
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Predicted Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill Count
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.predictions.map((period) => {
                const isExpanded = expandedPeriods.has(period.periodLabel)
                return (
                  <tbody key={period.periodLabel}>
                    <tr className="hover:bg-gray-50 cursor-pointer" onClick={() => togglePeriod(period.periodLabel)}>
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
                            <h4 className="text-sm font-semibold text-gray-700 mb-3">Predicted bills in this period:</h4>
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
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                      Source
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {period.bills.map((bill, index) => (
                                    <tr key={`${bill.billId}-${bill.dueDate.getTime()}-${index}`}>
                                      <td className="px-4 py-2 text-sm text-gray-900">{bill.title}</td>
                                      <td className="px-4 py-2 text-sm text-right text-gray-900">
                                        ${bill.amount.toFixed(2)}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-500">
                                        {format(bill.dueDate, 'yyyy-MM-dd')}
                                      </td>
                                      <td className="px-4 py-2 text-sm">
                                        <span
                                          className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                            bill.source === 'recurrence'
                                              ? 'bg-green-100 text-green-800'
                                              : 'bg-blue-100 text-blue-800'
                                          }`}
                                        >
                                          {bill.source === 'recurrence' ? 'Recurrence Pattern' : 'Historical Analysis'}
                                        </span>
                                      </td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
