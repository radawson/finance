import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, startOfDay, endOfWeek, endOfMonth, endOfQuarter, endOfYear, endOfDay, format } from 'date-fns'

export type CategoryPeriod = 'week' | 'month' | 'quarter' | 'year'

/**
 * Get the start of the current week (Monday)
 */
export function getWeekStart(date: Date): Date {
  return startOfWeek(date, { weekStartsOn: 1 }) // 1 = Monday
}

/**
 * Get the start of the current month
 */
export function getMonthStart(date: Date): Date {
  return startOfMonth(date)
}

/**
 * Get the start of the current quarter
 */
export function getQuarterStart(date: Date): Date {
  return startOfQuarter(date)
}

/**
 * Get the start of the current year
 */
export function getYearStart(date: Date): Date {
  return startOfYear(date)
}

/**
 * Get the end of the current week (Sunday)
 */
export function getWeekEnd(date: Date): Date {
  return endOfWeek(date, { weekStartsOn: 1 }) // 1 = Monday, so Sunday is end
}

/**
 * Get the end of the current month
 */
export function getMonthEnd(date: Date): Date {
  return endOfMonth(date)
}

/**
 * Get the end of the current quarter
 */
export function getQuarterEnd(date: Date): Date {
  return endOfQuarter(date)
}

/**
 * Get the end of the current year
 */
export function getYearEnd(date: Date): Date {
  return endOfYear(date)
}

/**
 * Get the start date for a given period type
 * Returns the start of the period containing the given date, normalized to start of day
 */
export function getPeriodStartDate(period: CategoryPeriod, date: Date = new Date()): Date {
  // Normalize input date to start of day first
  const normalizedDate = startOfDay(date)
  
  switch (period) {
    case 'week':
      return getWeekStart(normalizedDate)
    case 'month':
      return getMonthStart(normalizedDate)
    case 'quarter':
      return getQuarterStart(normalizedDate)
    case 'year':
      return getYearStart(normalizedDate)
    default:
      return normalizedDate
  }
}

/**
 * Get the end date for a given period type
 * Returns the end of the period containing the given date, normalized to end of day
 */
export function getPeriodEndDate(period: CategoryPeriod, date: Date = new Date()): Date {
  const today = startOfDay(date)
  
  switch (period) {
    case 'week':
      return endOfDay(getWeekEnd(today))
    case 'month':
      return endOfDay(getMonthEnd(today))
    case 'quarter':
      return endOfDay(getQuarterEnd(today))
    case 'year':
      return endOfDay(getYearEnd(today))
    default:
      return endOfDay(today)
  }
}

const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/

function pad2(n: number): string {
  return String(n).padStart(2, '0')
}

function utcNoon(year: number, monthIndex: number, day: number): Date {
  return new Date(Date.UTC(year, monthIndex, day, 12, 0, 0, 0))
}

/**
 * Calendar dates (due dates, paid dates, expense dates) are stored at UTC noon
 * of the chosen Y-M-D so the day does not slip in US timezones.
 *
 * `new Date("yyyy-MM-dd")` is UTC midnight, and `format(date, "yyyy-MM-dd")`
 * uses local time — in UTC−4 that shows the previous day and can drift back
 * another day on each save.
 */
export function parseCalendarDate(value: string | Date | null | undefined): Date | null {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    return utcNoon(value.getUTCFullYear(), value.getUTCMonth(), value.getUTCDate())
  }
  const s = String(value).trim()
  if (DATE_ONLY.test(s)) {
    return new Date(`${s}T12:00:00.000Z`)
  }
  const d = new Date(s)
  if (Number.isNaN(d.getTime())) return null
  return utcNoon(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
}

/** Coerce a request payload into a UTC-noon calendar Date. */
export function asCalendarDate(value: unknown): Date {
  if (value instanceof Date) {
    return parseCalendarDate(value) ?? value
  }
  if (typeof value === 'string') {
    return parseCalendarDate(value) ?? new Date(value)
  }
  return parseCalendarDate(String(value)) ?? new Date(Number.NaN)
}

/** Encode a date-only form value as a stable ISO timestamp. */
export function calendarDateToIso(value: string): string {
  const parsed = parseCalendarDate(value)
  return parsed ? parsed.toISOString() : new Date(value).toISOString()
}

/** UTC Y-M-D of a stored calendar timestamp, for `<input type="date">`. */
export function calendarDateInputValue(value: string | Date | null | undefined): string {
  if (value == null || value === '') return ''
  const d = value instanceof Date ? value : new Date(value)
  if (Number.isNaN(d.getTime())) return ''
  return `${d.getUTCFullYear()}-${pad2(d.getUTCMonth() + 1)}-${pad2(d.getUTCDate())}`
}

/** Local Y-M-D (today, date-picker defaults, local period bounds). */
export function localCalendarDate(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function todayCalendarDate(now: Date = new Date()): string {
  return localCalendarDate(now)
}

export function calendarYmdToLocalDate(ymd: string): Date {
  const [y, m, d] = ymd.split('-').map(Number)
  return new Date(y, m - 1, d, 12, 0, 0)
}

export function formatCalendarDate(
  value: string | Date | null | undefined,
  pattern: string = 'MMM d, yyyy',
): string {
  const ymd = calendarDateInputValue(value)
  if (!ymd) return ''
  return format(calendarYmdToLocalDate(ymd), pattern)
}

export function calendarDayOfMonth(value: string | Date): number {
  const parsed = parseCalendarDate(value)
  return parsed ? parsed.getUTCDate() : 1
}

export function isSameCalendarDay(stored: string | Date, localDay: Date): boolean {
  return calendarDateInputValue(stored) === localCalendarDate(localDay)
}

export function inCalendarYmdRange(
  stored: string | Date,
  fromYmd?: string,
  toYmd?: string,
): boolean {
  const ymd = calendarDateInputValue(stored)
  if (!ymd) return false
  if (fromYmd && ymd < fromYmd) return false
  if (toYmd && ymd > toYmd) return false
  return true
}

/** Compare a stored calendar date to local period bounds (inclusive). */
export function isStoredDateInLocalRange(
  stored: string | Date,
  start: Date,
  end: Date,
): boolean {
  return inCalendarYmdRange(stored, localCalendarDate(start), localCalendarDate(end))
}

export function parseCalendarDateStart(value: string): Date {
  if (DATE_ONLY.test(value)) return new Date(`${value}T00:00:00.000Z`)
  const parsed = parseCalendarDate(value)
  if (!parsed) return new Date(value)
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 0, 0, 0, 0))
}

export function parseCalendarDateEnd(value: string): Date {
  if (DATE_ONLY.test(value)) return new Date(`${value}T23:59:59.999Z`)
  const parsed = parseCalendarDate(value)
  if (!parsed) return new Date(value)
  return new Date(Date.UTC(parsed.getUTCFullYear(), parsed.getUTCMonth(), parsed.getUTCDate(), 23, 59, 59, 999))
}
