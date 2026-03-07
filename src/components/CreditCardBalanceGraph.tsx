'use client'

import AccountTypeBalanceGraph from './AccountTypeBalanceGraph'

interface BalanceSnapshot {
  date: string
  balance: string
}

interface AccountBalanceData {
  accountId: string
  accountLabel: string
  vendorName: string
  accountTypeName: string | null
  currentBalance: string | null
  interestRate: string | null
  snapshots: BalanceSnapshot[]
}

interface CreditCardBalanceGraphProps {
  accounts: AccountBalanceData[]
  period: string
  onPeriodChange: (period: string) => void
}

export default function CreditCardBalanceGraph({
  accounts,
  period,
  onPeriodChange,
}: CreditCardBalanceGraphProps) {
  return (
    <AccountTypeBalanceGraph
      accounts={accounts}
      period={period}
      onPeriodChange={onPeriodChange}
      title="Credit Card Balances"
    />
  )
}
