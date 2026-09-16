import {
  asCalendarDate,
  calendarDateInputValue,
  calendarDateToIso,
  calendarDayOfMonth,
  formatCalendarDate,
  inCalendarYmdRange,
  parseCalendarDate,
} from '../date-utils'

describe('calendar dates', () => {
  it('stores a date-only form value at UTC noon', () => {
    expect(calendarDateToIso('2026-09-15')).toBe('2026-09-15T12:00:00.000Z')
  })

  it('keeps UTC-midnight legacy values on the intended calendar day', () => {
    expect(calendarDateInputValue('2026-09-15T00:00:00.000Z')).toBe('2026-09-15')
    expect(formatCalendarDate('2026-09-15T00:00:00.000Z')).toBe('Sep 15, 2026')
  })

  it('does not drift a day when an edit form is saved again', () => {
    const firstSave = calendarDateToIso('2026-09-15')
    const inputValue = calendarDateInputValue(firstSave)
    expect(inputValue).toBe('2026-09-15')
    const secondSave = calendarDateToIso(inputValue)
    expect(calendarDateInputValue(secondSave)).toBe('2026-09-15')
  })

  it('parses date-only and ISO payloads to the same UTC day', () => {
    const fromDateOnly = parseCalendarDate('2026-09-15')
    const fromIso = parseCalendarDate('2026-09-15T00:00:00.000Z')
    const fromNoon = parseCalendarDate('2026-09-15T12:00:00.000Z')
    expect(fromDateOnly?.toISOString()).toBe('2026-09-15T12:00:00.000Z')
    expect(fromIso?.toISOString()).toBe('2026-09-15T12:00:00.000Z')
    expect(fromNoon?.toISOString()).toBe('2026-09-15T12:00:00.000Z')
    expect(asCalendarDate('2026-09-15').toISOString()).toBe('2026-09-15T12:00:00.000Z')
  })

  it('uses the UTC day of month for recurrence defaults', () => {
    expect(calendarDayOfMonth('2026-09-15')).toBe(15)
    expect(calendarDayOfMonth('2026-09-15T00:00:00.000Z')).toBe(15)
  })

  it('filters by Y-M-D strings without local shifting', () => {
    const stored = '2026-09-15T00:00:00.000Z'
    expect(inCalendarYmdRange(stored, '2026-09-15', '2026-09-15')).toBe(true)
    expect(inCalendarYmdRange(stored, '2026-09-16', '2026-09-30')).toBe(false)
    expect(inCalendarYmdRange(stored, '2026-09-01', '2026-09-14')).toBe(false)
  })
})
