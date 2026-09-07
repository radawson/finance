import { mergeBillsWithForecast } from '../merge-forecast'
import { isActualBill, filterActualBillsInPeriod } from '../period-ledger'
import { Bill } from '@/types'

describe('mergeBillsWithForecast', () => {
  it('keeps one line when actual matches forecast within tolerance', () => {
    const actuals = [
      {
        title: 'Electric',
        amount: 150,
        dueDate: new Date('2026-03-15'),
        categoryId: 'cat-1',
        vendorId: 'v-1',
        vendorAccountId: null,
        billId: 'actual-1',
      },
    ]
    const forecast = [
      {
        title: 'Electric (forecast)',
        amount: 140,
        dueDate: new Date('2026-03-17'),
        categoryId: 'cat-1',
        vendorId: 'v-1',
        vendorAccountId: null,
      },
    ]

    const merged = mergeBillsWithForecast(actuals, forecast)
    expect(merged).toHaveLength(1)
    expect(merged[0].amount).toBe(150)
    expect(merged[0].billId).toBe('actual-1')
  })

  it('includes unmatched forecast slots', () => {
    const actuals = [
      {
        title: 'Grocery',
        amount: 80,
        dueDate: new Date('2026-03-01'),
        categoryId: 'cat-2',
        vendorId: 'v-2',
        vendorAccountId: null,
        billId: 'g-1',
      },
    ]
    const forecast = [
      {
        title: 'Rent',
        amount: 1200,
        dueDate: new Date('2026-03-28'),
        categoryId: 'cat-3',
        vendorId: 'v-3',
        vendorAccountId: null,
      },
    ]

    const merged = mergeBillsWithForecast(actuals, forecast)
    expect(merged).toHaveLength(2)
    expect(merged.map((m) => m.title)).toContain('Rent')
  })
})

describe('isActualBill', () => {
  const base: Bill = {
    id: '1',
    title: 'Test',
    amount: 10,
    dueDate: new Date(),
    status: 'PENDING',
    categoryId: 'c',
    isRecurring: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  }

  it('excludes recurring templates', () => {
    expect(isActualBill({ ...base, isRecurring: true })).toBe(false)
  })

  it('includes normal bills', () => {
    expect(isActualBill(base)).toBe(true)
  })
})

describe('filterActualBillsInPeriod', () => {
  it('filters by due date and excludes templates', () => {
    const bills: Bill[] = [
      {
        id: '1',
        title: 'One-off',
        amount: 50,
        dueDate: new Date('2026-03-10'),
        status: 'PENDING',
        categoryId: 'c',
        isRecurring: false,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
      {
        id: '2',
        title: 'Template',
        amount: 100,
        dueDate: new Date('2026-03-10'),
        status: 'PENDING',
        categoryId: 'c',
        isRecurring: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]

    const filtered = filterActualBillsInPeriod(
      bills,
      new Date('2026-03-01'),
      new Date('2026-03-31'),
    )
    expect(filtered).toHaveLength(1)
    expect(filtered[0].id).toBe('1')
  })
})
