import { enhancePredictionsWithActualData } from '../recurring-bills'
import { Bill, PredictedBill } from '@/types'

const template: Bill = {
  id: 'template-1',
  title: 'Internet',
  amount: 60,
  dueDate: new Date('2026-01-01'),
  status: 'PENDING',
  categoryId: 'cat-1',
  vendorId: 'v-1',
  vendorAccountId: null,
  isRecurring: true,
  createdAt: new Date(),
  updatedAt: new Date(),
  recurrencePattern: {
    id: 'rp-1',
    frequency: 'MONTHLY',
    dayOfMonth: 1,
    startDate: new Date('2026-01-01'),
    endDate: null,
    billId: 'template-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  },
}

describe('enhancePredictionsWithActualData', () => {
  it('preserves detected-pattern predictions without a template id match', () => {
    const predictions: PredictedBill[] = [
      {
        title: 'Detected bill',
        amount: 45,
        dueDate: new Date('2026-04-01'),
        source: 'detected',
        billId: 'historical-1',
        categoryId: 'cat-9',
        vendorId: 'v-9',
      },
    ]

    const result = enhancePredictionsWithActualData(predictions, [], [template])
    expect(result).toHaveLength(1)
    expect(result[0].title).toBe('Detected bill')
    expect(result[0].source).toBe('detected')
  })

  it('appends future one-off actuals not tied to a prediction slot', () => {
    const predictions: PredictedBill[] = [
      {
        title: 'Internet',
        amount: 60,
        dueDate: new Date('2026-05-01'),
        source: 'recurrence',
        billId: 'template-1',
        categoryId: 'cat-1',
        vendorId: 'v-1',
      },
    ]

    const futureOneOff: Bill = {
      id: 'one-off-1',
      title: 'Grocery run',
      amount: 125,
      dueDate: new Date('2026-03-20'),
      status: 'PENDING',
      categoryId: 'cat-2',
      vendorId: 'v-2',
      vendorAccountId: null,
      isRecurring: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = enhancePredictionsWithActualData(
      predictions,
      [futureOneOff],
      [template],
    )

    expect(result.some((r) => r.title === 'Grocery run')).toBe(true)
    expect(result.some((r) => r.title === 'Internet')).toBe(true)
  })

  it('replaces prediction with actual when dates match', () => {
    const predictions: PredictedBill[] = [
      {
        title: 'Internet',
        amount: 60,
        dueDate: new Date('2026-03-01'),
        source: 'recurrence',
        billId: 'template-1',
        categoryId: 'cat-1',
        vendorId: 'v-1',
      },
    ]

    const actual: Bill = {
      id: 'actual-1',
      title: 'Internet March',
      amount: 62.5,
      dueDate: new Date('2026-03-02'),
      status: 'PAID',
      categoryId: 'cat-1',
      vendorId: 'v-1',
      vendorAccountId: null,
      isRecurring: false,
      createdAt: new Date(),
      updatedAt: new Date(),
    }

    const result = enhancePredictionsWithActualData(predictions, [actual], [template])
    const march = result.find((r) => r.billId === 'actual-1')
    expect(march).toBeDefined()
    expect(march?.amount).toBe(62.5)
    expect(result.filter((r) => r.title.includes('Internet'))).toHaveLength(1)
  })
})
