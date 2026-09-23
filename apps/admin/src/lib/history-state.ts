import type { DataTableState } from '@mes/ui'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router'

// UI state per history entry, kept for the browser session. React Router gives every entry a key,
// and Back or Forward returns to the same key, so a list finds its search and filters again.
const entries = new Map<string, Record<string, unknown>>()

/**
 * `useState` that survives leaving a page and returning with Back or Forward. A fresh visit from the
 * nav starts from `initial`. Use it for list search, filters and table state, so a detail page's
 * back button lands on the list the user left. `name` must be unique within the page.
 */
export function useHistoryState<T>(name: string, initial: T | (() => T)) {
  const { key } = useLocation()
  const [value, setValue] = useState<T>(() => {
    const saved = entries.get(key)
    if (saved && name in saved) return saved[name] as T
    return typeof initial === 'function' ? (initial as () => T)() : initial
  })
  // A replace navigation (a tab kept in the URL) gives the entry a new key, so save under that one too.
  useEffect(() => {
    entries.set(key, { ...entries.get(key), [name]: value })
  }, [key, name, value])
  return [value, setValue] as const
}

/** Spread onto a `DataTable` to bring back its sort and page with the list. */
export function useTableHistory(name = 'table') {
  const [initialState, onStateChange] = useHistoryState<DataTableState | undefined>(name, undefined)
  return { initialState, onStateChange }
}
