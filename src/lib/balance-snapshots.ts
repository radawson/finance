import { prisma } from '@/lib/prisma'

/**
 * Record a balance snapshot for a vendor account.
 * Should be called whenever the account balance changes (manual edit or bill addition).
 *
 * @param accountId - The vendor account ID
 * @param balance - The new balance value (as string or number for Decimal)
 */
export async function recordBalanceSnapshot(
  accountId: string,
  balance: string | number
): Promise<void> {
  await prisma.vendorAccountBalanceSnapshot.create({
    data: {
      accountId,
      balance,
    },
  })
}
