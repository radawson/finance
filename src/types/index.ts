import { Role, BillStatus, RecurrenceFrequency } from '@/generated/prisma/client'

export type { Role, BillStatus, RecurrenceFrequency }

// UUID validation regex (replaces deprecated z.string().uuid())
export const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export enum BillStatusEnum {
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
  nickname?: string | null
  notes?: string | null
  isActive: boolean
  createdAt: Date
  updatedAt: Date
  vendor?: Vendor | null
  type?: AccountType | null
}

export interface Vendor {
  id: string
  name: string
  email?: string | null
  phone?: string | null
  address?: string | null
  city?: string | null
  state?: string | null
  zip?: string | null
  country?: string | null
  website?: string | null
  logo?: string | null
  description?: string | null
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
  createdAt: Date
  updatedAt: Date
  category?: Category
  vendor?: Vendor | null
  vendorAccount?: VendorAccount | null
  createdBy?: User | null
  recurrencePattern?: RecurrencePattern | null
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
  upcomingBills: number // Bills due in next 7 days
  upcomingBills30: number // Bills due in next 30 days
  categoryBreakdown: {
    categoryId: string
    categoryName: string
    count: number
    totalAmount: number
  }[]
  recentBills: Bill[]
  upcomingBillsList: Bill[]
  overdueBillsList: Bill[]
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
  source: 'recurrence' | 'historical-analysis'
  billId?: string
  categoryId?: string
  vendorId?: string | null
}

export interface BudgetPredictionPeriodData {
  periodLabel: string
  predictedAmount: number
  billCount: number
  bills: PredictedBill[]
}

export interface BudgetPredictionData {
  period: AnalysisPeriod
  predictions: BudgetPredictionPeriodData[]
  historicData?: HistoricBillsPeriodData[]
}
