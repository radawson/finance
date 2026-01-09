'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Ticket, LogIn, Send, Search } from 'lucide-react'
import toast from 'react-hot-toast'

export default function Home() {
  const router = useRouter()
  const [magicToken, setMagicToken] = useState('')
  const [isChecking, setIsChecking] = useState(false)

  const handleCheckTicket = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!magicToken.trim()) {
      toast.error('Please enter your ticket access code')
      return
    }

    setIsChecking(true)
    // Navigate to the ticket view page with the token
    router.push(`/tickets/view/${magicToken.trim()}`)
  }

  return (
    <div className="min-h-screen bg-linear-to-br from-primary-50 to-primary-100">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <div className="flex justify-center mb-6">
            <Image 
              src="/logo.png" 
              alt="Kontado Logo" 
              width={80} 
              height={80}
              className="h-20 w-20"
            />
          </div>
          <h1 className="text-5xl font-bold text-primary-900 mb-4">IT Support Requests</h1>
          <p className="text-xl text-primary-700">
            IT Support Ticket Management System
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 max-w-6xl mx-auto">
          {/* Submit Ticket Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="flex justify-center mb-6">
              <div className="bg-primary-100 rounded-full p-6">
                <Send className="h-12 w-12 text-primary-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Submit a Ticket
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Have an IT issue? Submit a support ticket and our team will help you resolve it.
            </p>
            <Link 
              href="/submit-ticket"
              className="btn btn-primary w-full flex items-center justify-center gap-2"
            >
              <Ticket size={20} />
              Create Ticket
            </Link>
            <p className="text-sm text-gray-500 mt-4 text-center">
              No account required
            </p>
          </div>

          {/* Check Ticket Status Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="flex justify-center mb-6">
              <div className="bg-primary-100 rounded-full p-6">
                <Search className="h-12 w-12 text-primary-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Check Ticket Status
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Enter your ticket access code from the email we sent you to view your ticket status and updates.
            </p>
            <form onSubmit={handleCheckTicket} className="space-y-4">
              <input
                type="text"
                value={magicToken}
                onChange={(e) => setMagicToken(e.target.value)}
                placeholder="Enter your access code"
                className="input w-full text-center font-mono"
                disabled={isChecking}
              />
              <button
                type="submit"
                className="btn btn-secondary w-full flex items-center justify-center gap-2"
                disabled={isChecking}
              >
                <Search size={20} />
                {isChecking ? 'Checking...' : 'View Ticket'}
              </button>
            </form>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Check your email for the access code
            </p>
          </div>

          {/* Sign In Card */}
          <div className="bg-white rounded-lg shadow-lg p-8 hover:shadow-xl transition-shadow">
            <div className="flex justify-center mb-6">
              <div className="bg-primary-100 rounded-full p-6">
                <LogIn className="h-12 w-12 text-primary-600" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-4 text-center">
              Sign In
            </h2>
            <p className="text-gray-600 mb-6 text-center">
              Already have an account? Sign in to track your tickets and view your dashboard.
            </p>
            <Link 
              href="/login"
              className="btn btn-secondary w-full flex items-center justify-center gap-2"
            >
              <LogIn size={20} />
              Sign In
            </Link>
            <p className="text-sm text-gray-500 mt-4 text-center">
              Or <Link href="/register" className="text-primary-600 hover:text-primary-700 font-medium">create an account</Link>
            </p>
          </div>
        </div>

        <div className="mt-16 text-center">
          <h3 className="text-xl font-semibold text-primary-900 mb-6">
            How It Works
          </h3>
          <div className="grid md:grid-cols-3 gap-8 max-w-4xl mx-auto">
            <div>
              <div className="bg-primary-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                1
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Submit Your Issue</h4>
              <p className="text-gray-600 text-sm">
                Describe your IT problem and provide relevant details
              </p>
            </div>
            <div>
              <div className="bg-primary-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                2
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">We Review & Respond</h4>
              <p className="text-gray-600 text-sm">
                Our IT team will review and respond to your ticket
              </p>
            </div>
            <div>
              <div className="bg-primary-600 text-white rounded-full w-12 h-12 flex items-center justify-center mx-auto mb-4 text-xl font-bold">
                3
              </div>
              <h4 className="font-semibold text-gray-900 mb-2">Issue Resolved</h4>
              <p className="text-gray-600 text-sm">
                Track progress and get your issue resolved quickly
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

