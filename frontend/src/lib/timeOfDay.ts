import type { ThemeMode } from '@/features/ui/uiSlice'

/** Day is 6:00–17:59 local time, night is 18:00–5:59 — theme follows the user's
 *  system clock rather than a stored preference or OS light/dark setting. */
export function themeModeForTime(date: Date = new Date()): ThemeMode {
  const hour = date.getHours()
  return hour >= 6 && hour < 18 ? 'light' : 'dark'
}
