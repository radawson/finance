import {
  buildMonthlyBudgetReport,
  buildTaxItemsReport,
  matchesAnyTag,
  parseTagFilter,
} from '../reports'

describe('parseTagFilter / matchesAnyTag', () => {
  it('parses comma-separated tags', () => {
    expect(parseTagFilter('Rick, Kristen')).toEqual(['Rick', 'Kristen'])
    expect(parseTagFilter('')).toEqual([])
    expect(parseTagFilter(null)).toEqual([])
  })

  it('matches any filter tag (OR)', () => {
    expect(matchesAnyTag(['Rick'], ['Rick', 'Kristen'])).toBe(true)
    expect(matchesAnyTag(['Kristen'], ['Rick', 'Kristen'])).toBe(true)
    expect(matchesAnyTag(['Other'], ['Rick', 'Kristen'])).toBe(false)
    expect(matchesAnyTag(['rick'], ['Rick'])).toBe(true)
    expect(matchesAnyTag(['Rick'], [])).toBe(true)
  })
})

describe('buildTaxItemsReport', () => {
  const start = new Date('2026-01-01')
  const end = new Date('2026-12-31')

  it('includes tax-flagged bills and EOBs and excludes non-tax bills', () => {
    const report = buildTaxItemsReport({
      startDate: start,
      endDate: end,
      tags: [],
      bills: [
        {
          id: 'b1',
          title: 'Copay',
          dueDate: new Date('2026-03-10'),
          amount: 40,
          isTaxItem: true,
          tags: ['Rick'],
          category: { name: 'Medical' },
        },
        {
          id: 'b2',
          title: 'Electric',
          dueDate: new Date('2026-03-15'),
          amount: 120,
          isTaxItem: false,
          tags: [],
        },
      ],
      eobs: [
        {
          id: 'e1',
          eobDate: new Date('2026-04-01'),
          providerName: 'City Clinic',
          payerName: 'BCBS',
          billedAmount: 800,
          insurancePaid: 700,
          patientResponsibility: 100,
          isTaxItem: true,
          tags: ['Kristen'],
        },
      ],
    })

    expect(report.bills).toHaveLength(1)
    expect(report.bills[0].title).toBe('Copay')
    expect(report.eobs).toHaveLength(1)
    expect(report.billTotal).toBe(40)
    expect(report.eobPatientTotal).toBe(100)
    expect(report.expenseTotal).toBe(0)
    expect(report.combinedTotal).toBe(140)
  })

  it('includes standalone tax expenses and skips bill-linked ones', () => {
    const report = buildTaxItemsReport({
      startDate: start,
      endDate: end,
      tags: [],
      bills: [
        {
          id: 'b1',
          title: 'Copay',
          dueDate: new Date('2026-03-10'),
          amount: 40,
          isTaxItem: true,
        },
      ],
      eobs: [],
      expenses: [
        {
          id: 'ex-standalone',
          date: new Date('2026-05-01'),
          amount: 75,
          payee: 'Pharmacy',
          isTaxItem: true,
          billId: null,
        },
        {
          id: 'ex-linked',
          date: new Date('2026-03-10'),
          amount: 40,
          payee: 'Copay',
          isTaxItem: true,
          billId: 'b1',
        },
        {
          id: 'ex-ordinary',
          date: new Date('2026-05-02'),
          amount: 12,
          payee: 'Tesco',
          isTaxItem: false,
          billId: null,
        },
      ],
    })

    expect(report.expenses).toHaveLength(1)
    expect(report.expenses[0].title).toBe('Pharmacy')
    expect(report.expenseTotal).toBe(75)
    expect(report.combinedTotal).toBe(115)
  })

  it('includes Rick-only and Kristen-only rows when both tags are selected', () => {
    const report = buildTaxItemsReport({
      startDate: start,
      endDate: end,
      tags: ['Rick', 'Kristen'],
      bills: [
        {
          id: 'b1',
          title: 'Rick copay',
          dueDate: new Date('2026-02-01'),
          amount: 25,
          isTaxItem: true,
          tags: ['Rick'],
        },
        {
          id: 'b2',
          title: 'Kristen copay',
          dueDate: new Date('2026-02-02'),
          amount: 30,
          isTaxItem: true,
          tags: ['Kristen'],
        },
        {
          id: 'b3',
          title: 'Other',
          dueDate: new Date('2026-02-03'),
          amount: 10,
          isTaxItem: true,
          tags: ['Sam'],
        },
      ],
      eobs: [],
    })

    expect(report.bills.map((b) => b.title).sort()).toEqual(['Kristen copay', 'Rick copay'])
  })
})

describe('buildMonthlyBudgetReport', () => {
  it('excludes recurring templates and never includes EOB-shaped data', () => {
    const report = buildMonthlyBudgetReport({
      startDate: new Date('2026-03-01'),
      endDate: new Date('2026-03-31'),
      tags: [],
      bills: [
        {
          id: 'b1',
          title: 'Rent',
          dueDate: new Date('2026-03-01'),
          amount: 1200,
          isRecurring: false,
          isTaxItem: false,
          tags: [],
        },
        {
          id: 'tmpl',
          title: 'Rent template',
          dueDate: new Date('2026-03-01'),
          amount: 1200,
          isRecurring: true,
          tags: [],
        },
      ],
    })

    expect(report.periods).toHaveLength(1)
    expect(report.periods[0].rows).toHaveLength(1)
    expect(report.periods[0].rows[0].title).toBe('Rent')
    expect(report.grandTotal).toBe(1200)
  })
})
