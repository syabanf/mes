import { fmtNumber, nowIso } from '@mes/fixtures'
import type { Operation, ReworkOrder, ReworkStatus } from '@mes/types'
import { REWORK_STATUS_LABEL } from '@mes/types'
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
  cn,
  toast,
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { ReasonPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { moOperations } from './lib'

export const REWORK_STATUSES: ReworkStatus[] = ['open', 'in_progress', 'inspection', 'closed']
const STATUS_OPTIONS = REWORK_STATUSES.map((st) => ({ value: st, label: REWORK_STATUS_LABEL[st] }))

/** Toggle chips over the operations of an order snapshot, kept in sequence order. */
export function RouteSeqPicker({
  ops,
  value,
  onChange,
  empty,
}: {
  ops: Operation[]
  value: number[]
  onChange: (seqs: number[]) => void
  empty: string
}) {
  if (ops.length === 0)
    return <p className="rounded-2xl px-3 py-2 text-sm bg-surface-2 text-muted">{empty}</p>
  const toggle = (seq: number) =>
    onChange(value.includes(seq) ? value.filter((v) => v !== seq) : [...value, seq].sort((a, b) => a - b))
  return (
    <div className="gap-2 flex flex-wrap">
      {ops.map((o) => {
        const on = value.includes(o.seq)
        return (
          <button
            key={o.id}
            type="button"
            role="checkbox"
            aria-checked={on}
            onClick={() => toggle(o.seq)}
            className={cn(
              'h-9 gap-2 px-3.5 text-xs font-semibold inline-flex items-center rounded-full transition-colors',
              on ? 'bg-ink text-on-ink' : 'bg-surface text-body hover:bg-surface-2',
            )}
          >
            <span className="tabular-nums opacity-70">{o.seq}</span>
            {o.name}
          </button>
        )
      })}
    </div>
  )
}

// ─── Close with result ──────────────────────────────────────────

export function CloseReworkDialog({
  open,
  onOpenChange,
  rework,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rework: ReworkOrder
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && <CloseForm rework={rework} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function CloseForm({ rework: r, onDone }: { rework: ReworkOrder; onDone: () => void }) {
  const s = useScoped()
  const [good, setGood] = useState(String(r.qty))
  const [scrap, setScrap] = useState('0')
  const [tried, setTried] = useState(false)
  const g = Number(good)
  const sc = Number(scrap)
  const error =
    !(g >= 0 && sc >= 0) || !Number.isInteger(g) || !Number.isInteger(sc)
      ? 'Enter whole quantities.'
      : g + sc > r.qty
        ? `Good and scrap add up to ${fmtNumber(g + sc)}, more than the ${fmtNumber(r.qty)} reworked.`
        : g + sc === 0
          ? 'Enter at least one piece.'
          : null
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) return
    s.dispatch({ type: 'rework/close', id: r.id, goodQty: g, scrapQty: sc })
    toast(`${r.code} closed`, {
      tone: 'success',
      description: `${fmtNumber(g)} good, ${fmtNumber(sc)} scrap`,
    })
    onDone()
  }
  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Close {r.code}</DialogTitle>
        <DialogDescription>
          Good pieces go back to the order as good quantity; scrap adds to its scrap count.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 grid grid-cols-2">
        <FormField label="Good" required>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={good}
            onChange={(e) => setGood(e.target.value)}
            invalid={tried && !!error}
          />
        </FormField>
        <FormField label="Scrap" required>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={scrap}
            onChange={(e) => setScrap(e.target.value)}
            invalid={tried && !!error}
          />
        </FormField>
      </div>
      {tried && error && <p className="mt-2 text-xs text-danger">{error}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Close rework</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Edit ───────────────────────────────────────────────────────

/** Edit the quantity, routing, reason and status of a rework order. New ones come from the create dialog on the list. */
export function ReworkDialog({
  open,
  onOpenChange,
  rework,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  rework: ReworkOrder
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <ReworkForm rework={rework} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ReworkForm({ rework: r, onDone }: { rework: ReworkOrder; onDone: () => void }) {
  const s = useScoped()
  const ops = moOperations(s, s.maps.mo.get(r.moId))
  const [qty, setQty] = useState(String(r.qty))
  const [seqs, setSeqs] = useState<number[]>(r.routeSeqs)
  const [reasonId, setReasonId] = useState<string | null>(r.reasonCodeId)
  const [status, setStatus] = useState<ReworkStatus>(r.status)
  const [tried, setTried] = useState(false)

  const n = Number(qty)
  const errors = {
    qty: !(n > 0) || !Number.isInteger(n) ? 'Enter a whole quantity above zero.' : null,
    route: seqs.length === 0 ? 'Pick at least one operation to route through.' : null,
    reason: !reasonId ? 'Choose a rework reason.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !reasonId) return
    s.dispatch({
      type: 'reworkOrders/upsert',
      item: {
        ...r,
        qty: n,
        routeSeqs: seqs,
        reasonCodeId: reasonId,
        status,
        closedAt: status === 'closed' ? (r.closedAt ?? nowIso()) : null,
      },
    })
    toast(`${r.code} updated`, { tone: 'success' })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Edit {r.code}</DialogTitle>
        <DialogDescription>
          Corrects the rework record. Good and scrap counts are set when the order closes with a result.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Quantity" required error={show(errors.qty)} hint="Pieces">
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        <FormField label="Status">
          <NativeSelect
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as ReworkStatus)}
          />
        </FormField>
        <FormField label="Reason" required error={show(errors.reason)} className="sm:col-span-2">
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
            empty="This order has no engineering snapshot yet."
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save</Button>
      </DialogFooter>
    </form>
  )
}
