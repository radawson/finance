import { BillStatus } from '@/generated/prisma/client'
import { addDays, isBefore, isAfter, differenceInDays } from 'date-fns'

/**
 * Calculate bill status based on due date and current date
 * @param dueDate - The bill's due date
 * @param paidDate - Optional paid date
 * @param currentStatus - Current status (if already set)
 * @returns Calculated BillStatus
 */
export function calculateBillStatus(
  dueDate: Date,
  paidDate?: Date | null,
  currentStatus?: BillStatus
): BillStatus {
  // If bill is already paid or skipped, keep that status
  if (currentStatus === BillStatus.PAID || currentStatus === BillStatus.SKIPPED) {
    return currentStatus
  }

  // If paidDate is set, mark as paid
  if (paidDate) {
    return BillStatus.PAID
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const daysUntilDue = differenceInDays(due, today)

  // Overdue: due date has passed
  if (isBefore(due, today)) {
    return BillStatus.OVERDUE
  }

  // Due soon: within 7 days
  if (daysUntilDue <= 7) {
    return BillStatus.DUE_SOON
  }

  // Pending: more than 7 days away
  return BillStatus.PENDING
}

/**
 * Check if a bill is due soon (within specified days)
 * @param dueDate - The bill's due date
 * @param days - Number of days to check (default: 7)
 * @returns true if bill is due within the specified days
 */
export function isDueSoon(dueDate: Date, days: number = 7): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  const daysUntilDue = differenceInDays(due, today)
  return daysUntilDue >= 0 && daysUntilDue <= days
}

/**
 * Check if a bill is overdue
 * @param dueDate - The bill's due date
 * @returns true if bill is overdue
 */
export function isOverdue(dueDate: Date): boolean {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const due = new Date(dueDate)
  due.setHours(0, 0, 0, 0)

  return isBefore(due, today)
}

/**
 * Get bills that are due soon (within specified days)
 * @param bills - Array of bills
 * @param days - Number of days to check (default: 7)
 * @returns Filtered array of bills due soon
 */
export function getBillsDueSoon<T extends { dueDate: Date; status?: BillStatus }>(
  bills: T[],
  days: number = 7
): T[] {
  return bills.filter(
    (bill) =>
      isDueSoon(bill.dueDate, days) &&
      bill.status !== BillStatus.PAID &&
      bill.status !== BillStatus.SKIPPED
  )
}

/**
 * Get overdue bills
 * @param bills - Array of bills
 * @returns Filtered array of overdue bills
 */
export function getOverdueBills<T extends { dueDate: Date; status?: BillStatus }>(
  bills: T[]
): T[] {
  return bills.filter(
    (bill) =>
      isOverdue(bill.dueDate) &&
      bill.status !== BillStatus.PAID &&
      bill.status !== BillStatus.SKIPPED
  )
}

/**
 * Get upcoming bills (within specified days)
 * @param bills - Array of bills
 * @param days - Number of days to check (default: 30)
 * @returns Filtered array of upcoming bills
 */
export function getUpcomingBills<T extends { dueDate: Date; status?: BillStatus }>(
  bills: T[],
  days: number = 30
): T[] {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const futureDate = addDays(today, days)

  return bills.filter((bill) => {
    const due = new Date(bill.dueDate)
    due.setHours(0, 0, 0, 0)

    return (
      (isAfter(due, today) || due.getTime() === today.getTime()) &&
      isBefore(due, futureDate) &&
      bill.status !== BillStatus.PAID &&
      bill.status !== BillStatus.SKIPPED
    )
  })
}
