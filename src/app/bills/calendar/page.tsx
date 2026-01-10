'use client'

import { useEffect, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import BillStatusBadge from '@/components/BillStatusBadge'
import { Bill } from '@/types'
import { Calendar, ChevronLeft, ChevronRight, Filter } from 'lucide-react'
import Link from 'next/link'
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isSameDay, addMonths, subMonths } from 'date-fns'
import toast from 'react-hot-toast'

export default function BillCalendarPage() {
  const { data: session } = useSession()
  const [bills, setBills] = useState<Bill[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [currentDate, setCurrentDate] = useState(new Date())
  const [selectedDate, setSelectedDate] = useState<Date | null>(null)
  const [filterStatus, setFilterStatus] = useState<string>('')

  useEffect(() => {
    if (session) {
      fetchBills()
    }
  }, [session, filterStatus])

  const fetchBills = async () => {
    try {
      const url = filterStatus ? `/api/bills?status=${filterStatus}` : '/api/bills'
      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setBills(data)
      } else {
        toast.error('Failed to load bills')
      }
    } catch (error) {
      toast.error('Failed to load bills')
    } finally {
      setIsLoading(false)
    }
  }

  const monthStart = startOfMonth(currentDate)
  const monthEnd = endOfMonth(currentDate)
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd })

  // Get bills for a specific date
  const getBillsForDate = (date: Date) => {
    return bills.filter(bill => {
      const billDate = new Date(bill.dueDate)
      return isSameDay(billDate, date)
    })
  }

  // Get status color for a bill
  const getStatusColor = (status: string) => {
    switch (status) {
      case 'PAID':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'OVERDUE':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'DUE_SOON':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'PENDING':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'SKIPPED':
        return 'bg-gray-100 text-gray-800 border-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const previousMonth = () => {
    setCurrentDate(subMonths(currentDate, 1))
  }

  const nextMonth = () => {
    setCurrentDate(addMonths(currentDate, 1))
  }

  const goToToday = () => {
    setCurrentDate(new Date())
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-gray-600">Please log in to view bills</p>
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
          <p className="text-gray-600">Loading calendar...</p>
        </div>
      </div>
    )
  }

  // Get first day of month's weekday (0 = Sunday, 6 = Saturday)
  const firstDayOfWeek = monthStart.getDay()
  const emptyDays = Array(firstDayOfWeek).fill(null)

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Bill Calendar</h1>
            <p className="mt-2 text-gray-600">
              View bills by due date • {format(currentDate, 'MMMM yyyy')}
            </p>
          </div>
          <div className="flex items-center gap-4">
            <Link
              href="/bills"
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              List View
            </Link>
            <div className="flex items-center gap-2">
              <button
                onClick={previousMonth}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Previous month"
              >
                <ChevronLeft className="w-5 h-5" />
              </button>
              <button
                onClick={goToToday}
                className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Today
              </button>
              <button
                onClick={nextMonth}
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-md transition-colors"
                title="Next month"
              >
                <ChevronRight className="w-5 h-5" />
              </button>
            </div>
          </div>
        </div>

        {/* Filter */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-gray-500" />
            <label className="text-sm font-medium text-gray-700">Filter by Status:</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
            >
              <option value="">All Statuses</option>
              <option value="PENDING">Pending</option>
              <option value="DUE_SOON">Due Soon</option>
              <option value="OVERDUE">Overdue</option>
              <option value="PAID">Paid</option>
              <option value="SKIPPED">Skipped</option>
            </select>
          </div>
        </div>

        {/* Calendar Grid */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {/* Calendar Header */}
          <div className="grid grid-cols-7 border-b border-gray-200">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
              <div
                key={day}
                className="p-4 text-center text-sm font-semibold text-gray-700 bg-gray-50"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar Body */}
          <div className="grid grid-cols-7">
            {/* Empty days at start of month */}
            {emptyDays.map((_, index) => (
              <div key={`empty-${index}`} className="min-h-[120px] border-r border-b border-gray-200 bg-gray-50" />
            ))}

            {/* Days of month */}
            {daysInMonth.map((day) => {
              const dayBills = getBillsForDate(day)
              const isToday = isSameDay(day, new Date())
              const isSelected = selectedDate && isSameDay(day, selectedDate)

              return (
                <div
                  key={day.toISOString()}
                  className={`min-h-[120px] border-r border-b border-gray-200 p-2 ${
                    isToday ? 'bg-blue-50' : 'bg-white'
                  } ${isSelected ? 'ring-2 ring-primary-500' : ''} hover:bg-gray-50 transition-colors cursor-pointer`}
                  onClick={() => setSelectedDate(day)}
                >
                  <div className={`text-sm font-medium mb-1 ${isToday ? 'text-primary-600' : 'text-gray-900'}`}>
                    {format(day, 'd')}
                  </div>
                  <div className="space-y-1">
                    {dayBills.slice(0, 3).map((bill) => (
                      <div
                        key={bill.id}
                        className={`text-xs px-2 py-1 rounded border truncate ${getStatusColor(bill.status)}`}
                        title={`${bill.title} - $${bill.amount.toFixed(2)}`}
                      >
                        {bill.title}
                      </div>
                    ))}
                    {dayBills.length > 3 && (
                      <div className="text-xs text-gray-500 px-2">
                        +{dayBills.length - 3} more
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Selected Date Bills */}
        {selectedDate && (
          <div className="mt-6 bg-white rounded-lg shadow-md p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">
                Bills due on {format(selectedDate, 'MMMM d, yyyy')}
              </h2>
              <button
                onClick={() => setSelectedDate(null)}
                className="text-gray-500 hover:text-gray-700"
              >
                Close
              </button>
            </div>
            {getBillsForDate(selectedDate).length === 0 ? (
              <p className="text-gray-500">No bills due on this date</p>
            ) : (
              <div className="space-y-3">
                {getBillsForDate(selectedDate).map((bill) => (
                  <Link
                    key={bill.id}
                    href={`/bills/${bill.id}`}
                    className="block p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex-1">
                        <h3 className="font-medium text-gray-900">{bill.title}</h3>
                        <p className="text-sm text-gray-500 mt-1">
                          {bill.vendor?.name && `${bill.vendor.name} • `}
                          {bill.category?.name}
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <p className="font-semibold text-gray-900">${bill.amount.toFixed(2)}</p>
                        </div>
                        <BillStatusBadge status={bill.status} />
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Legend */}
        <div className="mt-6 bg-white rounded-lg shadow-md p-4">
          <h3 className="text-sm font-semibold text-gray-700 mb-3">Status Colors</h3>
          <div className="flex flex-wrap gap-4">
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-blue-100 border border-blue-200"></div>
              <span className="text-sm text-gray-600">Pending</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-yellow-100 border border-yellow-200"></div>
              <span className="text-sm text-gray-600">Due Soon</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-red-100 border border-red-200"></div>
              <span className="text-sm text-gray-600">Overdue</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-green-100 border border-green-200"></div>
              <span className="text-sm text-gray-600">Paid</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 rounded bg-gray-100 border border-gray-200"></div>
              <span className="text-sm text-gray-600">Skipped</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}
