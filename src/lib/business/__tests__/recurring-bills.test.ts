import { estimateRecurringAmount, shouldMatchBill, isDateMatch, findMatchingForecastSlot } from '../recurring-bills'
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
  const template = bill({ title: 'Kathy Amex', categoryId: 'c', vendorId: 'v', vendorAccountId: 'a' })

  it('matches on normalized title + vendor, ignoring category and account', () => {
    expect(
      shouldMatchBill(
        bill({ title: 'kathy amex', categoryId: 'other', vendorId: 'v', vendorAccountId: 'other-acct' }),
        template,
      ),
    ).toBe(true)
    expect(shouldMatchBill(bill({ title: 'Kathy Amex', vendorId: 'other' }), template)).toBe(false)
    expect(shouldMatchBill(bill({ title: 'John Amex', vendorId: 'v' }), template)).toBe(false)
  })

  it('isDateMatch within ±2 days', () => {
    expect(isDateMatch(new Date('2026-06-15'), new Date('2026-06-17'))).toBe(true)
    expect(isDateMatch(new Date('2026-06-15'), new Date('2026-06-18'))).toBe(false)
    expect(isDateMatch(new Date('2026-06-15'), new Date('2026-06-20'))).toBe(false)
  })
})

describe('findMatchingForecastSlot', () => {
  const kathy = {
    title: 'Kathy Amex',
    dueDate: new Date('2026-06-15'),
    vendorId: 'amex',
  }
  const john = {
    title: 'John Amex',
    dueDate: new Date('2026-06-15'),
    vendorId: 'amex',
  }

  it('matches a unique vendor + nearby due date even if category/title differ', () => {
    const match = findMatchingForecastSlot(
      { title: 'Kathy Amex', dueDate: new Date('2026-06-17'), vendorId: 'amex' },
      [kathy],
    )
    expect(match).toEqual(kathy)
  })

  it('uses title to pick among multiple same-vendor nearby slots', () => {
    const match = findMatchingForecastSlot(
      { title: 'Kathy Amex', dueDate: new Date('2026-06-15'), vendorId: 'amex' },
      [kathy, john],
    )
    expect(match).toEqual(kathy)
  })

  it('does not auto-match when vendor + date is ambiguous and titles do not uniquely match', () => {
    const match = findMatchingForecastSlot(
      { title: 'AMEX', dueDate: new Date('2026-06-15'), vendorId: 'amex' },
      [kathy, john],
    )
    expect(match).toBeNull()
  })

  it('falls back to unique title + date when the bill has no vendor', () => {
    const match = findMatchingForecastSlot(
      { title: 'Kathy Amex', dueDate: new Date('2026-06-16'), vendorId: null },
      [kathy, john],
    )
    expect(match).toEqual(kathy)
  })
})
