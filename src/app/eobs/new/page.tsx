'use client'

import { useSession } from 'next-auth/react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Navbar from '@/components/Navbar'
import EobForm from '@/components/EobForm'
import { Eob } from '@/types'
import { ArrowLeft } from 'lucide-react'

export default function NewEobPage() {
  const { data: session } = useSession()
  const router = useRouter()

  const handleSaved = (eob: Eob) => {
    router.push(`/eobs/${eob.id}`)
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-600">Please log in to add an EOB</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="app-page-container">
        <Link href="/eobs" className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6">
          <ArrowLeft className="w-4 h-4 mr-1" />
          Back to EOBs
        </Link>
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Add EOB</h1>
        <EobForm onSaved={handleSaved} onCancel={() => router.push('/eobs')} />
      </main>
    </div>
  )
}
