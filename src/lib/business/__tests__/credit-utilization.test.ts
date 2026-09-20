import {
  allZeroReportBalanceCents,
  analysisLine,
  availableCreditCents,
  centsToMoney,
  combinedUtilizationScore,
  extraLimitCents,
  moneyToCents,
  payToPercentCents,
  paydownPercent,
  roundFico,
  targetBalanceCents,
  utilizationOnlyScore,
  utilizationRatio,
} from '../credit-utilization'
import { buildAccountsReport, isCreditLoanAccount } from '../reports'

describe('money cents', () => {
  it('parses decimal strings to integer cents', () => {
    expect(moneyToCents('10.25')).toBe(1025)
    expect(moneyToCents(10.25)).toBe(1025)
    expect(centsToMoney(1025)).toBe(10.25)
  })
})

describe('utilization math', () => {
  it('computes available credit and ratio from cents', () => {
    expect(availableCreditCents(240000, 800000)).toBe(560000)
    expect(utilizationRatio(240000, 800000)).toBeCloseTo(0.3)
  })

  it('uses 4% and 9% of limit for target and paydown', () => {
    const limit = 800000
    const balance = 240000
    expect(targetBalanceCents(limit)).toBe(32000)
    expect(payToPercentCents(balance, limit, 4)).toBe(208000)
    expect(payToPercentCents(balance, limit, 9)).toBe(168000)
    expect(centsToMoney(payToPercentCents(balance, limit, 4))).toBe(2080)
  })

  it('computes extra limit needed to sit at 9%', () => {
    // $2400 / 0.09 = $26666.67 limit; extra vs $8000
    expect(extraLimitCents(240000, 800000)).toBe(1866667)
  })

  it('recommends 1% of the largest limit, at least $1', () => {
    expect(allZeroReportBalanceCents(1000000)).toBe(10000)
    expect(allZeroReportBalanceCents(5000)).toBe(100)
  })

  it('maps utilization anchors to the documented FICO estimates', () => {
    expect(roundFico(utilizationOnlyScore(0))).toBe(780)
    expect(roundFico(utilizationOnlyScore(0.01))).toBe(835)
    expect(roundFico(utilizationOnlyScore(0.041))).toBe(850)
    expect(roundFico(utilizationOnlyScore(0.071))).toBe(825)
    expect(roundFico(utilizationOnlyScore(0.152))).toBe(770)
    expect(roundFico(utilizationOnlyScore(0.386))).toBe(705)
    expect(roundFico(utilizationOnlyScore(0.614))).toBe(625)
    expect(roundFico(utilizationOnlyScore(0.807))).toBe(440)
    expect(roundFico(utilizationOnlyScore(1))).toBe(300)
    expect(roundFico(utilizationOnlyScore(1.2))).toBe(300)
  })

  it('weights overall 70% and worst card 30%', () => {
    const s = combinedUtilizationScore(0.041, 0.041)
    expect(roundFico(s)).toBe(850)
    expect(roundFico(combinedUtilizationScore(0.041, 0.071))).toBe(843)
  })

  it('writes the dollar equation for a 30% card', () => {
    expect(
      analysisLine({
        nickname: 'Visa',
        balanceCents: 240000,
        limitCents: 800000,
        utilization: 0.3,
        targetCents: 32000,
        payTo4Cents: 208000,
      }),
    ).toBe('$2400.00 on a $8000.00 limit is 30.0%; 0.04×8000.00 = $320.00 target; pay $2080.00 to reach 4%.')
  })

  it('computes loan paydown from original vs current', () => {
    expect(paydownPercent(2000000, 1500000)).toBeCloseTo(0.25)
  })
})

describe('buildAccountsReport', () => {
  it('derives last/average payment from paid instance bills and skips templates', () => {
    const report = buildAccountsReport({
      accounts: [
        {
          id: 'acc-1',
          nickname: 'Visa',
          accountNumber: '4111111111111111',
          creditLimit: '8000.00',
          balance: '2400.00',
          initialValue: null,
          accountType: 'Credit Card',
          isActive: true,
          vendor: { name: 'Chase' },
          type: { name: 'Credit Card' },
        },
      ],
      bills: [
        {
          vendorAccountId: 'acc-1',
          status: 'PAID',
          isRecurring: true,
          amount: '999.00',
          dueDate: '2026-01-01',
          paidDate: '2026-01-01',
        },
        {
          vendorAccountId: 'acc-1',
          status: 'PAID',
          isRecurring: false,
          amount: '200.00',
          paidAmount: '150.00',
          dueDate: '2026-02-01',
          paidDate: '2026-02-05',
        },
        {
          vendorAccountId: 'acc-1',
          status: 'PAID',
          isRecurring: false,
          amount: '250.00',
          dueDate: '2026-03-01',
          paidDate: '2026-03-04',
        },
      ],
    })

    expect(report.rows).toHaveLength(1)
    expect(report.rows[0].accountNumberLast4).toBe('1111')
    expect(report.rows[0].averagePayment).toBe(200)
    expect(report.rows[0].lastPaymentAmount).toBe(250)
    expect(report.rows[0].lastPaymentDate).toBe('2026-03-04')
    expect(report.rows[0].payTo4).toBe(2080)
    expect(report.rows[0].targetBalance).toBe(320)
    expect(report.rows[0].availableCredit).toBe(5600)
    expect(report.rows[0].utilization).toBeCloseTo(0.3)
    expect(report.utilization.utilizationOnlyFicoEstimate).not.toBeNull()
  })

  it('recommends a small reported balance on the largest-limit card when all revolving balances are zero', () => {
    const report = buildAccountsReport({
      accounts: [
        {
          id: 'small',
          nickname: 'Store',
          accountNumber: '1111',
          creditLimit: '1000.00',
          balance: '0',
          isActive: true,
          vendor: { name: 'Store' },
          type: { name: 'Credit Card' },
        },
        {
          id: 'big',
          nickname: 'Visa',
          accountNumber: '2222',
          creditLimit: '10000.00',
          balance: '0',
          isActive: true,
          vendor: { name: 'Bank' },
          type: { name: 'Credit Card' },
        },
      ],
      bills: [],
    })
    expect(report.utilization.allZeroRecommendation).toEqual({
      accountId: 'big',
      reportBalance: 100,
    })
  })

  it('omits the utilization-only score when there are no revolving limits', () => {
    const report = buildAccountsReport({
      accounts: [
        {
          id: 'loan',
          nickname: 'Auto',
          accountNumber: '3333',
          initialValue: '20000.00',
          balance: '15000.00',
          isActive: true,
          vendor: { name: 'Honda' },
          type: { name: 'Auto Loan' },
        },
      ],
      bills: [],
    })
    expect(report.rows[0].paydownPercent).toBeCloseTo(0.25)
    expect(report.utilization.utilizationOnlyFicoEstimate).toBeNull()
  })

  it('includes untyped cards when nickname, Visa/Amex type, or Credit Card bill category matches', () => {
    expect(isCreditLoanAccount({ nickname: 'Amex Gold' })).toBe(true)
    expect(isCreditLoanAccount({ type: { name: 'Visa' } })).toBe(true)
    expect(isCreditLoanAccount({ nickname: 'Freedom' }, ['Credit Card'])).toBe(true)
    expect(isCreditLoanAccount({ nickname: 'Electric' }, ['Utilities'])).toBe(false)

    const report = buildAccountsReport({
      accounts: [
        {
          id: 'untagged',
          nickname: 'Freedom',
          accountNumber: '4444',
          isActive: true,
          vendor: { name: 'Chase' },
        },
      ],
      bills: [
        {
          vendorAccountId: 'untagged',
          status: 'PENDING',
          isRecurring: false,
          amount: '100.00',
          dueDate: '2026-04-01',
          categoryName: 'Credit Card',
        },
      ],
    })
    expect(report.rows).toHaveLength(1)
    expect(report.rows[0].nickname).toBe('Freedom')
  })
})
