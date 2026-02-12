'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import { useParams, useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import BillStatusBadge from '@/components/BillStatusBadge'
import BillEditForm, { BillFormData, RecurrenceFormData } from '@/components/BillEditForm'
import { Bill } from '@/types'
import { ArrowLeft, Eye } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'
import { useSocket } from '@/components/SocketProvider'
import { SocketEvents } from '@/lib/socketio-server'

export default function BillDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const billId = params.id as string

  const [bill, setBill] = useState<Bill | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)

  const { socket, isConnected } = useSocket()

  useEffect(() => {
    if (session && billId) {
      fetchBill()
    }
  }, [session, billId])

  // WebSocket: Join bill room and listen for updates
  useEffect(() => {
    if (!socket || !isConnected || !billId) return

    // Join bill room
    socket.emit('join', `bill:${billId}`)

    // Listen for bill updates (silent UI update)
    const handleBillUpdated = (data: { bill: Bill; changedBy: { id: string; name: string } }) => {
      // Only update if changed by someone else (not the current user)
      if (data.changedBy.id !== session?.user?.id) {
        setBill(data.bill)
      }
    }

    socket.on(SocketEvents.BILL_UPDATED, handleBillUpdated)

    return () => {
      socket.emit('leave', `bill:${billId}`)
      socket.off(SocketEvents.BILL_UPDATED, handleBillUpdated)
    }
  }, [socket, isConnected, billId, session?.user?.id])


  const fetchBill = async () => {
    try {
      const response = await fetch(`/api/bills/${billId}`)
      if (response.ok) {
        const data = await response.json()
        setBill(data)
      } else if (response.status === 403) {
        toast.error('You do not have permission to view this bill')
        router.push('/dashboard')
      } else if (response.status === 404) {
        toast.error('Bill not found')
        router.push('/dashboard')
      } else {
        toast.error('Failed to load bill')
        router.push('/dashboard')
      }
    } catch (error) {
      toast.error('Failed to load bill')
      router.push('/dashboard')
    } finally {
      setIsLoading(false)
    }
  }

  const handleSave = async (formData: BillFormData, recurrenceData?: RecurrenceFormData) => {
    setIsSaving(true)

    try {
      // First, update the bill
      const response = await fetch(`/api/bills/${billId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          amount: parseFloat(formData.amount),
          dueDate: new Date(formData.dueDate).toISOString(),
          categoryId: formData.categoryId,
          vendorId: formData.vendorId || null,
          vendorAccountId: formData.vendorAccountId || null,
          description: formData.description || null,
          status: formData.status,
          paidDate: formData.paidDate ? new Date(formData.paidDate).toISOString() : null,
          invoiceNumber: formData.invoiceNumber || null,
          isRecurring: !!recurrenceData,
          ...(formData.accountBalance ? { accountBalance: parseFloat(formData.accountBalance) } : {}),
        }),
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('You do not have permission to edit this bill')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Failed to update bill')
        }
        setIsSaving(false)
        return
      }

      // Get the updated bill to check for recurrence pattern
      const updatedBillData = await response.json()
      // Check if recurrencePattern object actually exists, not just the ID (handles orphaned references)
      const hasExistingRecurrence = updatedBillData?.recurrencePattern !== null && updatedBillData?.recurrencePattern !== undefined

      if (recurrenceData) {
        // Create or update recurrence pattern
        if (hasExistingRecurrence) {
          // Update existing recurrence pattern
          const recurrenceResponse = await fetch(`/api/bills/${billId}/recurrence`, {
            method: 'PATCH',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              frequency: recurrenceData.frequency,
              dayOfMonth: recurrenceData.dayOfMonth,
              startDate: recurrenceData.startDate,
              endDate: recurrenceData.endDate || null,
            }),
          })

          if (!recurrenceResponse.ok) {
            const errorData = await recurrenceResponse.json()
            toast.error(errorData.error || 'Failed to update recurrence pattern')
            setIsSaving(false)
            return
          }
        } else {
          // Create new recurrence pattern
          const recurrenceResponse = await fetch(`/api/bills/${billId}/recurrence`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              frequency: recurrenceData.frequency,
              dayOfMonth: recurrenceData.dayOfMonth,
              startDate: recurrenceData.startDate,
              endDate: recurrenceData.endDate || null,
            }),
          })

          if (!recurrenceResponse.ok) {
            const errorData = await recurrenceResponse.json()
            toast.error(errorData.error || 'Failed to create recurrence pattern')
            setIsSaving(false)
            return
          }
        }
      } else if (hasExistingRecurrence) {
        // Delete recurrence pattern if unchecked
        const deleteResponse = await fetch(`/api/bills/${billId}/recurrence`, {
          method: 'DELETE',
        })

        if (!deleteResponse.ok) {
          toast.error('Failed to remove recurrence pattern')
          setIsSaving(false)
          return
        }
      }

      toast.success('Bill updated successfully')
      // Refresh bill data
      await fetchBill()
    } catch (error) {
      toast.error('Failed to update bill')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!bill) return

    try {
      const response = await fetch(`/api/bills/${billId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        if (response.status === 403) {
          toast.error('You do not have permission to delete this bill')
        } else {
          const data = await response.json()
          toast.error(data.error || 'Failed to delete bill')
        }
        return
      }

      toast.success('Bill deleted successfully')
      router.push('/dashboard')
    } catch (error) {
      toast.error('Failed to delete bill')
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to view bill details</p>
            <Link href="/login" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
              Login
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
            <p className="mt-4 text-gray-600">Loading bill...</p>
          </div>
        </div>
      </div>
    )
  }

  if (!bill) {
    return null
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <Link
          href="/dashboard"
          className="inline-flex items-center text-gray-600 hover:text-gray-900 mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Dashboard
        </Link>

        {/* Predicted Bill Banner */}
        {bill.status === 'PREDICTED' && (
          <div className="bg-purple-50 border-2 border-dashed border-purple-300 rounded-lg p-4 mb-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Eye className="w-5 h-5 text-purple-600" />
                <div>
                  <p className="font-medium text-purple-900">This is a predicted bill</p>
                  <p className="text-sm text-purple-700">
                    Review and update the details below when the actual bill arrives, then confirm it.
                    {bill.predictionConfidence != null && (
                      <span className="ml-1">
                        Confidence: {Math.round(Number(bill.predictionConfidence) * 100)}%
                        {bill.predictionMethod && ` (${bill.predictionMethod})`}
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={async () => {
                  setIsSaving(true)
                  try {
                    const response = await fetch(`/api/bills/${billId}`, {
                      method: 'PATCH',
                      headers: { 'Content-Type': 'application/json' },
                      body: JSON.stringify({ status: 'PENDING' }),
                    })
                    if (response.ok) {
                      toast.success('Bill confirmed')
                      await fetchBill()
                    } else {
                      toast.error('Failed to confirm bill')
                    }
                  } catch {
                    toast.error('Failed to confirm bill')
                  } finally {
                    setIsSaving(false)
                  }
                }}
                disabled={isSaving}
                className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium text-sm whitespace-nowrap disabled:opacity-50"
              >
                Confirm Bill
              </button>
            </div>
          </div>
        )}

        {/* Bill Header */}
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <div className="flex items-start justify-between mb-4">
            <div className="flex-1">
              <h1 className="text-3xl font-bold text-gray-900 mb-2">{bill.title}</h1>
              <div className="flex items-center gap-4">
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
          </div>
        </div>

        {/* Edit Form */}
        <BillEditForm
          bill={bill}
          onSave={handleSave}
          onCancel={() => router.push('/dashboard')}
          onDelete={handleDelete}
          isSaving={isSaving}
          isPredicted={bill.status === 'PREDICTED'}
        />
      </main>
    </div>
  )
}
