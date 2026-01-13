'use client'

import { useEffect, useState } from 'react'
import { Bill } from '@/types'
import BillStatusBadge from './BillStatusBadge'
import { format } from 'date-fns'
import { X, Edit, DollarSign, Calendar, Tag, Building2, CreditCard, MessageSquare, Paperclip, FileText, CheckCircle } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import TagDisplay from './TagDisplay'

interface BillViewModalProps {
  bill: Bill
  isOpen: boolean
  onClose: () => void
  onUpdate?: (updatedBill: Bill) => void
}

export default function BillViewModal({ bill, isOpen, onClose, onUpdate }: BillViewModalProps) {
  const [isMarkingPaid, setIsMarkingPaid] = useState(false)
  const [currentBill, setCurrentBill] = useState<Bill>(bill)

  // Update currentBill when bill prop changes
  useEffect(() => {
    setCurrentBill(bill)
  }, [bill])

  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEsc)
    return () => document.removeEventListener('keydown', handleEsc)
  }, [isOpen, onClose])

  const handleMarkAsPaid = async () => {
    if (currentBill.status === 'PAID') return

    setIsMarkingPaid(true)
    try {
      const today = new Date().toISOString().split('T')[0] // YYYY-MM-DD format
      
      const response = await fetch(`/api/bills/${currentBill.id}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          status: 'PAID',
          paidDate: today,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        toast.error(data.error || 'Failed to mark bill as paid')
        return
      }

      const updatedBill = await response.json()
      setCurrentBill(updatedBill)
      
      if (onUpdate) {
        onUpdate(updatedBill)
      }

      toast.success('Bill marked as paid')
    } catch (error) {
      console.error('Error marking bill as paid:', error)
      toast.error('Failed to mark bill as paid')
    } finally {
      setIsMarkingPaid(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 overflow-y-auto">
      <div className="bg-white rounded-lg shadow-xl p-6 max-w-2xl w-full my-8">
        <div className="flex items-start justify-between mb-6">
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">{currentBill.title}</h2>
            <div className="flex items-center gap-3">
              <BillStatusBadge status={currentBill.status} />
              {currentBill.createdBy && (
                <span className="text-sm text-gray-500">
                  Created by {currentBill.createdBy.name}
                </span>
              )}
              {!currentBill.createdById && (
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
                <div className="font-semibold text-lg">${Number(currentBill.amount).toFixed(2)}</div>
              </div>
            </div>

            <div className="flex items-center text-gray-700">
              <Calendar className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Due Date</div>
                <div className="font-semibold">{format(new Date(currentBill.dueDate), 'MMM d, yyyy')}</div>
              </div>
            </div>

            {currentBill.paidDate && (
              <div className="flex items-center text-gray-700">
                <Calendar className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Paid Date</div>
                  <div className="font-semibold">{format(new Date(currentBill.paidDate), 'MMM d, yyyy')}</div>
                </div>
              </div>
            )}

            {currentBill.category && (
              <div className="flex items-center text-gray-700">
                <Tag className="w-5 h-5 mr-3 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Category</div>
                  <div className="font-semibold">{currentBill.category.name}</div>
                </div>
              </div>
            )}
          </div>

          {currentBill.vendor && (
            <div className="flex items-center text-gray-700">
              <Building2 className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Vendor</div>
                <div className="font-semibold">{currentBill.vendor.name}</div>
              </div>
            </div>
          )}

          {currentBill.vendorAccount && (
            <div className="flex items-center text-gray-700">
              <CreditCard className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Account</div>
                <div className="font-semibold">
                  {currentBill.vendorAccount.nickname || currentBill.vendorAccount.type?.name || currentBill.vendorAccount.accountType || 'Account'}
                  {currentBill.vendorAccount.accountNumber && currentBill.vendorAccount.accountNumber.length >= 4 && ` (****${currentBill.vendorAccount.accountNumber.slice(-4)})`}
                </div>
              </div>
            </div>
          )}

          {currentBill.invoiceNumber && (
            <div className="flex items-center text-gray-700">
              <FileText className="w-5 h-5 mr-3 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Invoice Number</div>
                <div className="font-semibold">{currentBill.invoiceNumber}</div>
              </div>
            </div>
          )}

          {currentBill.tags && currentBill.tags.length > 0 && (
            <div className="flex items-start text-gray-700">
              <Tag className="w-5 h-5 mr-3 text-gray-400 mt-1" />
              <div className="flex-1">
                <div className="text-sm text-gray-500 mb-2">Tags</div>
                <TagDisplay tags={currentBill.tags} />
              </div>
            </div>
          )}

          {currentBill.description && (
            <div>
              <div className="text-sm font-medium text-gray-500 mb-2">Description</div>
              <p className="text-gray-700 whitespace-pre-wrap">{currentBill.description}</p>
            </div>
          )}

          {currentBill.isRecurring && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
              <div className="text-sm font-medium text-blue-900">Recurring Bill</div>
              {currentBill.nextDueDate && (
                <div className="text-sm text-blue-700 mt-1">
                  Next due: {format(new Date(currentBill.nextDueDate), 'MMM d, yyyy')}
                </div>
              )}
            </div>
          )}

          {currentBill._count && (
            <div className="flex items-center gap-6 pt-4 border-t border-gray-200">
              {currentBill._count.comments > 0 && (
                <div className="flex items-center text-gray-600">
                  <MessageSquare className="w-4 h-4 mr-2" />
                  <span className="text-sm">{currentBill._count.comments} comment{currentBill._count.comments !== 1 ? 's' : ''}</span>
                </div>
              )}
              {currentBill._count.attachments > 0 && (
                <div className="flex items-center text-gray-600">
                  <Paperclip className="w-4 h-4 mr-2" />
                  <span className="text-sm">{currentBill._count.attachments} attachment{currentBill._count.attachments !== 1 ? 's' : ''}</span>
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex gap-4 mt-6 pt-6 border-t border-gray-200">
          {currentBill.status !== 'PAID' && (
            <button
              onClick={handleMarkAsPaid}
              disabled={isMarkingPaid}
              className="flex-1 inline-flex items-center justify-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle className="w-5 h-5 mr-2" />
              {isMarkingPaid ? 'Marking as Paid...' : 'Mark as Paid'}
            </button>
          )}
          <Link
            href={`/bills/${currentBill.id}`}
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
