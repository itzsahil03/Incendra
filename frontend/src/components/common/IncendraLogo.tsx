import { Link } from 'react-router-dom'
import { cn } from '@/lib/utils'
import markSvg from '@/assets/brand/incendra-mark.svg?raw'

type LogoVariant = 'full' | 'mark'
type LogoTheme = 'light' | 'dark'

// The wordmark's color is the only thing that needs to change between light/dark
// surfaces — the mark's own shield/flame/checkmark colors are self-contained
// (dark-navy linework, orange-red flame) and already read clearly on either.
const THEME_TEXT_CLASS: Record<LogoTheme, string> = {
  light: 'text-foreground',
  dark: 'text-white',
}

/** The Incendra mark — a shield (protection/resilience) holding a flame (the incident
 *  itself) with a checkmark blending into an upward arrow that breaks out through the
 *  top-right edge (resolution, trending up and out). Inlines `assets/brand/incendra-mark.svg`
 *  directly so this is always pixel-identical to the standalone asset file. */
function Mark({ size }: { size: number }) {
  return (
    <span
      className="inline-flex shrink-0 items-center justify-center [&>svg]:block"
      style={{ width: size, height: size }}
      // Safe: `markSvg` is our own bundled asset (Vite `?raw` import), not user input.
      dangerouslySetInnerHTML={{ __html: markSvg }}
    />
  )
}

export function IncendraLogo({
  variant = 'full',
  theme = 'light',
  size = 36,
  withLink = true,
  className,
}: {
  /** `full` renders the mark plus the "Incendra" wordmark; `mark` renders just the
   *  symbol — use it wherever space is tight (a collapsed sidebar rail, a compact
   *  header) and the wordmark would get cramped or truncated. */
  variant?: LogoVariant
  /** Which kind of surface this sits on. Controls only the wordmark's text color —
   *  `light` for light backgrounds (dark-charcoal text), `dark` for dark backgrounds
   *  (white text). Override further with `className` for a one-off color. */
  theme?: LogoTheme
  size?: number
  withLink?: boolean
  className?: string
}) {
  const content = (
    <span className={cn('inline-flex items-center gap-2.5 no-underline', THEME_TEXT_CLASS[theme], className)}>
      <Mark size={size} />
      {variant === 'full' && (
        <span className="whitespace-nowrap font-sans text-lg font-black tracking-tight">Incendra</span>
      )}
    </span>
  )

  // Mark-only has no visible text for its accessible name, so the link needs one
  // explicitly; the full variant already carries "Incendra" as real text.
  const linkLabel = variant === 'mark' ? 'Incendra home' : undefined

  return withLink ? (
    <Link to="/" className="inline-flex no-underline" aria-label={linkLabel}>
      {content}
    </Link>
  ) : (
    content
  )
}
