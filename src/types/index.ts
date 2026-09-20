import { Role, BillStatus, RecurrenceFrequency, CategoryKind, EnvelopePeriod } from '@/generated/prisma/client'
import { Decimal } from '@/generated/prisma/internal/prismaNamespace'

export type { Role, BillStatus, RecurrenceFrequency, CategoryKind, EnvelopePeriod }

// Flexible decimal type: Prisma Decimal on server, string after JSON serialization on client
export type DecimalValue = Decimal | string | number

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
  kind: CategoryKind // FIXED -> projected from obligations; VARIABLE -> from envelopes
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
  initialValue?: DecimalValue | null  // Original principal / starting value
  creditLimit?: DecimalValue | null  // Revolving credit limit
  avgMonthlyPayment?: DecimalValue | null  // Typical monthly payment
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

export interface Bill {
  id: string
  title: string
  description?: string | null
  amount: number
  minimumPayment?: number | null
  paidAmount?: number | null
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
  isTaxItem?: boolean
  createdAt: Date
  updatedAt: Date
  category?: Category
  vendor?: Vendor | null
  vendorAccount?: VendorAccount | null
  createdBy?: User | null
  recurrencePattern?: RecurrencePattern | null
  /** True when this row is an ephemeral forecast slot, not a stored bill. */
  isForecast?: boolean
  expense?: Expense | null
  comments?: Comment[]
  attachments?: Attachment[]
  _count?: {
    comments: number
    attachments: number
  }
}

export interface Expense {
  id: string
  date: Date
  amount: number
  categoryId: string
  payee?: string | null
  note?: string | null
  vendorId?: string | null
  billId?: string | null // Set when this expense is the payment of an obligation
  isTaxItem?: boolean
  createdById?: string | null
  createdAt: Date
  updatedAt: Date
  category?: Category
  vendor?: Vendor | null
  bill?: Bill | null
  createdBy?: User | null
}

export interface BudgetEnvelope {
  id: string
  userId: string
  categoryId: string
  amount: number
  period: EnvelopePeriod
  createdAt: Date
  updatedAt: Date
  category?: Category
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
  /** False only when the user has no bills, expenses, or envelopes */
  hasAnyData?: boolean
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
  /** Per-envelope budget vs this-period spend (variable categories) */
  budgetVsActual: {
    categoryId: string
    categoryName: string
    color: string | null
    budget: number
    spent: number
    remaining: number
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
  /** 'actual' = a real ledger expense; 'recurrence' = a projected obligation. */
  source: 'recurrence' | 'actual'
  billId?: string
  categoryId?: string
  vendorId?: string | null
  vendorAccountId?: string | null
}

export interface BillTitleSuggestion {
  title: string
  categoryId: string
  vendorId: string | null
  vendorAccountId: string | null
  occurrenceCount: number
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

export interface EobProcedure {
  id: string
  eobId: string
  sortOrder: number
  dateOfService: Date
  procedureCode?: string | null
  description: string
  billedAmount: number
  allowedAmount?: number | null
  insurancePaid: number
  patientResponsibility: number
}

export interface EobAttachment {
  id: string
  fileName: string
  filePath: string
  fileSize: number
  mimeType: string
  eobId: string
  uploadedById?: string | null
  createdAt: Date
  uploadedBy?: User | null
}

export interface Eob {
  id: string
  payerName: string
  vendorId?: string | null
  providerName: string
  claimNumber?: string | null
  memberId?: string | null
  eobDate: Date
  serviceStart?: Date | null
  serviceEnd?: Date | null
  billedAmount: number
  insurancePaid: number
  adjustmentAmount: number
  patientResponsibility: number
  tags: string[]
  isTaxItem: boolean
  notes?: string | null
  createdById?: string | null
  createdAt: Date
  updatedAt: Date
  vendor?: Vendor | null
  createdBy?: User | null
  procedures?: EobProcedure[]
  attachments?: EobAttachment[]
}

export interface TaxItemBillRow {
  source: 'bill'
  id: string
  date: Date
  title: string
  categoryName: string | null
  tags: string[]
  amount: number
}

export interface TaxItemEobRow {
  source: 'eob'
  id: string
  date: Date
  serviceStart: Date | null
  serviceEnd: Date | null
  providerName: string
  payerName: string
  tags: string[]
  billedAmount: number
  insurancePaid: number
  patientResponsibility: number
}

export interface TaxItemExpenseRow {
  source: 'expense'
  id: string
  date: Date
  title: string
  categoryName: string | null
  tags: string[]
  amount: number
}

export interface TaxItemsReport {
  startDate: string
  endDate: string
  tags: string[]
  bills: TaxItemBillRow[]
  eobs: TaxItemEobRow[]
  expenses: TaxItemExpenseRow[]
  billTotal: number
  eobPatientTotal: number
  expenseTotal: number
  combinedTotal: number
}

export interface MonthlyBudgetRow {
  id: string
  date: Date
  title: string
  description: string | null
  categoryName: string | null
  vendorName: string | null
  tags: string[]
  amount: number
  isTaxItem: boolean
}

export interface MonthlyBudgetPeriod {
  periodLabel: string
  rows: MonthlyBudgetRow[]
  subtotal: number
}

export interface MonthlyBudgetReport {
  startDate: string
  endDate: string
  tags: string[]
  periods: MonthlyBudgetPeriod[]
  grandTotal: number
}

export interface AccountsReportRow {
  accountId: string
  nickname: string | null
  vendorName: string
  accountNumber: string
  accountNumberLast4: string
  accountTypeName: string | null
  originalBalance: number | null
  currentBalance: number | null
  creditLimit: number | null
  availableCredit: number | null
  utilization: number | null
  apr: number | null
  averagePayment: number | null
  lastPaymentAmount: number | null
  lastPaymentDate: string | null
  nextDueDate: string | null
  paydownPercent: number | null
  targetBalance: number | null
  payTo4: number | null
  payTo9: number | null
  extraLimitNeeded: number | null
  analysisLine: string | null
}

export interface AccountsReportTotals {
  originalBalance: number
  currentBalance: number
  creditLimit: number
  availableCredit: number
}

export interface AccountsUtilizationAnalysis {
  overallUtilization: number | null
  maxUtilization: number | null
  utilizationOnlyFicoEstimate: number | null
  payTo4All: number | null
  payTo9All: number | null
  allZeroRecommendation: { accountId: string; reportBalance: number } | null
  footnote: string
}

export interface AccountsReport {
  rows: AccountsReportRow[]
  totals: AccountsReportTotals
  utilization: AccountsUtilizationAnalysis
}
