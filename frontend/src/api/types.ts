/** Spring Data's Page<T> envelope — the exact shape returned by every paginated
 *  endpoint in this backend (incidents, audit, alerts). */
export interface Page<T> {
  content: T[]
  totalElements: number
  totalPages: number
  number: number
  size: number
  first: boolean
  last: boolean
  numberOfElements: number
  empty: boolean
}
