import { LucideIcon } from 'lucide-react'
import PriorityPieChart from './PriorityPieChart'

interface PriorityData {
  LOW?: number
  MEDIUM?: number
  HIGH?: number
  CRITICAL?: number
}

interface StatsCardProps {
  title: string
  value?: number | string
  icon?: LucideIcon
  color?: 'blue' | 'green' | 'yellow' | 'red' | 'purple' | 'gray'
  subtitle?: string
  priorityData?: PriorityData
  pieSize?: number
}

const colorClasses = {
  blue: 'bg-blue-500',
  green: 'bg-green-500',
  yellow: 'bg-yellow-500',
  red: 'bg-red-500',
  purple: 'bg-purple-500',
  gray: 'bg-gray-500',
}

export default function StatsCard({ 
  title, 
  value, 
  icon: Icon, 
  color = 'blue', 
  subtitle,
  priorityData,
  pieSize = 140
}: StatsCardProps) {
  // Check if priorityData has any tickets
  const hasData = priorityData && 
    Object.values(priorityData).some(count => count && count > 0)

  // If priorityData is provided and has data, show pie chart layout
  if (priorityData && hasData) {
    return (
      <div className="card flex flex-col items-center justify-center">
        <h3 className="text-sm font-medium text-gray-600 mb-4">{title}</h3>
        <PriorityPieChart 
          data={priorityData}
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
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-3xl font-bold text-gray-900 mt-2">{value}</p>
          {subtitle && <p className="text-xs text-gray-500 mt-1">{subtitle}</p>}
        </div>
        {Icon && (
          <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
            <Icon className="text-white" size={24} />
          </div>
        )}
      </div>
    </div>
  )
}

