import type { ReactNode } from 'react'

/** Primary actions pinned above the home indicator on detail screens. Pair with `pb-28` on the page. */
export function StickyBar({ note, children }: { note?: ReactNode; children: ReactNode }) {
  return (
    <div className="inset-x-0 bottom-0 max-w-md fixed z-30 mx-auto w-full">
      <div
        aria-hidden="true"
        className="h-6 pointer-events-none bg-linear-to-t from-surface to-transparent"
      />
      <div className="px-5 pt-1 bg-surface pb-[max(env(safe-area-inset-bottom),1rem)]">
        {note && (
          <p role="status" className="mb-2 text-xs font-medium text-center text-muted">
            {note}
          </p>
        )}
        <div className="gap-2 flex">{children}</div>
      </div>
    </div>
  )
}
