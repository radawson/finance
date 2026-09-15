'use client'

import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import EobForm from '@/components/EobForm'
import { Eob } from '@/types'
import { ArrowLeft } from 'lucide-react'
import toast from 'react-hot-toast'

export default function EobDetailPage() {
  const { data: session } = useSession()
  const params = useParams()
  const router = useRouter()
  const eobId = params.id as string
  const [eob, setEob] = useState<Eob | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    if (!session || !eobId) return
    const load = async () => {
      try {
        const res = await fetch(`/api/eobs/${eobId}`)
        if (res.ok) setEob(await res.json())
        else toast.error('Failed to load EOB')
      } catch {
        toast.error('Failed to load EOB')
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [session, eobId])

  const handleDelete = async () => {
    if (!eob) return
    if (!confirm('Delete this EOB? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/eobs/${eob.id}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to delete EOB')
        return
      }
      toast.success('EOB deleted')
      router.push('/eobs')
    } catch {
      toast.error('Failed to delete EOB')
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-600">Please log in to view this EOB</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="app-page-container">
        <div className="flex items-center justify-between mb-6">
          <Link href="/eobs" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft className="w-4 h-4 mr-1" />
            Back to EOBs
          </Link>
          {eob && (
            <button
              type="button"
              onClick={handleDelete}
              className="text-sm text-red-600 hover:text-red-800"
            >
              Delete EOB
            </button>
          )}
        </div>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Edit EOB</h1>
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : eob ? (
          <EobForm eob={eob} onSaved={setEob} onCancel={() => router.push('/eobs')} />
        ) : (
          <p className="text-gray-600">EOB not found.</p>
        )}
      </main>
    </div>
  )
}
