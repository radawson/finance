import { getDueDatesInRange } from '../recurrence'

const d = (year: number, month: number, day: number) => new Date(year, month - 1, day)

describe('getDueDatesInRange', () => {
  it('includes this month’s remaining monthly due date', () => {
    const dates = getDueDatesInRange(
      d(2024, 1, 15),
      'MONTHLY',
      15,
      d(2026, 9, 1),
      d(2026, 9, 30),
    )
    expect(dates.map((x) => x.getDate())).toEqual([15])
    expect(dates[0].getMonth()).toBe(8) // September
    expect(dates[0].getFullYear()).toBe(2026)
  })

  it('starts next month when the window begins after day-of-month', () => {
    const dates = getDueDatesInRange(
      d(2024, 1, 15),
      'MONTHLY',
      15,
      d(2026, 9, 16),
      d(2026, 10, 31),
    )
    expect(dates).toHaveLength(1)
    expect(dates[0].getMonth()).toBe(9) // October
    expect(dates[0].getDate()).toBe(15)
  })

  it('does not invent yearly dates in the wrong month', () => {
    const dates = getDueDatesInRange(
      d(2024, 1, 15),
      'YEARLY',
      15,
      d(2026, 9, 1),
      d(2026, 9, 30),
    )
    expect(dates).toEqual([])
  })

  it('includes the yearly anniversary inside the window', () => {
    const dates = getDueDatesInRange(
      d(2024, 1, 15),
      'YEARLY',
      15,
      d(2026, 1, 1),
      d(2026, 1, 31),
    )
    expect(dates).toHaveLength(1)
    expect(dates[0].getFullYear()).toBe(2026)
    expect(dates[0].getMonth()).toBe(0)
    expect(dates[0].getDate()).toBe(15)
  })

  it('respects pattern endDate', () => {
    const dates = getDueDatesInRange(
      d(2026, 1, 15),
      'MONTHLY',
      15,
      d(2026, 1, 1),
      d(2026, 6, 30),
      d(2026, 3, 20),
    )
    expect(dates.map((x) => x.getMonth())).toEqual([0, 1, 2]) // Jan, Feb, Mar
  })
})
