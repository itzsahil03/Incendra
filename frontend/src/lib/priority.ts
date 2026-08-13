/** Priority is a free string server-side (no enum) — P1..P4 is this platform's
 *  convention (see analytics-service), not a validated whitelist, so anything else
 *  just falls back to grey instead of breaking. */
export const PRIORITY_COLORS: Record<string, string> = {
  P1: '#e5766c', // coral red
  P2: '#dd9a4c', // amber
  P3: '#cbb35a', // gold
  P4: 'rgba(255,255,255,0.6)', // neutral grey-white
}

export function priorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] ?? PRIORITY_COLORS.P4
}
