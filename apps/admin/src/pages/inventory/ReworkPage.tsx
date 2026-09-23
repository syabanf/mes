import { fmtAgo, fmtNumber } from '@mes/fixtures'
import type { ReworkOrder, ReworkStatus } from '@mes/types'
import { REWORK_STATUS_LABEL } from '@mes/types'
import {
  Badge,
  Button,
  Card,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  StatCard,
  toast,
} from '@mes/ui'
import { CheckCheck, Microscope, Play, Plus, Wrench } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { ReworkStatusBadge } from '../../components/badges'
import { MoLink, WoLink, paths } from '../../components/links'
import { MoPicker, ReasonPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { WipCombobox, WoCombobox } from './dialogs'
import { REWORK_STATUSES, RouteSeqPicker } from './rework-dialogs'
import { moOperations } from './lib'

const STATUS_TONE: Record<ReworkStatus, 'warning' | 'info' | 'ink' | 'default'> = {
  open: 'warning',
  in_progress: 'info',
  inspection: 'ink',
  closed: 'default',
}
const activeFilter = (status: string) => status === 'released' || status === 'in_progress'

export function ReworkPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const [status, setStatus] = useHistoryState<ReworkStatus | null>('status', null)
  const navigate = useNavigate()
  const [creating, setCreating] = useState(false)
  const table = useTableHistory()
  const manage = can('shopfloor.execute') || can('quality.execute')

  const rows = useMemo(
    () =>
      s.reworkOrders
        .filter((r) => !status || r.status === status)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s.reworkOrders, status],
  )
  const count = (st: ReworkStatus) => s.reworkOrders.filter((r) => r.status === st).length

  const columns: Column<ReworkOrder>[] = [
    {
      id: 'code',
      header: 'Rework',
      sortValue: (r) => r.code,
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{r.code}</p>
          <p className="text-sm truncate">{s.productName(s.maps.mo.get(r.moId)?.productId ?? '')}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <ReworkStatusBadge status={r.status} />
          </div>
        </div>
      ),
    },
    {
      id: 'mo',
      header: 'Order',
      hideBelow: 'md',
      sortValue: (r) => s.maps.mo.get(r.moId)?.code ?? '',
      cell: (r) => <MoLink moId={r.moId} showProduct={false} />,
    },
    { id: 'wo', header: 'Source', hideBelow: 'lg', cell: (r) => <WoLink woId={r.sourceWoId} /> },
    {
      id: 'qty',
      header: 'Qty',
      align: 'right',
      sortValue: (r) => r.qty,
      cell: (r) => <span className="font-semibold tabular-nums">{fmtNumber(r.qty)}</span>,
    },
    {
      id: 'route',
      header: 'Route',
      hideBelow: 'lg',
      cell: (r) => (
        <span className="gap-1 flex flex-wrap">
          {r.routeSeqs.map((seq) => (
            <Badge key={seq} variant="outline">
              {seq}
            </Badge>
          ))}
        </span>
      ),
    },
    { id: 'reason', header: 'Reason', hideBelow: 'xl', cell: (r) => s.reasonLabel(r.reasonCodeId) },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (r) => r.status,
      cell: (r) => <ReworkStatusBadge status={r.status} />,
    },
    {
      id: 'wip',
      header: 'Rework WIP',
      hideBelow: 'xl',
      cell: (r) =>
        r.reworkWipId ? (
          <Link
            to={paths.wip(r.reworkWipId)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-mono hover:text-accent"
          >
            {s.maps.wip.get(r.reworkWipId)?.code}
          </Link>
        ) : (
          '—'
        ),
    },
    {
      id: 'result',
      header: 'Good / scrap',
      hideBelow: 'md',
      align: 'right',
      cell: (r) =>
        r.status === 'closed' ? (
          <span className="tabular-nums">
            <span className="text-success">{fmtNumber(r.goodQty)}</span> /{' '}
            <span className="text-accent">{fmtNumber(r.scrapQty)}</span>
          </span>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: 'created',
      header: 'Created',
      hideBelow: 'md',
      sortValue: (r) => r.createdAt,
      cell: (r) => <span className="text-muted">{fmtAgo(r.createdAt, now)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Rework"
        description="Pieces sent back through part of the routing. Each order carries its own WIP batch and ends with an inspection that splits it into good and scrap."
        actions={
          manage && (
            <Button onClick={() => setCreating(true)}>
              <Plus />
              Create rework
            </Button>
          )
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          {REWORK_STATUSES.map((st) => (
            <StatCard
              key={st}
              label={REWORK_STATUS_LABEL[st]}
              value={count(st)}
              icon={
                st === 'inspection' ? (
                  <Microscope />
                ) : st === 'closed' ? (
                  <CheckCheck />
                ) : st === 'in_progress' ? (
                  <Play />
                ) : (
                  <Wrench />
                )
              }
              tone={count(st) ? STATUS_TONE[st] : 'default'}
              onClick={() => setStatus(status === st ? null : st)}
            />
          ))}
        </div>
        <ChipRow className="max-w-full">
          <Chip
            variant="filter"
            active={!status}
            count={s.reworkOrders.length}
            onClick={() => setStatus(null)}
          >
            All
          </Chip>
          {REWORK_STATUSES.map((st) => (
            <Chip
              key={st}
              variant="filter"
              active={status === st}
              count={count(st)}
              onClick={() => setStatus(status === st ? null : st)}
            >
              {REWORK_STATUS_LABEL[st]}
            </Chip>
          ))}
        </ChipRow>
        <Card>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.id}
            onRowClick={(r) => navigate(paths.rework(r.id))}
            resetPageKey={status}
            empty={
              <EmptyState
                compact
                title="No rework orders"
                description="Create one from a failed inspection or from a station."
              />
            }
            {...table}
          />
        </Card>
      </div>

      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent size="md">
          {creating && <CreateForm onDone={() => setCreating(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function CreateForm({ onDone }: { onDone: () => void }) {
  const s = useScoped()
  const [moId, setMoId] = useState<string | null>(null)
  const [woId, setWoId] = useState<string | null>(null)
  const [wipId, setWipId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [seqs, setSeqs] = useState<number[]>([])
  const [reasonId, setReasonId] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const mo = moId ? s.maps.mo.get(moId) : undefined
  const ops = moOperations(s, mo)
  const wip = wipId ? s.maps.wip.get(wipId) : undefined
  const n = Number(qty)
  const errors = {
    mo: !moId ? 'Choose the order.' : null,
    wo: !woId ? 'Choose the work order the pieces came from.' : null,
    wip: !wip ? 'Choose the source batch.' : null,
    qty:
      !Number.isSafeInteger(n) || n <= 0
        ? 'Enter a positive whole quantity.'
        : wip && n > wip.qty
          ? `The batch holds ${fmtNumber(wip.qty)}.`
          : null,
    route: seqs.length === 0 ? 'Pick at least one operation to route through.' : null,
    reason: !reasonId ? 'Choose a rework reason.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !moId || !woId || !reasonId) return
    s.dispatch({
      type: 'rework/create',
      moId,
      sourceWoId: woId,
      sourceWipId: wipId,
      qty: n,
      routeSeqs: seqs,
      reasonCodeId: reasonId,
    })
    toast('Rework order created', {
      tone: 'success',
      description: `${fmtNumber(n)} pieces through ${seqs.map((x) => `op ${x}`).join(', ')}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Create rework</DialogTitle>
        <DialogDescription>
          A rework WIP batch is created in the rework area and the source work order records the quantity.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Manufacturing order" required error={show(errors.mo)} className="sm:col-span-2">
          <MoPicker
            value={moId}
            onChange={(id) => {
              setMoId(id)
              setWoId(null)
              setWipId(null)
              setSeqs([])
            }}
            filter={activeFilter}
            invalid={!!show(errors.mo)}
          />
        </FormField>
        <FormField label="Source work order" required error={show(errors.wo)}>
          <WoCombobox
            moId={moId}
            value={woId}
            onChange={(id) => {
              setWoId(id)
              const wo = id ? s.maps.wo.get(id) : undefined
              const op = wo ? ops.find((o) => o.seq === wo.operationSeq) : undefined
              if (op?.reworkToSeq !== null && op?.reworkToSeq !== undefined) setSeqs([op.reworkToSeq])
            }}
            invalid={!!show(errors.wo)}
          />
        </FormField>
        <FormField label="Source WIP" required error={show(errors.wip)}>
          <WipCombobox
            moId={moId}
            value={wipId}
            onChange={(id) => {
              setWipId(id)
              const w = id ? s.maps.wip.get(id) : undefined
              if (w && !qty) setQty(String(w.qty))
            }}
            clearable
          />
        </FormField>
        <FormField label="Quantity" required error={show(errors.qty)}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        <FormField label="Reason" required error={show(errors.reason)}>
          <ReasonPicker
            kind="rework"
            value={reasonId}
            onChange={setReasonId}
            invalid={!!show(errors.reason)}
          />
        </FormField>
        <FormField
          label="Route through"
          required
          error={show(errors.route)}
          hint="Operations from the order snapshot, in sequence."
          className="sm:col-span-2"
        >
          <RouteSeqPicker
            ops={ops}
            value={seqs}
            onChange={setSeqs}
            empty={moId ? 'This order has no engineering snapshot yet.' : 'Choose an order first.'}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Create rework</Button>
      </DialogFooter>
    </form>
  )
}
