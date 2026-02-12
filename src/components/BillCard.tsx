import { Bill } from '@/types'
import BillStatusBadge from './BillStatusBadge'
import { format, isBefore } from 'date-fns'
import { DollarSign, Calendar, Tag, AlertTriangle } from 'lucide-react'

interface BillCardProps {
  bill: Bill
  onClick?: () => void
}

/**
 * Get a human-readable label for a confidence score
 */
function getConfidenceLabel(confidence: number): { label: string; color: string } {
  if (confidence >= 0.8) return { label: 'High', color: 'text-green-600' }
  if (confidence >= 0.6) return { label: 'Medium', color: 'text-yellow-600' }
  return { label: 'Low', color: 'text-orange-600' }
}

export default function BillCard({ bill, onClick }: BillCardProps) {
  const isPredicted = bill.status === 'PREDICTED'
  const now = new Date()
  now.setHours(0, 0, 0, 0)
  const isMissing = isPredicted && isBefore(new Date(bill.dueDate), now)

  return (
    <div 
      onClick={onClick}
      className={`bg-white rounded-lg shadow-md p-6 hover:shadow-lg transition-shadow cursor-pointer ${
        isPredicted ? 'border-2 border-dashed border-purple-300' : ''
      } ${isMissing ? 'border-2 border-dashed border-red-400 bg-red-50' : ''}`}
    >
        {/* Missing bill warning */}
        {isMissing && (
          <div className="flex items-center gap-2 text-red-600 text-sm font-medium mb-3 bg-red-100 rounded-md px-3 py-1.5">
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span>Missing — expected by {format(new Date(bill.dueDate), 'MMM d')}</span>
          </div>
        )}

        <div className="flex items-start justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">{bill.title}</h3>
          <BillStatusBadge status={bill.status} />
        </div>

        <div className="space-y-2">
          <div className="flex items-center text-gray-600">
            <DollarSign className="w-4 h-4 mr-2" />
            <span className="font-medium">
              {isPredicted ? '~' : ''}${Number(bill.amount).toFixed(2)}
            </span>
            {/* Confidence indicator for predicted bills */}
            {isPredicted && bill.predictionConfidence != null && (
              <span className={`ml-2 text-xs ${getConfidenceLabel(Number(bill.predictionConfidence)).color}`}>
                ({getConfidenceLabel(Number(bill.predictionConfidence)).label} confidence)
              </span>
            )}
          </div>

          <div className="flex items-center text-gray-600">
            <Calendar className="w-4 h-4 mr-2" />
            <span>{isPredicted ? 'Expected' : 'Due'}: {format(new Date(bill.dueDate), 'MMM d, yyyy')}</span>
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

          {/* Prediction method badge */}
          {isPredicted && bill.predictionMethod && (
            <div className="text-xs text-purple-600 mt-1">
              Forecast: {bill.predictionMethod}
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
