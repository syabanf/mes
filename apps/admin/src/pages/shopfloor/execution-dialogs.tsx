import { outputBlocker, woCompletionBlocker } from '@mes/fixtures'
import type { PauseReason, ReasonKind, WorkOrder } from '@mes/types'
import { PAUSE_REASON_LABEL } from '@mes/types'
import {
  Banner,
  Button,
  ConfirmDialog,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
  Textarea,
  toast,
} from '@mes/ui'
import { Minus, Plus } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { LotPicker, ReasonPicker } from '../../components/pickers'
import { type Scoped, useScoped } from '../../state/scoped'

const PAUSE_REASONS = (Object.keys(PAUSE_REASON_LABEL) as PauseReason[]).map((r) => ({
  value: r,
  label: PAUSE_REASON_LABEL[r],
}))

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void; wo: WorkOrder }

/** A quality-sensitive operation cannot complete without a passed inspection on this work order. */
export const completionBlocked = (s: Scoped, wo: WorkOrder) => !!woCompletionBlocker(s.state, wo)

export function PauseDialog({ open, onOpenChange, wo }: DialogProps) {
  const { dispatch } = useScoped()
  const [reason, setReason] = useState<PauseReason>('break')
  const [note, setNote] = useState('')
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Pause ${wo.code}?`}
      description="The clock keeps running on the order. Resume when the cause is cleared."
      confirmLabel="Pause"
      onConfirm={() => {
        dispatch({ type: 'workOrders/pause', id: wo.id, reason, note })
        toast('Operation paused', { tone: 'default' })
        onOpenChange(false)
      }}
    >
      <div className="space-y-3">
        <FormField label="Reason" required>
          <NativeSelect
            options={PAUSE_REASONS}
            value={reason}
            onChange={(e) => setReason(e.target.value as PauseReason)}
            className="[&_select]:h-12"
          />
        </FormField>
        <FormField label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
        </FormField>
      </div>
    </ConfirmDialog>
  )
}

export function IssueDialog({ open, onOpenChange, wo }: DialogProps) {
  const { dispatch } = useScoped()
  const [text, setText] = useState('')
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Report an issue on ${wo.code}`}
      description="The supervisor sees it in the event feed and on the work order."
      confirmLabel="Report"
      confirmDisabled={!text.trim()}
      onConfirm={() => {
        dispatch({ type: 'workOrders/reportIssue', id: wo.id, text: text.trim() })
        toast('Issue reported', { tone: 'success' })
        onOpenChange(false)
      }}
    >
      <FormField label="What is wrong?" required>
        <Textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          className="min-h-24"
          placeholder="Machine noise, missing tool, material looks off"
        />
      </FormField>
    </ConfirmDialog>
  )
}

export function CompleteDialog({ open, onOpenChange, wo }: DialogProps) {
  const s = useScoped()
  const blocker = woCompletionBlocker(s.state, wo)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Complete ${wo.code}?`}
      description={`${wo.goodQty} good of ${wo.targetQty} target. The next operation becomes ready.`}
      confirmLabel="Complete operation"
      confirmDisabled={!!blocker}
      onConfirm={() => {
        s.dispatch({ type: 'workOrders/complete', id: wo.id })
        toast('Operation completed', { tone: 'success' })
        onOpenChange(false)
      }}
    >
      {blocker ? (
        <Banner tone="danger" title="Operation cannot complete">
          {blocker}
        </Banner>
      ) : null}
    </ConfirmDialog>
  )
}

export function OutputDialog({ open, onOpenChange, wo }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <OutputForm wo={wo} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function OutputForm({ wo, onDone }: { wo: WorkOrder; onDone: () => void }) {
  const s = useScoped()
  const [good, setGood] = useState(0)
  const [reject, setReject] = useState(0)
  const [rework, setRework] = useState(0)
  const [scrap, setScrap] = useState(0)
  const [reasonCodeId, setReason] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  const total = good + reject + rework + scrap
  const reasonKind: ReasonKind | null =
    scrap > 0 ? 'scrap' : reject > 0 ? 'reject' : rework > 0 ? 'rework' : null
  const errors = {
    total: outputBlocker(s.state, {
      id: wo.id,
      goodQty: good,
      rejectQty: reject,
      reworkQty: rework,
      scrapQty: scrap,
      reasonCodeId,
      note,
    }),
    reason: reasonKind && !reasonCodeId ? `Pick the ${reasonKind} reason.` : null,
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (errors.total || errors.reason) return
    s.dispatch({
      type: 'workOrders/recordOutput',
      record: {
        id: wo.id,
        goodQty: good,
        rejectQty: reject,
        reworkQty: rework,
        scrapQty: scrap,
        reasonCodeId,
        note,
      },
    })
    toast(`${total} recorded`, { tone: 'success', description: `${good} good on ${wo.code}` })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Record output</DialogTitle>
        <DialogDescription>
          {wo.code} · {wo.operationName}. Good pieces feed the next operation.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <Stepper label="Good" value={good} onChange={setGood} emphasis />
        <Stepper label="Reject" value={reject} onChange={setReject} />
        <Stepper label="Rework" value={rework} onChange={setRework} />
        <Stepper label="Scrap" value={scrap} onChange={setScrap} />
      </div>
      {reasonKind && (
        <FormField
          label={`${reasonKind[0]!.toUpperCase()}${reasonKind.slice(1)} reason`}
          required
          className="mt-4"
          error={tried ? (errors.reason ?? undefined) : undefined}
        >
          <ReasonPicker
            key={reasonKind}
            kind={reasonKind}
            value={reasonCodeId}
            onChange={setReason}
            invalid={tried && !!errors.reason}
          />
        </FormField>
      )}
      <FormField label="Note" className="mt-4">
        <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
      </FormField>
      {tried && errors.total && <p className="mt-2 text-xs text-danger">{errors.total}</p>}
      <DialogFooter>
        <Button type="button" variant="outline" size="lg" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" size="lg">
          Record {total > 0 ? total : ''}
        </Button>
      </DialogFooter>
    </form>
  )
}

function Stepper({
  label,
  value,
  onChange,
  emphasis = false,
}: {
  label: string
  value: number
  onChange: (v: number) => void
  emphasis?: boolean
}) {
  const set = (v: number) => onChange(Math.max(0, Math.floor(Number.isFinite(v) ? v : 0)))
  return (
    <FormField label={label}>
      <div className="gap-2 flex items-center">
        <Button
          type="button"
          variant="soft"
          size="icon-lg"
          aria-label={`Decrease ${label}`}
          onClick={() => set(value - 1)}
          disabled={value <= 0}
        >
          <Minus />
        </Button>
        <Input
          type="number"
          min={0}
          inputMode="numeric"
          value={value}
          onChange={(e) => set(Number(e.target.value))}
          inputClassName={`h-12 text-center text-xl font-bold tabular-nums ${emphasis ? 'border-ink' : ''}`}
          aria-label={label}
        />
        <Button
          type="button"
          variant={emphasis ? 'secondary' : 'soft'}
          size="icon-lg"
          aria-label={`Increase ${label}`}
          onClick={() => set(value + 1)}
        >
          <Plus />
        </Button>
      </div>
    </FormField>
  )
}

export function ConsumeDialog({
  open,
  onOpenChange,
  wo,
  materialId,
  remaining,
}: DialogProps & { materialId: string; remaining: number }) {
  const s = useScoped()
  const [lotId, setLotId] = useState<string | null>(null)
  const [qty, setQty] = useState(String(Math.max(0, remaining)))
  const lot = lotId ? s.maps.lot.get(lotId) : undefined
  const amount = Number(qty)
  const invalid = !lot || !(amount > 0) || amount > lot.qty
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Consume ${s.materialName(materialId)}`}
      description="Scan the lot at the station. Consumption is booked against this operation."
      confirmLabel="Consume"
      confirmDisabled={invalid}
      onConfirm={() => {
        s.dispatch({
          type: 'materials/consume',
          moId: wo.moId,
          woId: wo.id,
          materialId,
          lotId: lotId!,
          qty: amount,
          mode: 'scan',
        })
        toast('Material consumed', { tone: 'success', description: `${amount} from lot ${lot?.code ?? ''}` })
        onOpenChange(false)
      }}
    >
      <div className="space-y-3">
        <FormField label="Lot" required>
          <LotPicker materialId={materialId} value={lotId} onChange={setLotId} />
        </FormField>
        <FormField
          label="Quantity"
          required
          hint={lot ? `${lot.qty} available on ${lot.code}` : `${remaining} still required`}
          error={lot && amount > lot.qty ? 'More than the lot holds.' : undefined}
        >
          <Input
            type="number"
            min={0}
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            inputClassName="h-12 text-lg font-semibold tabular-nums"
          />
        </FormField>
      </div>
    </ConfirmDialog>
  )
}
