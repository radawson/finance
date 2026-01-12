'use client'

import { useMemo } from 'react'

interface CategoryData {
  categoryId: string
  categoryName: string
  color: string | null
  count: number
  totalAmount: number
}

interface CategoryPieChartProps {
  data: CategoryData[]
  size?: number
}

// Default color palette if category doesn't have a color
const DEFAULT_COLORS = [
  '#3b82f6', // blue
  '#10b981', // green
  '#f59e0b', // yellow
  '#ef4444', // red
  '#8b5cf6', // purple
  '#ec4899', // pink
  '#06b6d4', // cyan
  '#f97316', // orange
  '#84cc16', // lime
  '#6366f1', // indigo
]

export default function CategoryPieChart({ data, size = 200 }: CategoryPieChartProps) {
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return null

    const total = data.reduce((sum, item) => sum + item.totalAmount, 0)
    if (total === 0) return null

    let currentAngle = -90 // Start at top
    const radius = size / 2 - 10
    const center = size / 2

    return data.map((item, index) => {
      const percentage = item.totalAmount / total
      const angle = percentage * 360
      const startAngle = currentAngle
      const endAngle = currentAngle + angle
      currentAngle = endAngle

      // Calculate path for pie slice
      const startAngleRad = (startAngle * Math.PI) / 180
      const endAngleRad = (endAngle * Math.PI) / 180

      const x1 = center + radius * Math.cos(startAngleRad)
      const y1 = center + radius * Math.sin(startAngleRad)
      const x2 = center + radius * Math.cos(endAngleRad)
      const y2 = center + radius * Math.sin(endAngleRad)

      const largeArcFlag = angle > 180 ? 1 : 0

      const path = [
        `M ${center} ${center}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArcFlag} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ')

      const color = item.color || DEFAULT_COLORS[index % DEFAULT_COLORS.length]

      return {
        ...item,
        percentage,
        path,
        color,
        startAngle,
        endAngle,
      }
    })
  }, [data, size])

  if (!chartData || chartData.length === 0) {
    return (
      <div className="flex items-center justify-center h-64 text-gray-500">
        No category data available
      </div>
    )
  }

  return (
    <div className="flex flex-col md:flex-row gap-8 items-start">
      {/* Pie Chart */}
      <div className="flex-shrink-0">
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-sm">
          {chartData.map((slice, index) => (
            <g key={slice.categoryId}>
              <path
                d={slice.path}
                fill={slice.color}
                stroke="white"
                strokeWidth="2"
                className="hover:opacity-80 transition-opacity cursor-pointer"
                style={{ filter: 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))' }}
              />
            </g>
          ))}
          {/* Center circle for donut effect (optional - can remove for full pie) */}
          <circle
            cx={size / 2}
            cy={size / 2}
            r={size / 4}
            fill="white"
            stroke="white"
            strokeWidth="2"
          />
          {/* Total amount in center */}
          <text
            x={size / 2}
            y={size / 2 - 8}
            textAnchor="middle"
            className="text-sm font-semibold fill-gray-900"
          >
            Total
          </text>
          <text
            x={size / 2}
            y={size / 2 + 12}
            textAnchor="middle"
            className="text-lg font-bold fill-primary-600"
          >
            ${chartData.reduce((sum, item) => sum + item.totalAmount, 0).toFixed(2)}
          </text>
        </svg>
      </div>

      {/* Legend */}
      <div className="flex-1 space-y-3">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Categories</h3>
        {chartData
          .sort((a, b) => b.totalAmount - a.totalAmount)
          .map((slice) => (
            <div key={slice.categoryId} className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-1 min-w-0">
                <div
                  className="w-4 h-4 rounded-full flex-shrink-0"
                  style={{ backgroundColor: slice.color }}
                />
                <span className="font-medium text-gray-900 truncate">{slice.categoryName}</span>
              </div>
              <div className="text-right ml-4 flex-shrink-0">
                <div className="font-semibold text-gray-900">
                  ${slice.totalAmount.toFixed(2)}
                </div>
                <div className="text-sm text-gray-500">
                  {slice.count} bill{slice.count !== 1 ? 's' : ''} •{' '}
                  {(slice.percentage * 100).toFixed(1)}%
                </div>
              </div>
            </div>
          ))}
      </div>
    </div>
  )
}
