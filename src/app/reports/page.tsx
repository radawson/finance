'use client'

import { useEffect, useMemo, useState } from 'react'
import { useSession } from 'next-auth/react'
import Navbar from '@/components/Navbar'
import TagInput from '@/components/TagInput'
import { MonthlyBudgetReport, TaxItemsReport, AccountsReport } from '@/types'
import { Download, Printer } from 'lucide-react'
import toast from 'react-hot-toast'
import { endOfMonth, endOfYear, format, startOfMonth, startOfYear } from 'date-fns'
import { calendarDateInputValue, formatCalendarDate } from '@/lib/date-utils'

type ReportTab = 'tax' | 'monthly' | 'accounts'

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

function moneyOrDash(n: number | null | undefined) {
  return n == null ? '—' : money(n)
}

function pct(n: number | null | undefined) {
  if (n == null) return '—'
  return `${(n * 100).toFixed(1)}%`
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
  const [accountsReport, setAccountsReport] = useState<AccountsReport | null>(null)
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
      if (tab === 'accounts') {
        const res = await fetch('/api/reports/accounts')
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          toast.error(data.error || 'Failed to load report')
          return
        }
        setAccountsReport(await res.json())
        return
      }
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
      return
    }
    if (tab === 'accounts' && accountsReport) {
      const rows: string[][] = [
        [
          'Nickname',
          'Vendor',
          'Account number',
          'Original balance',
          'Current balance',
          'Credit limit',
          'Available credit',
          'Utilization',
          'APR',
          'Average payment',
          'Last payment',
          'Last payment date',
          'Next due',
          'Paydown',
          'Target 4%',
          'Pay to 4%',
          'Pay to 9%',
          'Extra limit needed',
        ],
        ...accountsReport.rows.map((r) => [
          r.nickname || '',
          r.vendorName,
          r.accountNumber,
          r.originalBalance == null ? '' : Number(r.originalBalance).toFixed(2),
          r.currentBalance == null ? '' : Number(r.currentBalance).toFixed(2),
          r.creditLimit == null ? '' : Number(r.creditLimit).toFixed(2),
          r.availableCredit == null ? '' : Number(r.availableCredit).toFixed(2),
          r.utilization == null ? '' : (r.utilization * 100).toFixed(1) + '%',
          r.apr == null ? '' : Number(r.apr).toFixed(2),
          r.averagePayment == null ? '' : Number(r.averagePayment).toFixed(2),
          r.lastPaymentAmount == null ? '' : Number(r.lastPaymentAmount).toFixed(2),
          r.lastPaymentDate || '',
          r.nextDueDate || '',
          r.paydownPercent == null ? '' : (r.paydownPercent * 100).toFixed(1) + '%',
          r.targetBalance == null ? '' : Number(r.targetBalance).toFixed(2),
          r.payTo4 == null ? '' : Number(r.payTo4).toFixed(2),
          r.payTo9 == null ? '' : Number(r.payTo9).toFixed(2),
          r.extraLimitNeeded == null ? '' : Number(r.extraLimitNeeded).toFixed(2),
        ]),
        [
          'Totals',
          '',
          '',
          Number(accountsReport.totals.originalBalance).toFixed(2),
          Number(accountsReport.totals.currentBalance).toFixed(2),
          Number(accountsReport.totals.creditLimit).toFixed(2),
          Number(accountsReport.totals.availableCredit).toFixed(2),
        ],
      ]
      downloadCsv('credit-loan-accounts.csv', rows)
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
            <p className="mt-2 text-gray-600">Printable tax items, monthly budget, and credit/loan accounts</p>
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
            <button
              type="button"
              onClick={() => setTab('accounts')}
              className={`px-4 py-2 rounded-lg text-sm font-medium ${
                tab === 'accounts' ? 'bg-primary-600 text-white' : 'bg-gray-100 text-gray-700'
              }`}
            >
              Accounts
            </button>
          </div>
          {tab !== 'accounts' && (
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
          )}
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
        ) : tab === 'accounts' && accountsReport ? (
          <div className="space-y-6 print-report print-accounts">
            <style>{`@media print { @page { size: landscape } }`}</style>
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Credit cards and loans</h2>
              <p className="text-sm text-gray-600">
                Utilization-only FICO estimate:{' '}
                {accountsReport.utilization.utilizationOnlyFicoEstimate == null
                  ? '—'
                  : accountsReport.utilization.utilizationOnlyFicoEstimate}
                {accountsReport.utilization.overallUtilization != null && (
                  <>
                    {' '}
                    · overall U = {(accountsReport.utilization.overallUtilization * 100).toFixed(1)}%
                    {accountsReport.utilization.maxUtilization != null && (
                      <> · U_max = {(accountsReport.utilization.maxUtilization * 100).toFixed(1)}%</>
                    )}
                  </>
                )}
              </p>
            </div>

            <section className="print-break">
              <div className="bg-white rounded-lg shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200 text-xs">
                    <thead className="bg-gray-50">
                      <tr>
                        {[
                          'Nickname',
                          'Vendor',
                          'Acct',
                          'Original',
                          'Balance',
                          'Limit',
                          'Available',
                          'Util',
                          'APR',
                          'Avg pay',
                          'Last pay',
                          'Last date',
                          'Next due',
                          'Paydown',
                        ].map((h) => (
                          <th
                            key={h}
                            className="px-2 py-2 text-left font-medium text-gray-500 uppercase whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-200">
                      {accountsReport.rows.length === 0 ? (
                        <tr>
                          <td colSpan={14} className="px-2 py-6 text-sm text-gray-500">
                            No credit card or loan accounts.
                          </td>
                        </tr>
                      ) : (
                        accountsReport.rows.map((r) => (
                          <tr key={r.accountId}>
                            <td className="px-2 py-2 whitespace-nowrap">{r.nickname || '—'}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{r.vendorName}</td>
                            <td className="px-2 py-2 whitespace-nowrap">
                              {r.accountNumberLast4 ? `****${r.accountNumberLast4}` : '—'}
                            </td>
                            <td className="px-2 py-2 text-right">{moneyOrDash(r.originalBalance)}</td>
                            <td className="px-2 py-2 text-right">{moneyOrDash(r.currentBalance)}</td>
                            <td className="px-2 py-2 text-right">{moneyOrDash(r.creditLimit)}</td>
                            <td className="px-2 py-2 text-right">{moneyOrDash(r.availableCredit)}</td>
                            <td className="px-2 py-2 text-right">{pct(r.utilization)}</td>
                            <td className="px-2 py-2 text-right">
                              {r.apr == null ? '—' : `${Number(r.apr).toFixed(2)}%`}
                            </td>
                            <td className="px-2 py-2 text-right">{moneyOrDash(r.averagePayment)}</td>
                            <td className="px-2 py-2 text-right">{moneyOrDash(r.lastPaymentAmount)}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{r.lastPaymentDate || '—'}</td>
                            <td className="px-2 py-2 whitespace-nowrap">{r.nextDueDate || '—'}</td>
                            <td className="px-2 py-2 text-right">{pct(r.paydownPercent)}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                    {accountsReport.rows.length > 0 && (
                      <tfoot>
                        <tr className="bg-gray-50 font-semibold">
                          <td className="px-2 py-2" colSpan={3}>
                            Totals
                          </td>
                          <td className="px-2 py-2 text-right">{money(accountsReport.totals.originalBalance)}</td>
                          <td className="px-2 py-2 text-right">{money(accountsReport.totals.currentBalance)}</td>
                          <td className="px-2 py-2 text-right">{money(accountsReport.totals.creditLimit)}</td>
                          <td className="px-2 py-2 text-right">{money(accountsReport.totals.availableCredit)}</td>
                          <td colSpan={7} />
                        </tr>
                      </tfoot>
                    )}
                  </table>
                </div>
              </div>
            </section>

            <section className="print-break bg-white rounded-lg shadow-md p-4 space-y-3">
              <h3 className="text-lg font-semibold">Utilization analysis</h3>
              <p className="text-sm text-gray-700">
                U = balance / creditLimit. Overall U = ΣB / ΣL. FICO scores both overall and the worst card:{' '}
                S = 0.7×score(U) + 0.3×score(U_max). Target band is 1–9% of limit; B* = 0.04×L (near the 4.1%
                average for 850 scores). pay_4 = max(0, B − 0.04L). pay_9 = max(0, B − 0.09L). Extra limit ΔL =
                max(0, B/0.09 − L). There is no 30% cliff.
              </p>
              {accountsReport.utilization.payTo4All != null && (
                <p className="text-sm text-gray-900">
                  Portfolio: pay {money(accountsReport.utilization.payTo4All)} to reach 4% overall
                  {accountsReport.utilization.payTo9All != null &&
                    accountsReport.utilization.payTo9All > 0 &&
                    `; pay ${money(accountsReport.utilization.payTo9All)} to reach 9%`}.
                </p>
              )}
              {accountsReport.utilization.allZeroRecommendation && (
                <p className="text-sm text-gray-900">
                  All revolving balances are $0. Report{' '}
                  {money(accountsReport.utilization.allZeroRecommendation.reportBalance)} on the largest-limit
                  card only (0.01×L, at least $1.00) so FICO sees revolving use.
                </p>
              )}
              <ul className="text-sm text-gray-800 space-y-1">
                {accountsReport.rows
                  .filter((r) => r.analysisLine)
                  .map((r) => (
                    <li key={r.accountId}>
                      <span className="font-medium">{r.nickname || r.vendorName}:</span> {r.analysisLine}{' '}
                      pay_9 = {moneyOrDash(r.payTo9)}; ΔL = {moneyOrDash(r.extraLimitNeeded)}.
                    </li>
                  ))}
              </ul>
              <p className="text-xs text-gray-500">{accountsReport.utilization.footnote}</p>
            </section>
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
