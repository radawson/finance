import type { LayoutItem } from 'react-grid-layout'

// ─── Widget IDs ──────────────────────────────────────────────────────────────

export const WIDGET_IDS = {
  STATS: 'stats',
  EXPECTED_BILLS: 'expected-bills',
  CREDIT_CARD: 'credit-card',
  UPCOMING_BILLS: 'upcoming-bills',
  OVERDUE_BILLS: 'overdue-bills',
  CATEGORY_BREAKDOWN: 'category-breakdown',
  RECENT_BILLS: 'recent-bills',
} as const

export type WidgetId = (typeof WIDGET_IDS)[keyof typeof WIDGET_IDS]

// ─── Breakpoints & Columns ───────────────────────────────────────────────────

export const BREAKPOINTS = { lg: 1200, md: 996, sm: 768, xs: 480 } as const
export const COLS = { lg: 12, md: 10, sm: 6, xs: 4 } as const

export type Breakpoint = keyof typeof BREAKPOINTS

// ─── Responsive Layouts Type ─────────────────────────────────────────────────
// Using our own type with mutable arrays for layout manipulation.

export type DashboardLayouts = Record<Breakpoint, LayoutItem[]>

// ─── Default Layouts ─────────────────────────────────────────────────────────
// y coordinates stack widgets vertically in default order.
// Heights are in row‑height units (rowHeight = 60px).

const lgLayout: LayoutItem[] = [
  { i: WIDGET_IDS.STATS,              x: 0, y: 0,  w: 12, h: 2, minH: 2 },
  { i: WIDGET_IDS.EXPECTED_BILLS,     x: 0, y: 2,  w: 12, h: 5, minH: 3, minW: 6 },
  { i: WIDGET_IDS.CREDIT_CARD,        x: 0, y: 7,  w: 12, h: 6, minH: 4, minW: 6 },
  { i: WIDGET_IDS.UPCOMING_BILLS,     x: 0, y: 13, w: 6,  h: 5, minH: 3, minW: 4 },
  { i: WIDGET_IDS.OVERDUE_BILLS,      x: 6, y: 13, w: 6,  h: 5, minH: 3, minW: 4 },
  { i: WIDGET_IDS.CATEGORY_BREAKDOWN, x: 0, y: 18, w: 12, h: 7, minH: 5, minW: 6 },
  { i: WIDGET_IDS.RECENT_BILLS,       x: 0, y: 25, w: 12, h: 5, minH: 3, minW: 6 },
]

const mdLayout: LayoutItem[] = [
  { i: WIDGET_IDS.STATS,              x: 0, y: 0,  w: 10, h: 2, minH: 2 },
  { i: WIDGET_IDS.EXPECTED_BILLS,     x: 0, y: 2,  w: 10, h: 5, minH: 3, minW: 5 },
  { i: WIDGET_IDS.CREDIT_CARD,        x: 0, y: 7,  w: 10, h: 6, minH: 4, minW: 5 },
  { i: WIDGET_IDS.UPCOMING_BILLS,     x: 0, y: 13, w: 5,  h: 5, minH: 3, minW: 4 },
  { i: WIDGET_IDS.OVERDUE_BILLS,      x: 5, y: 13, w: 5,  h: 5, minH: 3, minW: 4 },
  { i: WIDGET_IDS.CATEGORY_BREAKDOWN, x: 0, y: 18, w: 10, h: 7, minH: 5, minW: 5 },
  { i: WIDGET_IDS.RECENT_BILLS,       x: 0, y: 25, w: 10, h: 5, minH: 3, minW: 5 },
]

const smLayout: LayoutItem[] = [
  { i: WIDGET_IDS.STATS,              x: 0, y: 0,  w: 6, h: 3, minH: 2 },
  { i: WIDGET_IDS.EXPECTED_BILLS,     x: 0, y: 3,  w: 6, h: 5, minH: 3 },
  { i: WIDGET_IDS.CREDIT_CARD,        x: 0, y: 8,  w: 6, h: 6, minH: 4 },
  { i: WIDGET_IDS.UPCOMING_BILLS,     x: 0, y: 14, w: 6, h: 5, minH: 3 },
  { i: WIDGET_IDS.OVERDUE_BILLS,      x: 0, y: 19, w: 6, h: 5, minH: 3 },
  { i: WIDGET_IDS.CATEGORY_BREAKDOWN, x: 0, y: 24, w: 6, h: 7, minH: 5 },
  { i: WIDGET_IDS.RECENT_BILLS,       x: 0, y: 31, w: 6, h: 5, minH: 3 },
]

const xsLayout: LayoutItem[] = [
  { i: WIDGET_IDS.STATS,              x: 0, y: 0,  w: 4, h: 4, minH: 2 },
  { i: WIDGET_IDS.EXPECTED_BILLS,     x: 0, y: 4,  w: 4, h: 5, minH: 3 },
  { i: WIDGET_IDS.CREDIT_CARD,        x: 0, y: 9,  w: 4, h: 6, minH: 4 },
  { i: WIDGET_IDS.UPCOMING_BILLS,     x: 0, y: 15, w: 4, h: 5, minH: 3 },
  { i: WIDGET_IDS.OVERDUE_BILLS,      x: 0, y: 20, w: 4, h: 5, minH: 3 },
  { i: WIDGET_IDS.CATEGORY_BREAKDOWN, x: 0, y: 25, w: 4, h: 7, minH: 5 },
  { i: WIDGET_IDS.RECENT_BILLS,       x: 0, y: 32, w: 4, h: 5, minH: 3 },
]

export const DEFAULT_LAYOUTS: DashboardLayouts = {
  lg: lgLayout,
  md: mdLayout,
  sm: smLayout,
  xs: xsLayout,
}

// ─── Layout Persistence ──────────────────────────────────────────────────────

const STORAGE_KEY_PREFIX = 'kontado-dashboard-layout'

function getStorageKey(userId?: string): string {
  return userId ? `${STORAGE_KEY_PREFIX}-${userId}` : STORAGE_KEY_PREFIX
}

/**
 * Load saved layouts from localStorage.
 * Returns null if nothing is saved or the data is corrupt.
 */
export function loadLayouts(userId?: string): DashboardLayouts | null {
  if (typeof window === 'undefined') return null

  try {
    const raw = localStorage.getItem(getStorageKey(userId))
    if (!raw) return null
    const parsed = JSON.parse(raw)

    // Basic validation: must be an object with at least one breakpoint
    if (typeof parsed !== 'object' || parsed === null) return null
    const hasAnyBreakpoint = Object.keys(BREAKPOINTS).some(
      (bp) => Array.isArray(parsed[bp])
    )
    if (!hasAnyBreakpoint) return null

    return parsed as DashboardLayouts
  } catch {
    return null
  }
}

/**
 * Save layouts to localStorage.
 */
export function saveLayouts(
  layouts: DashboardLayouts,
  userId?: string
): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.setItem(getStorageKey(userId), JSON.stringify(layouts))
  } catch {
    // Storage full or unavailable — silently ignore
  }
}

/**
 * Clear saved layouts (reset to defaults).
 */
export function clearLayouts(userId?: string): void {
  if (typeof window === 'undefined') return

  try {
    localStorage.removeItem(getStorageKey(userId))
  } catch {
    // Silently ignore
  }
}

/**
 * Filter layouts to only include items whose IDs are in `visibleIds`.
 * Preserves saved positions for widgets that are visible; uses default
 * positions for any widget not found in saved layouts.
 */
export function getFilteredLayouts(
  savedLayouts: DashboardLayouts | null,
  visibleIds: Set<string>
): DashboardLayouts {
  const base = savedLayouts ?? DEFAULT_LAYOUTS

  const result: Record<string, LayoutItem[]> = {}

  for (const bp of Object.keys(BREAKPOINTS) as Breakpoint[]) {
    const bpLayout = base[bp] ?? DEFAULT_LAYOUTS[bp]
    const defaultBpLayout = DEFAULT_LAYOUTS[bp]

    const filtered: LayoutItem[] = []

    for (const id of visibleIds) {
      // Prefer the saved/loaded item, fall back to default
      const item =
        bpLayout.find((l) => l.i === id) ??
        defaultBpLayout.find((l) => l.i === id)
      if (item) {
        filtered.push(item)
      }
    }

    result[bp] = filtered
  }

  return result as DashboardLayouts
}
