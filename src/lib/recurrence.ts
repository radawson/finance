import { RecurrenceFrequency } from '@/generated/prisma/client'
import { addMonths, addYears, setDate, isBefore, isAfter } from 'date-fns'

/**
 * Calculate the next due date based on recurrence pattern
 * @param lastDueDate - The last due date
 * @param frequency - Recurrence frequency
 * @param dayOfMonth - Day of month (1-31)
 * @param endDate - Optional end date for recurrence
 * @returns Next due date or null if recurrence has ended
 */
export function calculateNextDueDate(
  lastDueDate: Date,
  frequency: RecurrenceFrequency,
  dayOfMonth: number,
  endDate?: Date | null
): Date | null {
  let nextDate: Date

  switch (frequency) {
    case RecurrenceFrequency.MONTHLY:
      nextDate = addMonths(lastDueDate, 1)
      break
    case RecurrenceFrequency.QUARTERLY:
      nextDate = addMonths(lastDueDate, 3)
      break
    case RecurrenceFrequency.BIANNUALLY:
      nextDate = addMonths(lastDueDate, 6)
      break
    case RecurrenceFrequency.YEARLY:
      nextDate = addYears(lastDueDate, 1)
      break
    default:
      return null
  }

  // Set the day of month
  nextDate = setDate(nextDate, Math.min(dayOfMonth, getDaysInMonth(nextDate)))

  // Check if recurrence has ended
  if (endDate && isAfter(nextDate, endDate)) {
    return null
  }

  return nextDate
}

/**
 * Get all upcoming due dates for a recurrence pattern
 * @param startDate - Start date of recurrence
 * @param frequency - Recurrence frequency
 * @param dayOfMonth - Day of month (1-31)
 * @param endDate - Optional end date
 * @param count - Number of dates to generate (default: 12)
 * @returns Array of upcoming due dates
 */
export function getUpcomingDueDates(
  startDate: Date,
  frequency: RecurrenceFrequency,
  dayOfMonth: number,
  endDate?: Date | null,
  count: number = 12
): Date[] {
  const dates: Date[] = []
  let currentDate = new Date(startDate)

  for (let i = 0; i < count; i++) {
    const nextDate = calculateNextDueDate(currentDate, frequency, dayOfMonth, endDate)
    if (!nextDate) {
      break
    }

    // Check if we've passed the end date
    if (endDate && isAfter(nextDate, endDate)) {
      break
    }

    dates.push(nextDate)
    currentDate = nextDate
  }

  return dates
}

/**
 * Get number of days in a month
 * @param date - Date to check
 * @returns Number of days in the month
 */
function getDaysInMonth(date: Date): number {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate()
}

/**
 * Validate recurrence pattern
 * @param frequency - Recurrence frequency
 * @param dayOfMonth - Day of month (1-31)
 * @param startDate - Start date
 * @param endDate - Optional end date
 * @returns Validation result with error message if invalid
 */
export function validateRecurrencePattern(
  frequency: RecurrenceFrequency,
  dayOfMonth: number,
  startDate: Date,
  endDate?: Date | null
): { valid: boolean; error?: string } {
  // Validate day of month
  if (dayOfMonth < 1 || dayOfMonth > 31) {
    return { valid: false, error: 'Day of month must be between 1 and 31' }
  }

  // Validate end date is after start date
  if (endDate && isBefore(endDate, startDate)) {
    return { valid: false, error: 'End date must be after start date' }
  }

  // Check if day of month is valid for the start date's month
  const daysInStartMonth = getDaysInMonth(startDate)
  if (dayOfMonth > daysInStartMonth) {
    return {
      valid: false,
      error: `Day of month (${dayOfMonth}) is invalid for the start date's month (max: ${daysInStartMonth})`,
    }
  }

  return { valid: true }
}
