/** Generic color-coded status chip, same visual language as PriorityBadge — reused for
 *  API key status, delivery outcome, and webhook health across the Integrations pages
 *  instead of three near-identical components. */
export function StatusBadge({ label, color }: { label: string; color: string }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold leading-none"
      style={{ backgroundColor: `color-mix(in srgb, ${color} 16%, transparent)`, color }}
    >
      <span className="size-1.5 rounded-full" style={{ backgroundColor: color }} />
      {label}
    </span>
  )
}
