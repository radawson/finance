import { Bill } from '@/types'
import { forecastObligations } from '../analysis'

const d = (year: number, month: number, day: number) => new Date(year, month - 1, day)

function template(over: Partial<Bill> = {}): Bill {
  return {
    id: 'tmpl-1',
    title: 'Electric',
    amount: 120,
    dueDate: d(2024, 1, 15),
    status: 'PENDING',
    categoryId: 'cat-1',
    vendorId: 'v-1',
    vendorAccountId: null,
    isRecurring: true,
    createdAt: d(2024, 1, 1),
    updatedAt: d(2024, 1, 1),
    recurrencePattern: {
      id: 'pat-1',
      frequency: 'MONTHLY',
      dayOfMonth: 15,
      startDate: d(2024, 1, 15),
      endDate: null,
      billId: 'tmpl-1',
      createdAt: d(2024, 1, 1),
      updatedAt: d(2024, 1, 1),
    },
    ...over,
  } as Bill
}

describe('forecastObligations', () => {
  it('emits the current month’s slot for a monthly template', () => {
    const slots = forecastObligations(
      [template()],
      d(2026, 9, 1),
      d(2026, 9, 30),
    )
    expect(slots).toHaveLength(1)
    expect(slots[0].dueDate.getFullYear()).toBe(2026)
    expect(slots[0].dueDate.getMonth()).toBe(8)
    expect(slots[0].dueDate.getDate()).toBe(15)
    expect(slots[0].billId).toBe('tmpl-1')
    expect(slots[0].source).toBe('recurrence')
  })

  it('uses last-paid amount when there is matching history', () => {
    const history: Bill[] = [
      {
        ...template({ id: 'paid-1', isRecurring: false, recurrencePattern: null }),
        amount: 99,
        dueDate: d(2026, 8, 15),
        status: 'PAID',
      },
    ]
    const slots = forecastObligations(
      [template()],
      d(2026, 9, 1),
      d(2026, 9, 30),
      history,
    )
    expect(slots[0].amount).toBe(99)
  })
})
