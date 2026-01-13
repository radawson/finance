import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, startOfDay } from 'date-fns'

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
 * Get the start date for a given period type
 * Returns the start of the period containing the given date, normalized to start of day
 */
export function getPeriodStartDate(period: CategoryPeriod, date: Date = new Date()): Date {
  const today = startOfDay(date)
  
  switch (period) {
    case 'week':
      return startOfDay(getWeekStart(today))
    case 'month':
      return startOfDay(getMonthStart(today))
    case 'quarter':
      return startOfDay(getQuarterStart(today))
    case 'year':
      return startOfDay(getYearStart(today))
    default:
      return startOfDay(today)
  }
}
