'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import AnalysisPeriodSelector from '@/components/AnalysisPeriodSelector'
import HistoricBillsView from '@/components/HistoricBillsView'
import BudgetPredictionsView from '@/components/BudgetPredictionsView'
import { HistoricBillsData, BudgetPredictionData, AnalysisPeriod } from '@/types'
import { format, subMonths, addMonths } from 'date-fns'
import Link from 'next/link'
import toast from 'react-hot-toast'

type ViewType = 'history' | 'budget'

export default function AnalysisPage() {
  const { data: session } = useSession()
  const [activeView, setActiveView] = useState<ViewType>('history')
  const [period, setPeriod] = useState<AnalysisPeriod>('monthly')
  const [startDate, setStartDate] = useState<string>(format(subMonths(new Date(), 6), 'yyyy-MM-dd'))
  const [endDate, setEndDate] = useState<string>(format(addMonths(new Date(), 6), 'yyyy-MM-dd'))
  const [historyData, setHistoryData] = useState<HistoricBillsData | null>(null)
  const [budgetData, setBudgetData] = useState<BudgetPredictionData | null>(null)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [isLoadingBudget, setIsLoadingBudget] = useState(false)

  useEffect(() => {
    if (session) {
      if (activeView === 'history') {
        fetchHistoryData()
      } else {
        fetchBudgetData()
      }
    }
  }, [session, activeView, period, startDate, endDate])

  const fetchHistoryData = async () => {
    setIsLoadingHistory(true)
    try {
      const params = new URLSearchParams({
        period: period === 'custom' ? 'monthly' : period,
        ...(startDate && { startDate }),
        ...(endDate && { endDate }),
      })

      const response = await fetch(`/api/analysis/history?${params}`)
      if (response.ok) {
        const data = await response.json()
        setHistoryData(data)
      } else {
        toast.error('Failed to load historic bills')
        setHistoryData(null)
      }
    } catch (error) {
      toast.error('Failed to load historic bills')
      setHistoryData(null)
    } finally {
      setIsLoadingHistory(false)
    }
  }

  const fetchBudgetData = async () => {
    setIsLoadingBudget(true)
    try {
      const params = new URLSearchParams({
        period: period === 'custom' ? 'monthly' : period,
        startDate,
        endDate,
        includeHistoric: 'false',
      })

      const response = await fetch(`/api/analysis/budget?${params}`)
      if (response.ok) {
        const data = await response.json()
        setBudgetData(data)
      } else {
        toast.error('Failed to load budget predictions')
        setBudgetData(null)
      }
    } catch (error) {
      toast.error('Failed to load budget predictions')
      setBudgetData(null)
    } finally {
      setIsLoadingBudget(false)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to view analysis</p>
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

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Analysis</h1>
          <p className="text-gray-600 mt-1">
            Analyze historic bills and predict future expenses
          </p>
        </div>

        {/* Tab Navigation */}
        <div className="mb-6 border-b border-gray-200">
          <nav className="-mb-px flex space-x-8">
            <button
              onClick={() => setActiveView('history')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeView === 'history'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Historic Bills Paid
            </button>
            <button
              onClick={() => setActiveView('budget')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeView === 'budget'
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Periodic Budget
            </button>
          </nav>
        </div>

        {/* Period Selector */}
        <div className="bg-white rounded-lg shadow p-6 mb-6">
          <AnalysisPeriodSelector
            period={period}
            onPeriodChange={setPeriod}
            startDate={startDate}
            endDate={endDate}
            onStartDateChange={setStartDate}
            onEndDateChange={setEndDate}
          />
        </div>

        {/* Content Views */}
        {activeView === 'history' ? (
          <HistoricBillsView
            data={historyData}
            isLoading={isLoadingHistory}
            startDate={startDate}
            endDate={endDate}
          />
        ) : (
          <BudgetPredictionsView
            data={budgetData}
            isLoading={isLoadingBudget}
            startDate={startDate}
            endDate={endDate}
          />
        )}
      </main>
    </div>
  )
}
