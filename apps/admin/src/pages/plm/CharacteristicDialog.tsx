import { newId } from '@mes/fixtures'
import type { Characteristic, MeasurementType, Specification } from '@mes/types'
import { MEASUREMENT_TYPE_LABEL } from '@mes/types'
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
  toast,
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { useScoped } from '../../state/scoped'

const TYPES: MeasurementType[] = ['numeric', 'pass_fail', 'checklist', 'visual', 'photo']
const TYPE_OPTIONS = TYPES.map((t) => ({ value: t, label: MEASUREMENT_TYPE_LABEL[t] }))

export interface CharacteristicDialogProps {
  spec: Specification
  /** The characteristic to edit, or null to add a new one. */
  item: Characteristic | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function CharacteristicDialog({ spec, item, open, onOpenChange }: CharacteristicDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <CharacteristicForm spec={spec} item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

const optional = (v: string) => (v.trim() === '' ? null : Number(v))
const text = (v: number | null | undefined) => (v === null || v === undefined ? '' : String(v))

function CharacteristicForm({
  spec,
  item,
  onDone,
}: {
  spec: Specification
  item: Characteristic | null
  onDone: () => void
}) {
  const s = useScoped()
  const [name, setName] = useState(item?.name ?? '')
  const [type, setType] = useState<MeasurementType>(item?.type ?? 'numeric')
  const [target, setTarget] = useState(text(item?.target))
  const [min, setMin] = useState(text(item?.min))
  const [max, setMax] = useState(text(item?.max))
  const [unit, setUnit] = useState(item?.unit ?? '')
  const [method, setMethod] = useState(item?.method ?? '')
  const [seq, setSeq] = useState(String(item?.operationSeq ?? 10))
  const [tried, setTried] = useState(false)

  const numeric = type === 'numeric'
  const bad = (v: string) => v.trim() !== '' && !Number.isFinite(Number(v))
  const errors = {
    name: !name.trim() ? 'Name the characteristic.' : null,
    limits:
      numeric && (bad(target) || bad(min) || bad(max))
        ? 'Limits have to be numbers.'
        : numeric && min.trim() && max.trim() && Number(min) > Number(max)
          ? 'Min cannot be above max.'
          : null,
    seq: !(Number(seq) > 0) ? 'Enter the operation sequence.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const next: Characteristic = {
      id: item?.id ?? newId('chr'),
      name: name.trim(),
      type,
      target: numeric ? optional(target) : null,
      min: numeric ? optional(min) : null,
      max: numeric ? optional(max) : null,
      unit: numeric ? unit.trim() : '',
      method: method.trim(),
      operationSeq: Number(seq),
    }
    const characteristics = item
      ? spec.characteristics.map((c) => (c.id === item.id ? next : c))
      : [...spec.characteristics, next]
    s.dispatch({ type: 'specifications/upsert', item: { ...spec, characteristics } })
    toast(item ? 'Characteristic updated' : 'Characteristic added', { tone: 'success' })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{item ? item.name : 'Add characteristic'}</DialogTitle>
        <DialogDescription>
          {spec.code} · {spec.rev}. What is measured, the acceptable range and where it is checked.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="gap-3 sm:grid-cols-[1fr_10rem] grid grid-cols-1">
          <FormField label="Name" required error={show(errors.name)}>
            <Input value={name} onChange={(e) => setName(e.target.value)} invalid={!!show(errors.name)} />
          </FormField>
          <FormField label="Type">
            <NativeSelect
              options={TYPE_OPTIONS}
              value={type}
              onChange={(e) => setType(e.target.value as MeasurementType)}
            />
          </FormField>
        </div>
        {numeric && (
          <div className="gap-3 sm:grid-cols-4 grid grid-cols-2">
            <FormField label="Target">
              <Input type="number" step="any" value={target} onChange={(e) => setTarget(e.target.value)} />
            </FormField>
            <FormField label="Min" error={show(errors.limits)}>
              <Input
                type="number"
                step="any"
                value={min}
                onChange={(e) => setMin(e.target.value)}
                invalid={!!show(errors.limits)}
              />
            </FormField>
            <FormField label="Max">
              <Input type="number" step="any" value={max} onChange={(e) => setMax(e.target.value)} />
            </FormField>
            <FormField label="Unit">
              <Input value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="g" />
            </FormField>
          </div>
        )}
        <div className="gap-3 sm:grid-cols-[1fr_8rem] grid grid-cols-1">
          <FormField label="Method" hint="Instrument or procedure">
            <Input
              value={method}
              onChange={(e) => setMethod(e.target.value)}
              placeholder="Digital scale, 3 samples"
            />
          </FormField>
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
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{item ? 'Save' : 'Add characteristic'}</Button>
      </DialogFooter>
    </form>
  )
}
