import { fmtNumber, productOnHand } from '@mes/fixtures'
import type { Demand } from '@mes/types'
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
import { useScoped } from '../../state/scoped'
import { splitGap } from './lib'

/** Allocate finished goods to a demand line. Defaults to everything free stock can cover. */
export function AllocateDialog({
  demand,
  resolveAll = false,
  onOpenChange,
}: {
  demand: Demand | null
  resolveAll?: boolean
  onOpenChange: (open: boolean) => void
}) {
  return (
    <Dialog open={!!demand} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {demand && (
          <AllocateForm demand={demand} resolveAll={resolveAll} onDone={() => onOpenChange(false)} />
        )}
      </DialogContent>
    </Dialog>
  )
}

function AllocateForm({
  demand,
  resolveAll,
  onDone,
}: {
  demand: Demand
  resolveAll: boolean
  onDone: () => void
}) {
  const s = useScoped()
  const { free } = productOnHand(s, demand.productId, s.siteId)
  const { gap, allocate } = splitGap(demand, free)
  const [qty, setQty] = useState(String(allocate))
  const [tried, setTried] = useState(false)
  const n = Number(qty)
  const error =
    !qty || !Number.isFinite(n) || n <= 0
      ? 'Enter a quantity'
      : n > allocate
        ? `At most ${fmtNumber(allocate)} can be allocated`
        : null

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (error) return
    s.dispatch({ type: 'demands/allocate', id: demand.id, qty: n })
    toast(`${fmtNumber(n)} allocated from stock`, { tone: 'success', description: demand.code })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{resolveAll ? 'Resolve from stock' : 'Allocate from stock'}</DialogTitle>
        <DialogDescription>
          {demand.code} · {s.productName(demand.productId)}. {fmtNumber(free)} free in finished goods,{' '}
          {fmtNumber(gap)} still unresolved.
        </DialogDescription>
      </DialogHeader>
      {allocate === 0 ? (
        <p className="rounded-2xl p-3 text-sm bg-surface-2 text-muted">
          {gap === 0
            ? 'This demand is already resolved.'
            : 'No free finished goods for this product. Create a manufacturing order instead.'}
        </p>
      ) : (
        <FormField label="Quantity" required error={tried ? error : null}>
          <Input
            type="number"
            min={1}
            max={allocate}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            disabled={resolveAll}
            invalid={tried && !!error}
            autoFocus
          />
        </FormField>
      )}
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit" disabled={allocate === 0}>
          {resolveAll ? 'Resolve demand' : 'Allocate'}
        </Button>
      </DialogFooter>
    </form>
  )
}
