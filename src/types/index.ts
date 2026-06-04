import { Role, BillStatus, RecurrenceFrequency } from '@/generated/prisma/client'
import { Decimal } from '@/generated/prisma/internal/prismaNamespace'

export type { Role, BillStatus, RecurrenceFrequency }

// Flexible decimal type: Prisma Decimal on server, string after JSON serialization on client
export type DecimalValue = Decimal | string | number

// UUID validation regex (replaces deprecated z.string().uuid())
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export enum BillStatusEnum {
  PREDICTED = 'PREDICTED',
  PENDING = 'PENDING',
  DUE_SOON = 'DUE_SOON',
  OVERDUE = 'OVERDUE',
  PAID = 'PAID',
  SKIPPED = 'SKIPPED',
}

export enum RecurrenceFrequencyEnum {
  MONTHLY = 'MONTHLY',
  QUARTERLY = 'QUARTERLY',
  BIANNUALLY = 'BIANNUALLY',
  YEARLY = 'YEARLY',
}

export interface User {
  id: string
  email: string
  name: string
  role: Role
  department?: string | null
  isKeycloakUser: boolean
  createdAt: Date
  updatedAt: Date
}

export interface Category {
  id: string
  name: string
  description?: string | null
  color?: string | null
  isGlobal: boolean
  userId?: string | null
  createdAt: Date
  updatedAt: Date
  user?: User | null
}

export interface AccountType {
  id: string
  name: string
  description?: string | null
  createdAt: Date
  updatedAt: Date
  accounts?: VendorAccount[]
}

export interface VendorAccount {
  id: string
  vendorId: string
  accountNumber: string
  accountTypeId?: string | null
  accountType?: string | null  // Legacy field for backward compatibility
  balance?: DecimalValue | null  // Prisma Decimal on server, string on client
  interestRate?: DecimalValue | null  // Prisma Decimal on server, string on client
  nickname?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  vendor?: Vendor | null
  type?: AccountType | null
}

export interface VendorAccountBalanceSnapshot {
  id: string
  accountId: string
  balance: DecimalValue  // Prisma Decimal on server, string on client
  recordedAt: Date
}

export interface Vendor {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  addressLine2?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  website?: string | null
  logo?: string | null
  description?: string | null
  tags?: string[] // Array of tag strings (max 128 chars each)
  createdById?: string | null
  createdAt: Date
  updatedAt: Date
  createdBy?: User | null
  accounts?: VendorAccount[]
}

export interface RecurrencePattern {
  id: string
  frequency: RecurrenceFrequency
  dayOfMonth: number
  startDate: Date
  endDate?: Date | null
  billId: string
  createdAt: Date
  updatedAt: Date
}

export type PredictionMethod = 'trend' | 'weighted' | 'seasonal' | 'average' | 'synthetic'

export interface Bill {
  id: string
  title: string
  description?: string | null
  amount: number
  dueDate: Date
  paidDate?: Date | null
  status: BillStatus
  categoryId: string
  vendorId?: string | null
  vendorAccountId?: string | null
  createdById?: string | null
  recurrencePatternId?: string | null
  isRecurring: boolean
  nextDueDate?: Date | null
  invoiceNumber?: string | null
  tags?: string[] // Array of tag strings (max 128 chars each)
  templateBillId?: string | null // FK to the recurring bill that generated this prediction
  predictionConfidence?: number | null // 0.00–1.00 confidence score
  predictionMethod?: PredictionMethod | null // Method used to forecast amount
  createdAt: Date
  updatedAt: Date
  category?: Category
  vendor?: Vendor | null
  vendorAccount?: VendorAccount | null
  createdBy?: User | null
  recurrencePattern?: RecurrencePattern | null
  templateBill?: Bill | null
  predictions?: Bill[]
  comments?: Comment[]
  attachments?: Attachment[]
  _count?: {
    comments: number
    attachments: number
  }
}

export interface Comment {
  id: string
  content: string
  billId: string
  userId?: string | null
  createdAt: Date
  updatedAt: Date
  bill?: Bill
  user?: User | null
}

export interface Attachment {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  billId: string
  uploadedById?: string | null
  createdAt: Date
  bill?: Bill
  uploadedBy?: User | null
}

export interface BillWithDetails extends Bill {
  category: Category
  vendor: Vendor | null
  vendorAccount: VendorAccount | null
  createdBy: User | null
  recurrencePattern: RecurrencePattern | null
  comments: (Comment & { user: User | null })[]
  attachments: (Attachment & { uploadedBy: User | null })[]
  _count: {
    comments: number
    attachments: number
  }
}

export interface DashboardStats {
  totalBills: number
  pendingBills: number
  dueSoonBills: number
  overdueBills: number
  paidBills: number
  skippedBills: number
  predictedBills: number // Predicted bills awaiting actualization
  missingBills: number // Predicted bills past due date
  upcomingBills: number // Bills due in next 7 days
  upcomingBills30: number // Bills due in next 30 days
  categoryBreakdown: {
    categoryId: string
    categoryName: string
    color: string | null
    count: number
    totalAmount: number
  }[]
  projectedCategoryBreakdown: {
    categoryId: string
    categoryName: string
    color: string | null
    count: number
    totalAmount: number
  }[]
  /** Recurring forecast merged with actuals; only when includeForecast=true */
  forecastCategoryBreakdown?: {
    categoryId: string
    categoryName: string
    color: string | null
    count: number
    totalAmount: number
  }[]
  recentBills: Bill[]
  upcomingBillsList: Bill[]
  overdueBillsList: Bill[]
  predictedBillsList: Bill[] // Predicted bills for next 30 days
}

export type AnalysisPeriod = 'monthly' | 'quarterly' | 'yearly' | 'custom'

export interface HistoricBillsPeriodData {
  periodLabel: string
  totalAmount: number
  billCount: number
  bills: Bill[]
}

export interface HistoricBillsData {
  period: AnalysisPeriod
  data: HistoricBillsPeriodData[]
}

export interface PredictedBill {
  title: string
  amount: number
  dueDate: Date
  source: 'recurrence' | 'historical-analysis' | 'detected'
  billId?: string
  categoryId?: string
  vendorId?: string | null
  vendorAccountId?: string | null
  method?: PredictionMethod
  confidence?: number
}

export interface BudgetPredictionPeriodData {
  periodLabel: string
  predictedAmount: number
  billCount: number
  bills: PredictedBill[]
}

export interface BudgetPredictionData {
  period: AnalysisPeriod
  /** Actual bills in range (default view) */
  actuals: BudgetPredictionPeriodData[]
  /** Merged actuals + recurring forecast when includeForecast=true */
  predictions: BudgetPredictionPeriodData[]
  includeForecast?: boolean
  historicData?: HistoricBillsPeriodData[]
}

export interface VendorTrendPeriodData {
  periodLabel: string
  totalAmount: number
  billCount: number
}

export interface VendorTrendData {
  vendorId: string
  vendorName: string
  periods: VendorTrendPeriodData[]
}

export interface VendorTrendsResponse {
  period: AnalysisPeriod
  vendors: VendorTrendData[]
}

export interface Notification {
  id: string
  type: 'bill_assigned' | 'bill_updated' | 'bill_comment' | 'bill_attachment'
  title: string
  message: string
  billId?: string | null
  billTitle?: string
  createdBy?: { id: string; name: string }
  read: boolean
  createdAt: Date
  user?: User
}

export interface Note {
  id: string
  userId: string
  content: string
  isTodo: boolean
  isCleared: boolean
  clearedAt?: Date | null
  createdAt: Date
  updatedAt: Date
}

export type NotificationBadgeType = 'notification' | 'todo'
