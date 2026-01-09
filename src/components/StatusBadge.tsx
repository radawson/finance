import { TicketStatus } from '@/types'

interface StatusBadgeProps {
  status: TicketStatus
  size?: 'sm' | 'md' | 'lg'
}

const statusConfig = {
  OPEN: {
    label: 'Open',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
  },
  IN_PROGRESS: {
    label: 'In Progress',
    className: 'bg-purple-100 text-purple-800 border-purple-200',
  },
  WAITING: {
    label: 'Waiting',
    className: 'bg-yellow-100 text-yellow-800 border-yellow-200',
  },
  RESOLVED: {
    label: 'Resolved',
    className: 'bg-green-100 text-green-800 border-green-200',
  },
  CLOSED: {
    label: 'Closed',
    className: 'bg-gray-100 text-gray-800 border-gray-200',
  },
}

export default function StatusBadge({ status, size = 'md' }: StatusBadgeProps) {
  const config = statusConfig[status]
  
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

