import { addDays, fromInput, newId, nextCode, nowIso, nowMs, toDateInput, toIso } from '@mes/fixtures'
import type { FulfillmentStrategy, MarketingOrder, MarketingOrderItem, Priority } from '@mes/types'
import { PRIORITIES, PRIORITY_LABEL, STRATEGY_SHORT } from '@mes/types'
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
  Kicker,
  NativeSelect,
} from '@mes/ui'
import { Plus, Trash2 } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { useScoped } from '../state/scoped'
import { CustomerPicker, ProductPicker } from './pickers'

interface LineDraft {
  key: string
  productId: string | null
  qty: string
  strategy: FulfillmentStrategy
}

const STRATEGY_OPTIONS = (['mto', 'mts', 'hybrid'] as FulfillmentStrategy[]).map((s) => ({
  value: s,
  label: STRATEGY_SHORT[s],
}))
const PRIORITY_OPTIONS = PRIORITIES.map((p) => ({ value: p, label: PRIORITY_LABEL[p] }))

const newLine = (): LineDraft => ({ key: newId('ln'), productId: null, qty: '', strategy: 'mto' })

export function MarketingOrderDialog({
  open,
  onOpenChange,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved?: (order: MarketingOrder) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="lg">
        {open && (
          <MarketingOrderForm
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

function MarketingOrderForm({ onDone }: { onDone: (saved: MarketingOrder | null) => void }) {
  const { siteId, user, maps, marketingOrders, dispatch } = useScoped()
  const [customerId, setCustomerId] = useState<string | null>(null)
  const [requiredDate, setRequiredDate] = useState(toDateInput(toIso(addDays(nowMs(), 7))))
  const [priority, setPriority] = useState<Priority>('normal')
  const [reference, setReference] = useState('')
  const [note, setNote] = useState('')
  const [lines, setLines] = useState<LineDraft[]>([newLine()])
  const [tried, setTried] = useState(false)

  const setLine = (key: string, patch: Partial<LineDraft>) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, ...patch } : l)))
  const validLines = lines.filter((l) => l.productId && Number(l.qty) > 0)
  const errors = {
    customer: !customerId ? 'Choose the customer.' : null,
    date: !requiredDate ? 'Set the required delivery date.' : null,
    lines: validLines.length === 0 ? 'Add at least one line with a product and quantity.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const code = nextCode(
      marketingOrders.map((o) => o.code),
      'MKT-2026-',
      5,
    )
    const order: MarketingOrder = {
      id: newId('mkt'),
      code,
      siteId,
      customerId: customerId!,
      orderDate: nowIso(),
      requiredDate: fromInput(requiredDate),
      priority,
      reference,
      status: 'draft',
      note,
      createdBy: user.id,
      createdAt: nowIso(),
    }
    dispatch({ type: 'marketingOrders/upsert', item: order })
    validLines.forEach((l, i) => {
      const product = maps.product.get(l.productId!)!
      const item: MarketingOrderItem = {
        id: newId('mki'),
        orderId: order.id,
        line: (i + 1) * 10,
        productId: product.id,
        qty: Number(l.qty),
        uomId: product.uomId,
        requiredDate: order.requiredDate,
        strategy: l.strategy,
        status: 'open',
        allocatedQty: 0,
        producedQty: 0,
        deliveredQty: 0,
      }
      dispatch({ type: 'marketingOrderItems/upsert', item })
    })
    onDone(order)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>New marketing order</DialogTitle>
        <DialogDescription>
          Each line carries its own fulfillment strategy. Confirming the order raises a demand per line.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Customer" required error={show(errors.customer)} className="sm:col-span-2">
          <CustomerPicker value={customerId} onChange={setCustomerId} invalid={!!show(errors.customer)} />
        </FormField>
        <FormField label="Required delivery" required error={show(errors.date)}>
          <Input type="date" value={requiredDate} onChange={(e) => setRequiredDate(e.target.value)} />
        </FormField>
        <FormField label="Priority">
          <NativeSelect
            options={PRIORITY_OPTIONS}
            value={priority}
            onChange={(e) => setPriority(e.target.value as Priority)}
          />
        </FormField>
        <FormField label="Customer reference" hint="PO number or contract">
          <Input
            value={reference}
            onChange={(e) => setReference(e.target.value)}
            placeholder="PO-2026-0451"
          />
        </FormField>
        <FormField label="Note">
          <Input
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Packing or delivery remarks"
          />
        </FormField>
      </div>

      <div className="mt-5 flex items-center justify-between">
        <Kicker>Order lines</Kicker>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setLines((ls) => [...ls, newLine()])}
        >
          <Plus />
          Add line
        </Button>
      </div>
      {show(errors.lines) && <p className="mt-1 text-xs text-danger">{errors.lines}</p>}
      <div className="mt-2 space-y-2">
        {lines.map((line, i) => (
          <div
            key={line.key}
            className="gap-2 rounded-2xl p-3 sm:grid-cols-[minmax(0,1fr)_7rem_6.5rem_auto] sm:items-end grid grid-cols-1 bg-surface"
          >
            <FormField label={`Line ${(i + 1) * 10}`}>
              <ProductPicker
                variant="soft"
                value={line.productId}
                onChange={(productId) =>
                  setLine(line.key, {
                    productId,
                    strategy: productId
                      ? (maps.product.get(productId)?.defaultStrategy ?? 'mto')
                      : line.strategy,
                  })
                }
              />
            </FormField>
            <FormField label="Quantity">
              <Input
                variant="soft"
                type="number"
                min={1}
                inputMode="numeric"
                value={line.qty}
                onChange={(e) => setLine(line.key, { qty: e.target.value })}
                placeholder="0"
              />
            </FormField>
            <FormField label="Strategy">
              <NativeSelect
                variant="soft"
                options={STRATEGY_OPTIONS}
                value={line.strategy}
                onChange={(e) => setLine(line.key, { strategy: e.target.value as FulfillmentStrategy })}
              />
            </FormField>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label="Remove line"
              disabled={lines.length === 1}
              onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
            >
              <Trash2 />
            </Button>
          </div>
        ))}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">Create order</Button>
      </DialogFooter>
    </form>
  )
}
