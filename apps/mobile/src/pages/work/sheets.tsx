import { outputBlocker, woCompletionBlocker } from '@mes/fixtures'
import type { PauseReason, ReasonKind, WorkOrder } from '@mes/types'
import { PAUSE_REASON_LABEL } from '@mes/types'
import { Banner, Button, FormField, Input, Textarea, cn, toast } from '@mes/ui'
import { CheckCircle2, Pause, ScanLine, TriangleAlert } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { ActionSheet } from '../../components/ActionSheet'
import { LotPicker, ReasonPicker } from '../../components/pickers'
import { Stepper } from '../../components/Stepper'
import { useMobileScope } from '../../state/scope'

const PAUSE_REASONS = Object.keys(PAUSE_REASON_LABEL) as PauseReason[]

type SheetProps = { open: boolean; onOpenChange: (open: boolean) => void; wo: WorkOrder }

export function PauseSheet({ open, onOpenChange, wo }: SheetProps) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Pause the operation"
      description="Tell the supervisor why. The order clock keeps running until you resume."
    >
      <PauseForm wo={wo} onDone={() => onOpenChange(false)} />
    </ActionSheet>
  )
}

function PauseForm({ wo, onDone }: { wo: WorkOrder; onDone: () => void }) {
  const { dispatch } = useMobileScope()
  const [reason, setReason] = useState<PauseReason | null>(null)
  const [note, setNote] = useState('')
  const pause = () => {
    if (!reason) return
    dispatch({ type: 'workOrders/pause', id: wo.id, reason, note: note.trim() })
    toast('Operation paused', { description: PAUSE_REASON_LABEL[reason] })
    onDone()
  }
  return (
    <div className="space-y-4">
      <div role="radiogroup" aria-label="Pause reason" className="gap-2 grid grid-cols-2">
        {PAUSE_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={reason === r}
            onClick={() => setReason(r)}
            className={cn(
              'min-h-12 rounded-2xl px-4 py-2 text-sm font-semibold flex items-center text-left transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]',
              reason === r ? 'bg-ink text-on-ink' : 'bg-surface text-body',
            )}
          >
            {PAUSE_REASON_LABEL[r]}
          </button>
        ))}
      </div>
      <FormField label="Note">
        <Textarea
          variant="soft"
          value={note}
          placeholder="Which material, which alarm, who to call"
          onChange={(e) => setNote(e.target.value)}
          className="min-h-20"
        />
      </FormField>
      <Button size="lg" className="w-full" disabled={!reason} onClick={pause}>
        <Pause />
        Pause
      </Button>
    </div>
  )
}

export function IssueSheet({ open, onOpenChange, wo }: SheetProps) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Report an issue"
      description="The supervisor sees it in the event feed and on the work order."
    >
      <IssueForm wo={wo} onDone={() => onOpenChange(false)} />
    </ActionSheet>
  )
}

function IssueForm({ wo, onDone }: { wo: WorkOrder; onDone: () => void }) {
  const { dispatch } = useMobileScope()
  const [text, setText] = useState('')
  const report = () => {
    if (!text.trim()) return
    dispatch({ type: 'workOrders/reportIssue', id: wo.id, text: text.trim() })
    toast('Issue reported', { tone: 'success', description: `On ${wo.code}` })
    onDone()
  }
  return (
    <div className="space-y-4">
      <FormField label="What is wrong?" required>
        <Textarea
          variant="soft"
          autoFocus
          value={text}
          placeholder="Machine noise, missing tool, material looks off"
          onChange={(e) => setText(e.target.value)}
          className="min-h-24"
        />
      </FormField>
      <Button size="lg" className="w-full" disabled={!text.trim()} onClick={report}>
        <TriangleAlert />
        Report
      </Button>
    </div>
  )
}

export function OutputSheet({ open, onOpenChange, wo }: SheetProps) {
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Record output"
      description={`${wo.code} · ${wo.operationName}. Good pieces feed the next operation.`}
    >
      <OutputForm wo={wo} onDone={() => onOpenChange(false)} />
    </ActionSheet>
  )
}

function OutputForm({ wo, onDone }: { wo: WorkOrder; onDone: () => void }) {
  const s = useMobileScope()
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
  const record = {
    id: wo.id,
    goodQty: good,
    rejectQty: reject,
    reworkQty: rework,
    scrapQty: scrap,
    reasonCodeId,
    note,
  }
  const totalError = outputBlocker(s.state, record)
  const reasonError = reasonKind && !reasonCodeId ? `Pick the ${reasonKind} reason.` : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (totalError || reasonError) return
    s.dispatch({ type: 'workOrders/recordOutput', record })
    toast(`${total} pieces recorded`, { tone: 'success', description: `${good} good on ${wo.code}` })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate className="space-y-4">
      <div className="gap-3 grid grid-cols-1">
        <Stepper label="Good" value={good} onChange={setGood} emphasis />
        <div className="gap-2 grid grid-cols-3">
          <Stepper label="Reject" value={reject} onChange={setReject} />
          <Stepper label="Rework" value={rework} onChange={setRework} />
          <Stepper label="Scrap" value={scrap} onChange={setScrap} />
        </div>
      </div>
      {reasonKind && (
        <FormField
          label={`${reasonKind[0]!.toUpperCase()}${reasonKind.slice(1)} reason`}
          required
          error={tried ? (reasonError ?? undefined) : undefined}
        >
          <ReasonPicker
            key={reasonKind}
            kind={reasonKind}
            value={reasonCodeId}
            onChange={setReason}
            variant="soft"
          />
        </FormField>
      )}
      <FormField label="Note">
        <Input variant="soft" value={note} onChange={(e) => setNote(e.target.value)} inputClassName="h-12" />
      </FormField>
      {tried && totalError && (
        <p role="alert" className="text-xs text-danger">
          {totalError}
        </p>
      )}
      <Button type="submit" size="lg" className="w-full">
        <CheckCircle2 />
        Record {total > 0 ? total : ''}
      </Button>
    </form>
  )
}

export function CompleteSheet({ open, onOpenChange, wo }: SheetProps) {
  const s = useMobileScope()
  const blocker = woCompletionBlocker(s.state, wo)
  const complete = () => {
    s.dispatch({ type: 'workOrders/complete', id: wo.id })
    toast('Operation completed', { tone: 'success', description: `${wo.goodQty} good on ${wo.code}` })
    onOpenChange(false)
  }
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Complete the operation"
      description={`${wo.goodQty} good of ${wo.targetQty} target. The next operation becomes ready.`}
    >
      <div className="space-y-4">
        {blocker ? (
          <Banner tone="danger" title="Cannot complete yet">
            {blocker}
          </Banner>
        ) : wo.qualityRequired ? (
          <Banner tone="success" title="Quality gate passed">
            The latest inspection passed with an accepted disposition.
          </Banner>
        ) : null}
        <Button size="lg" className="w-full" disabled={!!blocker} onClick={complete}>
          <CheckCircle2 />
          Complete operation
        </Button>
      </div>
    </ActionSheet>
  )
}

export function ConsumeSheet({
  open,
  onOpenChange,
  wo,
  materialId,
  remaining,
}: SheetProps & { materialId: string; remaining: number }) {
  const { materialName } = useMobileScope()
  return (
    <ActionSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Consume ${materialName(materialId)}`}
      description="Scan the lot at the line. Consumption is booked against this operation."
    >
      <ConsumeForm wo={wo} materialId={materialId} remaining={remaining} onDone={() => onOpenChange(false)} />
    </ActionSheet>
  )
}

function ConsumeForm({
  wo,
  materialId,
  remaining,
  onDone,
}: {
  wo: WorkOrder
  materialId: string
  remaining: number
  onDone: () => void
}) {
  const s = useMobileScope()
  const [lotId, setLotId] = useState<string | null>(null)
  const [qty, setQty] = useState(String(Math.max(0, remaining)))
  const lot = lotId ? s.maps.lot.get(lotId) : undefined
  const amount = Number(qty)
  const invalid = !lot || !(amount > 0) || amount > lot.qty
  const consume = () => {
    if (!lot) return
    s.dispatch({
      type: 'materials/consume',
      moId: wo.moId,
      woId: wo.id,
      materialId,
      lotId: lot.id,
      qty: amount,
      mode: 'scan',
    })
    toast('Material consumed', { tone: 'success', description: `${amount} from lot ${lot.code}` })
    onDone()
  }
  return (
    <div className="space-y-4">
      <FormField label="Lot" required>
        <LotPicker materialId={materialId} value={lotId} onChange={setLotId} variant="soft" />
      </FormField>
      <FormField
        label="Quantity"
        required
        hint={lot ? `${lot.qty} available on ${lot.code}` : `${remaining} still required`}
        error={lot && amount > lot.qty ? 'More than the lot holds.' : undefined}
      >
        <Input
          variant="soft"
          type="number"
          min={0}
          inputMode="decimal"
          value={qty}
          onChange={(e) => setQty(e.target.value)}
          inputClassName="h-12 text-lg font-semibold tabular-nums"
        />
      </FormField>
      <Button size="lg" className="w-full" disabled={invalid} onClick={consume}>
        <ScanLine />
        Consume
      </Button>
    </div>
  )
}
