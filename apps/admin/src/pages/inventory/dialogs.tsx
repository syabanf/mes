import { fmtNumber, fromInput, newId, toDateInput, toDateTimeInput } from '@mes/fixtures'
import type {
  ConsumptionMode,
  LotStatus,
  MaterialLot,
  MaterialRequirement,
  Operation,
  Wip,
  WorkOrder,
} from '@mes/types'
import {
  ACTIVE_WIP_STATES,
  CONSUMPTION_MODE_LABEL,
  LOT_STATUS_LABEL,
  REQUIREMENT_STATUS_LABEL,
  WIP_STATE_LABEL,
  WO_STATUS_LABEL,
} from '@mes/types'
import {
  Button,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  NativeSelect,
  toast,
} from '@mes/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { LocationPicker, MaterialPicker, MoPicker, SupplierPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import {
  CONSUMABLE_LOT_STATUSES,
  ISSUABLE_LOT_STATUSES,
  RESERVABLE_LOT_STATUSES,
  STAGEABLE_LOT_STATUSES,
  moOperations,
  remainingToIssue,
  requirementStatusOf,
  shortfall,
} from './lib'

type PickProps = {
  value: string | null
  onChange: (value: string | null) => void
  placeholder?: string
  invalid?: boolean
  disabled?: boolean
  clearable?: boolean
  variant?: 'default' | 'soft' | 'inline'
  'aria-label'?: string
}

/** Orders that can still take material, WIP or requirement lines. */
export const openMoFilter = (status: string) => status !== 'closed' && status !== 'cancelled'

// ─── Comboboxes over execution data ─────────────────────────────

/** Lots of one material in the given statuses, with quantity left. */
export function useMaterialLots(materialId: string | null, statuses: readonly LotStatus[]): MaterialLot[] {
  const { materialLots } = useScoped()
  return useMemo(
    () => materialLots.filter((l) => l.materialId === materialId && l.qty > 0 && statuses.includes(l.status)),
    [materialLots, materialId, statuses],
  )
}

/** Searchable lot list for a caller-filtered set of lots (the shared LotPicker cannot filter by status). */
export function LotCombobox({ lots, ...p }: PickProps & { lots: MaterialLot[] }) {
  const { materialName, locationName, uomCode } = useScoped()
  return (
    <Combobox
      {...p}
      items={lots}
      placeholder={p.placeholder ?? 'Select lot'}
      searchPlaceholder="Search lots"
      emptyText="No lots in the right state"
      getKey={(l) => l.id}
      getLabel={(l) => l.code}
      getDescription={(l) =>
        `${materialName(l.materialId)} · ${fmtNumber(l.qty, 2)} ${uomCode(l.uomId)} · ${locationName(l.locationId)} · ${LOT_STATUS_LABEL[l.status]}`
      }
    />
  )
}

/** Work orders of one manufacturing order, in operation order. */
export function WoCombobox({
  moId,
  filter,
  ...p
}: PickProps & { moId: string | null; filter?: (wo: WorkOrder) => boolean }) {
  const { workOrders, orgName } = useScoped()
  const items = useMemo(
    () =>
      workOrders
        .filter((w) => w.moId === moId && (!filter || filter(w)))
        .sort((a, b) => a.operationSeq - b.operationSeq),
    [workOrders, moId, filter],
  )
  return (
    <Combobox
      {...p}
      items={items}
      disabled={p.disabled || !moId}
      placeholder={p.placeholder ?? 'Select work order'}
      searchPlaceholder="Search operations"
      emptyText="This order has no work orders"
      getKey={(w) => w.id}
      getLabel={(w) => `${w.operationSeq} · ${w.operationName}`}
      getDescription={(w) => `${w.code} · ${orgName(w.workCenterId)} · ${WO_STATUS_LABEL[w.status]}`}
      getKeywords={(w) => [w.code]}
    />
  )
}

/** Material requirement lines of one order, keyed by material. */
export function RequirementCombobox({ moId, ...p }: PickProps & { moId: string | null }) {
  const { materialRequirements, materialName, maps, uomCode } = useScoped()
  const items = useMemo(
    () => materialRequirements.filter((r) => r.moId === moId).sort((a, b) => a.operationSeq - b.operationSeq),
    [materialRequirements, moId],
  )
  return (
    <Combobox<MaterialRequirement>
      {...p}
      items={items}
      disabled={p.disabled || !moId}
      placeholder={p.placeholder ?? 'Select material'}
      searchPlaceholder="Search materials"
      emptyText="No requirements on this order"
      getKey={(r) => r.materialId}
      getLabel={(r) => materialName(r.materialId)}
      getDescription={(r) =>
        `${maps.material.get(r.materialId)?.code ?? ''} · op ${r.operationSeq} · ${fmtNumber(r.requiredQty, 2)} ${uomCode(r.uomId)} · ${REQUIREMENT_STATUS_LABEL[r.status]}`
      }
      getKeywords={(r) => [maps.material.get(r.materialId)?.code ?? '']}
    />
  )
}

/** Active WIP batches of one order. */
export function WipCombobox({
  moId,
  filter,
  ...p
}: PickProps & { moId: string | null; filter?: (wip: Wip) => boolean }) {
  const { wips, locationName } = useScoped()
  const items = useMemo(
    () =>
      wips
        .filter(
          (w) =>
            w.moId === moId && w.qty > 0 && ACTIVE_WIP_STATES.includes(w.state) && (!filter || filter(w)),
        )
        .sort((a, b) => a.operationSeq - b.operationSeq),
    [wips, moId, filter],
  )
  return (
    <Combobox
      {...p}
      items={items}
      disabled={p.disabled || !moId}
      placeholder={p.placeholder ?? 'Select WIP batch'}
      searchPlaceholder="Search batches"
      emptyText="No active WIP on this order"
      getKey={(w) => w.id}
      getLabel={(w) => w.code}
      getDescription={(w) =>
        `Op ${w.operationSeq} · ${fmtNumber(w.qty)} · ${locationName(w.locationId)} · ${WIP_STATE_LABEL[w.state]}`
      }
      getKeywords={(w) => [w.batch]}
    />
  )
}

/** Operation from the order snapshot when there is one, a plain sequence number otherwise. */
export function OperationSeqField({
  ops,
  value,
  onChange,
  invalid,
}: {
  ops: Operation[]
  value: string
  onChange: (value: string) => void
  invalid?: boolean
}) {
  if (ops.length === 0)
    return (
      <Input
        type="number"
        min={1}
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        invalid={invalid}
      />
    )
  return (
    <Combobox
      items={ops}
      value={value || null}
      onChange={(v) => onChange(v ?? '')}
      placeholder="Select operation"
      searchPlaceholder="Search operations"
      getKey={(o) => String(o.seq)}
      getLabel={(o) => `${o.seq} · ${o.name}`}
      getDescription={(o) => o.code}
      invalid={invalid}
    />
  )
}

// ─── Reserve, stage, issue, consume ─────────────────────────────

export type MoveMode = 'reserve' | 'stage' | 'issue' | 'consume'

const MOVE_COPY: Record<
  MoveMode,
  { title: string; description: string; verb: string; past: string; statuses: LotStatus[] }
> = {
  reserve: {
    title: 'Reserve material',
    description: 'Reserving locks a lot to this order without moving it.',
    verb: 'Reserve',
    past: 'reserved',
    statuses: RESERVABLE_LOT_STATUSES,
  },
  stage: {
    title: 'Stage material',
    description: 'Staging moves the lot to a production staging location.',
    verb: 'Stage',
    past: 'staged',
    statuses: STAGEABLE_LOT_STATUSES,
  },
  issue: {
    title: 'Issue material',
    description: 'Issuing hands the lot from staging to the floor.',
    verb: 'Issue',
    past: 'issued',
    statuses: ISSUABLE_LOT_STATUSES,
  },
  consume: {
    title: 'Record consumption',
    description: 'Consumption books the quantity against the work order that used it.',
    verb: 'Consume',
    past: 'consumed',
    statuses: CONSUMABLE_LOT_STATUSES,
  },
}
const CONSUMPTION_MODE_OPTIONS = (['manual', 'scan', 'automatic'] as ConsumptionMode[]).map((m) => ({
  value: m,
  label: CONSUMPTION_MODE_LABEL[m],
}))

function suggestedNeed(mode: MoveMode, r: MaterialRequirement | undefined): number {
  if (!r) return 0
  switch (mode) {
    case 'reserve':
      return shortfall(r)
    case 'stage':
      return r.reservedQty || shortfall(r)
    case 'issue':
      return remainingToIssue(r)
    case 'consume':
      return r.issuedQty || remainingToIssue(r)
  }
}

/** Move a lot one step along the material chain for an order: reserve, stage, issue or consume. */
export function MaterialMoveDialog({
  open,
  onOpenChange,
  mode,
  moId,
  materialId,
  lotId = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  mode: MoveMode
  moId: string
  materialId: string
  lotId?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && (
          <MoveForm
            mode={mode}
            moId={moId}
            materialId={materialId}
            lotId={lotId}
            onDone={() => onOpenChange(false)}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function MoveForm({
  mode,
  moId,
  materialId,
  lotId,
  onDone,
}: {
  mode: MoveMode
  moId: string
  materialId: string
  lotId: string | null
  onDone: () => void
}) {
  const s = useScoped()
  const copy = MOVE_COPY[mode]
  const lots = useMaterialLots(materialId, copy.statuses)
  const mo = s.maps.mo.get(moId)
  const requirement = s.materialRequirements.find((r) => r.moId === moId && r.materialId === materialId)
  const need = suggestedNeed(mode, requirement)
  const suggest = (lot: MaterialLot | undefined) =>
    lot ? String(Math.min(lot.qty, need > 0 ? need : lot.qty)) : ''

  const [lot, setLot] = useState<string | null>(lotId)
  const [qty, setQty] = useState(() => suggest(lots.find((l) => l.id === lotId)))
  const [locationId, setLocationId] = useState<string | null>(null)
  const [woId, setWoId] = useState<string | null>(null)
  const [consumption, setConsumption] = useState<ConsumptionMode>('manual')
  const [tried, setTried] = useState(false)

  const selected = lots.find((l) => l.id === lot)
  const n = Number(qty)
  const errors = {
    lot: !selected ? 'Choose a lot.' : null,
    qty: !(n > 0)
      ? 'Enter the quantity.'
      : selected && n > selected.qty
        ? `Only ${fmtNumber(selected.qty, 2)} left in this lot.`
        : null,
    location: mode === 'stage' && !locationId ? 'Choose the staging location.' : null,
    wo: mode === 'consume' && !woId ? 'Choose the work order that consumed it.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)
  const uom = s.uomCode(s.maps.material.get(materialId)?.uomId ?? '')

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !selected) return
    const base = { moId, materialId, lotId: selected.id, qty: n }
    if (mode === 'reserve') s.dispatch({ type: 'materials/reserve', ...base })
    else if (mode === 'stage') s.dispatch({ type: 'materials/stage', ...base, toLocationId: locationId! })
    else if (mode === 'issue') s.dispatch({ type: 'materials/issue', ...base, woId })
    else s.dispatch({ type: 'materials/consume', ...base, woId: woId!, mode: consumption })
    toast(`${fmtNumber(n, 2)} ${uom} ${copy.past} for ${mo?.code ?? 'order'}`, {
      tone: 'success',
      description: `Lot ${selected.code}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{copy.title}</DialogTitle>
        <DialogDescription>
          {s.materialName(materialId)} for {mo?.code ?? 'the order'}. {copy.description}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <FormField
          label="Lot"
          required
          error={show(errors.lot)}
          hint={
            requirement && need > 0 ? `${fmtNumber(need, 2)} ${uom} still needed on this line.` : undefined
          }
        >
          <LotCombobox
            lots={lots}
            value={lot}
            onChange={(id) => {
              setLot(id)
              setQty(suggest(lots.find((l) => l.id === id)))
            }}
            invalid={!!show(errors.lot)}
          />
        </FormField>
        <FormField
          label="Quantity"
          required
          error={show(errors.qty)}
          hint={selected ? `${fmtNumber(selected.qty, 2)} ${uom} in lot` : undefined}
        >
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        {mode === 'stage' && (
          <FormField label="Staging location" required error={show(errors.location)}>
            <LocationPicker
              kind="staging"
              value={locationId}
              onChange={setLocationId}
              invalid={!!show(errors.location)}
            />
          </FormField>
        )}
        {mode === 'issue' && (
          <FormField label="Work order" hint="Optional: issue to one operation instead of the order.">
            <WoCombobox moId={moId} value={woId} onChange={setWoId} clearable />
          </FormField>
        )}
        {mode === 'consume' && (
          <>
            <FormField label="Work order" required error={show(errors.wo)}>
              <WoCombobox moId={moId} value={woId} onChange={setWoId} invalid={!!show(errors.wo)} />
            </FormField>
            <FormField label="Mode">
              <NativeSelect
                options={CONSUMPTION_MODE_OPTIONS}
                value={consumption}
                onChange={(e) => setConsumption(e.target.value as ConsumptionMode)}
              />
            </FormField>
          </>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{copy.verb}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Requirement line ───────────────────────────────────────────

/** Add a requirement line to an order, or edit the operation and quantity of an existing one. */
export function RequirementDialog({
  open,
  onOpenChange,
  editing = null,
  moId = null,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: MaterialRequirement | null
  /** Order preselected when creating. */
  moId?: string | null
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <RequirementForm editing={editing} presetMoId={moId} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function RequirementForm({
  editing,
  presetMoId,
  onDone,
}: {
  editing: MaterialRequirement | null
  presetMoId: string | null
  onDone: () => void
}) {
  const s = useScoped()
  const [moId, setMoId] = useState<string | null>(editing?.moId ?? presetMoId)
  const [materialId, setMaterialId] = useState<string | null>(editing?.materialId ?? null)
  const [seq, setSeq] = useState(() => {
    if (editing) return String(editing.operationSeq)
    const first = moOperations(s, presetMoId ? s.maps.mo.get(presetMoId) : undefined)[0]
    return first ? String(first.seq) : ''
  })
  const [qty, setQty] = useState(editing ? String(editing.requiredQty) : '')
  const [tried, setTried] = useState(false)

  const mo = moId ? s.maps.mo.get(moId) : undefined
  const ops = moOperations(s, mo)
  const material = materialId ? s.maps.material.get(materialId) : undefined
  const uom = s.uomCode(editing?.uomId ?? material?.uomId ?? '')
  const n = Number(qty)
  const seqN = Number(seq)
  const duplicate =
    !editing && s.materialRequirements.some((r) => r.moId === moId && r.materialId === materialId)
  const errors = {
    mo: !mo ? 'Choose the order.' : null,
    material: !material
      ? 'Choose the material.'
      : duplicate
        ? 'This order already has a line for this material. Edit that line instead.'
        : null,
    seq: !(seqN > 0) || !Number.isInteger(seqN) ? 'Choose the operation that consumes it.' : null,
    qty: !(n > 0) ? 'Enter the required quantity.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const pickMo = (id: string | null) => {
    setMoId(id)
    const first = moOperations(s, id ? s.maps.mo.get(id) : undefined)[0]
    setSeq(first ? String(first.seq) : '')
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !mo || !material) return
    const draft: MaterialRequirement = {
      id: editing?.id ?? newId('mrq'),
      moId: mo.id,
      materialId: material.id,
      operationSeq: seqN,
      requiredQty: n,
      uomId: editing?.uomId ?? material.uomId,
      reservedQty: editing?.reservedQty ?? 0,
      stagedQty: editing?.stagedQty ?? 0,
      issuedQty: editing?.issuedQty ?? 0,
      consumedQty: editing?.consumedQty ?? 0,
      returnedQty: editing?.returnedQty ?? 0,
      status: 'shortage',
    }
    s.dispatch({
      type: 'materialRequirements/upsert',
      item: { ...draft, status: requirementStatusOf(draft) },
    })
    toast(editing ? 'Requirement updated' : 'Requirement added', {
      tone: 'success',
      description: `${fmtNumber(n, 2)} ${uom} ${material.name} for ${mo.code}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit requirement' : 'Add requirement'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Quantities already reserved, staged, issued or consumed stay as they are.'
            : 'A manual line beside the ones the BOM generated on release. It starts as a shortage until material is reserved.'}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Manufacturing order" required error={show(errors.mo)} className="sm:col-span-2">
          <MoPicker
            value={moId}
            onChange={pickMo}
            filter={openMoFilter}
            disabled={!!editing}
            invalid={!!show(errors.mo)}
          />
        </FormField>
        <FormField label="Material" required error={show(errors.material)} className="sm:col-span-2">
          <MaterialPicker
            value={materialId}
            onChange={setMaterialId}
            disabled={!!editing}
            invalid={!!show(errors.material)}
          />
        </FormField>
        <FormField
          label="Consumed at operation"
          required
          error={show(errors.seq)}
          hint={mo && ops.length === 0 ? 'No snapshot yet: enter the sequence number.' : undefined}
        >
          <OperationSeqField ops={ops} value={seq} onChange={setSeq} invalid={!!show(errors.seq)} />
        </FormField>
        <FormField
          label="Required quantity"
          required
          error={show(errors.qty)}
          hint={uom ? `In ${uom}` : 'Unit follows the material'}
        >
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save' : 'Add requirement'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Lot ────────────────────────────────────────────────────────

const LOT_STATUS_OPTIONS = (Object.keys(LOT_STATUS_LABEL) as LotStatus[]).map((st) => ({
  value: st,
  label: LOT_STATUS_LABEL[st],
}))

/** Edit a received lot. New lots come in through the receive dialog. */
export function LotDialog({
  open,
  onOpenChange,
  lot,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  lot: MaterialLot
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <LotForm lot={lot} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function LotForm({ lot, onDone }: { lot: MaterialLot; onDone: () => void }) {
  const s = useScoped()
  const [code, setCode] = useState(lot.code)
  const [materialId, setMaterialId] = useState<string | null>(lot.materialId)
  const [supplierId, setSupplierId] = useState<string | null>(lot.supplierId)
  const [qty, setQty] = useState(String(lot.qty))
  const [uomId, setUomId] = useState<string | null>(lot.uomId)
  const [locationId, setLocationId] = useState<string | null>(lot.locationId)
  const [status, setStatus] = useState<LotStatus>(lot.status)
  const [receivedAt, setReceivedAt] = useState(toDateTimeInput(lot.receivedAt))
  const [expiresAt, setExpiresAt] = useState(lot.expiresAt ? toDateInput(lot.expiresAt) : '')
  const [tried, setTried] = useState(false)

  const trimmed = code.trim()
  const n = Number(qty)
  const errors = {
    code: !trimmed
      ? 'Enter the lot code.'
      : s.materialLots.some((l) => l.id !== lot.id && l.code === trimmed)
        ? 'Another lot already uses this code.'
        : null,
    material: !materialId ? 'Choose the material.' : null,
    qty: !(n >= 0) ? 'Enter the quantity on hand.' : null,
    uom: !uomId ? 'Choose the unit.' : null,
    location: !locationId ? 'Choose the location.' : null,
    receivedAt: !receivedAt ? 'Enter the received date.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const pickMaterial = (id: string | null) => {
    setMaterialId(id)
    const m = id ? s.maps.material.get(id) : undefined
    if (m) setUomId(m.uomId)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !materialId || !uomId || !locationId) return
    s.dispatch({
      type: 'materialLots/upsert',
      item: {
        ...lot,
        code: trimmed,
        materialId,
        supplierId,
        qty: n,
        uomId,
        locationId,
        status,
        receivedAt: fromInput(receivedAt),
        expiresAt: expiresAt ? fromInput(expiresAt) : null,
      },
    })
    toast('Lot updated', {
      tone: 'success',
      description: `${trimmed} · ${fmtNumber(n, 2)} ${s.uomCode(uomId)}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Edit {lot.code}</DialogTitle>
        <DialogDescription>
          Corrects the lot record. Movements between locations and orders go through reserve, stage, issue and
          return.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Lot code" required error={show(errors.code)}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="font-mono"
            invalid={!!show(errors.code)}
          />
        </FormField>
        <FormField label="Status">
          <NativeSelect
            options={LOT_STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as LotStatus)}
          />
        </FormField>
        <FormField label="Material" required error={show(errors.material)} className="sm:col-span-2">
          <MaterialPicker value={materialId} onChange={pickMaterial} invalid={!!show(errors.material)} />
        </FormField>
        <FormField label="Supplier" hint="Optional">
          <SupplierPicker value={supplierId} onChange={setSupplierId} clearable />
        </FormField>
        <FormField label="Location" required error={show(errors.location)}>
          <LocationPicker value={locationId} onChange={setLocationId} invalid={!!show(errors.location)} />
        </FormField>
        <FormField label="Quantity" required error={show(errors.qty)}>
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        <FormField label="Unit" required error={show(errors.uom)}>
          <Combobox
            items={s.uoms}
            value={uomId}
            onChange={setUomId}
            placeholder="Select unit"
            searchPlaceholder="Search units"
            getKey={(u) => u.id}
            getLabel={(u) => u.code}
            getDescription={(u) => u.name}
            invalid={!!show(errors.uom)}
          />
        </FormField>
        <FormField label="Received" required error={show(errors.receivedAt)}>
          <Input
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            invalid={!!show(errors.receivedAt)}
          />
        </FormField>
        <FormField label="Expiry" hint="Optional">
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
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
