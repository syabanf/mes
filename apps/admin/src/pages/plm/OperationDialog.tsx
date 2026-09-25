import { newId, workCenterForSite } from '@mes/fixtures'
import type { Bop, Operation } from '@mes/types'
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
  MultiCombobox,
  Switch,
  toast,
} from '@mes/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { OrgNodePicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'

export interface OperationDialogProps {
  bop: Bop
  /** The operation to edit, or null to add a new one. */
  op: Operation | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function OperationDialog({ bop, op, open, onOpenChange }: OperationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && <OperationForm bop={bop} op={op} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

const nextSeq = (ops: readonly Operation[]) => Math.max(0, ...ops.map((o) => o.seq)) + 10

function OperationForm({ bop, op, onDone }: { bop: Bop; op: Operation | null; onDone: () => void }) {
  const s = useScoped()
  const others = useMemo(
    () => bop.operations.filter((o) => o.id !== op?.id).sort((a, b) => a.seq - b.seq),
    [bop.operations, op],
  )
  const last = others.at(-1)
  const [seq, setSeq] = useState(String(op?.seq ?? nextSeq(bop.operations)))
  const [code, setCode] = useState(op?.code ?? '')
  const [name, setName] = useState(op?.name ?? '')
  const [workCenterCode, setWorkCenterCode] = useState<string | null>(op?.workCenterCode ?? null)
  const [setup, setSetup] = useState(String(op?.setupMin ?? 0))
  const [cycle, setCycle] = useState(String(op?.cycleSec ?? 0))
  const [queue, setQueue] = useState(String(op?.queueMin ?? 0))
  const [transfer, setTransfer] = useState(String(op?.transferMin ?? 0))
  const [predecessors, setPredecessors] = useState<string[]>(
    op ? op.predecessorSeqs.map(String) : last ? [String(last.seq)] : [],
  )
  const [parallel, setParallel] = useState(op?.parallel ?? false)
  const [reworkTo, setReworkTo] = useState<string | null>(
    op && op.reworkToSeq !== null ? String(op.reworkToSeq) : null,
  )
  const [qualityRequired, setQualityRequired] = useState(op?.qualityRequired ?? false)
  const [workInstructionId, setWorkInstructionId] = useState<string | null>(op?.workInstructionId ?? null)
  const [tried, setTried] = useState(false)

  const seqOptions = others.map((o) => ({
    key: String(o.seq),
    label: `Op ${o.seq}`,
    description: `${o.code} · ${o.name}`,
  }))
  const workCenter = workCenterCode ? workCenterForSite(s.orgNodes, s.siteId, workCenterCode) : undefined
  const instructions = useMemo(
    () => s.workInstructions.filter((w) => w.productId === bop.productId && w.state !== 'obsolete'),
    [s.workInstructions, bop.productId],
  )

  const nonNegative = (v: string) => (v === '' || !(Number(v) >= 0) ? 'Enter zero or more.' : null)
  const errors = {
    seq: !(Number(seq) > 0)
      ? 'Enter the sequence.'
      : others.some((o) => o.seq === Number(seq))
        ? 'Another operation already has this sequence.'
        : null,
    code: !code.trim() ? 'Enter the operation code.' : null,
    name: !name.trim() ? 'Enter the operation name.' : null,
    workCenter: !workCenterCode ? 'Choose the work center.' : null,
    setup: nonNegative(setup),
    cycle: nonNegative(cycle),
    queue: nonNegative(queue),
    transfer: nonNegative(transfer),
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !workCenterCode) return
    const next: Operation = {
      id: op?.id ?? newId('op'),
      seq: Number(seq),
      code: code.trim().toUpperCase(),
      name: name.trim(),
      workCenterCode,
      setupMin: Number(setup),
      cycleSec: Number(cycle),
      queueMin: Number(queue),
      transferMin: Number(transfer),
      predecessorSeqs: predecessors.map(Number).sort((a, b) => a - b),
      parallel,
      reworkToSeq: reworkTo === null ? null : Number(reworkTo),
      qualityRequired,
      workInstructionId,
    }
    const operations = op ? bop.operations.map((o) => (o.id === op.id ? next : o)) : [...bop.operations, next]
    s.dispatch({ type: 'bops/upsert', item: { ...bop, operations } })
    toast(op ? 'Operation updated' : 'Operation added', { tone: 'success' })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{op ? `Op ${op.seq} · ${op.name}` : 'Add operation'}</DialogTitle>
        <DialogDescription>
          {bop.code} · {bop.rev}. Times drive the schedule of every work order generated from it.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="gap-3 sm:grid-cols-[6rem_8rem_1fr] grid grid-cols-2">
          <FormField label="Seq" required error={show(errors.seq)}>
            <Input
              type="number"
              min={1}
              step={1}
              value={seq}
              onChange={(e) => setSeq(e.target.value)}
              invalid={!!show(errors.seq)}
            />
          </FormField>
          <FormField label="Code" required error={show(errors.code)}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="CAST"
              className="font-mono uppercase"
              invalid={!!show(errors.code)}
            />
          </FormField>
          <FormField label="Name" required error={show(errors.name)} className="sm:col-span-1 col-span-2">
            <Input value={name} onChange={(e) => setName(e.target.value)} invalid={!!show(errors.name)} />
          </FormField>
        </div>
        <FormField
          label="Work center"
          required
          error={show(errors.workCenter)}
          hint={
            workCenterCode && !workCenter ? `${workCenterCode} has no work center at this site` : undefined
          }
        >
          <OrgNodePicker
            kind="work_center"
            value={workCenter?.id ?? null}
            onChange={(id) => setWorkCenterCode(id ? (s.maps.orgNode.get(id)?.code ?? null) : null)}
            invalid={!!show(errors.workCenter)}
          />
        </FormField>
        <div className="gap-3 sm:grid-cols-4 grid grid-cols-2">
          <FormField label="Setup (min)" error={show(errors.setup)}>
            <Input
              type="number"
              min={0}
              step="any"
              value={setup}
              onChange={(e) => setSetup(e.target.value)}
              invalid={!!show(errors.setup)}
            />
          </FormField>
          <FormField label="Cycle (sec)" error={show(errors.cycle)}>
            <Input
              type="number"
              min={0}
              step="any"
              value={cycle}
              onChange={(e) => setCycle(e.target.value)}
              invalid={!!show(errors.cycle)}
            />
          </FormField>
          <FormField label="Queue (min)" error={show(errors.queue)}>
            <Input
              type="number"
              min={0}
              step="any"
              value={queue}
              onChange={(e) => setQueue(e.target.value)}
              invalid={!!show(errors.queue)}
            />
          </FormField>
          <FormField label="Transfer (min)" error={show(errors.transfer)}>
            <Input
              type="number"
              min={0}
              step="any"
              value={transfer}
              onChange={(e) => setTransfer(e.target.value)}
              invalid={!!show(errors.transfer)}
            />
          </FormField>
        </div>
        <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
          <FormField label="After operations" hint="Empty means the routing starts here">
            <MultiCombobox
              items={seqOptions}
              values={predecessors}
              onChange={setPredecessors}
              placeholder="Start of routing"
              searchPlaceholder="Search operations"
              getKey={(o) => o.key}
              getLabel={(o) => o.label}
              getDescription={(o) => o.description}
            />
          </FormField>
          <FormField label="Rework routes to" hint="Empty when rework is not allowed here">
            <Combobox
              items={seqOptions}
              value={reworkTo}
              onChange={setReworkTo}
              clearable
              placeholder="No rework"
              searchPlaceholder="Search operations"
              getKey={(o) => o.key}
              getLabel={(o) => o.label}
              getDescription={(o) => o.description}
            />
          </FormField>
        </div>
        <FormField label="Work instruction" hint="Shown at the station when the work order starts">
          <Combobox
            items={instructions}
            value={workInstructionId}
            onChange={setWorkInstructionId}
            clearable
            placeholder="No work instruction"
            searchPlaceholder="Search instructions"
            getKey={(w) => w.id}
            getLabel={(w) => w.title}
            getDescription={(w) => `${w.code} · ${w.rev} · op ${w.operationSeq}`}
            getKeywords={(w) => [w.code]}
          />
        </FormField>
        <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
          <label className="gap-3 rounded-2xl p-3 flex items-center justify-between bg-surface-2">
            <span className="min-w-0">
              <span className="text-sm font-medium block">Parallel</span>
              <span className="text-xs block text-muted">Runs alongside its predecessors</span>
            </span>
            <Switch checked={parallel} onCheckedChange={setParallel} aria-label="Parallel" />
          </label>
          <label className="gap-3 rounded-2xl p-3 flex items-center justify-between bg-surface-2">
            <span className="min-w-0">
              <span className="text-sm font-medium block">Quality check</span>
              <span className="text-xs block text-muted">An inspection is requested on start</span>
            </span>
            <Switch
              checked={qualityRequired}
              onCheckedChange={setQualityRequired}
              aria-label="Quality required"
            />
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{op ? 'Save' : 'Add operation'}</Button>
      </DialogFooter>
    </form>
  )
}
