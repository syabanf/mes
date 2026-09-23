import { fmtNumber, newId, nextCode, nowIso, sumBy } from '@mes/fixtures'
import type { Disposition, ManufacturingOrder, Wip, WipState } from '@mes/types'
import { ACTIVE_WIP_STATES, DISPOSITIONS, DISPOSITION_LABEL, WIP_STATE_LABEL } from '@mes/types'
import {
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
  MultiCombobox,
  NativeSelect,
  Textarea,
  toast,
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { LocationPicker, MoPicker, ReasonPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { OperationSeqField, openMoFilter } from './dialogs'
import { moOperations } from './lib'

const WIP_STATE_OPTIONS = (Object.keys(WIP_STATE_LABEL) as WipState[]).map((st) => ({
  value: st,
  label: WIP_STATE_LABEL[st],
}))
const DISPOSITION_OPTIONS = DISPOSITIONS.map((d) => ({ value: d, label: DISPOSITION_LABEL[d] }))

export type WipAction = 'move' | 'split' | 'merge' | 'hold' | 'release'

/** Active batches of the same order at the same operation: the only ones a batch can merge with. */
export const siblingsOf = (wips: readonly Wip[], wip: Wip) =>
  wips.filter(
    (w) =>
      w.id !== wip.id &&
      w.moId === wip.moId &&
      w.operationSeq === wip.operationSeq &&
      w.qty > 0 &&
      ACTIVE_WIP_STATES.includes(w.state),
  )

// ─── Lifecycle actions ──────────────────────────────────────────

export function WipActionDialog({
  wip,
  action,
  onClose,
}: {
  wip: Wip
  action: WipAction
  onClose: () => void
}) {
  const s = useScoped()
  const done = (label: string) => {
    toast(label, { tone: 'success' })
    onClose()
  }
  if (action === 'hold') return <HoldDialog wip={wip} onClose={onClose} onDone={done} />
  if (action === 'release') return <ReleaseDialog wip={wip} onClose={onClose} onDone={done} />
  return (
    <Dialog open onOpenChange={(open) => !open && onClose()}>
      <DialogContent size="sm">
        {action === 'move' && <MoveForm wip={wip} onDone={done} onClose={onClose} />}
        {action === 'split' && <SplitForm wip={wip} onDone={done} onClose={onClose} />}
        {action === 'merge' && (
          <MergeForm wip={wip} siblings={siblingsOf(s.wips, wip)} onDone={done} onClose={onClose} />
        )}
      </DialogContent>
    </Dialog>
  )
}

type FormProps = { wip: Wip; onDone: (label: string) => void; onClose: () => void }

function MoveForm({ wip, onDone, onClose }: FormProps) {
  const s = useScoped()
  const [locationId, setLocationId] = useState<string | null>(wip.locationId)
  const [state, setState] = useState<WipState>(wip.state)
  const [tried, setTried] = useState(false)
  const error = !locationId ? 'Choose the destination.' : null
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error || !locationId) return
    s.dispatch({ type: 'wips/move', id: wip.id, locationId, state })
    onDone(`${wip.code} moved to ${s.locationName(locationId)}`)
  }
  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Move {wip.code}</DialogTitle>
        <DialogDescription>Change where the batch sits and what state it is in.</DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <FormField label="Location" required error={tried ? (error ?? undefined) : undefined}>
          <LocationPicker value={locationId} onChange={setLocationId} invalid={tried && !!error} />
        </FormField>
        <FormField label="State">
          <NativeSelect
            options={WIP_STATE_OPTIONS}
            value={state}
            onChange={(e) => setState(e.target.value as WipState)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Move</Button>
      </DialogFooter>
    </form>
  )
}

function SplitForm({ wip, onDone, onClose }: FormProps) {
  const s = useScoped()
  const [qtys, setQtys] = useState<string[]>([
    String(Math.floor(wip.qty / 2)),
    String(wip.qty - Math.floor(wip.qty / 2)),
  ])
  const [tried, setTried] = useState(false)
  const nums = qtys.map(Number)
  const total = nums.reduce((a, b) => a + b, 0)
  const error = nums.some((n) => !(n > 0) || !Number.isInteger(n))
    ? 'Every part needs a whole quantity above zero.'
    : total > wip.qty
      ? `The parts add up to ${fmtNumber(total)}, more than the batch holds.`
      : null
  const setAt = (i: number, v: string) => setQtys((q) => q.map((x, j) => (j === i ? v : x)))
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) return
    s.dispatch({ type: 'wips/split', id: wip.id, qtys: nums })
    onDone(`${wip.code} split into ${nums.length} batches`)
  }
  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Split {wip.code}</DialogTitle>
        <DialogDescription>
          {fmtNumber(wip.qty)} pieces. Parts get suffixed codes; anything left stays on this batch.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        {qtys.map((q, i) => (
          <div key={i} className="gap-2 flex items-center">
            <FormField label={`Part ${String.fromCharCode(65 + i)}`} className="flex-1">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={q}
                onChange={(e) => setAt(i, e.target.value)}
                invalid={tried && !(Number(q) > 0)}
              />
            </FormField>
            {qtys.length > 2 && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="mt-6"
                onClick={() => setQtys((x) => x.filter((_, j) => j !== i))}
              >
                Remove
              </Button>
            )}
          </div>
        ))}
        <div className="gap-2 text-xs flex flex-wrap items-center justify-between text-muted">
          <span>
            {fmtNumber(total)} of {fmtNumber(wip.qty)} · {fmtNumber(Math.max(0, wip.qty - total))} stays
          </span>
          <Button type="button" variant="outline" size="sm" onClick={() => setQtys((x) => [...x, ''])}>
            Add part
          </Button>
        </div>
        {tried && error && <p className="text-xs text-danger">{error}</p>}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Split</Button>
      </DialogFooter>
    </form>
  )
}

function MergeForm({ wip, siblings, onDone, onClose }: FormProps & { siblings: Wip[] }) {
  const s = useScoped()
  const [ids, setIds] = useState<string[]>([])
  const [tried, setTried] = useState(false)
  const error = ids.length === 0 ? 'Pick at least one batch to merge in.' : null
  const total =
    wip.qty +
    sumBy(
      siblings.filter((w) => ids.includes(w.id)),
      (w) => w.qty,
    )
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) return
    s.dispatch({ type: 'wips/merge', ids: [wip.id, ...ids] })
    onDone(`${ids.length + 1} batches merged`)
  }
  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Merge into {wip.code}</DialogTitle>
        <DialogDescription>
          Only batches of the same order at the same operation can merge. Lots from every part carry over.
        </DialogDescription>
      </DialogHeader>
      <FormField
        label="Batches"
        required
        error={tried ? (error ?? undefined) : undefined}
        hint={`Merged quantity: ${fmtNumber(total)}`}
      >
        <MultiCombobox
          items={siblings}
          values={ids}
          onChange={setIds}
          placeholder="Select batches"
          searchPlaceholder="Search batches"
          getKey={(w) => w.id}
          getLabel={(w) => w.code}
          getDescription={(w) =>
            `${fmtNumber(w.qty)} · ${s.locationName(w.locationId)} · ${WIP_STATE_LABEL[w.state]}`
          }
          invalid={tried && !!error}
        />
      </FormField>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onClose}>
          Cancel
        </Button>
        <Button type="submit">Merge</Button>
      </DialogFooter>
    </form>
  )
}

function HoldDialog({ wip, onDone, onClose }: FormProps) {
  const s = useScoped()
  const [reasonId, setReasonId] = useState<string | null>(null)
  const [note, setNote] = useState('')
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Put ${wip.code} on hold?`}
      description="The batch moves to the QC hold location and a quality hold is opened."
      confirmLabel="Put on hold"
      confirmDisabled={!reasonId}
      onConfirm={() => {
        s.dispatch({ type: 'wips/hold', id: wip.id, reasonCodeId: reasonId!, note })
        onDone(`${wip.code} on hold`)
      }}
    >
      <div className="space-y-3">
        <FormField label="Reason" required>
          <ReasonPicker kind="hold" value={reasonId} onChange={setReasonId} />
        </FormField>
        <FormField label="Note">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-20" />
        </FormField>
      </div>
    </ConfirmDialog>
  )
}

function ReleaseDialog({ wip, onDone, onClose }: FormProps) {
  const s = useScoped()
  const [disposition, setDisposition] = useState<Disposition>('accept')
  return (
    <ConfirmDialog
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Release ${wip.code}?`}
      description="The disposition decides where the batch goes next: back to the queue, to rework, or scrapped."
      confirmLabel="Release"
      onConfirm={() => {
        s.dispatch({ type: 'wips/release', id: wip.id, disposition })
        onDone(`${wip.code} released · ${DISPOSITION_LABEL[disposition]}`)
      }}
    >
      <FormField label="Disposition" required>
        <NativeSelect
          options={DISPOSITION_OPTIONS}
          value={disposition}
          onChange={(e) => setDisposition(e.target.value as Disposition)}
        />
      </FormField>
    </ConfirmDialog>
  )
}

// ─── Create and edit ────────────────────────────────────────────

/** Create a WIP batch by hand, or edit the operation, quantity, state, location and batch of one. */
export function WipDialog({
  open,
  onOpenChange,
  editing = null,
  moId = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Wip | null
  /** Order preselected when creating. */
  moId?: string | null
  onSaved?: (wip: Wip) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <WipForm
            editing={editing}
            presetMoId={moId}
            onDone={(saved) => {
              onOpenChange(false)
              if (saved) onSaved?.(saved)
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function WipForm({
  editing,
  presetMoId,
  onDone,
}: {
  editing: Wip | null
  presetMoId: string | null
  onDone: (saved: Wip | null) => void
}) {
  const s = useScoped()
  const nextBatchCode = (mo: ManufacturingOrder) =>
    nextCode(
      s.wips.filter((w) => w.moId === mo.id).map((w) => w.code),
      `${mo.code}-B`,
      1,
    )
  const initialMo = editing?.moId ?? presetMoId
  const [moId, setMoId] = useState<string | null>(initialMo)
  const [seq, setSeq] = useState(() => {
    if (editing) return String(editing.operationSeq)
    const first = moOperations(s, initialMo ? s.maps.mo.get(initialMo) : undefined)[0]
    return first ? String(first.seq) : ''
  })
  const [qty, setQty] = useState(editing ? String(editing.qty) : '')
  const [state, setState] = useState<WipState>(editing?.state ?? 'queued')
  const [locationId, setLocationId] = useState<string | null>(
    editing?.locationId ?? s.inventoryLocations.find((l) => l.kind === 'line_buffer')?.id ?? null,
  )
  const [batch, setBatch] = useState(() => {
    if (editing) return editing.batch
    const mo = initialMo ? s.maps.mo.get(initialMo) : undefined
    return mo ? nextBatchCode(mo) : ''
  })
  const [tried, setTried] = useState(false)

  const mo = moId ? s.maps.mo.get(moId) : undefined
  const ops = moOperations(s, mo)
  const n = Number(qty)
  const seqN = Number(seq)
  const errors = {
    mo: !mo ? 'Choose the order.' : null,
    seq: !(seqN > 0) || !Number.isInteger(seqN) ? 'Choose the operation the batch sits at.' : null,
    qty: !(n >= 0) || !Number.isInteger(n) || (!editing && n === 0) ? 'Enter a whole quantity.' : null,
    location: !locationId ? 'Choose the location.' : null,
    batch: !batch.trim() ? 'Enter the lot batch.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const pickMo = (id: string | null) => {
    setMoId(id)
    const next = id ? s.maps.mo.get(id) : undefined
    const first = moOperations(s, next)[0]
    setSeq(first ? String(first.seq) : '')
    setBatch(next ? nextBatchCode(next) : '')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !mo || !locationId) return
    const now = nowIso()
    const item: Wip = {
      id: editing?.id ?? newId('wip'),
      code: editing?.code ?? nextBatchCode(mo),
      siteId: s.siteId,
      moId: mo.id,
      woId: editing?.woId ?? null,
      productId: mo.productId,
      operationSeq: seqN,
      qty: n,
      state,
      locationId,
      batch: batch.trim(),
      parentIds: editing?.parentIds ?? [],
      lotIds: editing?.lotIds ?? [],
      machineId: editing?.machineId ?? null,
      createdAt: editing?.createdAt ?? now,
      updatedAt: now,
    }
    s.dispatch({ type: 'wips/upsert', item })
    toast(editing ? `${item.code} updated` : `${item.code} created`, {
      tone: 'success',
      description: `${fmtNumber(n)} pcs at operation ${seqN} · ${s.locationName(locationId)}`,
    })
    onDone(item)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'Add WIP batch'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Corrects the batch record. Genealogy and consumed lots stay as they are.'
            : 'A batch created by hand, for stock found on the floor that no operation reported. The product follows the order.'}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField
          label="Manufacturing order"
          required
          error={show(errors.mo)}
          hint={mo ? `Product: ${s.productName(mo.productId)}` : undefined}
          className="sm:col-span-2"
        >
          <MoPicker
            value={moId}
            onChange={pickMo}
            filter={openMoFilter}
            disabled={!!editing}
            invalid={!!show(errors.mo)}
          />
        </FormField>
        <FormField
          label="Operation"
          required
          error={show(errors.seq)}
          hint={mo && ops.length === 0 ? 'No snapshot yet: enter the sequence number.' : undefined}
        >
          <OperationSeqField ops={ops} value={seq} onChange={setSeq} invalid={!!show(errors.seq)} />
        </FormField>
        <FormField label="Quantity" required error={show(errors.qty)} hint="Pieces">
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        <FormField label="State">
          <NativeSelect
            options={WIP_STATE_OPTIONS}
            value={state}
            onChange={(e) => setState(e.target.value as WipState)}
          />
        </FormField>
        <FormField label="Location" required error={show(errors.location)}>
          <LocationPicker value={locationId} onChange={setLocationId} invalid={!!show(errors.location)} />
        </FormField>
        <FormField label="Lot batch" required error={show(errors.batch)} className="sm:col-span-2">
          <Input
            value={batch}
            onChange={(e) => setBatch(e.target.value)}
            className="font-mono"
            invalid={!!show(errors.batch)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save' : 'Add batch'}</Button>
      </DialogFooter>
    </form>
  )
}
