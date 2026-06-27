import {
  planExpenseForBill,
  categoryBreakdownFromExpenses,
  filterExpensesInPeriod,
  BillForLedger,
} from '../ledger'
import { Expense } from '@/types'

const baseBill: BillForLedger = {
  id: 'bill-1',
  status: 'PENDING',
  paidDate: null,
  dueDate: new Date('2026-06-15'),
  amount: 100,
  categoryId: 'cat-1',
  vendorId: 'vendor-1',
  title: 'Electric bill',
  createdById: 'user-1',
  vendor: { name: 'Power Co' },
}

describe('planExpenseForBill', () => {
  it('upserts an expense when the bill is PAID, dated by paidDate', () => {
    const plan = planExpenseForBill({
      ...baseBill,
      status: 'PAID',
      paidDate: new Date('2026-06-20'),
    })
    expect(plan.action).toBe('upsert')
    if (plan.action !== 'upsert') throw new Error('expected upsert')
    expect(plan.data.date).toEqual(new Date('2026-06-20'))
    expect(plan.data.amount).toBe(100)
    expect(plan.data.categoryId).toBe('cat-1')
    expect(plan.data.payee).toBe('Power Co')
    expect(plan.data.createdById).toBe('user-1')
  })

  it('falls back to dueDate when a PAID bill has no paidDate', () => {
    const plan = planExpenseForBill({ ...baseBill, status: 'PAID', paidDate: null })
    if (plan.action !== 'upsert') throw new Error('expected upsert')
    expect(plan.data.date).toEqual(new Date('2026-06-15'))
  })

  it('uses the bill title as payee when there is no vendor', () => {
    const plan = planExpenseForBill({ ...baseBill, status: 'PAID', vendor: null, vendorId: null })
    if (plan.action !== 'upsert') throw new Error('expected upsert')
    expect(plan.data.payee).toBe('Electric bill')
    expect(plan.data.vendorId).toBeNull()
  })

  it('deletes the linked expense when the bill is not PAID', () => {
    expect(planExpenseForBill({ ...baseBill, status: 'PENDING' })).toEqual({ action: 'delete' })
    expect(planExpenseForBill({ ...baseBill, status: 'OVERDUE' })).toEqual({ action: 'delete' })
    expect(planExpenseForBill({ ...baseBill, status: 'SKIPPED' })).toEqual({ action: 'delete' })
  })
})

function makeExpense(over: Partial<Expense>): Expense {
  return {
    id: 'e',
    date: new Date('2026-06-10'),
    amount: 50,
    categoryId: 'cat-1',
    payee: null,
    note: null,
    vendorId: null,
    billId: null,
    createdById: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  }
}

describe('categoryBreakdownFromExpenses', () => {
  it('groups and sums by category', () => {
    const expenses = [
      makeExpense({ id: '1', categoryId: 'cat-1', amount: 50, category: { id: 'cat-1', name: 'Food', color: '#fff', kind: 'VARIABLE', isGlobal: true, createdAt: new Date(), updatedAt: new Date() } }),
      makeExpense({ id: '2', categoryId: 'cat-1', amount: 30, category: { id: 'cat-1', name: 'Food', color: '#fff', kind: 'VARIABLE', isGlobal: true, createdAt: new Date(), updatedAt: new Date() } }),
      makeExpense({ id: '3', categoryId: 'cat-2', amount: 20, category: { id: 'cat-2', name: 'Fuel', color: null, kind: 'VARIABLE', isGlobal: true, createdAt: new Date(), updatedAt: new Date() } }),
    ]
    const breakdown = categoryBreakdownFromExpenses(expenses).sort((a, b) => a.categoryName.localeCompare(b.categoryName))
    expect(breakdown).toHaveLength(2)
    expect(breakdown[0]).toMatchObject({ categoryName: 'Food', count: 2, totalAmount: 80 })
    expect(breakdown[1]).toMatchObject({ categoryName: 'Fuel', count: 1, totalAmount: 20 })
  })
})

describe('filterExpensesInPeriod', () => {
  it('includes expenses within the inclusive day range and excludes others', () => {
    // All local datetimes so day-boundary normalization is timezone-consistent.
    const expenses = [
      makeExpense({ id: 'in-start', date: new Date('2026-06-01T00:00:00') }),
      makeExpense({ id: 'in-mid', date: new Date('2026-06-15T12:00:00') }),
      makeExpense({ id: 'in-end', date: new Date('2026-06-30T23:00:00') }),
      makeExpense({ id: 'before', date: new Date('2026-05-31T23:00:00') }),
      makeExpense({ id: 'after', date: new Date('2026-07-01T01:00:00') }),
    ]
    const result = filterExpensesInPeriod(
      expenses,
      new Date('2026-06-01T00:00:00'),
      new Date('2026-06-30T00:00:00'),
    )
    expect(result.map((e) => e.id).sort()).toEqual(['in-end', 'in-mid', 'in-start'])
  })
})
