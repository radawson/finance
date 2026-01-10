import { Bill } from '@/types'
import BillStatusBadge from './BillStatusBadge'
import { format } from 'date-fns'
import { DollarSign, Calendar, Tag } from 'lucide-react'

interface BillCardProps {
  bill: Bill
  onClick?: () => void
}

export default function BillCard({ bill, onClick }: BillCardProps) {
  return (
    <div 
      onClick={onClick}
      className="bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer"
    >
        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{bill.title}</h3>
          <BillStatusBadge status={bill.status} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-gray-600">
            <DollarSign className="w-4 h-4 mr-2" />
            <span className="font-medium">${Number(bill.amount).toFixed(2)}</span>
          </div>

          <div className="flex items-center text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>Due: {format(new Date(bill.dueDate), 'MMM d, yyyy')}</span>
          </div>

          {bill.category && (
            <div className="flex items-center text-gray-600">
              <Tag className="w-4 h-4 mr-2" />
              <span>{bill.category.name}</span>
            </div>
          )}

          {bill.vendor && (
            <div className="text-sm text-gray-500">
              Vendor: {bill.vendor.name}
            </div>
          )}

          {bill.invoiceNumber && (
            <div className="text-sm text-gray-500">
              Invoice: {bill.invoiceNumber}
            </div>
          )}

          {bill.description && (
            <p className="text-sm text-gray-500 mt-2 line-clamp-2">
              {bill.description}
            </p>
          )}

          {bill._count && (
            <div className="flex items-center gap-4 mt-3 text-xs text-gray-500">
              {bill._count.comments > 0 && (
                <span>{bill._count.comments} comment{bill._count.comments !== 1 ? 's' : ''}</span>
              )}
              {bill._count.attachments > 0 && (
                <span>{bill._count.attachments} attachment{bill._count.attachments !== 1 ? 's' : ''}</span>
              )}
            </div>
          )}
        </div>
      </div>
  )
}
