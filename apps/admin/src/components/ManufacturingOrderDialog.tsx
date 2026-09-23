import {
  addDays,
  addHours,
  currentRevision,
  fromInput,
  newId,
  nowMs,
  toDateTimeInput,
  toIso,
} from '@mes/fixtures'
import type { ManufacturingOrder, MoSource, Priority } from '@mes/types'
import { MO_SOURCE_LABEL, PRIORITIES, PRIORITY_LABEL } from '@mes/types'
import {
  Badge,
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
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { useScoped } from '../state/scoped'
import { OrgNodePicker, ProductPicker } from './pickers'

export interface MoPreset {
  productId?: string
  qty?: number
  source?: MoSource
  demandIds?: string[]
  replenishmentId?: string | null
  priority?: Priority
  lockQty?: boolean
  /** Stock allocated together with this order when resolving a hybrid demand. */
  allocation?: { demandId: string; qty: number }
}

const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))
const SOURCE_OPTIONS = (['mto', 'mts', 'internal', 'rework'] as MoSource[]).map((s) => ({
  value: s,
  label: MO_SOURCE_LABEL[s],
}))

export function ManufacturingOrderDialog({
  open,
  onOpenChange,
  preset,
  editing = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  preset?: MoPreset
  editing?: ManufacturingOrder | null
  onSaved?: (mo: ManufacturingOrder) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <MoForm
            preset={preset}
            editing={editing}
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

function MoForm({
  preset,
  editing,
  onDone,
}: {
  preset?: MoPreset
  editing: ManufacturingOrder | null
  onDone: (saved: ManufacturingOrder | null) => void
}) {
  const { siteId, state, maps, dispatch } = useScoped()
  const [productId, setProductId] = useState<string | null>(editing?.productId ?? preset?.productId ?? null)
  const [qty, setQty] = useState(String(editing?.qty ?? preset?.qty ?? ''))
  const [source, setSource] = useState<MoSource>(editing?.source ?? preset?.source ?? 'internal')
  const [priority, setPriority] = useState<Priority>(editing?.priority ?? preset?.priority ?? 'normal')
  const [lineId, setLineId] = useState<string | null>(editing?.lineId ?? null)
  const [start, setStart] = useState(toDateTimeInput(editing?.plannedStart ?? toIso(addHours(nowMs(), 2))))
  const [end, setEnd] = useState(toDateTimeInput(editing?.plannedEnd ?? toIso(addDays(nowMs(), 2))))
  const [tried, setTried] = useState(false)

  const revision = productId ? currentRevision(state, productId) : undefined
  const errors = {
    product: !productId
      ? 'Choose the product to make.'
      : revision?.state !== 'released'
        ? 'This product has no released revision. Release it in PLM first.'
        : null,
    qty: !(Number(qty) > 0) ? 'Enter the quantity.' : null,
    window: !start || !end || end <= start ? 'The planned finish has to be after the start.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    if (editing) {
      dispatch({
        type: 'manufacturingOrders/update',
        id: editing.id,
        patch: {
          qty: Number(qty),
          priority,
          lineId,
          plannedStart: fromInput(start),
          plannedEnd: fromInput(end),
        },
      })
      onDone({ ...editing, qty: Number(qty), priority, lineId })
      return
    }
    const id = newId('mo')
    const draft = {
      id,
      siteId,
      productId: productId!,
      qty: Number(qty),
      source,
      demandIds: preset?.demandIds ?? [],
      replenishmentId: preset?.replenishmentId ?? null,
      priority,
      lineId,
      plannedStart: fromInput(start),
      plannedEnd: fromInput(end),
    }
    dispatch(
      preset?.allocation
        ? {
            type: 'demands/resolveWithMo',
            id: preset.allocation.demandId,
            allocateQty: preset.allocation.qty,
            draft,
          }
        : { type: 'manufacturingOrders/create', draft },
    )
    onDone({ id } as ManufacturingOrder)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New manufacturing order'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Planning fields only. Released data lives in the snapshot.'
            : preset?.allocation
              ? `${preset.allocation.qty.toLocaleString()} pieces will be allocated from stock when you create this order. Cancelling leaves the demand unchanged.`
              : preset?.lockQty
                ? 'This order covers the unresolved demand quantity. Cancelling leaves the demand unchanged.'
                : 'The order takes an exact engineering snapshot when you release it.'}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Product" required error={show(errors.product)} className="sm:col-span-2">
          <ProductPicker
            value={productId}
            onChange={setProductId}
            disabled={!!editing}
            invalid={!!show(errors.product)}
          />
          {revision && (
            <p className="mt-1.5 gap-2 text-xs flex flex-wrap items-center text-muted">
              Revision {revision.rev}
              <Badge variant={revision.state === 'released' ? 'success' : 'warning'}>{revision.state}</Badge>
              {maps.bom.get(revision.bomId ?? '')?.code} · {maps.bop.get(revision.bopId ?? '')?.code}
            </p>
          )}
        </FormField>
        <FormField label="Quantity" required error={show(errors.qty)}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={!!preset?.lockQty}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        <FormField label="Priority">
          <NativeSelect
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />
        </FormField>
        {!editing && (
          <FormField label="Source">
            <NativeSelect
              options={SOURCE_OPTIONS}
              value={source}
              onChange={(e) => setSource(e.target.value as MoSource)}
              disabled={!!preset?.source}
            />
          </FormField>
        )}
        <FormField label="Line" hint="Optional until dispatch">
          <OrgNodePicker kind="line" value={lineId} onChange={setLineId} clearable />
        </FormField>
        <FormField label="Planned start" required>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </FormField>
        <FormField label="Planned finish" required error={show(errors.window)}>
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            invalid={!!show(errors.window)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Create order'}</Button>
      </DialogFooter>
    </form>
  )
}
