import { prisma } from './prisma'

export const DEFAULT_ACCOUNT_TYPES = [
  { name: 'Credit Card', description: 'Revolving credit card' },
  { name: 'Loan', description: 'Installment loan' },
  { name: 'Mortgage', description: 'Home mortgage' },
  { name: 'HELOC', description: 'Home equity line of credit' },
  { name: 'Line of Credit', description: 'Revolving line of credit' },
] as const

/** Inserts the built-in debt account types if they are missing. */
export async function ensureDefaultAccountTypes() {
  for (const type of DEFAULT_ACCOUNT_TYPES) {
    await prisma.accountType.upsert({
      where: { name: type.name },
      update: {},
      create: {
        name: type.name,
        description: type.description,
      },
    })
  }
}
