// Per-viewer UI preferences. Storage can be unavailable (private mode), so every access is guarded.
export function readStorage<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key)
    return raw === null ? fallback : (JSON.parse(raw) as T)
  } catch {
    return fallback
  }
}

export function writeStorage(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key)
    else localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // ignore: preferences are a convenience
  }
}

/** Drops every key this app wrote, so the next load starts from the seed. */
export function clearAppStorage() {
  try {
    const keys = Object.keys(localStorage).filter((k) => k.startsWith('mes.mobile.'))
    for (const key of keys) localStorage.removeItem(key)
  } catch {
    // ignore
  }
}
