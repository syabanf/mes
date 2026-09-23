import { fmtAgo, fmtDateTime, fmtNumber, wipAgeHours } from '@mes/fixtures'
import type { Wip } from '@mes/types'
import { ACTIVE_WIP_STATES } from '@mes/types'
import {
  ActionMenu,
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  toast,
} from '@mes/ui'
import { Merge, MoreHorizontal, MoveRight, PauseOctagon, Pencil, Play, Split, Trash2 } from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { WipStateBadge } from '../../components/badges'
import { MachineLink, MoLink, ProductLink, WoLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { EventList, HeroMetric } from './detail'
import { operationName } from './lib'
import { type WipAction, WipActionDialog, WipDialog, siblingsOf } from './wip-dialogs'

export function WipDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const wip = s.maps.wip.get(id)
  const [action, setAction] = useState<WipAction | null>(null)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const events = useMemo(
    () => s.productionEvents.filter((e) => e.wipId === id).sort((a, b) => b.at.localeCompare(a.at)),
    [s.productionEvents, id],
  )
  const children = useMemo(() => s.wips.filter((w) => w.parentIds.includes(id)), [s.wips, id])

  if (!wip) {
    return (
      <Card>
        <EmptyState
          title="WIP batch not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback="/inventory/wip" />}
        />
      </Card>
    )
  }

  const mo = s.maps.mo.get(wip.moId)
  const parents = wip.parentIds.map((pid) => s.maps.wip.get(pid)).filter((w): w is Wip => !!w)
  const siblings = siblingsOf(s.wips, wip)
  const manage = can('shopfloor.execute') || can('inventory.manage')
  const active = ACTIVE_WIP_STATES.includes(wip.state) && wip.qty > 0
  const held = wip.state === 'hold' || wip.state === 'quality_hold'
  const aging = wipAgeHours(wip, now) > s.settings.wipAgingHours
  const hold = s.qualityHolds.find(
    (h) => h.target === 'wip' && h.targetId === wip.id && h.status === 'active',
  )
  const rework = s.reworkOrders.find((r) => r.reworkWipId === wip.id)
  const chip = 'rounded-full bg-surface px-2.5 py-0.5 font-mono text-xs hover:bg-surface-2 hover:text-accent'

  const menu = [
    manage ? { key: 'edit', label: 'Edit batch', icon: <Pencil />, onSelect: () => setEditing(true) } : null,
    manage
      ? {
          key: 'delete',
          label: 'Delete batch',
          icon: <Trash2 />,
          destructive: true,
          onSelect: () => setDeleting(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/inventory/wip" />
        <div className="gap-2 flex flex-wrap items-center">
          {manage && active && (
            <>
              {held ? (
                <Button variant="outline" onClick={() => setAction('release')}>
                  <Play />
                  Release
                </Button>
              ) : (
                <Button variant="outline" onClick={() => setAction('hold')}>
                  <PauseOctagon />
                  Hold
                </Button>
              )}
              <Button variant="outline" onClick={() => setAction('split')} disabled={wip.qty < 2}>
                <Split />
                Split
              </Button>
              <Button variant="outline" onClick={() => setAction('merge')} disabled={siblings.length === 0}>
                <Merge />
                Merge
              </Button>
              <Button onClick={() => setAction('move')}>
                <MoveRight />
                Move
              </Button>
            </>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={wip.code}
              items={menu}
              trigger={
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              }
            />
          )}
        </div>
      </div>

      <Card variant="ink" className="p-5">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">
              {mo?.code ?? 'Order removed'} · {wip.batch}
            </p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight font-mono">{wip.code}</h1>
            <p className="text-sm text-on-ink-muted">
              {s.productName(wip.productId)} · Op {wip.operationSeq} {operationName(s, mo, wip.operationSeq)}{' '}
              · {s.locationName(wip.locationId)}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <WipStateBadge state={wip.state} />
            {aging && (
              <Badge variant="warning" dot>
                Aging
              </Badge>
            )}
          </div>
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <HeroMetric label="Quantity" value={fmtNumber(wip.qty)} unit="pcs" />
          <HeroMetric
            label="Operation"
            value={String(wip.operationSeq)}
            unit={operationName(s, mo, wip.operationSeq)}
          />
          <HeroMetric
            label="Age"
            value={fmtAgo(wip.updatedAt, now)}
            unit={aging ? `over ${s.settings.wipAgingHours}h` : undefined}
          />
          <HeroMetric label="Lots" value={String(wip.lotIds.length)} unit="consumed" />
        </div>
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Batch</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                { label: 'Order', value: <MoLink moId={wip.moId} /> },
                { label: 'Work order', value: wip.woId ? <WoLink woId={wip.woId} /> : 'None' },
                { label: 'Product', value: <ProductLink productId={wip.productId} /> },
                { label: 'Location', value: s.locationName(wip.locationId) },
                { label: 'Batch', value: <span className="text-xs font-mono">{wip.batch}</span> },
                { label: 'Machine', value: <MachineLink machineId={wip.machineId} /> },
                {
                  label: 'Quality hold',
                  value: hold ? (
                    <Link to={paths.hold(hold.id)} className="text-xs font-mono hover:text-accent">
                      {hold.code} · {s.reasonLabel(hold.reasonCodeId)}
                    </Link>
                  ) : null,
                  hidden: !hold,
                },
                {
                  label: 'Rework',
                  value: rework ? (
                    <Link to={paths.rework(rework.id)} className="text-xs font-mono hover:text-accent">
                      {rework.code}
                    </Link>
                  ) : null,
                  hidden: !rework,
                },
                { label: 'Created', value: fmtDateTime(wip.createdAt) },
                { label: 'Updated', value: `${fmtDateTime(wip.updatedAt)} · ${fmtAgo(wip.updatedAt, now)}` },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Genealogy</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <GenealogyRow label="From" empty="Original batch">
              {parents.map((p) => (
                <Link key={p.id} to={paths.wip(p.id)} className={chip}>
                  {p.code}
                </Link>
              ))}
            </GenealogyRow>
            <GenealogyRow label="Into" empty="Not split or merged">
              {children.map((c) => (
                <Link key={c.id} to={paths.wip(c.id)} className={chip}>
                  {c.code}
                </Link>
              ))}
            </GenealogyRow>
            <GenealogyRow label="Lots" empty="No material consumed yet">
              {wip.lotIds.map((lotId) => (
                <Link key={lotId} to={paths.lotDetail(lotId)} className={chip}>
                  {s.maps.lot.get(lotId)?.code ?? lotId}
                </Link>
              ))}
            </GenealogyRow>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Events</CardTitle>
        </CardHeader>
        <CardContent>
          <EventList
            events={events}
            now={now}
            empty="Moves, holds, splits and merges of this batch show here."
          />
        </CardContent>
      </Card>

      {action && <WipActionDialog wip={wip} action={action} onClose={() => setAction(null)} />}
      <WipDialog open={editing} onOpenChange={setEditing} editing={wip} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${wip.code}?`}
        description="Removes the batch record. Its events and the work order counts stay as they are."
        confirmLabel="Delete batch"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'wips/remove', id: wip.id })
          setDeleting(false)
          toast('WIP batch deleted', { tone: 'default' })
          navigate('/inventory/wip')
        }}
      />
    </div>
  )
}

function GenealogyRow({ label, empty, children }: { label: string; empty: string; children: ReactNode[] }) {
  return (
    <div className="gap-3 grid grid-cols-[3rem_1fr] items-start">
      <span className="pt-0.5 text-xs text-muted">{label}</span>
      <span className="gap-1.5 flex flex-wrap">
        {children.length ? children : <span className="text-xs text-muted">{empty}</span>}
      </span>
    </div>
  )
}
