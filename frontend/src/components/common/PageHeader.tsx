import type { ReactNode } from 'react'

export function PageHeader({
  title,
  eyebrow,
  icon,
  subtitle,
  actions,
}: {
  title: string
  /** Small uppercase label above the title, e.g. "Workspace" / "Ingestion" / "Reporting". */
  eyebrow?: string
  icon?: ReactNode
  subtitle?: string
  actions?: ReactNode
}) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-5">
      <div>
        {eyebrow && <p className="mb-2.5 text-[11px] font-semibold tracking-[0.14em] text-muted-foreground uppercase">{eyebrow}</p>}
        <div className="flex items-center gap-2">
          <h1 className="font-serif text-[2rem] leading-[0.95] font-semibold tracking-tight text-foreground md:text-[2.6rem]">
            {title}
          </h1>
          {icon}
        </div>
        {subtitle && <p className="mt-2.5 max-w-xl text-sm text-muted-foreground">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  )
}
