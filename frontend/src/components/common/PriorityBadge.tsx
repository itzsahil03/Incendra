import { priorityColor } from '@/lib/priority'

const SIZES = {
  small: { paddingY: 2, paddingX: 7, fontSize: 10 },
  medium: { paddingY: 4, paddingX: 10, fontSize: 12 },
} as const

/** Color-coded priority chip (P1 red, P2 amber, P3 gold, P4 neutral) — the visual
 *  language used everywhere a priority shows up. */
export function PriorityBadge({ priority, size = 'medium' }: { priority: string; size?: keyof typeof SIZES }) {
  const { paddingY, paddingX, fontSize } = SIZES[size]
  const color = priorityColor(priority)
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center rounded-md font-bold leading-none"
      style={{ padding: `${paddingY}px ${paddingX}px`, backgroundColor: `color-mix(in srgb, ${color} 14%, transparent)`, color, fontSize }}
    >
      {priority}
    </span>
  )
}
