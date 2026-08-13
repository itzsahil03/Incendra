/** Shared className override for shadcn Input/Textarea on the marketing site's dark
 *  auth/contact forms — the default Input/Textarea styling is driven by the app's
 *  light/dark theme tokens, which this always-black surface doesn't use. */
export const darkFieldClass =
  'border-white/16 bg-black/50 text-white placeholder:text-white/35 focus-visible:border-marketing-accent focus-visible:ring-marketing-accent/30 dark:bg-black/50'
