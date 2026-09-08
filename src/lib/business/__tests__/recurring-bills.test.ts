import { estimateRecurringAmount, shouldMatchBill, isDateMatch } from '../recurring-bills'
import { Bill } from '@/types'

function bill(over: Partial<Bill>): Bill {
  return {
    id: 't',
    title: 'Electric',
    amount: 100,
    dueDate: new Date('2026-06-15'),
    status: 'PAID',
    categoryId: 'c',
    vendorId: null,
    vendorAccountId: null,
    isRecurring: false,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...over,
  } as Bill
}

describe('estimateRecurringAmount', () => {
  const template = bill({ amount: 100 })

  it('falls back to the template amount when there is no history', () => {
    expect(estimateRecurringAmount(template, [], new Date('2026-07-15'))).toBe(100)
  })

  it('uses the most recent actual (last-paid)', () => {
    const history = [
      bill({ dueDate: new Date('2026-04-15'), amount: 80 }),
      bill({ dueDate: new Date('2026-05-15'), amount: 95 }),
    ]
    expect(estimateRecurringAmount(template, history, new Date('2026-06-15'))).toBe(95)
  })

  it('uses the same-month seasonal average when ≥2 years of that month exist', () => {
    const history = [
      bill({ dueDate: new Date('2024-07-15'), amount: 200 }),
      bill({ dueDate: new Date('2025-07-15'), amount: 220 }),
      bill({ dueDate: new Date('2026-05-15'), amount: 90 }), // recent, but not July
    ]
    // Target is July → seasonal avg(200, 220) = 210, not the last-paid 90.
    expect(estimateRecurringAmount(template, history, new Date('2026-07-10'))).toBe(210)
  })

  it('ignores SKIPPED bills', () => {
    const history = [
      bill({ dueDate: new Date('2026-05-15'), amount: 95, status: 'SKIPPED' }),
      bill({ dueDate: new Date('2026-04-15'), amount: 80 }),
    ]
    expect(estimateRecurringAmount(template, history, new Date('2026-06-15'))).toBe(80)
  })
})

describe('matchers', () => {
  const template = bill({ categoryId: 'c', vendorId: 'v', vendorAccountId: 'a' })

  it('matches on category + vendor + account', () => {
    expect(shouldMatchBill(bill({ categoryId: 'c', vendorId: 'v', vendorAccountId: 'a' }), template)).toBe(true)
    expect(shouldMatchBill(bill({ categoryId: 'x', vendorId: 'v', vendorAccountId: 'a' }), template)).toBe(false)
  })

  it('isDateMatch within ±3 days', () => {
    expect(isDateMatch(new Date('2026-06-15'), new Date('2026-06-17'))).toBe(true)
    expect(isDateMatch(new Date('2026-06-15'), new Date('2026-06-20'))).toBe(false)
  })
})
