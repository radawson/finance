'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import { Eob } from '@/types'
import { Plus, FileText } from 'lucide-react'
import toast from 'react-hot-toast'
import { formatCalendarDate } from '@/lib/date-utils'

export default function EobsPage() {
  const { data: session } = useSession()
  const [eobs, setEobs] = useState<Eob[]>([])
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (session) fetchEobs()
  }, [session])

  const fetchEobs = async () => {
    try {
      const res = await fetch('/api/eobs')
      if (res.ok) setEobs(await res.json())
      else toast.error('Failed to load EOBs')
    } catch {
      toast.error('Failed to load EOBs')
    } finally {
      setIsLoading(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-600">Please log in to view EOBs</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="app-page-container-wide">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">EOBs</h1>
            <p className="mt-2 text-gray-600">
              Insurance explanations of benefits, kept separate from bills
            </p>
          </div>
          <Link
            href="/eobs/new"
            className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            <Plus className="w-5 h-5 mr-2" />
            Add EOB
          </Link>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : eobs.length === 0 ? (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <FileText className="w-10 h-10 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-600 mb-4">No EOBs yet.</p>
            <Link
              href="/eobs/new"
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Plus className="w-5 h-5 mr-2" />
              Add your first EOB
            </Link>
          </div>
        ) : (
          <div className="bg-white rounded-lg shadow-md overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Provider</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Payer</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Billed</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Insurance</th>
                    <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Patient</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tags</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {eobs.map((eob) => (
                    <tr key={eob.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <Link href={`/eobs/${eob.id}`} className="text-primary-700 hover:underline">
                          {formatCalendarDate(eob.eobDate)}
                        </Link>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">{eob.providerName}</td>
                      <td className="px-6 py-4 text-sm text-gray-900">{eob.payerName}</td>
                      <td className="px-6 py-4 text-sm text-right">${Number(eob.billedAmount).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right">${Number(eob.insurancePaid).toFixed(2)}</td>
                      <td className="px-6 py-4 text-sm text-right font-semibold">
                        ${Number(eob.patientResponsibility).toFixed(2)}
                      </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="flex flex-wrap gap-1">
                          {eob.isTaxItem !== false && (
                            <span className="inline-flex items-center text-xs font-medium text-amber-800 bg-amber-100 rounded-full px-2 py-0.5">
                              Tax
                            </span>
                          )}
                          {(eob.tags || []).map((tag) => (
                            <span
                              key={tag}
                              className="inline-flex items-center text-xs text-gray-600 bg-gray-100 rounded-full px-2 py-0.5"
                            >
                              {tag}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
