'use client'

import { useState } from 'react'
import { TrendingUp, CreditCard } from 'lucide-react'
import { format } from 'date-fns'

interface BalanceSnapshot {
  date: string
  balance: string
}

interface AccountBalanceData {
  accountId: string
  accountLabel: string
  vendorName: string
  accountTypeName: string | null
  currentBalance: string | null
  interestRate: string | null
  snapshots: BalanceSnapshot[]
}

interface CreditCardBalanceGraphProps {
  accounts: AccountBalanceData[]
  period: string
  onPeriodChange: (period: string) => void
}

// Color palette for accounts
const ACCOUNT_COLORS = [
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

export default function CreditCardBalanceGraph({
  accounts,
  period,
  onPeriodChange,
}: CreditCardBalanceGraphProps) {
  const [hoveredPoint, setHoveredPoint] = useState<{
    accountId: string
    date: string
    balance: number
    x: number
    y: number
  } | null>(null)

  if (accounts.length === 0) {
    return null
  }

  // Collect all unique dates across all accounts
  const allDates = new Set<string>()
  accounts.forEach((account) => {
    account.snapshots.forEach((s) => {
      // Normalize to date only (YYYY-MM-DD)
      allDates.add(s.date.split('T')[0])
    })
  })
  const sortedDates = Array.from(allDates).sort()

  if (sortedDates.length === 0) {
    return null
  }

  // Calculate max balance for Y-axis scaling
  const maxBalance = Math.max(
    ...accounts.flatMap((a) => a.snapshots.map((s) => Number(s.balance))),
    1
  )

  // Chart dimensions
  const width = 800
  const height = 350
  const padding = { top: 30, right: 40, bottom: 60, left: 80 }
  const chartWidth = width - padding.left - padding.right
  const chartHeight = height - padding.top - padding.bottom

  // Scale functions
  const xScale = (index: number) => {
    if (sortedDates.length === 1) return padding.left + chartWidth / 2
    return padding.left + (index / (sortedDates.length - 1)) * chartWidth
  }

  const yScale = (balance: number) => {
    return padding.top + chartHeight - (balance / maxBalance) * chartHeight
  }

  // Get balance at a specific date for an account (use latest snapshot on or before that date)
  const getBalanceAtDate = (account: AccountBalanceData, dateStr: string): number | null => {
    const snapshot = account.snapshots.find((s) => s.date.split('T')[0] === dateStr)
    return snapshot ? Number(snapshot.balance) : null
  }

  // Generate path for line chart - only connect points that have data
  const generateLinePath = (account: AccountBalanceData) => {
    const points: string[] = []
    sortedDates.forEach((dateStr, index) => {
      const balance = getBalanceAtDate(account, dateStr)
      if (balance !== null) {
        points.push(`${xScale(index)},${yScale(balance)}`)
      }
    })
    if (points.length === 0) return ''
    return `M ${points.join(' L ')}`
  }

  // Format Y-axis label
  const formatYLabel = (value: number) => {
    if (value >= 10000) return `$${(value / 1000).toFixed(0)}k`
    if (value >= 1000) return `$${(value / 1000).toFixed(1)}k`
    return `$${value.toFixed(0)}`
  }

  // Format date label for X-axis
  const formatDateLabel = (dateStr: string) => {
    try {
      return format(new Date(dateStr + 'T00:00:00'), 'MMM d')
    } catch {
      return dateStr
    }
  }

  // Determine which X-axis labels to show (avoid overlap)
  const maxLabels = 10
  const labelStep = Math.max(1, Math.ceil(sortedDates.length / maxLabels))

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <CreditCard className="w-6 h-6 text-primary-600" />
          <h3 className="text-lg font-semibold text-gray-900">Credit Card Balances</h3>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="balance-period" className="text-sm font-medium text-gray-700">
            Period:
          </label>
          <select
            id="balance-period"
            value={period}
            onChange={(e) => onPeriodChange(e.target.value)}
            className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
          >
            <option value="3m">3 Months</option>
            <option value="6m">6 Months</option>
            <option value="1y">1 Year</option>
          </select>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 mb-4">
        {accounts.map((account, index) => {
          const color = ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]
          const balance = account.currentBalance ? Number(account.currentBalance) : 0
          return (
            <div
              key={account.accountId}
              className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg"
            >
              <div
                className="w-3 h-3 rounded-full flex-shrink-0"
                style={{ backgroundColor: color }}
              />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-gray-900 truncate">
                  {account.vendorName} - {account.accountLabel}
                </p>
                <p className="text-sm text-gray-600">
                  ${balance.toFixed(2)}
                  {account.interestRate && (
                    <span className="text-gray-400 ml-2">
                      {Number(account.interestRate).toFixed(2)}% APR
                    </span>
                  )}
                </p>
              </div>
            </div>
          )
        })}
      </div>

      {/* Chart */}
      <div className="overflow-x-auto">
        <svg
          width={width}
          height={height}
          className="min-w-full"
          onMouseLeave={() => setHoveredPoint(null)}
        >
          {/* Y-axis grid lines */}
          {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
            const y = padding.top + chartHeight - ratio * chartHeight
            const value = maxBalance * ratio
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
                  className="text-xs fill-gray-500"
                >
                  {formatYLabel(value)}
                </text>
              </g>
            )
          })}

          {/* Axes */}
          <line
            x1={padding.left}
            y1={padding.top + chartHeight}
            x2={width - padding.right}
            y2={padding.top + chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />
          <line
            x1={padding.left}
            y1={padding.top}
            x2={padding.left}
            y2={padding.top + chartHeight}
            stroke="#374151"
            strokeWidth="2"
          />

          {/* X-axis date labels */}
          {sortedDates.map((dateStr, index) => {
            if (index % labelStep !== 0 && index !== sortedDates.length - 1) return null
            const x = xScale(index)
            return (
              <text
                key={dateStr}
                x={x}
                y={height - padding.bottom + 20}
                textAnchor="middle"
                className="text-xs fill-gray-500"
                transform={`rotate(-30 ${x} ${height - padding.bottom + 20})`}
              >
                {formatDateLabel(dateStr)}
              </text>
            )
          })}

          {/* Lines and data points for each account */}
          {accounts.map((account, accountIndex) => {
            const color = ACCOUNT_COLORS[accountIndex % ACCOUNT_COLORS.length]
            const path = generateLinePath(account)

            return (
              <g key={account.accountId}>
                {path && (
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth="2.5"
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {/* Data points */}
                {sortedDates.map((dateStr, dateIndex) => {
                  const balance = getBalanceAtDate(account, dateStr)
                  if (balance === null) return null
                  const cx = xScale(dateIndex)
                  const cy = yScale(balance)
                  const isHovered =
                    hoveredPoint?.accountId === account.accountId &&
                    hoveredPoint?.date === dateStr
                  return (
                    <circle
                      key={`${account.accountId}-${dateStr}`}
                      cx={cx}
                      cy={cy}
                      r={isHovered ? 6 : 4}
                      fill={color}
                      stroke="white"
                      strokeWidth="2"
                      className="cursor-pointer transition-all"
                      onMouseEnter={() =>
                        setHoveredPoint({
                          accountId: account.accountId,
                          date: dateStr,
                          balance,
                          x: cx,
                          y: cy,
                        })
                      }
                    />
                  )
                })}
              </g>
            )
          })}

          {/* Tooltip */}
          {hoveredPoint && (
            <g>
              <rect
                x={hoveredPoint.x - 60}
                y={hoveredPoint.y - 40}
                width={120}
                height={28}
                rx={4}
                fill="#1f2937"
                opacity={0.9}
              />
              <text
                x={hoveredPoint.x}
                y={hoveredPoint.y - 22}
                textAnchor="middle"
                className="text-xs fill-white font-medium"
              >
                ${hoveredPoint.balance.toFixed(2)} - {formatDateLabel(hoveredPoint.date)}
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap gap-4 justify-center">
        {accounts.map((account, index) => {
          const color = ACCOUNT_COLORS[index % ACCOUNT_COLORS.length]
          return (
            <div key={account.accountId} className="flex items-center gap-2">
              <div
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: color }}
              />
              <span className="text-sm text-gray-700">
                {account.vendorName} - {account.accountLabel}
              </span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
