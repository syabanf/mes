import { newId, workCenterForSite } from '@mes/fixtures'
import type { Bor, BorItem } from '@mes/types'
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
  MultiCombobox,
  toast,
} from '@mes/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { OrgNodePicker, ResourcesPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'

export interface BorItemDialogProps {
  bor: Bor
  /** The operation line to edit, or null to add a new one. */
  item: BorItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BorItemDialog({ bor, item, open, onOpenChange }: BorItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && <BorItemForm bor={bor} item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

const nextSeq = (items: readonly BorItem[]) => Math.max(0, ...items.map((i) => i.operationSeq)) + 10

function BorItemForm({ bor, item, onDone }: { bor: Bor; item: BorItem | null; onDone: () => void }) {
  const s = useScoped()
  const [seq, setSeq] = useState(String(item?.operationSeq ?? nextSeq(bor.items)))
  const [workCenterCode, setWorkCenterCode] = useState<string | null>(item?.workCenterCode ?? null)
  const [machineIds, setMachineIds] = useState<string[]>(item?.machineIds ?? [])
  const [toolIds, setToolIds] = useState<string[]>(item?.toolIds ?? [])
  const [moldIds, setMoldIds] = useState<string[]>(item?.moldIds ?? [])
  const [fixtureIds, setFixtureIds] = useState<string[]>(item?.fixtureIds ?? [])
  const [utilityIds, setUtilityIds] = useState<string[]>(item?.utilityIds ?? [])
  const [skillIds, setSkillIds] = useState<string[]>(item?.skillIds ?? [])
  const [operators, setOperators] = useState(String(item?.operatorCount ?? 1))
  const [setup, setSetup] = useState(String(item?.standardSetupMin ?? 0))
  const [cycle, setCycle] = useState(String(item?.standardCycleSec ?? 0))
  const [labor, setLabor] = useState(String(item?.laborMinPerUnit ?? 0))
  const [tried, setTried] = useState(false)

  const workCenter = workCenterCode ? workCenterForSite(s.orgNodes, s.siteId, workCenterCode) : undefined
  const workCenterId = workCenter?.id ?? null
  const machines = useMemo(
    () => s.machines.filter((m) => m.active && (!workCenterId || m.workCenterId === workCenterId)),
    [s.machines, workCenterId],
  )

  const pickWorkCenter = (id: string | null) => {
    setWorkCenterCode(id ? (s.maps.orgNode.get(id)?.code ?? null) : null)
    if (id) setMachineIds((prev) => prev.filter((m) => s.maps.machine.get(m)?.workCenterId === id))
  }

  const nonNegative = (v: string) => (v === '' || !(Number(v) >= 0) ? 'Enter zero or more.' : null)
  const errors = {
    seq: !(Number(seq) > 0)
      ? 'Enter the operation sequence.'
      : bor.items.some((i) => i.operationSeq === Number(seq) && i.id !== item?.id)
        ? 'Another line already covers this operation.'
        : null,
    workCenter: !workCenterCode ? 'Choose the work center.' : null,
    operators: !(Number(operators) >= 1) ? 'At least one operator.' : null,
    setup: nonNegative(setup),
    cycle: nonNegative(cycle),
    labor: nonNegative(labor),
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !workCenterCode) return
    const next: BorItem = {
      id: item?.id ?? newId('bori'),
      operationSeq: Number(seq),
      workCenterCode,
      machineIds,
      toolIds,
      moldIds,
      fixtureIds,
      utilityIds,
      skillIds,
      operatorCount: Number(operators),
      standardSetupMin: Number(setup),
      standardCycleSec: Number(cycle),
      laborMinPerUnit: Number(labor),
    }
    const items = item ? bor.items.map((i) => (i.id === item.id ? next : i)) : [...bor.items, next]
    s.dispatch({ type: 'bors/upsert', item: { ...bor, items } })
    toast(item ? 'BOR operation updated' : 'BOR operation added', { tone: 'success' })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{item ? `Operation ${item.operationSeq}` : 'Add operation resources'}</DialogTitle>
        <DialogDescription>
          {bor.code} · {bor.rev}. What one operation needs and how long it takes at standard.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="gap-3 sm:grid-cols-[8rem_1fr] grid grid-cols-1">
          <FormField label="Operation seq" required error={show(errors.seq)}>
            <Input
              type="number"
              min={1}
              step={1}
              value={seq}
              onChange={(e) => setSeq(e.target.value)}
              invalid={!!show(errors.seq)}
            />
          </FormField>
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
              value={workCenterId}
              onChange={pickWorkCenter}
              invalid={!!show(errors.workCenter)}
            />
          </FormField>
        </div>
        <FormField
          label="Machines"
          hint="Machines at this site; other sites use any machine in the work center"
        >
          <MultiCombobox
            items={machines}
            values={machineIds}
            onChange={setMachineIds}
            placeholder="Any machine"
            searchPlaceholder="Search machines"
            getKey={(m) => m.id}
            getLabel={(m) => `${m.code} · ${m.name}`}
            getDescription={(m) => `${s.orgName(m.workCenterId)} · ${m.model}`}
            getKeywords={(m) => [m.model]}
          />
        </FormField>
        <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
          <FormField label="Tools">
            <ResourcesPicker kind="tool" values={toolIds} onChange={setToolIds} />
          </FormField>
          <FormField label="Molds">
            <ResourcesPicker kind="mold" values={moldIds} onChange={setMoldIds} />
          </FormField>
          <FormField label="Fixtures">
            <ResourcesPicker kind="fixture" values={fixtureIds} onChange={setFixtureIds} />
          </FormField>
          <FormField label="Utilities">
            <ResourcesPicker kind="utility" values={utilityIds} onChange={setUtilityIds} />
          </FormField>
        </div>
        <FormField label="Skills">
          <MultiCombobox
            items={s.skills}
            values={skillIds}
            onChange={setSkillIds}
            placeholder="No skill required"
            searchPlaceholder="Search skills"
            getKey={(x) => x.id}
            getLabel={(x) => x.name}
            getDescription={(x) => x.code}
          />
        </FormField>
        <div className="gap-3 sm:grid-cols-4 grid grid-cols-2">
          <FormField label="Operators" required error={show(errors.operators)}>
            <Input
              type="number"
              min={1}
              step={1}
              value={operators}
              onChange={(e) => setOperators(e.target.value)}
              invalid={!!show(errors.operators)}
            />
          </FormField>
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
          <FormField label="Labor / unit (min)" error={show(errors.labor)}>
            <Input
              type="number"
              min={0}
              step="any"
              value={labor}
              onChange={(e) => setLabor(e.target.value)}
              invalid={!!show(errors.labor)}
            />
          </FormField>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{item ? 'Save' : 'Add operation'}</Button>
      </DialogFooter>
    </form>
  )
}
