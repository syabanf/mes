import { newId } from '@mes/fixtures'
import type { OrgNode } from '@mes/types'
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
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { OrgNodePicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'

export function WorkCenterDialog({
  open,
  onOpenChange,
  editing = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: OrgNode | null
  onSaved?: (node: OrgNode) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <WorkCenterForm
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

function WorkCenterForm({
  editing,
  onDone,
}: {
  editing: OrgNode | null
  onDone: (saved: OrgNode | null) => void
}) {
  const { siteId, workCenters, lines, dispatch } = useScoped()
  const [name, setName] = useState(editing?.name ?? '')
  const [code, setCode] = useState(editing?.code ?? '')
  const [capacity, setCapacity] = useState(
    editing?.capacityHoursPerShift !== undefined ? String(editing.capacityHoursPerShift) : '',
  )
  const [parentId, setParentId] = useState<string | null>(editing?.parentId ?? lines[0]?.id ?? null)
  const [tried, setTried] = useState(false)

  const trimmedCode = code.trim().toUpperCase()
  const codeTaken = workCenters.some((wc) => wc.id !== editing?.id && wc.code === trimmedCode)
  const errors = {
    name: !name.trim() ? 'Enter the work center name.' : null,
    code: !trimmedCode
      ? 'Enter a short code, for example WC-CAST.'
      : codeTaken
        ? 'Another work center already uses this code.'
        : null,
    capacity: capacity !== '' && !(Number(capacity) > 0) ? 'Hours per shift must be above zero.' : null,
    parent: !parentId ? 'Pick the line this work center belongs to.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const item: OrgNode = {
      id: editing?.id ?? newId('org'),
      siteId: editing?.siteId ?? siteId,
      kind: 'work_center',
      parentId,
      code: trimmedCode,
      name: name.trim(),
      ...(capacity !== '' ? { capacityHoursPerShift: Number(capacity) } : {}),
    }
    dispatch({ type: 'orgNodes/upsert', item })
    onDone(item)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New work center'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Name, code, capacity and the parent line. Machines keep their assignment.'
            : 'A work center groups machines under a line and sets the hours capacity offers per shift.'}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Name" required error={show(errors.name)} className="sm:col-span-2">
          <Input value={name} onChange={(e) => setName(e.target.value)} invalid={!!show(errors.name)} />
        </FormField>
        <FormField label="Code" required error={show(errors.code)}>
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="WC-"
            className="font-mono"
            invalid={!!show(errors.code)}
          />
        </FormField>
        <FormField
          label="Capacity per shift"
          hint="Hours. Leave empty to derive it from the shift length."
          error={show(errors.capacity)}
        >
          <Input
            type="number"
            min={0.5}
            step={0.5}
            inputMode="decimal"
            value={capacity}
            onChange={(e) => setCapacity(e.target.value)}
            invalid={!!show(errors.capacity)}
          />
        </FormField>
        <FormField label="Line" required error={show(errors.parent)} className="sm:col-span-2">
          <OrgNodePicker
            kind="line"
            value={parentId}
            onChange={setParentId}
            invalid={!!show(errors.parent)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Create work center'}</Button>
      </DialogFooter>
    </form>
  )
}
