/**
 * Revolving-credit utilization math. Money is integer cents.
 * Utilization and FICO estimates are ratios/scores, not money.
 */

export const UTILIZATION_FLOOR = 1 // 1%
export const UTILIZATION_TARGET = 4 // ~850-average 4.1%
export const UTILIZATION_CEILING = 9 // high-score band

const FICO_ANCHORS: Array<[number, number]> = [
  [0, 780],
  [0.01, 835],
  [0.041, 850],
  [0.071, 825],
  [0.152, 770],
  [0.386, 705],
  [0.614, 625],
  [0.807, 440],
  [1, 300],
]

export function moneyToCents(value: unknown): number | null {
  if (value == null || value === '') return null
  const raw = String(value).trim()
  if (raw === '') return null
  const neg = raw.startsWith('-')
  const s = neg ? raw.slice(1) : raw
  if (!/^\d+(\.\d+)?$/.test(s)) return null
  const [w, f = ''] = s.split('.')
  const frac = (f + '00').slice(0, 2)
  const cents = parseInt(w || '0', 10) * 100 + parseInt(frac || '0', 10)
  return neg ? -cents : cents
}

export function centsToMoney(cents: number): number {
  const neg = cents < 0
  const abs = Math.abs(cents)
  const whole = Math.trunc(abs / 100)
  const frac = abs % 100
  const asNumber = whole + frac / 100
  // Display-only dollars from integer cents (two decimal places).
  return neg ? -Number(asNumber.toFixed(2)) : Number(asNumber.toFixed(2))
}

function percentOfLimit(limitCents: number, percent: number): number {
  return Math.trunc((limitCents * percent) / 100)
}

function divCeil(numerator: number, denominator: number): number {
  if (denominator <= 0) return 0
  return Math.trunc((numerator + denominator - 1) / denominator)
}

export function availableCreditCents(balanceCents: number | null, limitCents: number | null): number | null {
  if (limitCents == null) return null
  return limitCents - (balanceCents ?? 0)
}

export function utilizationRatio(balanceCents: number | null, limitCents: number | null): number | null {
  if (limitCents == null || limitCents <= 0) return null
  return (balanceCents ?? 0) / limitCents
}

export function targetBalanceCents(limitCents: number): number {
  return percentOfLimit(limitCents, UTILIZATION_TARGET)
}

export function payToPercentCents(balanceCents: number, limitCents: number, percent: number): number {
  const cap = percentOfLimit(limitCents, percent)
  const pay = balanceCents - cap
  return pay > 0 ? pay : 0
}

/** Extra limit needed so current balance is at the 9% ceiling. */
export function extraLimitCents(balanceCents: number, limitCents: number): number {
  if (balanceCents <= 0) return 0
  const needed = divCeil(balanceCents * 100, UTILIZATION_CEILING)
  const extra = needed - limitCents
  return extra > 0 ? extra : 0
}

export function paydownPercent(originalCents: number | null, currentCents: number | null): number | null {
  if (originalCents == null || originalCents <= 0 || currentCents == null) return null
  return (originalCents - currentCents) / originalCents
}

export function utilizationOnlyScore(utilization: number): number {
  if (utilization >= 1) return 300
  if (utilization < 0) return FICO_ANCHORS[0][1]
  for (let i = 0; i < FICO_ANCHORS.length - 1; i++) {
    const [u0, s0] = FICO_ANCHORS[i]
    const [u1, s1] = FICO_ANCHORS[i + 1]
    if (utilization <= u1) {
      const t = (utilization - u0) / (u1 - u0)
      return s0 + t * (s1 - s0)
    }
  }
  return 300
}

export function combinedUtilizationScore(overall: number, maxCard: number): number {
  return 0.7 * utilizationOnlyScore(overall) + 0.3 * utilizationOnlyScore(maxCard)
}

export function roundFico(score: number): number {
  return Math.round(score)
}

export function allZeroReportBalanceCents(largestLimitCents: number): number {
  const onePercent = percentOfLimit(largestLimitCents, UTILIZATION_FLOOR)
  return onePercent > 100 ? onePercent : 100
}

export function analysisLine(input: {
  nickname: string
  balanceCents: number
  limitCents: number
  utilization: number
  targetCents: number
  payTo4Cents: number
}): string {
  const uPct = (input.utilization * 100).toFixed(1)
  const balance = centsToMoney(input.balanceCents).toFixed(2)
  const limit = centsToMoney(input.limitCents).toFixed(2)
  const target = centsToMoney(input.targetCents).toFixed(2)
  const pay4 = centsToMoney(input.payTo4Cents).toFixed(2)
  return `$${balance} on a $${limit} limit is ${uPct}%; 0.04×${limit} = $${target} target; pay $${pay4} to reach 4%.`
}

export const UTILIZATION_FICO_FOOTNOTE =
  'Utilization-only FICO estimate (300–850), not a bureau score. Amounts owed is ~30% of FICO; this maps overall and worst-card utilization (0.7/0.3) onto Experian Q3 2024 band averages and myFICO’s ~4.1% ≈ 850. Payment history, age, mix, and inquiries are omitted. Target band is 1–9% of limit (B* = 0.04L). 0% on every card is slightly worse than a small reported balance on one card.'
