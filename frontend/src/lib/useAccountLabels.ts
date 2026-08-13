import { useMemo } from 'react'

/** Several seed/demo accounts in this org happen to share a display name ("Ada" ×3) —
 *  a plain name-only list makes picking/filtering by one of them ambiguous (you can't
 *  tell which "Ada" you're choosing, and a filter selecting one specific account looks
 *  "broken" when another row shows the same name). Appending the email disambiguates,
 *  but only for names that actually collide — unique names stay clean.
 *
 *  Structural type (not UserAccountResponse specifically) — callers pass either
 *  auth-service's admin-only account list or user-service's open-to-any-member directory
 *  listing (@/api/users), whichever fits the page; both share id/name/email. */
export function useAccountLabels(accounts: { id: string; name: string; email: string }[] | undefined) {
  return useMemo(() => {
    const list = accounts ?? []
    const nameCounts = new Map<string, number>()
    for (const a of list) nameCounts.set(a.name, (nameCounts.get(a.name) ?? 0) + 1)
    const labelById = new Map<string, string>()
    for (const a of list) {
      labelById.set(a.id, (nameCounts.get(a.name) ?? 0) > 1 ? `${a.name} (${a.email})` : a.name)
    }
    return labelById
  }, [accounts])
}
