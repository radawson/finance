import { TicketPriority } from '@/types'

interface PriorityBadgeProps {
  priority: TicketPriority
  size?: 'sm' | 'md' | 'lg'
}

const priorityConfig = {
  LOW: {
    label: 'Low',
    className: 'bg-gray-100 text-gray-700 border-gray-200',
  },
  MEDIUM: {
    label: 'Medium',
    className: 'bg-blue-100 text-blue-700 border-blue-200',
  },
  HIGH: {
    label: 'High',
    className: 'bg-orange-100 text-orange-700 border-orange-200',
  },
  CRITICAL: {
    label: 'Critical',
    className: 'bg-red-100 text-red-700 border-red-200',
  },
}

export default function PriorityBadge({ priority, size = 'md' }: PriorityBadgeProps) {
  const config = priorityConfig[priority]
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs',
    md: 'px-2.5 py-1 text-sm',
    lg: 'px-3 py-1.5 text-base',
  }

  return (
    <span
      className={`inline-flex items-center font-medium rounded-full border ${config.className} ${sizeClasses[size]}`}
    >
      {config.label}
    </span>
  )
}

