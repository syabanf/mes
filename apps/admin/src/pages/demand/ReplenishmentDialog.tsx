import { newId, nextCode, nowIso } from '@mes/fixtures'
import type { Replenishment, ReplenishmentStatus } from '@mes/types'
import { REPLENISHMENT_STATUS_LABEL } from '@mes/types'
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
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { ProductPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { projectedStock } from './lib'

const STATUSES: ReplenishmentStatus[] = ['proposed', 'approved', 'in_production', 'received', 'dismissed']
const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: REPLENISHMENT_STATUS_LABEL[s] }))

/** Create or edit a replenishment proposal by hand. Dispatches replenishments/upsert with the full item. */
export function ReplenishmentDialog({
  open,
  onOpenChange,
  editing = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Replenishment | null
  onSaved?: (replenishment: Replenishment) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <ReplenishmentForm
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

function ReplenishmentForm({
  editing,
  onDone,
}: {
  editing: Replenishment | null
  onDone: (saved: Replenishment | null) => void
}) {
  const s = useScoped()
  const [productId, setProductId] = useState<string | null>(editing?.productId ?? null)
  const [onHand, setOnHand] = useState(String(editing?.onHand ?? ''))
  const [projected, setProjected] = useState(String(editing?.projected ?? ''))
  const [reorderPoint, setReorderPoint] = useState(String(editing?.reorderPoint ?? ''))
  const [requiredQty, setRequiredQty] = useState(String(editing?.requiredQty ?? ''))
  const [status, setStatus] = useState<ReplenishmentStatus>(editing?.status ?? 'proposed')
  const [tried, setTried] = useState(false)

  /** A new proposal starts from the same numbers the replenishment check would use. */
  const pickProduct = (id: string | null) => {
    setProductId(id)
    if (editing || !id) return
    const projection = projectedStock(s, id)
    const policy = s.inventoryPolicies.find((p) => p.productId === id)
    setOnHand(String(projection.free))
    setProjected(String(projection.projected))
    setReorderPoint(String(policy?.reorderPoint ?? ''))
    if (policy) {
      const raw = Math.max(policy.replenishQty, policy.maxStock - projection.projected)
      const multiple = Math.max(1, policy.productionMultiple)
      setRequiredQty(String(Math.ceil(raw / multiple) * multiple))
    }
  }

  const number = (value: string) => (value.trim() === '' ? NaN : Number(value))
  const errors = {
    product: !productId ? 'Choose the product.' : null,
    onHand: !(number(onHand) >= 0) ? 'Enter the quantity on hand.' : null,
    projected: !Number.isFinite(number(projected)) ? 'Enter the projected stock.' : null,
    reorderPoint: !(number(reorderPoint) >= 0) ? 'Enter the reorder point.' : null,
    requiredQty: !(number(requiredQty) > 0) ? 'Enter the quantity to produce.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const values = {
      productId: productId!,
      onHand: number(onHand),
      projected: number(projected),
      reorderPoint: number(reorderPoint),
      requiredQty: number(requiredQty),
      status,
    }
    const replenishment: Replenishment = editing
      ? { ...editing, ...values }
      : {
          id: newId('rpl'),
          code: nextCode(
            s.state.replenishments.map((r) => r.code),
            'RPL-',
            5,
          ),
          siteId: s.siteId,
          ...values,
          demandId: null,
          moId: null,
          createdAt: nowIso(),
        }
    s.dispatch({ type: 'replenishments/upsert', item: replenishment })
    onDone(replenishment)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New proposal'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Changing the status here does not create or cancel a manufacturing order.'
            : `Manual make-to-stock proposal at ${s.site.name}. Picking a product fills the numbers from stock and its policy.`}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Product" required error={show(errors.product)} className="sm:col-span-2">
          <ProductPicker
            value={productId}
            onChange={pickProduct}
            disabled={!!editing}
            invalid={!!show(errors.product)}
          />
        </FormField>
        <FormField label="On hand" required error={show(errors.onHand)}>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={onHand}
            onChange={(e) => setOnHand(e.target.value)}
            invalid={!!show(errors.onHand)}
          />
        </FormField>
        <FormField
          label="Projected"
          required
          hint="Free stock minus open demand plus running orders"
          error={show(errors.projected)}
        >
          <Input
            type="number"
            inputMode="numeric"
            value={projected}
            onChange={(e) => setProjected(e.target.value)}
            invalid={!!show(errors.projected)}
          />
        </FormField>
        <FormField label="Reorder point" required error={show(errors.reorderPoint)}>
          <Input
            type="number"
            min={0}
            inputMode="numeric"
            value={reorderPoint}
            onChange={(e) => setReorderPoint(e.target.value)}
            invalid={!!show(errors.reorderPoint)}
          />
        </FormField>
        <FormField label="Required quantity" required error={show(errors.requiredQty)}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={requiredQty}
            onChange={(e) => setRequiredQty(e.target.value)}
            invalid={!!show(errors.requiredQty)}
          />
        </FormField>
        <FormField label="Status">
          <NativeSelect
            options={STATUS_OPTIONS}
            value={status}
            onChange={(e) => setStatus(e.target.value as ReplenishmentStatus)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Create proposal'}</Button>
      </DialogFooter>
    </form>
  )
}
