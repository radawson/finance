import { startOfWeek, startOfMonth, startOfQuarter, startOfYear, startOfDay, endOfWeek, endOfMonth, endOfQuarter, endOfYear, endOfDay } from 'date-fns'

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
