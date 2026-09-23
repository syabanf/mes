import { fmtDate, newId, nowIso, plural } from '@mes/fixtures'
import type { RevisionState } from '@mes/types'
import {
  ActionMenu,
  type ActionMenuItem,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  toast,
} from '@mes/ui'
import { Copy, MoreHorizontal, Rocket, Send, Trash2 } from 'lucide-react'
import { type ReactNode, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { MoStatusBadge, RevisionBadge } from '../../components/badges'
import { MoLink, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { type DocUsage, isEditableState, nextRev, withRev } from './lib'
import { LockBadge } from './tables'

export interface DocLike {
  id: string
  code: string
  productId: string
  rev: string
  state: RevisionState
  createdAt: string
}

export interface DocMetric {
  label: string
  value: string
  unit?: string
}

export interface DocShellProps<T extends DocLike> {
  doc: T
  /** Short noun used in toasts and dialogs, such as "BOM". */
  label: string
  /** Prefix for the id of a copied draft. */
  idPrefix: string
  listPath: string
  path: (id: string) => string
  /** Every document of the same collection, for revision numbering and the release cascade. */
  siblings: readonly T[]
  usage: DocUsage
  save: (doc: T) => void
  remove: (id: string) => void
  title: ReactNode
  subtitle?: ReactNode
  badges?: ReactNode
  metrics: DocMetric[]
  /** Page specific buttons, shown before the lifecycle actions. */
  actions?: ReactNode
  children: ReactNode
}

/**
 * The frame every engineering document page shares: back button, lifecycle actions, ink hero,
 * the page's own content and the "Used by" card. Released documents are locked; a copy as a
 * new draft is the only way to change them.
 */
export function DocShell<T extends DocLike>({
  doc,
  label,
  idPrefix,
  listPath,
  path,
  siblings,
  usage,
  save,
  remove,
  title,
  subtitle,
  badges,
  metrics,
  actions,
  children,
}: DocShellProps<T>) {
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const [deleting, setDeleting] = useState(false)
  const manage = can('plm.manage')
  const editable = manage && isEditableState(doc.state)
  const product = s.maps.product.get(doc.productId)
  const referenced = usage.revisions.length + usage.mos.length > 0

  const submit = () => {
    save({ ...doc, state: 'review' })
    toast(`${label} submitted for review`, { tone: 'success' })
  }

  const release = () => {
    for (const other of siblings) {
      if (other.id !== doc.id && other.productId === doc.productId && other.state === 'released') {
        save({ ...other, state: 'obsolete' })
      }
    }
    save({ ...doc, state: 'released' })
    toast(`${label} released`, {
      tone: 'success',
      description: 'Earlier released versions for this product are now obsolete.',
    })
  }

  const copyAsDraft = () => {
    const rev = nextRev(siblings, doc.productId)
    const copy = {
      ...doc,
      id: newId(idPrefix),
      code: withRev(doc.code, rev),
      rev,
      state: 'draft',
      createdAt: nowIso(),
    }
    save(copy)
    toast(`Draft ${copy.code} created`, { tone: 'success' })
    navigate(path(copy.id))
  }

  const items: (ActionMenuItem | 'separator')[] = [
    {
      key: 'copy',
      label: 'Copy as new draft',
      icon: <Copy />,
      description: `Rev ${nextRev(siblings, doc.productId)}, unlocked for edits`,
      onSelect: copyAsDraft,
    },
    'separator',
    {
      key: 'delete',
      label: `Delete ${label}`,
      icon: <Trash2 />,
      destructive: true,
      disabled: referenced,
      description: referenced
        ? `Referenced by ${plural(usage.revisions.length, 'revision')} and ${plural(usage.mos.length, 'order')}`
        : undefined,
      onSelect: () => setDeleting(true),
    },
  ]

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback={listPath} />
        <div className="gap-2 flex flex-wrap items-center">
          {actions}
          {editable && doc.state === 'draft' && (
            <Button variant="outline" onClick={submit}>
              <Send />
              Submit for review
            </Button>
          )}
          {editable && (
            <Button onClick={release}>
              <Rocket />
              Release
            </Button>
          )}
          {manage && (
            <ActionMenu
              title={doc.code}
              items={items}
              trigger={
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card variant="ink" className="p-5 relative overflow-hidden">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">
              {doc.code} · {doc.rev}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{title}</h1>
            <p className="text-sm text-on-ink-muted">
              <Link to={paths.product(doc.productId)} className="hover:underline">
                {product ? `${product.name} · ${product.code}` : 'Unknown product'}
              </Link>
              {subtitle && <> · {subtitle}</>}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            {badges}
            <RevisionBadge state={doc.state} />
            {doc.state === 'released' && <LockBadge />}
          </div>
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          {metrics.map((m) => (
            <div key={m.label}>
              <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">
                {m.label}
              </p>
              <p className="mt-1 gap-1.5 flex flex-wrap items-end leading-none">
                <span className="text-3xl font-bold tracking-tight tabular-nums">{m.value}</span>
                {m.unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{m.unit}</span>}
              </p>
            </div>
          ))}
        </div>
        {doc.state === 'released' && (
          <p className="mt-4 rounded-2xl px-3 py-2 text-sm bg-white/10">
            Released data is read only. Copy it as a new draft to change it, or raise an ECO for a new product
            revision.
          </p>
        )}
        <div
          aria-hidden
          className="-right-24 -top-24 size-72 blur-3xl pointer-events-none absolute rounded-full bg-accent/30"
        />
      </Card>

      {children}

      <UsedByCard usage={usage} productId={doc.productId} />

      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${doc.code}?`}
        description="The document disappears from the list. Nothing references it, so no order or revision is affected."
        confirmLabel="Delete"
        destructive
        onConfirm={() => {
          remove(doc.id)
          setDeleting(false)
          toast(`${label} deleted`, { tone: 'default' })
          navigate(listPath, { replace: true })
        }}
      />
    </div>
  )
}

function UsedByCard({ usage, productId }: { usage: DocUsage; productId: string }) {
  const empty = usage.revisions.length === 0 && usage.mos.length === 0
  return (
    <Card>
      <CardHeader>
        <CardTitle>Used by</CardTitle>
        <p className="text-sm text-muted">
          Product revisions that carry this document and orders that froze it in their snapshot.
        </p>
      </CardHeader>
      <CardContent>
        {empty ? (
          <EmptyState
            compact
            title="Not referenced yet"
            description="Attach it to a product revision through an ECO. Orders pick it up when they are released."
          />
        ) : (
          <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
            <div className="space-y-2">
              <p className="font-semibold tracking-wider text-[11px] text-muted uppercase">Revisions</p>
              {usage.revisions.length === 0 ? (
                <p className="text-sm text-muted">No revision references it.</p>
              ) : (
                usage.revisions.map((r) => (
                  <Link
                    key={r.id}
                    to={paths.product(productId)}
                    className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-sm font-semibold block">Rev {r.rev}</span>
                      <span className="text-xs block truncate text-muted">
                        {r.effectiveFrom ? `Effective ${fmtDate(r.effectiveFrom)}` : 'Not effective'}
                        {r.changeReason ? ` · ${r.changeReason}` : ''}
                      </span>
                    </span>
                    <RevisionBadge state={r.state} />
                  </Link>
                ))
              )}
            </div>
            <div className="space-y-2">
              <p className="font-semibold tracking-wider text-[11px] text-muted uppercase">Orders</p>
              {usage.mos.length === 0 ? (
                <p className="text-sm text-muted">No order snapshot references it.</p>
              ) : (
                usage.mos.map((m) => (
                  <div key={m.id} className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2">
                    <MoLink moId={m.id} className="flex-1" />
                    <MoStatusBadge status={m.status} />
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
