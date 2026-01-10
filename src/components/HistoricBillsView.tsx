'use client'

import { useState } from 'react'
import { HistoricBillsData, Bill } from '@/types'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { format } from 'date-fns'
import MarkdownExporter from './MarkdownExporter'

interface HistoricBillsViewProps {
  data: HistoricBillsData | null
  isLoading: boolean
  startDate: string
  endDate: string
}

export default function HistoricBillsView({
  data,
  isLoading,
  startDate,
  endDate,
}: HistoricBillsViewProps) {
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
          <p className="mt-4 text-gray-600">Loading historic bills...</p>
        </div>
      </div>
    )
  }

  if (!data || data.data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-600">No historic bills found for the selected period.</p>
      </div>
    )
  }

  const totalAmount = data.data.reduce((sum, period) => sum + period.totalAmount, 0)
  const totalBills = data.data.reduce((sum, period) => sum + period.billCount, 0)

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Historic Bills Paid</h2>
          <p className="text-gray-600 mt-1">
            Total: ${totalAmount.toFixed(2)} across {totalBills} bills
          </p>
        </div>
        {data && <MarkdownExporter type="history" data={data} startDate={startDate} endDate={endDate} />}
      </div>

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
                  Total Amount
                </th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Bill Count
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {data.data.map((period) => {
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
                        ${period.totalAmount.toFixed(2)}
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
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                      Paid Date
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                      Category
                                    </th>
                                    <th className="px-4 py-2 text-left text-xs font-medium text-gray-600 uppercase">
                                      Vendor
                                    </th>
                                  </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                  {period.bills.map((bill) => (
                                    <tr key={bill.id}>
                                      <td className="px-4 py-2 text-sm text-gray-900">{bill.title}</td>
                                      <td className="px-4 py-2 text-sm text-right text-gray-900">
                                        ${Number(bill.amount).toFixed(2)}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-500">
                                        {format(new Date(bill.dueDate), 'yyyy-MM-dd')}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-500">
                                        {bill.paidDate ? format(new Date(bill.paidDate), 'yyyy-MM-dd') : 'N/A'}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-500">
                                        {bill.category?.name || 'N/A'}
                                      </td>
                                      <td className="px-4 py-2 text-sm text-gray-500">
                                        {bill.vendor?.name || 'N/A'}
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
