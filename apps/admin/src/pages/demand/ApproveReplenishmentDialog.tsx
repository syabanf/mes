import { addDays, addHours, fmtNumber, fromInput, nowMs, toDateTimeInput, toIso } from '@mes/fixtures'
import type { Replenishment } from '@mes/types'
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
  toast,
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { OrgNodePicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'

/** Approving a proposal creates a make-to-stock manufacturing order with this planning window. */
export function ApproveReplenishmentDialog({
  replenishment,
  onOpenChange,
}: {
  replenishment: Replenishment | null
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!replenishment} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {replenishment && <ApproveForm replenishment={replenishment} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function ApproveForm({ replenishment, onDone }: { replenishment: Replenishment; onDone: () => void }) {
  const { dispatch, productName } = useScoped()
  const [lineId, setLineId] = useState<string | null>(null)
  const [start, setStart] = useState(toDateTimeInput(toIso(addHours(nowMs(), 2))))
  const [end, setEnd] = useState(toDateTimeInput(toIso(addDays(nowMs(), 2))))
  const [tried, setTried] = useState(false)
  const windowError = !start || !end ? 'Set both dates' : end <= start ? 'Finish must be after start' : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (windowError) return
    dispatch({
      type: 'replenishments/approve',
      id: replenishment.id,
      plannedStart: fromInput(start),
      plannedEnd: fromInput(end),
      lineId,
    })
    toast('Replenishment approved', {
      tone: 'success',
      description: `Manufacturing order created for ${fmtNumber(replenishment.requiredQty)} ${productName(replenishment.productId)}.`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Approve {replenishment.code}</DialogTitle>
        <DialogDescription>
          Creates a make-to-stock order for {fmtNumber(replenishment.requiredQty)}{' '}
          {productName(replenishment.productId)}.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 grid grid-cols-1">
        <FormField label="Line" hint="Optional until dispatch">
          <OrgNodePicker kind="line" value={lineId} onChange={setLineId} clearable />
        </FormField>
        <FormField label="Planned start" required>
          <Input type="datetime-local" value={start} onChange={(e) => setStart(e.target.value)} />
        </FormField>
        <FormField label="Planned finish" required error={tried ? windowError : null}>
          <Input
            type="datetime-local"
            value={end}
            onChange={(e) => setEnd(e.target.value)}
            invalid={tried && !!windowError}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Approve and create order</Button>
      </DialogFooter>
    </form>
  )
}
