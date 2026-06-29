import { LucideIcon } from 'lucide-react'
import PriorityPieChart from './PriorityPieChart'

interface CategoryData {
  [key: string]: number
}

interface StatsCardProps {
  title: string
  value?: number | string
  icon?: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  subtitle?: string
  categoryData?: CategoryData
  pieSize?: number
}

const colorClasses = {
  blue: 'bg-blue-50 text-blue-600',
  green: 'bg-green-50 text-green-600',
  yellow: 'bg-amber-50 text-amber-600',
  red: 'bg-red-50 text-red-600',
  purple: 'bg-purple-50 text-purple-600',
  gray: 'bg-gray-100 text-gray-600',
}

export default function StatsCard({
  title,
  value,
  icon: Icon,
  color = 'blue',
  subtitle,
  categoryData,
  pieSize = 140
}: StatsCardProps) {
  // Check if categoryData has any items
  const hasData = categoryData &&
    Object.values(categoryData).some(count => count && count > 0)

  // If categoryData is provided and has data, show pie chart layout
  if (categoryData && hasData) {
    return (
      <div className="card flex flex-col items-center justify-center">
        <h3 className="text-sm font-medium text-gray-600 mb-4">{title}</h3>
        <PriorityPieChart
          data={categoryData}
          size={pieSize}
        />
      </div>
    )
  }

  // Otherwise show traditional icon layout
  return (
    <div className="card">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon size={24} />
          </div>
        )}
      </div>
    </div>
  )
}

