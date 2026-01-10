'use client'

import { Bill } from '@/types'
import BillStatusBadge from './BillStatusBadge'
import { format } from 'date-fns'
import { X, Edit, DollarSign, Calendar, Tag, Building2, CreditCard, MessageSquare, Paperclip } from 'lucide-react'
import Link from 'next/link'

interface BillViewModalProps {
  bill: Bill
  isOpen: boolean
  onClose: () => void
}

export default function BillViewModal({ bill, isOpen, onClose }: BillViewModalProps) {
  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full my-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{bill.title}</h2>
            <div className="flex items-center gap-3">
              <BillStatusBadge status={bill.status} />
              {bill.createdBy && (
                <span className="text-sm text-gray-500">
                  Created by {bill.createdBy.name}
                </span>
              )}
              {!bill.createdById && (
                <span className="text-sm text-gray-500 italic">
                  Unassigned bill
                </span>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition-colors"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center text-gray-700">
              <DollarSign className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Amount</div>
                <div className="font-semibold text-lg">${Number(bill.amount).toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center text-gray-700">
              <Calendar className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Due Date</div>
                <div className="font-semibold">{format(new Date(bill.dueDate), 'MMM d, yyyy')}</div>
              </div>
            </div>

            {bill.paidDate && (
              <div className="flex items-center text-gray-700">
                <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Paid Date</div>
                  <div className="font-semibold">{format(new Date(bill.paidDate), 'MMM d, yyyy')}</div>
                </div>
              </div>
            )}

            {bill.category && (
              <div className="flex items-center text-gray-700">
                <Tag className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Category</div>
                  <div className="font-semibold">{bill.category.name}</div>
                </div>
              </div>
            )}
          </div>

          {bill.vendor && (
            <div className="flex items-center text-gray-700">
              <Building2 className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Vendor</div>
                <div className="font-semibold">{bill.vendor.name}</div>
              </div>
            </div>
          )}

          {bill.vendorAccount && (
            <div className="flex items-center text-gray-700">
              <CreditCard className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Account</div>
                <div className="font-semibold">
                  {bill.vendorAccount.nickname || bill.vendorAccount.accountType || 'Account'}
                  {bill.vendorAccount.last4 && ` (****${bill.vendorAccount.last4})`}
                </div>
              </div>
            </div>
          )}

          {bill.description && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-2">Description</div>
              <p className="text-gray-700 whitespace-pre-wrap">{bill.description}</p>
            </div>
          )}

          {bill.isRecurring && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-900">Recurring Bill</div>
              {bill.nextDueDate && (
                <div className="text-sm text-blue-700 mt-1">
                  Next due: {format(new Date(bill.nextDueDate), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          )}

          {bill._count && (
            <div className="flex items-center gap-6 pt-4 border-t border-gray-200">
              {bill._count.comments > 0 && (
                <div className="flex items-center text-gray-600">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  <span className="text-sm">{bill._count.comments} comment{bill._count.comments !== 1 ? 's' : ''}</span>
                </div>
              )}
              {bill._count.attachments > 0 && (
                <div className="flex items-center text-gray-600">
                  <Paperclip className="w-4 h-4 mr-2" />
                  <span className="text-sm">{bill._count.attachments} attachment{bill._count.attachments !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
          <Link
            href={`/bills/${bill.id}`}
            className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Edit className="w-5 h-5 mr-2" />
            Edit Bill
          </Link>
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
