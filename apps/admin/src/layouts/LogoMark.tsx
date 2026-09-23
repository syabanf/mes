/** The platform mark: a stacked ingot with an accent dot. Same shape as the favicon. */
export function LogoMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" className={className} aria-hidden="true">
      <path
        d="M18 42h28l-4-10H22z"
        fill="none"
        stroke="currentColor"
        strokeWidth="5"
        strokeLinejoin="round"
      />
      <path d="M24 30h16l-3-8H27z" fill="none" stroke="currentColor" strokeWidth="5" strokeLinejoin="round" />
      <circle cx="49" cy="18" r="5.5" fill="var(--color-accent)" />
    </svg>
  )
}
