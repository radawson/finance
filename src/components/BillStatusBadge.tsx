import { BillStatus } from '@/generated/prisma/client'

interface BillStatusBadgeProps {
  status: BillStatus
}

export default function BillStatusBadge({ status }: BillStatusBadgeProps) {
  const statusConfig = {
    PENDING: {
      label: 'Pending',
      className: 'bg-gray-100 text-gray-800',
    },
    DUE_SOON: {
      label: 'Due Soon',
      className: 'bg-yellow-100 text-yellow-800',
    },
    OVERDUE: {
      label: 'Overdue',
      className: 'bg-red-100 text-red-800',
    },
    PAID: {
      label: 'Paid',
      className: 'bg-green-100 text-green-800',
    },
    SKIPPED: {
      label: 'Skipped',
      className: 'bg-gray-100 text-gray-600',
    },
  }

  const config = statusConfig[status] || statusConfig.PENDING

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${config.className}`}>
      {config.label}
    </span>
  )
}
