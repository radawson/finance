'use client'

import { useState } from 'react'
import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Navbar from '@/components/Navbar'
import BillEditForm, { BillFormData, RecurrenceFormData } from '@/components/BillEditForm'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function NewBillPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const [isSaving, setIsSaving] = useState(false)

  const handleSave = async (formData: BillFormData, recurrenceData?: RecurrenceFormData) => {
    setIsSaving(true)

    try {
      // Validate amount before sending
      const amount = parseFloat(formData.amount)
      if (isNaN(amount) || amount <= 0) {
        toast.error('Please enter a valid amount')
        setIsSaving(false)
        return
      }

      // Create the bill
      const response = await fetch('/api/bills', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          title: formData.title,
          amount: amount,
          dueDate: new Date(formData.dueDate).toISOString(),
          categoryId: formData.categoryId,
          vendorId: formData.vendorId || undefined,
          vendorAccountId: formData.vendorAccountId || undefined,
          description: formData.description || undefined,
          status: formData.status,
          paidDate: formData.paidDate ? new Date(formData.paidDate).toISOString() : undefined,
          invoiceNumber: formData.invoiceNumber || undefined,
          isRecurring: !!recurrenceData,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        const errorMessage = data.details && data.details.length > 0
          ? `${data.error || 'Validation error'}: ${data.details.map((d: any) => `${d.path?.join('.') || 'field'}: ${d.message}`).join(', ')}`
          : data.error || 'Failed to create bill'
        toast.error(errorMessage)
        setIsSaving(false)
        return
      }

      const createdBill = await response.json()

      // Create recurrence pattern if enabled
      if (recurrenceData) {
        try {
          const recurrenceResponse = await fetch(`/api/bills/${createdBill.id}/recurrence`, {
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
            toast.error(errorData.error || 'Bill created but failed to set recurrence pattern')
          }
        } catch (error) {
          toast.error('Bill created but failed to set recurrence pattern')
        }
      }

      toast.success('Bill created successfully')
      // Redirect to the new bill's detail page
      router.push(`/bills/${createdBill.id}`)
    } catch (error) {
      toast.error('Failed to create bill')
      setIsSaving(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to create a bill</p>
            <Link href="/login" className="text-primary-600 hover:text-primary-700 mt-4 inline-block">
              Login
            </Link>
          </div>
        </div>
      </div>
    )
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

        {/* Create Form */}
        <BillEditForm
          bill={null}
          onSave={handleSave}
          onCancel={() => router.push('/dashboard')}
          isSaving={isSaving}
        />
      </main>
    </div>
  )
}
