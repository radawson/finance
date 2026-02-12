'use client'

import { useEffect, useState, useCallback, useMemo, useRef } from 'react'
import { useSession } from 'next-auth/react'
import { Responsive, useContainerWidth } from 'react-grid-layout'
import type { Layout, ResponsiveLayouts } from 'react-grid-layout'
import 'react-grid-layout/css/styles.css'
import 'react-resizable/css/styles.css'
import Navbar from '@/components/Navbar'
import StatsCard from '@/components/StatsCard'
import BillCard from '@/components/BillCard'
import BillViewModal from '@/components/BillViewModal'
import DashboardWidget from '@/components/DashboardWidget'
import { Bill, DashboardStats } from '@/types'
import { DollarSign, Clock, CheckCircle, AlertCircle, Plus, Eye, RotateCcw } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import CategoryPieChart from '@/components/CategoryPieChart'
import CreditCardBalanceGraph from '@/components/CreditCardBalanceGraph'
import { CategoryPeriod } from '@/lib/date-utils'
import {
  WIDGET_IDS,
  BREAKPOINTS,
  COLS,
  DEFAULT_LAYOUTS,
  loadLayouts,
  saveLayouts,
  clearLayouts,
  getFilteredLayouts,
  type DashboardLayouts,
} from '@/lib/dashboard-layout'

export default function DashboardPage() {
  const { data: session } = useSession()
  const router = useRouter()
  const [stats, setStats] = useState<DashboardStats | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [selectedBill, setSelectedBill] = useState<Bill | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [categoryPeriod, setCategoryPeriod] = useState<CategoryPeriod>('month')
  const [balancePeriod, setBalancePeriod] = useState('6m')
  const [creditCardData, setCreditCardData] = useState<{ period: string; accounts: any[] } | null>(null)
  const [predictedBills, setPredictedBills] = useState<Bill[]>([])
  const [isPredictedLoading, setIsPredictedLoading] = useState(false)

  // ─── Grid layout state ───────────────────────────────────────────────────
  const { width, containerRef, mounted } = useContainerWidth()
  const userId = session?.user?.id ?? session?.user?.email ?? undefined
  const [savedLayouts, setSavedLayouts] = useState<DashboardLayouts | null>(null)
  const [layoutsLoaded, setLayoutsLoaded] = useState(false)
  const saveTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load layouts from localStorage on mount
  useEffect(() => {
    const loaded = loadLayouts(userId)
    setSavedLayouts(loaded)
    setLayoutsLoaded(true)
  }, [userId])

  // ─── Data fetching ───────────────────────────────────────────────────────

  const fetchData = useCallback(async () => {
    try {
      const params = new URLSearchParams({
        categoryPeriod: categoryPeriod,
      })
      const statsRes = await fetch(`/api/stats?${params}`)

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
  }, [categoryPeriod])

  const fetchCreditCardBalances = useCallback(async () => {
    try {
      const res = await fetch(`/api/analysis/credit-card-balances?period=${balancePeriod}`)
      if (res.ok) {
        const data = await res.json()
        setCreditCardData(data)
      }
    } catch (error) {
      // Silently fail - widget just won't show
    }
  }, [balancePeriod])

  const fetchPredictedBills = useCallback(async () => {
    setIsPredictedLoading(true)
    try {
      const res = await fetch('/api/bills/predicted')
      if (res.ok) {
        const data = await res.json()
        setPredictedBills(data)
      }
    } catch (error) {
      // Silently fail - predicted bills section just won't show
    } finally {
      setIsPredictedLoading(false)
    }
  }, [])

  useEffect(() => {
    if (session) {
      fetchData()
      fetchCreditCardBalances()
      fetchPredictedBills()
    }
  }, [session, fetchData, fetchCreditCardBalances, fetchPredictedBills])

  // ─── Determine visible widgets ───────────────────────────────────────────

  const visibleWidgetIds = useMemo(() => {
    const ids = new Set<string>()

    // Stats are always visible when data is loaded
    if (stats) {
      ids.add(WIDGET_IDS.STATS)
    }

    if (predictedBills.length > 0 || isPredictedLoading) {
      ids.add(WIDGET_IDS.EXPECTED_BILLS)
    }

    if (creditCardData && creditCardData.accounts.length > 0) {
      ids.add(WIDGET_IDS.CREDIT_CARD)
    }

    if (stats?.upcomingBillsList && stats.upcomingBillsList.length > 0) {
      ids.add(WIDGET_IDS.UPCOMING_BILLS)
    }

    if (stats?.overdueBillsList && stats.overdueBillsList.length > 0) {
      ids.add(WIDGET_IDS.OVERDUE_BILLS)
    }

    if (
      (stats?.categoryBreakdown && stats.categoryBreakdown.length > 0) ||
      (stats?.projectedCategoryBreakdown && stats.projectedCategoryBreakdown.length > 0)
    ) {
      ids.add(WIDGET_IDS.CATEGORY_BREAKDOWN)
    }

    if (stats?.recentBills && stats.recentBills.length > 0) {
      ids.add(WIDGET_IDS.RECENT_BILLS)
    }

    return ids
  }, [stats, predictedBills, isPredictedLoading, creditCardData])

  // ─── Compute active layouts ──────────────────────────────────────────────

  const activeLayouts = useMemo(() => {
    if (!layoutsLoaded) return DEFAULT_LAYOUTS
    return getFilteredLayouts(savedLayouts, visibleWidgetIds)
  }, [savedLayouts, visibleWidgetIds, layoutsLoaded])

  // ─── Layout change handler (debounced save) ─────────────────────────────

  const handleLayoutChange = useCallback(
    (_currentLayout: Layout, allLayouts: ResponsiveLayouts) => {
      // Merge with existing saved layouts so breakpoints not currently active aren't lost
      const merged: DashboardLayouts = {
        ...DEFAULT_LAYOUTS,
        ...savedLayouts,
        ...(allLayouts as unknown as DashboardLayouts),
      }
      setSavedLayouts(merged)

      // Debounce save to localStorage
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
      saveTimeoutRef.current = setTimeout(() => {
        saveLayouts(merged, userId)
      }, 500)
    },
    [savedLayouts, userId]
  )

  const handleResetLayout = useCallback(() => {
    clearLayouts(userId)
    setSavedLayouts(null)
    toast.success('Dashboard layout reset to default')
  }, [userId])

  // ─── Cleanup timeout on unmount ──────────────────────────────────────────

  useEffect(() => {
    return () => {
      if (saveTimeoutRef.current) {
        clearTimeout(saveTimeoutRef.current)
      }
    }
  }, [])

  // ─── Render helpers ──────────────────────────────────────────────────────

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

  // ─── Empty state ─────────────────────────────────────────────────────────

  if (!stats || stats.totalBills === 0) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex justify-between items-center mb-8">
            <div>
              <h1 className="text-3xl font-bold text-gray-900">Welcome, {session?.user?.name || 'Guest'}</h1>
              <p className="text-gray-600 mt-1">Here&apos;s an overview of your bills</p>
            </div>
            <Link href="/bills/new" className="btn btn-primary flex items-center gap-2">
              <Plus size={20} />
              New Bill
            </Link>
          </div>
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
        </main>
      </div>
    )
  }

  // ─── Main dashboard with grid layout ─────────────────────────────────────

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-between items-center mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Welcome, {session?.user?.name || 'Guest'}</h1>
            <p className="text-gray-600 mt-1">Here&apos;s an overview of your bills</p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={handleResetLayout}
              className="btn btn-secondary flex items-center gap-2 text-sm"
              title="Reset dashboard layout to default"
            >
              <RotateCcw size={16} />
              Reset Layout
            </button>
            <Link href="/bills/new" className="btn btn-primary flex items-center gap-2">
              <Plus size={20} />
              New Bill
            </Link>
          </div>
        </div>

        <div ref={containerRef}>
          {mounted && (
            <Responsive
              width={width}
              breakpoints={BREAKPOINTS}
              cols={COLS}
              layouts={activeLayouts}
              rowHeight={60}
              margin={[16, 16]}
              containerPadding={[0, 0]}
              onLayoutChange={handleLayoutChange}
              dragConfig={{ handle: '.drag-handle' }}
              resizeConfig={{ enabled: true, handles: ['se'] }}
            >
              {/* Stats Widget */}
              {visibleWidgetIds.has(WIDGET_IDS.STATS) && (
                <DashboardWidget
                  key={WIDGET_IDS.STATS}
                  title="Overview"
                  collapsible={false}
                >
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
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
                      title="Predicted"
                      value={stats?.predictedBills || 0}
                      icon={Eye}
                      color="purple"
                    />
                    <StatsCard
                      title="Paid"
                      value={stats?.paidBills || 0}
                      icon={CheckCircle}
                      color="green"
                    />
                  </div>
                </DashboardWidget>
              )}

              {/* Expected Bills Widget */}
              {visibleWidgetIds.has(WIDGET_IDS.EXPECTED_BILLS) && (
                <DashboardWidget
                  key={WIDGET_IDS.EXPECTED_BILLS}
                  title="Expected Bills (Next 30 Days)"
                  badge={
                    (stats?.missingBills ?? 0) > 0 ? (
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-800">
                        {stats?.missingBills} missing
                      </span>
                    ) : undefined
                  }
                  action={
                    <span className="text-sm text-gray-500">
                      {predictedBills.length} predicted bill{predictedBills.length !== 1 ? 's' : ''}
                    </span>
                  }
                >
                  {isPredictedLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mr-3"></div>
                      <span className="text-gray-500">Generating predictions...</span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {predictedBills.map((bill) => (
                        <BillCard
                          key={bill.id}
                          bill={bill}
                          onClick={() => router.push(`/bills/${bill.id}`)}
                        />
                      ))}
                    </div>
                  )}
                </DashboardWidget>
              )}

              {/* Credit Card Balance Graph Widget */}
              {visibleWidgetIds.has(WIDGET_IDS.CREDIT_CARD) && creditCardData && (
                <DashboardWidget
                  key={WIDGET_IDS.CREDIT_CARD}
                  title="Credit Card Balances"
                >
                  <CreditCardBalanceGraph
                    accounts={creditCardData.accounts}
                    period={balancePeriod}
                    onPeriodChange={setBalancePeriod}
                  />
                </DashboardWidget>
              )}

              {/* Upcoming Bills Widget */}
              {visibleWidgetIds.has(WIDGET_IDS.UPCOMING_BILLS) && stats?.upcomingBillsList && (
                <DashboardWidget
                  key={WIDGET_IDS.UPCOMING_BILLS}
                  title="Upcoming Bills (Next 7 Days)"
                  action={
                    <Link href="/bills" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                      View all &rarr;
                    </Link>
                  }
                >
                  <div className="grid grid-cols-1 gap-4">
                    {stats.upcomingBillsList.map((bill) => (
                      <BillCard
                        key={bill.id}
                        bill={bill}
                        onClick={() => {
                          setSelectedBill(bill)
                          setIsModalOpen(true)
                        }}
                      />
                    ))}
                  </div>
                </DashboardWidget>
              )}

              {/* Overdue Bills Widget */}
              {visibleWidgetIds.has(WIDGET_IDS.OVERDUE_BILLS) && stats?.overdueBillsList && (
                <DashboardWidget
                  key={WIDGET_IDS.OVERDUE_BILLS}
                  title="Overdue Bills"
                  action={
                    <Link href="/bills?status=OVERDUE" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                      View all &rarr;
                    </Link>
                  }
                >
                  <div className="grid grid-cols-1 gap-4">
                    {stats.overdueBillsList.map((bill) => (
                      <BillCard
                        key={bill.id}
                        bill={bill}
                        onClick={() => {
                          setSelectedBill(bill)
                          setIsModalOpen(true)
                        }}
                      />
                    ))}
                  </div>
                </DashboardWidget>
              )}

              {/* Category Breakdown Widget */}
              {visibleWidgetIds.has(WIDGET_IDS.CATEGORY_BREAKDOWN) && (
                <DashboardWidget
                  key={WIDGET_IDS.CATEGORY_BREAKDOWN}
                  title="Category Breakdown"
                  action={
                    <div className="flex items-center gap-2">
                      <label htmlFor="category-period" className="text-sm font-medium text-gray-700">
                        Period:
                      </label>
                      <select
                        id="category-period"
                        value={categoryPeriod}
                        onChange={(e) => setCategoryPeriod(e.target.value as CategoryPeriod)}
                        className="px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-sm"
                      >
                        <option value="week">Week</option>
                        <option value="month">Month</option>
                        <option value="quarter">Quarter</option>
                        <option value="year">Year</option>
                      </select>
                    </div>
                  }
                >
                  <div className="space-y-6">
                    {stats?.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
                      <div>
                        <h3 className="text-md font-semibold text-gray-900 mb-3">Historic</h3>
                        <CategoryPieChart data={stats.categoryBreakdown} size={200} />
                      </div>
                    )}

                    {stats?.projectedCategoryBreakdown && stats.projectedCategoryBreakdown.length > 0 ? (
                      <div>
                        <h3 className="text-md font-semibold text-gray-900 mb-3">Projected</h3>
                        <CategoryPieChart data={stats.projectedCategoryBreakdown} size={200} />
                      </div>
                    ) : (
                      stats?.categoryBreakdown && stats.categoryBreakdown.length > 0 && (
                        <div className="flex items-center justify-center h-32 text-gray-500">
                          <p>No projected data available for the selected period</p>
                        </div>
                      )
                    )}
                  </div>
                </DashboardWidget>
              )}

              {/* Recent Bills Widget */}
              {visibleWidgetIds.has(WIDGET_IDS.RECENT_BILLS) && stats?.recentBills && (
                <DashboardWidget
                  key={WIDGET_IDS.RECENT_BILLS}
                  title="Recent Bills"
                  action={
                    <Link href="/bills" className="text-primary-600 hover:text-primary-700 font-medium text-sm">
                      View all &rarr;
                    </Link>
                  }
                >
                  <div className="grid grid-cols-1 gap-4">
                    {stats.recentBills.map((bill) => (
                      <BillCard
                        key={bill.id}
                        bill={bill}
                        onClick={() => {
                          setSelectedBill(bill)
                          setIsModalOpen(true)
                        }}
                      />
                    ))}
                  </div>
                </DashboardWidget>
              )}
            </Responsive>
          )}
        </div>

        {/* Bill View Modal */}
        {selectedBill && (
          <BillViewModal
            bill={selectedBill}
            isOpen={isModalOpen}
            onClose={() => {
              setIsModalOpen(false)
              setSelectedBill(null)
            }}
            onUpdate={(updatedBill) => {
              setSelectedBill(updatedBill)
              fetchData()
            }}
          />
        )}
      </main>
    </div>
  )
}
