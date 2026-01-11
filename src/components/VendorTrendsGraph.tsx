'use client'

import { useState } from 'react'
import { VendorTrendData } from '@/types'
import { BarChart3, TrendingUp } from 'lucide-react'

interface VendorTrendsGraphProps {
  data: VendorTrendData[]
  period: 'monthly' | 'quarterly' | 'yearly'
}

// Color palette for vendors (max 10 distinct colors)
const VENDOR_COLORS = [
  '#3b82f6', // blue
  '#ef4444', // red
  '#10b981', // green
  '#f59e0b', // amber
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#84cc16', // lime
  '#f97316', // orange
  '#6366f1', // indigo
]

type ChartType = 'line' | 'bar'

export default function VendorTrendsGraph({ data, period }: VendorTrendsGraphProps) {
  const [chartType, setChartType] = useState<ChartType>('line')

  if (data.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 bg-gray-50 rounded-lg">
        <p className="text-gray-500">No vendor data to display</p>
      </div>
    )
  }

  // Collect all unique periods across all vendors
  const allPeriods = new Set<string>()
  data.forEach((vendor) => {
    vendor.periods.forEach((p) => allPeriods.add(p.periodLabel))
  })
  const sortedPeriods = Array.from(allPeriods).sort()

  // Calculate max amount for Y-axis scaling
  const maxAmount = Math.max(
    ...data.flatMap((v) => v.periods.map((p) => p.totalAmount)),
    1
  )

  // Chart dimensions
  const width = 800
  const height = 400
  const padding = { top: 40, right: 40, bottom: 60, left: 80 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Calculate positions
  const xScale = (index: number) => {
    return padding.left + (index / (sortedPeriods.length - 1 || 1)) * chartWidth
  }

  const yScale = (amount: number) => {
    return padding.top + chartHeight - (amount / maxAmount) * chartHeight
  }

  // Get vendor data point for a period
  const getVendorDataPoint = (vendor: VendorTrendData, periodLabel: string) => {
    const periodData = vendor.periods.find((p) => p.periodLabel === periodLabel)
    return periodData ? periodData.totalAmount : 0
  }

  // Generate path for line chart
  const generateLinePath = (vendor: VendorTrendData) => {
    const points = sortedPeriods.map((periodLabel, index) => {
      const amount = getVendorDataPoint(vendor, periodLabel)
      return `${xScale(index)},${yScale(amount)}`
    })
    return `M ${points.join(' L ')}`
  }

  return (
    <div className="space-y-4">
      {/* Chart Type Toggle */}
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={() => setChartType('line')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chartType === 'line'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <TrendingUp className="w-4 h-4" />
          Line Chart
        </button>
        <button
          type="button"
          onClick={() => setChartType('bar')}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
            chartType === 'bar'
              ? 'bg-primary-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          Bar Chart
        </button>
      </div>

      {/* Chart Container */}
      <div className="bg-white rounded-lg shadow p-6 overflow-x-auto">
        <svg width={width} height={height} className="min-w-full">
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + chartHeight - ratio * chartHeight
            const value = Math.round(maxAmount * ratio)
            return (
              <g key={ratio}>
                <line
                  x1={padding.left}
                  y1={y}
                  x2={width - padding.right}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                  strokeDasharray="4 4"
                />
                <text
                  x={padding.left - 10}
                  y={y}
                  textAnchor="end"
                  dominantBaseline="middle"
                  className="text-xs fill-gray-600"
                >
                  ${(value / 1000).toFixed(value >= 1000 ? 1 : 0)}k
                </text>
              </g>
            )
          })}

          {/* X-axis */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* Y-axis */}
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* Period labels on X-axis */}
          {sortedPeriods.map((periodLabel, index) => {
            const x = xScale(index)
            return (
              <text
                key={periodLabel}
                x={x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-gray-600"
                transform={`rotate(-45 ${x} ${height - padding.bottom + 20})`}
              >
                {periodLabel}
              </text>
            )
          })}

          {/* Render chart based on type */}
          {chartType === 'line' ? (
            // Line Chart
            <>
              {data.map((vendor, vendorIndex) => {
                const color = VENDOR_COLORS[vendorIndex % VENDOR_COLORS.length]
                const path = generateLinePath(vendor)

                return (
                  <g key={vendor.vendorId}>
                    <path
                      d={path}
                      fill="none"
                      stroke={color}
                      strokeWidth="3"
                      className="hover:opacity-80"
                    />
                    {/* Data points */}
                    {sortedPeriods.map((periodLabel, index) => {
                      const amount = getVendorDataPoint(vendor, periodLabel)
                      if (amount === 0) return null
                      return (
                        <circle
                          key={`${vendor.vendorId}-${periodLabel}`}
                          cx={xScale(index)}
                          cy={yScale(amount)}
                          r="4"
                          fill={color}
                          className="hover:r-6 transition-all cursor-pointer"
                        >
                          <title>{`${vendor.vendorName}: $${amount.toFixed(2)}`}</title>
                        </circle>
                      )
                    })}
                  </g>
                )
              })}
            </>
          ) : (
            // Bar Chart
            <>
              {sortedPeriods.map((periodLabel, periodIndex) => {
                const barWidth = chartWidth / sortedPeriods.length / (data.length + 1)
                const barSpacing = barWidth * 0.2

                return (
                  <g key={periodLabel}>
                    {data.map((vendor, vendorIndex) => {
                      const amount = getVendorDataPoint(vendor, periodLabel)
                      if (amount === 0) return null

                      const color = VENDOR_COLORS[vendorIndex % VENDOR_COLORS.length]
                      const x =
                        xScale(periodIndex) -
                        (barWidth * data.length) / 2 +
                        vendorIndex * (barWidth + barSpacing)
                      const y = yScale(amount)
                      const barHeight = padding.top + chartHeight - y

                      return (
                        <rect
                          key={`${vendor.vendorId}-${periodLabel}`}
                          x={x}
                          y={y}
                          width={barWidth}
                          height={barHeight}
                          fill={color}
                          className="hover:opacity-80 transition-opacity cursor-pointer"
                        >
                          <title>{`${vendor.vendorName}: $${amount.toFixed(2)}`}</title>
                        </rect>
                      )
                    })}
                  </g>
                )
              })}
            </>
          )}
        </svg>

        {/* Legend */}
        <div className="mt-6 flex flex-wrap gap-4 justify-center">
          {data.map((vendor, index) => {
            const color = VENDOR_COLORS[index % VENDOR_COLORS.length]
            return (
              <div key={vendor.vendorId} className="flex items-center gap-2">
                <div
                  className="w-4 h-4 rounded"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm text-gray-700">{vendor.vendorName}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
