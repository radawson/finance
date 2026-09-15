import { format } from 'date-fns'
import {
  MonthlyBudgetPeriod,
  MonthlyBudgetReport,
  MonthlyBudgetRow,
  TaxItemBillRow,
  TaxItemEobRow,
  TaxItemExpenseRow,
  TaxItemsReport,
} from '@/types'

export function parseTagFilter(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((t) => t.trim())
    .filter((t) => t.length > 0)
}

/** Match any of the filter tags (OR). Empty filter matches everything. */
export function matchesAnyTag(itemTags: string[] | undefined, filterTags: string[]): boolean {
  if (filterTags.length === 0) return true
  const set = new Set((itemTags || []).map((t) => t.trim().toLowerCase()))
  return filterTags.some((t) => set.has(t.trim().toLowerCase()))
}

export function inDateRange(date: Date | string, start: Date, end: Date): boolean {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  const s = new Date(start)
  s.setHours(0, 0, 0, 0)
  const e = new Date(end)
  e.setHours(23, 59, 59, 999)
  return d >= s && d <= e
}

export function buildTaxItemsReport(input: {
  bills: Array<{
    id: string
    title: string
    dueDate: Date | string
    amount: number
    tags?: string[]
    isTaxItem?: boolean
    category?: { name?: string | null } | null
  }>
  eobs: Array<{
    id: string
    eobDate: Date | string
    serviceStart?: Date | string | null
    serviceEnd?: Date | string | null
    providerName: string
    payerName: string
    tags?: string[]
    isTaxItem?: boolean
    billedAmount: number
    insurancePaid: number
    patientResponsibility: number
  }>
  expenses?: Array<{
    id: string
    date: Date | string
    amount: number
    payee?: string | null
    note?: string | null
    billId?: string | null
    isTaxItem?: boolean
    category?: { name?: string | null } | null
  }>
  startDate: Date
  endDate: Date
  tags: string[]
}): TaxItemsReport {
  const bills: TaxItemBillRow[] = input.bills
    .filter((b) => b.isTaxItem)
    .filter((b) => inDateRange(b.dueDate, input.startDate, input.endDate))
    .filter((b) => matchesAnyTag(b.tags, input.tags))
    .map((b) => ({
      source: 'bill' as const,
      id: b.id,
      date: new Date(b.dueDate),
      title: b.title,
      categoryName: b.category?.name ?? null,
      tags: b.tags || [],
      amount: Number(b.amount),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const eobs: TaxItemEobRow[] = input.eobs
    .filter((e) => e.isTaxItem !== false)
    .filter((e) => inDateRange(e.eobDate, input.startDate, input.endDate))
    .filter((e) => matchesAnyTag(e.tags, input.tags))
    .map((e) => ({
      source: 'eob' as const,
      id: e.id,
      date: new Date(e.eobDate),
      serviceStart: e.serviceStart ? new Date(e.serviceStart) : null,
      serviceEnd: e.serviceEnd ? new Date(e.serviceEnd) : null,
      providerName: e.providerName,
      payerName: e.payerName,
      tags: e.tags || [],
      billedAmount: Number(e.billedAmount),
      insurancePaid: Number(e.insurancePaid),
      patientResponsibility: Number(e.patientResponsibility),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  // Standalone tax expenses only. Bill-linked expenses copy isTaxItem from the
  // bill; counting them here would double-count paid tax bills.
  const expenses: TaxItemExpenseRow[] = (input.expenses || [])
    .filter((e) => e.isTaxItem && !e.billId)
    .filter((e) => inDateRange(e.date, input.startDate, input.endDate))
    .filter((e) => matchesAnyTag([], input.tags))
    .map((e) => ({
      source: 'expense' as const,
      id: e.id,
      date: new Date(e.date),
      title: e.payee || e.note || 'Expense',
      categoryName: e.category?.name ?? null,
      tags: [],
      amount: Number(e.amount),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const billTotal = bills.reduce((sum, b) => sum + b.amount, 0)
  const eobPatientTotal = eobs.reduce((sum, e) => sum + e.patientResponsibility, 0)
  const expenseTotal = expenses.reduce((sum, e) => sum + e.amount, 0)

  return {
    startDate: format(input.startDate, 'yyyy-MM-dd'),
    endDate: format(input.endDate, 'yyyy-MM-dd'),
    tags: input.tags,
    bills,
    eobs,
    expenses,
    billTotal,
    eobPatientTotal,
    expenseTotal,
    combinedTotal: billTotal + eobPatientTotal + expenseTotal,
  }
}

export function buildMonthlyBudgetReport(input: {
  bills: Array<{
    id: string
    title: string
    description?: string | null
    dueDate: Date | string
    amount: number
    tags?: string[]
    isTaxItem?: boolean
    isRecurring?: boolean
    category?: { name?: string | null } | null
    vendor?: { name?: string | null } | null
  }>
  startDate: Date
  endDate: Date
  tags: string[]
}): MonthlyBudgetReport {
  const rows: MonthlyBudgetRow[] = input.bills
    .filter((b) => !b.isRecurring)
    .filter((b) => inDateRange(b.dueDate, input.startDate, input.endDate))
    .filter((b) => matchesAnyTag(b.tags, input.tags))
    .map((b) => ({
      id: b.id,
      date: new Date(b.dueDate),
      title: b.title,
      description: b.description ?? null,
      categoryName: b.category?.name ?? null,
      vendorName: b.vendor?.name ?? null,
      tags: b.tags || [],
      amount: Number(b.amount),
      isTaxItem: Boolean(b.isTaxItem),
    }))
    .sort((a, b) => a.date.getTime() - b.date.getTime())

  const periodMap = new Map<string, MonthlyBudgetRow[]>()
  for (const row of rows) {
    const label = format(row.date, 'yyyy-MM')
    const list = periodMap.get(label) || []
    list.push(row)
    periodMap.set(label, list)
  }

  const periods: MonthlyBudgetPeriod[] = Array.from(periodMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([periodLabel, periodRows]) => ({
      periodLabel,
      rows: periodRows,
      subtotal: periodRows.reduce((sum, r) => sum + r.amount, 0),
    }))

  return {
    startDate: format(input.startDate, 'yyyy-MM-dd'),
    endDate: format(input.endDate, 'yyyy-MM-dd'),
    tags: input.tags,
    periods,
    grandTotal: rows.reduce((sum, r) => sum + r.amount, 0),
  }
}
