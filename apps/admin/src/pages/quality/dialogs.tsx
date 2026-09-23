import { newId, nextCode, nowIso } from '@mes/fixtures'
import type {
  DefectRecord,
  Disposition,
  HoldTarget,
  Inspection,
  InspectionTrigger,
  Ncr,
  QualityHold,
  Severity,
} from '@mes/types'
import {
  DISPOSITIONS,
  DISPOSITION_LABEL,
  HOLD_TARGET_LABEL,
  INSPECTION_TRIGGER_LABEL,
  SEVERITY_LABEL,
  WIP_STATE_LABEL,
  WO_STATUS_LABEL,
} from '@mes/types'
import {
  Badge,
  Button,
  Combobox,
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
import { type FormEvent, type ReactNode, useMemo, useState } from 'react'
import { DefectCodePicker, MoPicker, PersonPicker, ReasonPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import {
  INSPECTION_TRIGGERS,
  NCR_SOURCES,
  SEVERITIES,
  characteristicsFor,
  holdTargetCode,
  measurementFromCharacteristic,
  planFor,
} from './lib'

const TRIGGER_OPTIONS = INSPECTION_TRIGGERS.map((t) => ({ value: t, label: INSPECTION_TRIGGER_LABEL[t] }))
export const DISPOSITION_OPTIONS = DISPOSITIONS.map((d) => ({ value: d, label: DISPOSITION_LABEL[d] }))
const TARGET_OPTIONS = (['wip', 'lot', 'mo', 'wo'] as HoldTarget[]).map((t) => ({
  value: t,
  label: HOLD_TARGET_LABEL[t],
}))
const SEVERITY_OPTIONS = SEVERITIES.map((s) => ({ value: s, label: SEVERITY_LABEL[s] }))

type DialogProps = { open: boolean; onOpenChange: (open: boolean) => void }

const requestable = (status: string) => status === 'released' || status === 'in_progress'

// ─── Request inspection ─────────────────────────────────────────

export function RequestInspectionDialog({ open, onOpenChange }: DialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">{open && <RequestForm onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function RequestForm({ onDone }: { onDone: () => void }) {
  const s = useScoped()
  const [moId, setMoId] = useState<string | null>(null)
  const [woId, setWoId] = useState<string | null>(null)
  const [wipId, setWipId] = useState<string | null>(null)
  const [trigger, setTrigger] = useState<InspectionTrigger>('batch')
  const [sampleSize, setSampleSize] = useState('')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  const mo = moId ? s.maps.mo.get(moId) : undefined
  const wos = useMemo(
    () =>
      s.workOrders
        .filter((w) => w.moId === moId && w.status !== 'cancelled')
        .sort((a, b) => a.operationSeq - b.operationSeq),
    [s.workOrders, moId],
  )
  const wo = woId ? s.maps.wo.get(woId) : undefined
  const wips = useMemo(
    () => s.wips.filter((w) => w.moId === moId && w.qty > 0 && (!wo || w.operationSeq === wo.operationSeq)),
    [s.wips, moId, wo],
  )
  const plan = mo && wo ? planFor(s.inspectionPlans, mo.productId, wo.operationSeq, trigger) : undefined
  const characteristics = useMemo(
    () =>
      mo && wo
        ? characteristicsFor(s.state, {
            plan,
            specIds: mo.snapshot?.specIds ?? [],
            operationSeq: wo.operationSeq,
          })
        : [],
    [s.state, mo, wo, plan],
  )
  const defaultSample = plan?.sampleSize ?? s.settings.defaultSampleSize
  const size = sampleSize === '' ? defaultSample : Number(sampleSize)

  const errors = {
    mo: !mo ? 'Choose a released or running order.' : null,
    wo: !wo ? 'Choose the operation to inspect.' : null,
    sample: !(size > 0) ? 'Sample size has to be at least 1.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !mo || !wo) return
    s.dispatch({
      type: 'inspections/request',
      inspection: {
        siteId: s.siteId,
        planId: plan?.id ?? null,
        productId: mo.productId,
        moId: mo.id,
        woId: wo.id,
        wipId,
        lotId: null,
        operationSeq: wo.operationSeq,
        trigger,
        sampleSize: size,
        measurements: characteristics.map(measurementFromCharacteristic),
        inspectorId: null,
        requestedAt: nowIso(),
        photos: [],
        note,
      },
    })
    toast('Inspection requested', {
      tone: 'success',
      description: `${characteristics.length} characteristics to measure at operation ${wo.operationSeq}.`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Request inspection</DialogTitle>
        <DialogDescription>
          The plan for the product and operation fills the characteristics. Without a plan the snapshot's
          specification is used.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Manufacturing order" required error={show(errors.mo)} className="sm:col-span-2">
          <MoPicker
            value={moId}
            onChange={(v) => {
              setMoId(v)
              setWoId(null)
              setWipId(null)
            }}
            filter={requestable}
            invalid={!!show(errors.mo)}
          />
        </FormField>
        <FormField label="Work order" required error={show(errors.wo)} className="sm:col-span-2">
          <Combobox
            items={wos}
            value={woId}
            onChange={(v) => {
              setWoId(v)
              setWipId(null)
            }}
            disabled={!mo}
            invalid={!!show(errors.wo)}
            placeholder={mo ? 'Select operation' : 'Choose an order first'}
            searchPlaceholder="Search operations"
            getKey={(w) => w.id}
            getLabel={(w) => `${w.operationSeq} · ${w.operationName}`}
            getDescription={(w) => `${w.code} · ${WO_STATUS_LABEL[w.status]} · ${w.goodQty} good`}
            getKeywords={(w) => [w.code]}
          />
        </FormField>
        <FormField
          label="WIP batch"
          hint="Optional. A failed result puts this batch on quality hold."
          className="sm:col-span-2"
        >
          <Combobox
            items={wips}
            value={wipId}
            onChange={setWipId}
            clearable
            disabled={!mo}
            placeholder="Any batch at this operation"
            searchPlaceholder="Search batches"
            getKey={(w) => w.id}
            getLabel={(w) => w.code}
            getDescription={(w) =>
              `Op ${w.operationSeq} · ${w.qty} · ${WIP_STATE_LABEL[w.state]} · ${s.locationName(w.locationId)}`
            }
          />
        </FormField>
        <FormField label="Trigger">
          <NativeSelect
            options={TRIGGER_OPTIONS}
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as InspectionTrigger)}
          />
        </FormField>
        <FormField
          label="Sample size"
          required
          error={show(errors.sample)}
          hint={
            plan
              ? `Plan ${plan.code} samples ${plan.sampleSize}`
              : `Site default ${s.settings.defaultSampleSize}`
          }
        >
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={sampleSize}
            placeholder={String(defaultSample)}
            onChange={(e) => setSampleSize(e.target.value)}
            invalid={!!show(errors.sample)}
          />
        </FormField>
        <FormField label="Note" className="sm:col-span-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-16"
            placeholder="What prompted the check"
          />
        </FormField>
      </div>
      {wo && (
        <div className="mt-4 rounded-2xl p-3 text-sm bg-surface-2">
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <span className="font-semibold">{plan ? `Plan ${plan.code}` : 'No inspection plan'}</span>
            <Badge variant={characteristics.length ? 'ink' : 'warning'}>
              {characteristics.length} characteristics
            </Badge>
          </div>
          <p className="mt-1 text-xs text-muted">
            {characteristics.length
              ? characteristics.map((c) => c.name).join(', ')
              : 'The snapshot has no characteristic at this operation. The inspection is recorded with a disposition only.'}
          </p>
        </div>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Request inspection</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Disposition ────────────────────────────────────────────────

/** Confirm with a disposition, shared by hold release, failed inspections and NCR closure. */
export function DispositionDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel = 'Confirm',
  initial = 'accept',
  options = DISPOSITIONS,
  onConfirm,
  children,
}: DialogProps & {
  title: ReactNode
  description?: ReactNode
  confirmLabel?: string
  initial?: Disposition
  options?: Disposition[]
  onConfirm: (disposition: Disposition) => void
  children?: ReactNode
}) {
  const [disposition, setDisposition] = useState<Disposition>(initial)
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={title}
      description={description}
      confirmLabel={confirmLabel}
      destructive={disposition === 'scrap'}
      onConfirm={() => onConfirm(disposition)}
    >
      <div className="mt-4 space-y-3">
        <FormField label="Disposition" required>
          <NativeSelect
            options={options.map((d) => ({ value: d, label: DISPOSITION_LABEL[d] }))}
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as Disposition)}
          />
        </FormField>
        {children}
      </div>
    </ConfirmDialog>
  )
}

// ─── Create hold ────────────────────────────────────────────────

export function HoldDialog({
  open,
  onOpenChange,
  editing = null,
}: DialogProps & { editing?: QualityHold | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <HoldForm editing={editing} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function HoldForm({ editing, onDone }: { editing: QualityHold | null; onDone: () => void }) {
  const s = useScoped()
  const [target, setTarget] = useState<HoldTarget>(editing?.target ?? 'wip')
  const [targetId, setTargetId] = useState<string | null>(editing?.targetId ?? null)
  const [reasonId, setReasonId] = useState<string | null>(editing?.reasonCodeId ?? null)
  const [note, setNote] = useState(editing?.note ?? '')
  const [tried, setTried] = useState(false)

  const heldIds = useMemo(
    () => new Set(s.qualityHolds.filter((h) => h.status === 'active').map((h) => h.targetId)),
    [s.qualityHolds],
  )
  const items = useMemo<{ id: string; label: string; description: string; moId: string }[]>(() => {
    switch (target) {
      case 'wip':
        return s.wips
          .filter(
            (w) =>
              w.qty > 0 && w.state !== 'completed' && w.state !== 'scrapped' && w.state !== 'quality_hold',
          )
          .map((w) => ({
            id: w.id,
            label: w.code,
            description: `${s.maps.mo.get(w.moId)?.code ?? ''} · op ${w.operationSeq} · ${w.qty} · ${WIP_STATE_LABEL[w.state]}`,
            moId: w.moId,
          }))
      case 'lot':
        return s.materialLots
          .filter((l) => l.status !== 'consumed' && l.status !== 'hold')
          .map((l) => ({
            id: l.id,
            label: l.code,
            description: `${s.materialName(l.materialId)} · ${l.qty} ${s.uomCode(l.uomId)} · ${s.locationName(l.locationId)}`,
            moId: s.wips.find((w) => w.lotIds.includes(l.id))?.moId ?? '',
          }))
      case 'mo':
        return s.manufacturingOrders
          .filter((m) => m.status === 'released' || m.status === 'in_progress')
          .map((m) => ({
            id: m.id,
            label: m.code,
            description: `${s.productName(m.productId)} × ${m.qty} · ${m.status}`,
            moId: m.id,
          }))
      case 'wo':
        return s.workOrders
          .filter((w) => w.status !== 'completed' && w.status !== 'cancelled' && w.status !== 'hold')
          .map((w) => ({
            id: w.id,
            label: `${w.code} · ${w.operationName}`,
            description: `${s.maps.mo.get(w.moId)?.code ?? ''} · ${WO_STATUS_LABEL[w.status]}`,
            moId: w.moId,
          }))
    }
  }, [target, s])

  const selected = items.find((i) => i.id === targetId)
  const errors = {
    target: editing
      ? null
      : !selected
        ? `Choose the ${HOLD_TARGET_LABEL[target].toLowerCase()} to hold.`
        : heldIds.has(selected.id)
          ? 'This one is already on hold.'
          : null,
    reason: !reasonId ? 'Choose a hold reason.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !reasonId) return
    if (editing) {
      s.dispatch({ type: 'qualityHolds/upsert', item: { ...editing, reasonCodeId: reasonId, note } })
      toast('Hold updated', { tone: 'success', description: `${editing.code} saved.` })
      onDone()
      return
    }
    if (!selected) return
    if (target === 'wip') {
      s.dispatch({ type: 'wips/hold', id: selected.id, reasonCodeId: reasonId, note })
    } else {
      // The reducer only records holds for WIP itself; other targets get a hold record here
      // plus their own status change, and qualityHolds/release resumes them.
      if (target === 'mo')
        s.dispatch({ type: 'manufacturingOrders/hold', id: selected.id, reasonCodeId: reasonId, note })
      if (target === 'wo')
        s.dispatch({ type: 'workOrders/hold', id: selected.id, reasonCodeId: reasonId, note })
      const lot = target === 'lot' ? s.maps.lot.get(selected.id) : undefined
      if (lot) s.dispatch({ type: 'materialLots/upsert', item: { ...lot, status: 'hold' } })
      const hold: QualityHold = {
        id: newId('qh'),
        code: nextCode(
          s.state.qualityHolds.map((h) => h.code),
          'QH-',
          5,
        ),
        siteId: s.siteId,
        target,
        targetId: selected.id,
        moId: selected.moId,
        reasonCodeId: reasonId,
        note,
        status: 'active',
        heldBy: s.user.id,
        heldAt: nowIso(),
        releasedBy: null,
        releasedAt: null,
        disposition: null,
      }
      s.dispatch({ type: 'qualityHolds/upsert', item: hold })
    }
    toast('Quality hold created', {
      tone: 'success',
      description: `${selected.label} is on hold until a disposition is recorded.`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'Create quality hold'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'The target stays as it is. Change the reason or the note; release the hold from its page.'
            : 'Nothing on hold moves or gets consumed until quality releases it with a disposition.'}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        {editing ? (
          <FormField label="Hold target" className="sm:col-span-2">
            <Input
              readOnly
              value={`${HOLD_TARGET_LABEL[editing.target]} · ${holdTargetCode(s.state, editing)}`}
            />
          </FormField>
        ) : (
          <>
            <FormField label="Hold target">
              <NativeSelect
                options={TARGET_OPTIONS}
                value={target}
                onChange={(e) => {
                  setTarget(e.target.value as HoldTarget)
                  setTargetId(null)
                }}
              />
            </FormField>
            <FormField label={HOLD_TARGET_LABEL[target]} required error={show(errors.target)}>
              <Combobox
                items={items}
                value={targetId}
                onChange={setTargetId}
                invalid={!!show(errors.target)}
                placeholder={`Select ${HOLD_TARGET_LABEL[target].toLowerCase()}`}
                searchPlaceholder="Search by code"
                getKey={(i) => i.id}
                getLabel={(i) => i.label}
                getDescription={(i) => i.description}
                getDisabledReason={(i) => (heldIds.has(i.id) ? 'Already on hold' : null)}
              />
            </FormField>
          </>
        )}
        <FormField label="Reason" required error={show(errors.reason)} className="sm:col-span-2">
          <ReasonPicker kind="hold" value={reasonId} onChange={setReasonId} invalid={!!show(errors.reason)} />
        </FormField>
        <FormField label="Note" className="sm:col-span-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-16"
            placeholder="What was observed"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Create hold'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── New NCR ────────────────────────────────────────────────────

export function NcrDialog({ open, onOpenChange, editing = null }: DialogProps & { editing?: Ncr | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <NcrForm editing={editing} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function NcrForm({ editing, onDone }: { editing: Ncr | null; onDone: () => void }) {
  const s = useScoped()
  const [title, setTitle] = useState(editing?.title ?? '')
  const [defectCodeId, setDefectCodeId] = useState<string | null>(editing?.defectCodeId ?? null)
  const [severity, setSeverity] = useState<Severity>(editing?.severity ?? 'major')
  const [source, setSource] = useState<Ncr['source']>(editing?.source ?? 'inspection')
  const [moId, setMoId] = useState<string | null>(editing?.moId ?? null)
  const [woId, setWoId] = useState<string | null>(editing?.woId ?? null)
  const [lotId, setLotId] = useState<string | null>(editing?.lotId ?? null)
  const [wipId, setWipId] = useState<string | null>(editing?.wipId ?? null)
  const [containment, setContainment] = useState(editing?.containment ?? '')
  const [tried, setTried] = useState(false)

  const wos = useMemo(
    () => s.workOrders.filter((w) => w.moId === moId).sort((a, b) => a.operationSeq - b.operationSeq),
    [s.workOrders, moId],
  )
  const wips = useMemo(() => s.wips.filter((w) => !moId || w.moId === moId), [s.wips, moId])
  const defect = defectCodeId ? s.maps.defectCode.get(defectCodeId) : undefined

  const errors = {
    title: !title.trim() ? 'Give the report a title.' : null,
    defect: !defectCodeId ? 'Choose the defect code.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !defectCodeId) return
    const fields = {
      title: title.trim(),
      defectCodeId,
      severity,
      source,
      moId,
      woId,
      lotId,
      wipId,
      containment,
    }
    if (editing) {
      s.dispatch({ type: 'ncrs/upsert', item: { ...editing, ...fields } })
      toast('NCR updated', { tone: 'success', description: `${editing.code} saved.` })
      onDone()
      return
    }
    const ncr: Ncr = {
      id: newId('ncr'),
      code: nextCode(
        s.state.ncrs.map((n) => n.code),
        'NCR-',
        5,
      ),
      siteId: s.siteId,
      ...fields,
      disposition: null,
      status: 'open',
      raisedBy: s.user.id,
      raisedAt: nowIso(),
      closedAt: null,
    }
    s.dispatch({ type: 'ncrs/upsert', item: ncr })
    toast('NCR raised', { tone: 'success', description: `${ncr.code} is open. Record containment next.` })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New non-conformance report'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Status and stamps stay as they are. Move the report on from its page.'
            : 'Open → containment → disposition → closed. Every step is stamped with who did it.'}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Title" required error={show(errors.title)} className="sm:col-span-2">
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            invalid={!!show(errors.title)}
            placeholder="Short description of the non-conformance"
          />
        </FormField>
        <FormField label="Defect code" required error={show(errors.defect)}>
          <DefectCodePicker
            value={defectCodeId}
            onChange={(v) => {
              setDefectCodeId(v)
              const d = v ? s.maps.defectCode.get(v) : undefined
              if (d) setSeverity(d.severity)
            }}
            invalid={!!show(errors.defect)}
          />
        </FormField>
        <FormField
          label="Severity"
          hint={defect ? `Defect code default: ${SEVERITY_LABEL[defect.severity]}` : undefined}
        >
          <NativeSelect
            options={SEVERITY_OPTIONS}
            value={severity}
            onChange={(e) => setSeverity(e.target.value as Severity)}
          />
        </FormField>
        <FormField label="Source">
          <NativeSelect
            options={NCR_SOURCES}
            value={source}
            onChange={(e) => setSource(e.target.value as Ncr['source'])}
          />
        </FormField>
        <FormField label="Manufacturing order">
          <MoPicker
            value={moId}
            onChange={(v) => {
              setMoId(v)
              setWoId(null)
              setWipId(null)
            }}
            clearable
          />
        </FormField>
        <FormField label="Work order">
          <Combobox
            items={wos}
            value={woId}
            onChange={setWoId}
            clearable
            disabled={!moId}
            placeholder={moId ? 'Any operation' : 'Choose an order first'}
            searchPlaceholder="Search operations"
            getKey={(w) => w.id}
            getLabel={(w) => `${w.operationSeq} · ${w.operationName}`}
            getDescription={(w) => w.code}
          />
        </FormField>
        <FormField label="Material lot">
          <Combobox
            items={s.materialLots}
            value={lotId}
            onChange={setLotId}
            clearable
            placeholder="No lot"
            searchPlaceholder="Search lots"
            getKey={(l) => l.id}
            getLabel={(l) => l.code}
            getDescription={(l) => `${s.materialName(l.materialId)} · ${l.status}`}
          />
        </FormField>
        <FormField label="WIP batch">
          <Combobox
            items={wips}
            value={wipId}
            onChange={setWipId}
            clearable
            placeholder="No batch"
            searchPlaceholder="Search batches"
            getKey={(w) => w.id}
            getLabel={(w) => w.code}
            getDescription={(w) =>
              `${s.maps.mo.get(w.moId)?.code ?? ''} · op ${w.operationSeq} · ${w.qty} · ${WIP_STATE_LABEL[w.state]}`
            }
          />
        </FormField>
        <FormField
          label="Immediate containment"
          hint={editing ? undefined : 'Optional now. Required to move past Open.'}
          className="sm:col-span-2"
        >
          <Textarea
            value={containment}
            onChange={(e) => setContainment(e.target.value)}
            className="min-h-16"
            placeholder="What was quarantined, stopped or segregated"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Raise NCR'}</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Edit inspection ────────────────────────────────────────────

export function InspectionEditDialog({
  open,
  onOpenChange,
  inspection,
}: DialogProps & { inspection: Inspection }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <InspectionEditForm inspection={inspection} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function InspectionEditForm({ inspection, onDone }: { inspection: Inspection; onDone: () => void }) {
  const s = useScoped()
  const [trigger, setTrigger] = useState<InspectionTrigger>(inspection.trigger)
  const [sampleSize, setSampleSize] = useState(String(inspection.sampleSize))
  const [inspectorId, setInspectorId] = useState<string | null>(inspection.inspectorId)
  const [wipId, setWipId] = useState<string | null>(inspection.wipId)
  const [lotId, setLotId] = useState<string | null>(inspection.lotId)
  const [note, setNote] = useState(inspection.note)
  const [tried, setTried] = useState(false)

  const wips = useMemo(() => s.wips.filter((w) => w.moId === inspection.moId), [s.wips, inspection.moId])
  const size = Number(sampleSize)
  const errors = { sample: !(size > 0) ? 'Sample size has to be at least 1.' : null }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    s.dispatch({
      type: 'inspections/upsert',
      item: { ...inspection, trigger, sampleSize: size, inspectorId, wipId, lotId, note },
    })
    toast('Inspection updated', { tone: 'success', description: `${inspection.code} saved.` })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Edit {inspection.code}</DialogTitle>
        <DialogDescription>
          Order, operation and the measured characteristics stay as requested. Results are recorded on the
          inspection page.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Trigger">
          <NativeSelect
            options={TRIGGER_OPTIONS}
            value={trigger}
            onChange={(e) => setTrigger(e.target.value as InspectionTrigger)}
          />
        </FormField>
        <FormField label="Sample size" required error={show(errors.sample)}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={sampleSize}
            onChange={(e) => setSampleSize(e.target.value)}
            invalid={!!show(errors.sample)}
          />
        </FormField>
        <FormField label="Inspector" className="sm:col-span-2">
          <PersonPicker
            people={s.inspectors}
            value={inspectorId}
            onChange={setInspectorId}
            clearable
            placeholder="Unassigned"
          />
        </FormField>
        <FormField label="WIP batch">
          <Combobox
            items={wips}
            value={wipId}
            onChange={setWipId}
            clearable
            placeholder="Any batch at this operation"
            searchPlaceholder="Search batches"
            getKey={(w) => w.id}
            getLabel={(w) => w.code}
            getDescription={(w) => `Op ${w.operationSeq} · ${w.qty} · ${WIP_STATE_LABEL[w.state]}`}
          />
        </FormField>
        <FormField label="Material lot">
          <Combobox
            items={s.materialLots}
            value={lotId}
            onChange={setLotId}
            clearable
            placeholder="No lot"
            searchPlaceholder="Search lots"
            getKey={(l) => l.id}
            getLabel={(l) => l.code}
            getDescription={(l) => `${s.materialName(l.materialId)} · ${l.status}`}
          />
        </FormField>
        <FormField label="Note" className="sm:col-span-2">
          <Textarea value={note} onChange={(e) => setNote(e.target.value)} className="min-h-16" />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Save changes</Button>
      </DialogFooter>
    </form>
  )
}

// ─── Rework close ───────────────────────────────────────────────

export function ReworkCloseDialog({
  open,
  onOpenChange,
  reworkId,
}: DialogProps & { reworkId: string | null }) {
  const s = useScoped()
  const rework = reworkId ? s.maps.rework.get(reworkId) : undefined
  const [good, setGood] = useState('')
  const [scrap, setScrap] = useState('')
  const qty = rework?.qty ?? 0
  const goodN = good === '' ? qty : Number(good)
  const scrapN = scrap === '' ? Math.max(0, qty - goodN) : Number(scrap)
  const valid = goodN >= 0 && scrapN >= 0 && goodN + scrapN === qty
  if (!rework) return null
  return (
    <ConfirmDialog
      open={open}
      onOpenChange={onOpenChange}
      title={`Close ${rework.code}`}
      description={`${qty} pieces went through rework. Split them between good and scrap.`}
      confirmLabel="Close rework"
      confirmDisabled={!valid}
      onConfirm={() => {
        s.dispatch({ type: 'rework/close', id: rework.id, goodQty: goodN, scrapQty: scrapN })
        toast('Rework closed', { tone: 'success', description: `${goodN} good, ${scrapN} scrap.` })
        onOpenChange(false)
      }}
    >
      <div className="mt-4 gap-3 grid grid-cols-2">
        <FormField label="Good" error={valid ? undefined : `Good and scrap have to add up to ${qty}.`}>
          <Input
            type="number"
            min={0}
            max={qty}
            inputMode="numeric"
            value={good}
            placeholder={String(qty)}
            onChange={(e) => setGood(e.target.value)}
          />
        </FormField>
        <FormField label="Scrap">
          <Input
            type="number"
            min={0}
            max={qty}
            inputMode="numeric"
            value={scrap}
            placeholder={String(Math.max(0, qty - goodN))}
            onChange={(e) => setScrap(e.target.value)}
          />
        </FormField>
      </div>
    </ConfirmDialog>
  )
}

// ─── Record defect ──────────────────────────────────────────────

export function DefectRecordDialog({
  open,
  onOpenChange,
  editing = null,
}: DialogProps & { editing?: DefectRecord | null }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <DefectRecordForm editing={editing} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function DefectRecordForm({ editing, onDone }: { editing: DefectRecord | null; onDone: () => void }) {
  const s = useScoped()
  const [defectCodeId, setDefectCodeId] = useState<string | null>(editing?.defectCodeId ?? null)
  const [moId, setMoId] = useState<string | null>(editing?.moId ?? null)
  const [woId, setWoId] = useState<string | null>(editing?.woId ?? null)
  const [wipId, setWipId] = useState<string | null>(editing?.wipId ?? null)
  const [qty, setQty] = useState(editing ? String(editing.qty) : '1')
  const [note, setNote] = useState(editing?.note ?? '')
  const [tried, setTried] = useState(false)

  const wos = useMemo(
    () => s.workOrders.filter((w) => w.moId === moId).sort((a, b) => a.operationSeq - b.operationSeq),
    [s.workOrders, moId],
  )
  const wips = useMemo(() => s.wips.filter((w) => w.moId === moId), [s.wips, moId])
  const qtyN = Number(qty)

  const errors = {
    defect: !defectCodeId ? 'Choose the defect code.' : null,
    mo: !moId ? 'Choose the order the defect was found on.' : null,
    qty: !(qtyN > 0) ? 'Quantity has to be at least 1.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !defectCodeId || !moId) return
    const fields = { defectCodeId, moId, woId, wipId, qty: qtyN, note }
    const item: DefectRecord = editing
      ? { ...editing, ...fields }
      : { id: newId('dfr'), siteId: s.siteId, inspectionId: null, at: nowIso(), by: s.user.id, ...fields }
    s.dispatch({ type: 'defectRecords/upsert', item })
    toast(editing ? 'Defect updated' : 'Defect recorded', {
      tone: 'success',
      description: `${qtyN} × ${s.maps.defectCode.get(defectCodeId)?.name ?? 'defect'} on ${s.maps.mo.get(moId)?.code ?? 'the order'}.`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? 'Edit defect record' : 'Record defect'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'The time and the person who recorded it stay as they are.'
            : 'A defect found on the floor outside an inspection. It counts in the Pareto like any other.'}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Defect code" required error={show(errors.defect)} className="sm:col-span-2">
          <DefectCodePicker value={defectCodeId} onChange={setDefectCodeId} invalid={!!show(errors.defect)} />
        </FormField>
        <FormField label="Manufacturing order" required error={show(errors.mo)} className="sm:col-span-2">
          <MoPicker
            value={moId}
            onChange={(v) => {
              setMoId(v)
              setWoId(null)
              setWipId(null)
            }}
            invalid={!!show(errors.mo)}
          />
        </FormField>
        <FormField label="Work order">
          <Combobox
            items={wos}
            value={woId}
            onChange={setWoId}
            clearable
            disabled={!moId}
            placeholder={moId ? 'Any operation' : 'Choose an order first'}
            searchPlaceholder="Search operations"
            getKey={(w) => w.id}
            getLabel={(w) => `${w.operationSeq} · ${w.operationName}`}
            getDescription={(w) => w.code}
          />
        </FormField>
        <FormField label="WIP batch">
          <Combobox
            items={wips}
            value={wipId}
            onChange={setWipId}
            clearable
            disabled={!moId}
            placeholder={moId ? 'No batch' : 'Choose an order first'}
            searchPlaceholder="Search batches"
            getKey={(w) => w.id}
            getLabel={(w) => w.code}
            getDescription={(w) => `Op ${w.operationSeq} · ${w.qty} · ${WIP_STATE_LABEL[w.state]}`}
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
        <FormField label="Note" className="sm:col-span-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-16"
            placeholder="Where and how it was found"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Record defect'}</Button>
      </DialogFooter>
    </form>
  )
}
