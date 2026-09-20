import { calendarDateInputValue } from '@/lib/date-utils'
import {
  AccountsReport,
  AccountsReportRow,
  MonthlyBudgetPeriod,
  MonthlyBudgetReport,
  MonthlyBudgetRow,
  TaxItemBillRow,
  TaxItemEobRow,
  TaxItemExpenseRow,
  TaxItemsReport,
} from '@/types'
import {
  UTILIZATION_CEILING,
  UTILIZATION_FICO_FOOTNOTE,
  UTILIZATION_TARGET,
  allZeroReportBalanceCents,
  analysisLine,
  availableCreditCents,
  centsToMoney,
  combinedUtilizationScore,
  extraLimitCents,
  moneyToCents,
  payToPercentCents,
  paydownPercent,
  roundFico,
  targetBalanceCents,
  utilizationRatio,
} from './credit-utilization'

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
  const d = calendarDateInputValue(date)
  const s = calendarDateInputValue(start)
  const e = calendarDateInputValue(end)
  return Boolean(d && s && e && d >= s && d <= e)
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
    startDate: calendarDateInputValue(input.startDate),
    endDate: calendarDateInputValue(input.endDate),
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
    const label = calendarDateInputValue(row.date).slice(0, 7)
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
    startDate: calendarDateInputValue(input.startDate),
    endDate: calendarDateInputValue(input.endDate),
    tags: input.tags,
    periods,
    grandTotal: rows.reduce((sum, r) => sum + r.amount, 0),
  }
}

const CREDIT_LOAN_LABEL =
  /credit|loan|mortgage|heloc|card|visa|amex|discover|revolving|\bloc\b/i

export function isCreditLoanLabel(value: string | null | undefined): boolean {
  return !!value && CREDIT_LOAN_LABEL.test(value)
}

export function isCreditLoanAccount(
  account: {
    creditLimit?: unknown
    initialValue?: unknown
    nickname?: string | null
    accountType?: string | null
    type?: { name?: string | null } | null
  },
  extraLabels: Array<string | null | undefined> = [],
): boolean {
  const labels = [
    account.type?.name,
    account.accountType,
    account.nickname,
    ...extraLabels,
  ]
  if (labels.some(isCreditLoanLabel)) return true
  return moneyToCents(account.creditLimit) != null || moneyToCents(account.initialValue) != null
}

function paymentCents(bill: { amount: unknown; paidAmount?: unknown }): number {
  const paid = moneyToCents(bill.paidAmount)
  if (paid != null) return paid
  return moneyToCents(bill.amount) ?? 0
}

function last4(accountNumber: string): string {
  const compact = accountNumber.replace(/\s/g, '')
  return compact.slice(-4)
}

export function buildAccountsReport(input: {
  accounts: Array<{
    id: string
    nickname?: string | null
    accountNumber: string
    accountType?: string | null
    balance?: unknown
    interestRate?: unknown
    initialValue?: unknown
    creditLimit?: unknown
    isActive?: boolean
    vendor?: { name?: string | null } | null
    type?: { name?: string | null } | null
  }>
  bills: Array<{
    vendorAccountId?: string | null
    status: string
    isRecurring?: boolean
    amount: unknown
    paidAmount?: unknown
    dueDate: Date | string
    paidDate?: Date | string | null
    categoryName?: string | null
  }>
}): AccountsReport {
  const billsByAccount = new Map<string, typeof input.bills>()
  for (const bill of input.bills) {
    if (!bill.vendorAccountId) continue
    const list = billsByAccount.get(bill.vendorAccountId) || []
    list.push(bill)
    billsByAccount.set(bill.vendorAccountId, list)
  }
  const included = input.accounts.filter((a) => {
    if (a.isActive === false) return false
    const categoryNames = (billsByAccount.get(a.id) || []).map((b) => b.categoryName)
    return isCreditLoanAccount(a, categoryNames)
  })

  const rows: AccountsReportRow[] = included.map((account) => {
    const bills = billsByAccount.get(account.id) || []
    const paidInstances = bills.filter((b) => b.status === 'PAID' && !b.isRecurring)
    const unpaidInstances = bills.filter(
      (b) => !b.isRecurring && b.status !== 'PAID' && b.status !== 'SKIPPED',
    )

    let averagePayment: number | null = null
    if (paidInstances.length > 0) {
      const total = paidInstances.reduce((sum, b) => sum + paymentCents(b), 0)
      averagePayment = centsToMoney(Math.round(total / paidInstances.length))
    }

    let lastPaymentAmount: number | null = null
    let lastPaymentDate: string | null = null
    if (paidInstances.length > 0) {
      const sorted = [...paidInstances].sort((a, b) => {
        const aKey = calendarDateInputValue(a.paidDate || a.dueDate)
        const bKey = calendarDateInputValue(b.paidDate || b.dueDate)
        return bKey.localeCompare(aKey)
      })
      const last = sorted[0]
      lastPaymentAmount = centsToMoney(paymentCents(last))
      lastPaymentDate = calendarDateInputValue(last.paidDate || last.dueDate) || null
    }

    let nextDueDate: string | null = null
    if (unpaidInstances.length > 0) {
      const sorted = [...unpaidInstances].sort((a, b) =>
        calendarDateInputValue(a.dueDate).localeCompare(calendarDateInputValue(b.dueDate)),
      )
      nextDueDate = calendarDateInputValue(sorted[0].dueDate) || null
    }

    const originalCents = moneyToCents(account.initialValue)
    const balanceCents = moneyToCents(account.balance)
    const limitCents = moneyToCents(account.creditLimit)
    const availableCents = availableCreditCents(balanceCents, limitCents)
    const utilization = utilizationRatio(balanceCents, limitCents)
    const apr = account.interestRate == null || account.interestRate === ''
      ? null
      : Number(account.interestRate)

    let targetBalance: number | null = null
    let payTo4: number | null = null
    let payTo9: number | null = null
    let extraLimitNeeded: number | null = null
    let line: string | null = null
    if (limitCents != null && limitCents > 0) {
      const bal = balanceCents ?? 0
      const target = targetBalanceCents(limitCents)
      targetBalance = centsToMoney(target)
      payTo4 = centsToMoney(payToPercentCents(bal, limitCents, UTILIZATION_TARGET))
      payTo9 = centsToMoney(payToPercentCents(bal, limitCents, UTILIZATION_CEILING))
      extraLimitNeeded = centsToMoney(extraLimitCents(bal, limitCents))
      line = analysisLine({
        nickname: account.nickname || account.vendor?.name || 'Account',
        balanceCents: bal,
        limitCents,
        utilization: utilization ?? 0,
        targetCents: target,
        payTo4Cents: payToPercentCents(bal, limitCents, UTILIZATION_TARGET),
      })
    }

    const typeName = account.type?.name || account.accountType || null
    const number = account.accountNumber || ''

    return {
      accountId: account.id,
      nickname: account.nickname ?? null,
      vendorName: account.vendor?.name || '—',
      accountNumber: number,
      accountNumberLast4: last4(number),
      accountTypeName: typeName,
      originalBalance: originalCents == null ? null : centsToMoney(originalCents),
      currentBalance: balanceCents == null ? null : centsToMoney(balanceCents),
      creditLimit: limitCents == null ? null : centsToMoney(limitCents),
      availableCredit: availableCents == null ? null : centsToMoney(availableCents),
      utilization,
      apr: apr != null && Number.isFinite(apr) ? apr : null,
      averagePayment,
      lastPaymentAmount,
      lastPaymentDate,
      nextDueDate,
      paydownPercent: paydownPercent(originalCents, balanceCents),
      targetBalance,
      payTo4,
      payTo9,
      extraLimitNeeded,
      analysisLine: line,
    }
  }).sort((a, b) => {
    const vendor = a.vendorName.localeCompare(b.vendorName)
    if (vendor !== 0) return vendor
    return (a.nickname || '').localeCompare(b.nickname || '')
  })

  const sum = (pick: (row: AccountsReportRow) => number | null) =>
    centsToMoney(rows.reduce((acc, row) => {
      const cents = moneyToCents(pick(row))
      return acc + (cents ?? 0)
    }, 0))

  const revolving = rows.filter((row) => row.creditLimit != null && row.creditLimit > 0)
  let overallUtilization: number | null = null
  let maxUtilization: number | null = null
  let utilizationOnlyFicoEstimate: number | null = null
  let payTo4All: number | null = null
  let payTo9All: number | null = null
  let allZeroRecommendation: { accountId: string; reportBalance: number } | null = null

  if (revolving.length > 0) {
    const totalBal = revolving.reduce((acc, row) => acc + (moneyToCents(row.currentBalance) ?? 0), 0)
    const totalLim = revolving.reduce((acc, row) => acc + (moneyToCents(row.creditLimit) ?? 0), 0)
    overallUtilization = totalLim > 0 ? totalBal / totalLim : null
    maxUtilization = revolving.reduce((max, row) => {
      const u = row.utilization ?? 0
      return u > max ? u : max
    }, 0)
    if (overallUtilization != null) {
      utilizationOnlyFicoEstimate = roundFico(
        combinedUtilizationScore(overallUtilization, maxUtilization ?? overallUtilization),
      )
    }
    payTo4All = centsToMoney(payToPercentCents(totalBal, totalLim, UTILIZATION_TARGET))
    payTo9All = centsToMoney(payToPercentCents(totalBal, totalLim, UTILIZATION_CEILING))
    const allZero = revolving.every((row) => (moneyToCents(row.currentBalance) ?? 0) === 0)
    if (allZero) {
      const largest = [...revolving].sort(
        (a, b) => (moneyToCents(b.creditLimit) ?? 0) - (moneyToCents(a.creditLimit) ?? 0),
      )[0]
      allZeroRecommendation = {
        accountId: largest.accountId,
        reportBalance: centsToMoney(
          allZeroReportBalanceCents(moneyToCents(largest.creditLimit) ?? 0),
        ),
      }
    }
  }

  return {
    rows,
    totals: {
      originalBalance: sum((r) => r.originalBalance),
      currentBalance: sum((r) => r.currentBalance),
      creditLimit: sum((r) => r.creditLimit),
      availableCredit: sum((r) => r.availableCredit),
    },
    utilization: {
      overallUtilization,
      maxUtilization,
      utilizationOnlyFicoEstimate,
      payTo4All,
      payTo9All,
      allZeroRecommendation,
      footnote: UTILIZATION_FICO_FOOTNOTE,
    },
  }
}
