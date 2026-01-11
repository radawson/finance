'use client'

import { useEffect, useState } from 'react'
import { VendorTrendsResponse, AnalysisPeriod } from '@/types'
import VendorTrendSelector from './VendorTrendSelector'
import VendorTrendsGraph from './VendorTrendsGraph'
import AnalysisPeriodSelector from './AnalysisPeriodSelector'
import { format, subMonths, addMonths } from 'date-fns'
import toast from 'react-hot-toast'

interface VendorTrendsViewProps {
  period: AnalysisPeriod
  startDate: string
  endDate: string
  onPeriodChange: (period: AnalysisPeriod) => void
  onStartDateChange: (date: string) => void
  onEndDateChange: (date: string) => void
}

export default function VendorTrendsView({
  period,
  startDate,
  endDate,
  onPeriodChange,
  onStartDateChange,
  onEndDateChange,
}: VendorTrendsViewProps) {
  const [selectedVendorIds, setSelectedVendorIds] = useState<string[]>([])
  const [trendData, setTrendData] = useState<VendorTrendsResponse | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (selectedVendorIds.length > 0) {
      fetchTrendData()
    } else {
      setTrendData(null)
    }
  }, [selectedVendorIds, period, startDate, endDate])

  const fetchTrendData = async () => {
    if (selectedVendorIds.length === 0) {
      setTrendData(null)
      return
    }

    setIsLoading(true)
    try {
      const params = new URLSearchParams({
        vendorIds: selectedVendorIds.join(','),
        period: period === 'custom' ? 'monthly' : period,
        startDate,
        endDate,
      })

      const response = await fetch(`/api/analysis/vendor-trends?${params}`)
      if (response.ok) {
        const data = await response.json()
        setTrendData(data)
      } else {
        toast.error('Failed to load vendor trends')
        setTrendData(null)
      }
    } catch (error) {
      toast.error('Failed to load vendor trends')
      setTrendData(null)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Vendor Trends</h2>
        <p className="text-gray-600 mt-1">
          Analyze spending trends across selected vendors over time
        </p>
      </div>

      {/* Period Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <AnalysisPeriodSelector
          period={period}
          onPeriodChange={onPeriodChange}
          startDate={startDate}
          endDate={endDate}
          onStartDateChange={onStartDateChange}
          onEndDateChange={onEndDateChange}
        />
      </div>

      {/* Vendor Selector */}
      <div className="bg-white rounded-lg shadow p-6">
        <VendorTrendSelector
          selectedVendorIds={selectedVendorIds}
          onSelectionChange={setSelectedVendorIds}
        />
      </div>

      {/* Graph */}
      {isLoading ? (
        <div className="bg-white rounded-lg shadow p-12">
          <div className="flex items-center justify-center">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading vendor trends...</p>
            </div>
          </div>
        </div>
      ) : selectedVendorIds.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12">
          <div className="text-center">
            <p className="text-gray-500">Select one or more vendors to view trends</p>
          </div>
        </div>
      ) : trendData && trendData.vendors.length > 0 ? (
        <div className="bg-white rounded-lg shadow p-6">
          <VendorTrendsGraph
            data={trendData.vendors}
            period={period === 'custom' ? 'monthly' : period}
          />
        </div>
      ) : (
        <div className="bg-white rounded-lg shadow p-12">
          <div className="text-center">
            <p className="text-gray-500">No data available for selected vendors in this period</p>
          </div>
        </div>
      )}
    </div>
  )
}
