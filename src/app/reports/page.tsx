'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import TagInput from '@/components/TagInput'
import { MonthlyBudgetReport, TaxItemsReport } from '@/types'
import { Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear } from 'date-fns'
import { calendarDateInputValue, formatCalendarDate } from '@/lib/date-utils'

type ReportTab = 'tax' | 'monthly'

function csvEscape(value: string | number | null | undefined) {
  const s = value == null ? '' : String(value)
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`
  return s
}

function downloadCsv(filename: string, rows: string[][]) {
  const csv = rows.map((row) => row.map(csvEscape).join(',')).join('\n')
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

function money(n: number) {
  return `$${Number(n).toFixed(2)}`
}

export default function ReportsPage() {
  const { data: session } = useSession()
  const now = new Date()
  const [tab, setTab] = useState<ReportTab>('tax')
  const [year, setYear] = useState(now.getFullYear())
  const [month, setMonth] = useState(format(now, 'yyyy-MM'))
  const [tags, setTags] = useState<string[]>([])
  const [taxReport, setTaxReport] = useState<TaxItemsReport | null>(null)
  const [monthlyReport, setMonthlyReport] = useState<MonthlyBudgetReport | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const taxRange = useMemo(() => {
    const start = startOfYear(new Date(year, 0, 1))
    const end = endOfYear(new Date(year, 0, 1))
    return { startDate: format(start, 'yyyy-MM-dd'), endDate: format(end, 'yyyy-MM-dd') }
  }, [year])

  const monthlyRange = useMemo(() => {
    const d = new Date(`${month}-01T12:00:00`)
    return {
      startDate: format(startOfMonth(d), 'yyyy-MM-dd'),
      endDate: format(endOfMonth(d), 'yyyy-MM-dd'),
    }
  }, [month])

  const fetchReport = async () => {
    setIsLoading(true)
    try {
      const range = tab === 'tax' ? taxRange : monthlyRange
      const params = new URLSearchParams({
        startDate: range.startDate,
        endDate: range.endDate,
      })
      if (tags.length > 0) params.set('tags', tags.join(','))
      const path = tab === 'tax' ? '/api/reports/tax-items' : '/api/reports/monthly-budget'
      const res = await fetch(`${path}?${params.toString()}`)
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        toast.error(data.error || 'Failed to load report')
        return
      }
      const data = await res.json()
      if (tab === 'tax') setTaxReport(data)
      else setMonthlyReport(data)
    } catch {
      toast.error('Failed to load report')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (session) fetchReport()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, tab, year, month, tags.join(',')])

  const exportCsv = () => {
    if (tab === 'tax' && taxReport) {
      const rows = [
        ['Type', 'Date', 'Title', 'Category', 'Tags', 'Amount'],
        ...taxReport.bills.map((b) => [
          'Bill',
          calendarDateInputValue(b.date),
          b.title,
          b.categoryName || '',
          b.tags.join('; '),
          Number(b.amount).toFixed(2),
        ]),
        ...taxReport.eobs.map((e) => [
          'EOB',
          calendarDateInputValue(e.date),
          `${e.providerName} / ${e.payerName}`,
          '',
          e.tags.join('; '),
          Number(e.patientResponsibility).toFixed(2),
        ]),
        ...taxReport.expenses.map((e) => [
          'Expense',
          calendarDateInputValue(e.date),
          e.title,
          e.categoryName || '',
          e.tags.join('; '),
          Number(e.amount).toFixed(2),
        ]),
        [],
        ['', '', '', '', 'Bills', Number(taxReport.billTotal).toFixed(2)],
        ['', '', '', '', 'EOBs (patient)', Number(taxReport.eobPatientTotal).toFixed(2)],
        ['', '', '', '', 'Expenses', Number(taxReport.expenseTotal).toFixed(2)],
        ['', '', '', '', 'Combined', Number(taxReport.combinedTotal).toFixed(2)],
      ]
      downloadCsv(`tax-items-${taxRange.startDate}-${taxRange.endDate}.csv`, rows)
      return
    }
    if (tab === 'monthly' && monthlyReport) {
      const rows = [['Date', 'Payee', 'Description', 'Category', 'Tags', 'Amount']]
      for (const period of monthlyReport.periods) {
        for (const row of period.rows) {
          rows.push([
            calendarDateInputValue(row.date),
            row.vendorName || row.title,
            row.description || row.title,
            row.categoryName || '',
            row.tags.join('; '),
            Number(row.amount).toFixed(2),
          ])
        }
        rows.push(['', '', '', '', `${period.periodLabel} subtotal`, Number(period.subtotal).toFixed(2)])
      }
      rows.push(['', '', '', '', 'Grand total', Number(monthlyReport.grandTotal).toFixed(2)])
      downloadCsv(`monthly-budget-${monthlyRange.startDate}-${monthlyRange.endDate}.csv`, rows)
    }
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Navbar />
        <div className="flex items-center justify-center h-96">
          <p className="text-gray-600">Please log in to view reports</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="app-page-container-wide">
        <div className="flex items-center justify-between mb-6 no-print">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Reports</h1>
            <p className="mt-2 text-gray-600">Printable tax items and monthly budget register</p>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={exportCsv}
              className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              <Download className="w-4 h-4 mr-2" />
              CSV
            </button>
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              <Printer className="w-4 h-4 mr-2" />
              Print
            </button>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-6 no-print space-y-4">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setTab('tax')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === 'tax' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Tax items
            </button>
            <button
              type="button"
              onClick={() => setTab('monthly')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === 'monthly' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Monthly budget
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {tab === 'tax' ? (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
                <input
                  type="number"
                  value={year}
                  onChange={(e) => setYear(parseInt(e.target.value, 10) || year)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            ) : (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                <input
                  type="month"
                  value={month}
                  onChange={(e) => setMonth(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg"
                />
              </div>
            )}
            <div className="md:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Tags (match any)
              </label>
              <TagInput tags={tags} onChange={setTags} placeholder="Add a tag and press Enter" />
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center h-48">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600" />
          </div>
        ) : tab === 'tax' && taxReport ? (
          <div className="space-y-8 print-report">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Tax items {year}</h2>
              <p className="text-sm text-gray-600">
                {taxReport.startDate} to {taxReport.endDate}
                {taxReport.tags.length > 0 ? ` · tags: ${taxReport.tags.join(', ')}` : ''}
              </p>
            </div>

            <section className="print-break">
              <h3 className="text-lg font-semibold mb-2">Bills</h3>
              <ReportTable
                headers={['Date', 'Title', 'Category', 'Tags', 'Amount']}
                rows={taxReport.bills.map((b) => [
                  formatCalendarDate(b.date),
                  b.title,
                  b.categoryName || '—',
                  b.tags.join(', ') || '—',
                  money(b.amount),
                ])}
                empty="No tax-flagged bills in this period."
                footer={['', '', '', 'Bill total', money(taxReport.billTotal)]}
              />
            </section>

            <section className="print-break">
              <h3 className="text-lg font-semibold mb-2">EOBs (patient responsibility)</h3>
              <ReportTable
                headers={['Date', 'Provider', 'Payer', 'Tags', 'Patient']}
                rows={taxReport.eobs.map((e) => [
                  formatCalendarDate(e.date),
                  e.providerName,
                  e.payerName,
                  e.tags.join(', ') || '—',
                  money(e.patientResponsibility),
                ])}
                empty="No tax-flagged EOBs in this period."
                footer={['', '', '', 'EOB total', money(taxReport.eobPatientTotal)]}
              />
            </section>

            <section className="print-break">
              <h3 className="text-lg font-semibold mb-2">Standalone expenses</h3>
              <ReportTable
                headers={['Date', 'Payee', 'Category', 'Tags', 'Amount']}
                rows={taxReport.expenses.map((e) => [
                  formatCalendarDate(e.date),
                  e.title,
                  e.categoryName || '—',
                  e.tags.join(', ') || '—',
                  money(e.amount),
                ])}
                empty="No standalone tax expenses in this period."
                footer={['', '', '', 'Expense total', money(taxReport.expenseTotal)]}
              />
            </section>

            <p className="text-xl font-bold text-right">Combined total {money(taxReport.combinedTotal)}</p>
          </div>
        ) : tab === 'monthly' && monthlyReport ? (
          <div className="space-y-6 print-report">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Monthly budget</h2>
              <p className="text-sm text-gray-600">
                {monthlyReport.startDate} to {monthlyReport.endDate}
                {monthlyReport.tags.length > 0 ? ` · tags: ${monthlyReport.tags.join(', ')}` : ''}
              </p>
            </div>
            {monthlyReport.periods.length === 0 ? (
              <p className="text-gray-600">No bills in this period.</p>
            ) : (
              monthlyReport.periods.map((period) => (
                <section key={period.periodLabel} className="print-break">
                  <h3 className="text-lg font-semibold mb-2">{period.periodLabel}</h3>
                  <ReportTable
                    headers={['Date', 'Payee', 'Description', 'Category', 'Tags', 'Amount']}
                    rows={period.rows.map((row) => [
                      formatCalendarDate(row.date),
                      row.vendorName || row.title,
                      row.description || row.title,
                      row.categoryName || '—',
                      row.tags.join(', ') || '—',
                      money(row.amount),
                    ])}
                    empty="No rows."
                    footer={['', '', '', '', 'Subtotal', money(period.subtotal)]}
                  />
                </section>
              ))
            )}
            <p className="text-xl font-bold text-right">Grand total {money(monthlyReport.grandTotal)}</p>
          </div>
        ) : null}
      </main>
    </div>
  )
}

function ReportTable({
  headers,
  rows,
  empty,
  footer,
}: {
  headers: string[]
  rows: string[][]
  empty: string
  footer?: string[]
}) {
  return (
    <div className="bg-white rounded-lg shadow-md overflow-hidden">
      <div className="overflow-x-auto">
        <table className="min-w-full divide-y divide-gray-200">
          <thead className="bg-gray-50">
            <tr>
              {headers.map((h) => (
                <th
                  key={h}
                  className={`px-4 py-3 text-xs font-medium text-gray-500 uppercase ${
                    h === 'Amount' || h === 'Patient' ? 'text-right' : 'text-left'
                  }`}
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {rows.length === 0 ? (
              <tr>
                <td colSpan={headers.length} className="px-4 py-6 text-sm text-gray-500">
                  {empty}
                </td>
              </tr>
            ) : (
              rows.map((row, i) => (
                <tr key={i}>
                  {row.map((cell, j) => (
                    <td
                      key={j}
                      className={`px-4 py-3 text-sm text-gray-900 ${j === row.length - 1 ? 'text-right font-medium' : ''}`}
                    >
                      {cell}
                    </td>
                  ))}
                </tr>
              ))
            )}
          </tbody>
          {footer && rows.length > 0 && (
            <tfoot>
              <tr className="bg-gray-50 font-semibold">
                {footer.map((cell, j) => (
                  <td key={j} className={`px-4 py-3 text-sm ${j === footer.length - 1 ? 'text-right' : ''}`}>
                    {cell}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  )
}
