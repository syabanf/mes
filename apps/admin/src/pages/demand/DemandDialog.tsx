import {
  fmtNumber,
  fromInput,
  newId,
  nextCode,
  nowIso,
  toDateInput,
  toIso,
  addDays,
  nowMs,
} from '@mes/fixtures'
import type { Demand, DemandSource } from '@mes/types'
import { DEMAND_SOURCE_LABEL } from '@mes/types'
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
  Textarea,
} from '@mes/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { ProductPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'

const SOURCES: DemandSource[] = ['customer', 'replenishment', 'forecast', 'internal', 'rework']
const SOURCE_OPTIONS = SOURCES.map((s) => ({ value: s, label: DEMAND_SOURCE_LABEL[s] }))

/** Create or edit a demand line at the current site. Dispatches demands/upsert with the full item. */
export function DemandDialog({
  open,
  onOpenChange,
  editing = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Demand | null
  onSaved?: (demand: Demand) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <DemandForm
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

function DemandForm({ editing, onDone }: { editing: Demand | null; onDone: (saved: Demand | null) => void }) {
  const s = useScoped()
  const [source, setSource] = useState<DemandSource>(editing?.source ?? 'customer')
  const [productId, setProductId] = useState<string | null>(editing?.productId ?? null)
  const [qty, setQty] = useState(String(editing?.qty ?? ''))
  const [requiredDate, setRequiredDate] = useState(
    toDateInput(editing?.requiredDate ?? toIso(addDays(nowMs(), 7))),
  )
  const [explanation, setExplanation] = useState(editing?.explanation ?? '')
  const [orderItemId, setOrderItemId] = useState<string | null>(editing?.orderItemId ?? null)
  const [tried, setTried] = useState(false)

  const orderLines = useMemo(
    () =>
      s.marketingOrderItems
        .map((item) => ({ item, order: s.maps.marketingOrder.get(item.orderId) }))
        .filter((x) => !!x.order && x.order.status !== 'cancelled' && x.order.status !== 'closed')
        .sort((a, b) => b.order!.orderDate.localeCompare(a.order!.orderDate) || a.item.line - b.item.line),
    [s.marketingOrderItems, s.maps.marketingOrder],
  )

  const pickOrderLine = (id: string | null) => {
    setOrderItemId(id)
    const line = id ? s.maps.marketingOrderItem.get(id) : undefined
    if (!line) return
    setProductId(line.productId)
    if (!qty) setQty(String(line.qty))
    setRequiredDate(toDateInput(line.requiredDate))
  }

  const errors = {
    product: !productId ? 'Choose the product.' : null,
    qty: !(Number(qty) > 0) ? 'Enter the quantity.' : null,
    date: !requiredDate ? 'Set the required date.' : null,
    explanation: !explanation.trim() ? 'Say in one sentence why this quantity is needed.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const demand: Demand = editing
      ? {
          ...editing,
          source,
          productId: productId!,
          qty: Number(qty),
          requiredDate: fromInput(requiredDate),
          explanation: explanation.trim(),
          orderItemId: source === 'customer' ? orderItemId : null,
        }
      : {
          id: newId('dmd'),
          code: nextCode(
            s.state.demands.map((d) => d.code),
            'DMD-',
            5,
          ),
          siteId: s.siteId,
          source,
          productId: productId!,
          qty: Number(qty),
          requiredDate: fromInput(requiredDate),
          status: 'open',
          orderItemId: source === 'customer' ? orderItemId : null,
          allocatedQty: 0,
          requirementQty: 0,
          moIds: [],
          explanation: explanation.trim(),
          createdAt: nowIso(),
        }
    s.dispatch({ type: 'demands/upsert', item: demand })
    onDone(demand)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New demand'}</DialogTitle>
        <DialogDescription>
          {editing
            ? `Allocated and produced quantities stay as recorded. Site ${s.site.name}.`
            : `Raised at ${s.site.name}. The line opens unresolved and can be allocated or sent to production.`}
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Source" required>
          <NativeSelect
            options={SOURCE_OPTIONS}
            value={source}
            onChange={(e) => setSource(e.target.value as DemandSource)}
          />
        </FormField>
        <FormField label="Required date" required error={show(errors.date)}>
          <Input
            type="date"
            value={requiredDate}
            onChange={(e) => setRequiredDate(e.target.value)}
            invalid={!!show(errors.date)}
          />
        </FormField>
        {source === 'customer' && (
          <FormField
            label="Order line"
            hint="Optional. Fills the product and quantity from the line."
            className="sm:col-span-2"
          >
            <Combobox
              items={orderLines}
              value={orderItemId}
              onChange={pickOrderLine}
              clearable
              placeholder="No order line"
              searchPlaceholder="Search order code or product"
              getKey={(x) => x.item.id}
              getLabel={(x) => `${x.order!.code} line ${x.item.line}`}
              getDescription={(x) => `${s.productName(x.item.productId)} × ${fmtNumber(x.item.qty)}`}
              getKeywords={(x) => [s.productCode(x.item.productId), s.productName(x.item.productId)]}
            />
          </FormField>
        )}
        <FormField label="Product" required error={show(errors.product)} className="sm:col-span-2">
          <ProductPicker value={productId} onChange={setProductId} invalid={!!show(errors.product)} />
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
        <FormField
          label="Why production is needed"
          required
          error={show(errors.explanation)}
          className="sm:col-span-2"
        >
          <Textarea
            value={explanation}
            onChange={(e) => setExplanation(e.target.value)}
            invalid={!!show(errors.explanation)}
            placeholder="One sentence, for example: Stock below reorder point after the September order."
            className="min-h-20"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Create demand'}</Button>
      </DialogFooter>
    </form>
  )
}
