'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import StatsCard from '@/components/StatsCard'
import BillCard from '@/components/BillCard'
import { Bill, DashboardStats } from '@/types'
import { DollarSign, Clock, CheckCircle, XCircle, AlertCircle, Plus, Calendar } from 'lucide-react'
import Link from 'next/link'
import toast from 'react-hot-toast'

export default function DashboardPage() {
  const { data: session } = useSession()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  const fetchData = async () => {
    try {
      const statsRes = await fetch('/api/stats')

      if (statsRes.ok) {
        const statsData = await statsRes.json()
        setStats(statsData)
      } else {
        toast.error('Failed to load dashboard data')
      }
    } catch (error) {
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session) {
      fetchData()
    }
  }, [session])

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to view your dashboard</p>
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
            <p className="mt-4 text-gray-600">Loading...</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {session?.user?.name || 'Guest'}</h1>
            <p className="text-gray-600 mt-1">Here's an overview of your bills</p>
          </div>
          <Link href="/bills/new" className="btn btn-primary flex items-center gap-2">
            <Plus size={20} />
            New Bill
          </Link>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          <StatsCard
            title="Total Bills"
            value={stats?.totalBills || 0}
            icon={DollarSign}
            color="blue"
          />
          <StatsCard
            title="Due Soon"
            value={stats?.dueSoonBills || 0}
            icon={Clock}
            color="yellow"
          />
          <StatsCard
            title="Overdue"
            value={stats?.overdueBills || 0}
            icon={AlertCircle}
            color="red"
          />
          <StatsCard
            title="Paid"
            value={stats?.paidBills || 0}
            icon={CheckCircle}
            color="green"
          />
        </div>

        {/* Upcoming Bills */}
        {stats?.upcomingBillsList && stats.upcomingBillsList.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Upcoming Bills (Next 7 Days)</h2>
              <Link href="/bills" className="text-primary-600 hover:text-primary-700 font-medium">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.upcomingBillsList.map((bill) => (
                <BillCard key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {/* Overdue Bills */}
        {stats?.overdueBillsList && stats.overdueBillsList.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Overdue Bills</h2>
              <Link href="/bills?status=OVERDUE" className="text-primary-600 hover:text-primary-700 font-medium">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.overdueBillsList.map((bill) => (
                <BillCard key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {/* Category Breakdown */}
        {stats?.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Category Breakdown</h2>
            <div className="bg-white rounded-lg shadow-md p-6">
              <div className="space-y-4">
                {stats.categoryBreakdown.map((category) => (
                  <div key={category.categoryId} className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="w-4 h-4 rounded-full bg-primary-500 mr-3"></div>
                      <span className="font-medium text-gray-900">{category.categoryName}</span>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-900">
                        ${category.totalAmount.toFixed(2)}
                      </div>
                      <div className="text-sm text-gray-500">{category.count} bill{category.count !== 1 ? 's' : ''}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Recent Bills */}
        {stats?.recentBills && stats.recentBills.length > 0 && (
          <div className="mb-8">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-2xl font-bold text-gray-900">Recent Bills</h2>
              <Link href="/bills" className="text-primary-600 hover:text-primary-700 font-medium">
                View all →
              </Link>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {stats.recentBills.map((bill) => (
                <BillCard key={bill.id} bill={bill} />
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {(!stats || stats.totalBills === 0) && (
          <div className="bg-white rounded-lg shadow-md p-12 text-center">
            <DollarSign className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No bills yet</h3>
            <p className="mt-1 text-sm text-gray-500">Get started by creating a new bill.</p>
            <div className="mt-6 flex gap-4 justify-center">
              <Link href="/bills/new" className="inline-flex btn btn-primary">
                <Plus size={20} className="mr-2" />
                New Bill
              </Link>
              <Link href="/enter-bill" className="inline-flex btn btn-secondary">
                Quick Entry
              </Link>
            </div>
          </div>
        )}
      </main>
    </div>
  )
}
