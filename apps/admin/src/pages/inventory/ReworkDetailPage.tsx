import { fmtAgo, fmtDateTime, fmtNumber } from '@mes/fixtures'
import type { ReworkStatus } from '@mes/types'
import {
  ActionMenu,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  KeyValue,
  Steps,
  type StepState,
  toast,
} from '@mes/ui'
import { CheckCheck, Microscope, MoreHorizontal, Pencil, Play, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { InspectionStatusBadge, ReworkStatusBadge, WipStateBadge } from '../../components/badges'
import { MoLink, WoLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'
import { EventList, HeroMetric } from './detail'
import { moOperations } from './lib'
import { CloseReworkDialog, REWORK_STATUSES, ReworkDialog } from './rework-dialogs'

export function ReworkDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const now = useNow(60_000)
  const r = s.maps.rework.get(id)
  const [closing, setClosing] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  const wipId = r?.reworkWipId ?? null
  const events = useMemo(
    () =>
      wipId
        ? s.productionEvents.filter((e) => e.wipId === wipId).sort((a, b) => b.at.localeCompare(a.at))
        : [],
    [s.productionEvents, wipId],
  )

  if (!r) {
    return (
      <Card>
        <EmptyState
          title="Rework order not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback="/inventory/rework" />}
        />
      </Card>
    )
  }

  const mo = s.maps.mo.get(r.moId)
  const ops = moOperations(s, mo)
  const wip = r.reworkWipId ? s.maps.wip.get(r.reworkWipId) : undefined
  const sourceWip = r.sourceWipId ? s.maps.wip.get(r.sourceWipId) : undefined
  const inspection = r.inspectionId ? s.maps.inspection.get(r.inspectionId) : undefined
  const manage = can('shopfloor.execute') || can('quality.execute')
  const closed = r.status === 'closed'
  const cur = REWORK_STATUSES.indexOf(r.status)
  const stepState = (i: number): StepState => (i < cur ? 'done' : i === cur ? 'current' : 'upcoming')
  const steps = [
    {
      key: 'wip',
      label: 'Rework WIP',
      state: r.reworkWipId ? (cur > 0 ? 'done' : 'current') : stepState(0),
      hint: wip?.code,
    },
    {
      key: 'route',
      label: 'Rework routing',
      state: stepState(1),
      hint: r.routeSeqs.map((seq) => `op ${seq}`).join(' → '),
    },
    { key: 'inspection', label: 'Inspection', state: stepState(2), hint: inspection?.code },
    {
      key: 'result',
      label: 'Good / Scrap',
      state: closed ? 'done' : 'upcoming',
      hint: closed ? `${fmtNumber(r.goodQty)} good · ${fmtNumber(r.scrapQty)} scrap` : undefined,
    },
  ] satisfies { key: string; label: string; state: StepState; hint?: string }[]

  const setStatus = (next: ReworkStatus, label: string) => {
    s.dispatch({ type: 'rework/setStatus', id: r.id, status: next })
    toast(label, { tone: 'success' })
  }

  const menu = [
    manage ? { key: 'edit', label: 'Edit rework', icon: <Pencil />, onSelect: () => setEditing(true) } : null,
    manage
      ? {
          key: 'delete',
          label: 'Delete rework',
          icon: <Trash2 />,
          destructive: true,
          onSelect: () => setDeleting(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/inventory/rework" />
        <div className="gap-2 flex flex-wrap items-center">
          {manage && r.status === 'open' && (
            <Button onClick={() => setStatus('in_progress', `${r.code} started`)}>
              <Play />
              Start
            </Button>
          )}
          {manage && r.status === 'in_progress' && (
            <Button onClick={() => setStatus('inspection', `${r.code} sent to inspection`)}>
              <Microscope />
              Send to inspection
            </Button>
          )}
          {manage && r.status === 'inspection' && (
            <Button onClick={() => setClosing(true)}>
              <CheckCheck />
              Close with result
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={r.code}
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
            <p className="text-xs font-mono text-on-ink-muted">{r.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">
              {mo ? s.productName(mo.productId) : 'Order removed'}
            </h1>
            <p className="text-sm text-on-ink-muted">
              {mo?.code ?? 'No order'} · {s.reasonLabel(r.reasonCodeId)}
            </p>
          </div>
          <ReworkStatusBadge status={r.status} />
        </div>
        <div className="mt-5 gap-4 sm:grid-cols-4 grid grid-cols-2">
          <HeroMetric label="Quantity" value={fmtNumber(r.qty)} unit="pcs" />
          <HeroMetric
            label="Route"
            value={r.routeSeqs.join(' → ') || '—'}
            unit={r.routeSeqs.length === 1 ? 'operation' : 'operations'}
          />
          <HeroMetric
            label="Good"
            value={closed ? fmtNumber(r.goodQty) : '—'}
            unit={closed ? 'pcs' : 'on close'}
          />
          <HeroMetric
            label="Scrap"
            value={closed ? fmtNumber(r.scrapQty) : '—'}
            unit={closed ? 'pcs' : 'on close'}
          />
        </div>
      </Card>

      <Card className="p-5">
        <Steps steps={steps} />
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Rework order</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                { label: 'Order', value: mo ? <MoLink moId={mo.id} /> : 'Removed' },
                { label: 'Source work order', value: <WoLink woId={r.sourceWoId} /> },
                {
                  label: 'Source WIP',
                  value: sourceWip ? (
                    <Link to={paths.wip(sourceWip.id)} className="text-xs font-mono hover:text-accent">
                      {sourceWip.code}
                    </Link>
                  ) : (
                    'None'
                  ),
                },
                {
                  label: 'Route',
                  value:
                    r.routeSeqs
                      .map((seq) => `${seq} ${ops.find((o) => o.seq === seq)?.name ?? ''}`.trim())
                      .join(' → ') || 'Not set',
                },
                { label: 'Reason', value: s.reasonLabel(r.reasonCodeId) },
                {
                  label: 'Rework WIP',
                  value: wip ? (
                    <span className="gap-2 flex flex-wrap items-center">
                      <Link to={paths.wip(wip.id)} className="text-xs font-mono hover:text-accent">
                        {wip.code} · {fmtNumber(wip.qty)} at {s.locationName(wip.locationId)}
                      </Link>
                      <WipStateBadge state={wip.state} />
                    </span>
                  ) : (
                    'None'
                  ),
                },
                {
                  label: 'Inspection',
                  value: inspection ? (
                    <span className="gap-2 flex flex-wrap items-center">
                      <Link
                        to={paths.inspection(inspection.id)}
                        className="text-xs font-mono hover:text-accent"
                      >
                        {inspection.code}
                      </Link>
                      <InspectionStatusBadge status={inspection.status} />
                    </span>
                  ) : null,
                  hidden: !inspection,
                },
                { label: 'Created', value: `${fmtDateTime(r.createdAt)} · ${fmtAgo(r.createdAt, now)}` },
                { label: 'Closed', value: r.closedAt ? fmtDateTime(r.closedAt) : null, hidden: !r.closedAt },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>History</CardTitle>
          </CardHeader>
          <CardContent>
            <EventList events={events} now={now} empty="Moves and holds of the rework batch show here." />
          </CardContent>
        </Card>
      </div>

      <CloseReworkDialog open={closing} onOpenChange={setClosing} rework={r} />
      <ReworkDialog open={editing} onOpenChange={setEditing} rework={r} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${r.code}?`}
        description="Removes the rework order. Its rework WIP batch and the source work order counts stay as they are."
        confirmLabel="Delete rework"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'reworkOrders/remove', id: r.id })
          setDeleting(false)
          toast('Rework order deleted', { tone: 'default' })
          navigate('/inventory/rework')
        }}
      />
    </div>
  )
}
