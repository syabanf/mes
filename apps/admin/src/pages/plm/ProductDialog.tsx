import { newId } from '@mes/fixtures'
import type { FulfillmentStrategy, Product } from '@mes/types'
import { STRATEGY_LABEL } from '@mes/types'
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
  Switch,
  toast,
} from '@mes/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { useScoped } from '../../state/scoped'

const STRATEGY_OPTIONS = (['mto', 'mts', 'hybrid'] as FulfillmentStrategy[]).map((s) => ({
  value: s,
  label: STRATEGY_LABEL[s],
}))

export function ProductDialog({
  open,
  onOpenChange,
  editing = null,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  editing?: Product | null
  onSaved?: (product: Product) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <ProductForm
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

function ProductForm({
  editing,
  onDone,
}: {
  editing: Product | null
  onDone: (saved: Product | null) => void
}) {
  const { categories, uoms, products, dispatch } = useScoped()
  const productCategories = useMemo(() => categories.filter((c) => c.kind === 'product'), [categories])
  const [code, setCode] = useState(editing?.code ?? '')
  const [name, setName] = useState(editing?.name ?? '')
  const [categoryId, setCategoryId] = useState<string | null>(editing?.categoryId ?? null)
  const [uomId, setUomId] = useState<string | null>(editing?.uomId ?? null)
  const [weight, setWeight] = useState(String(editing?.unitWeightG ?? ''))
  const [strategy, setStrategy] = useState<FulfillmentStrategy>(editing?.defaultStrategy ?? 'mts')
  const [lot, setLot] = useState(editing?.lotControlled ?? true)
  const [serial, setSerial] = useState(editing?.serialControlled ?? false)
  const [cost, setCost] = useState(String(editing?.standardCostIdr ?? ''))
  const [tried, setTried] = useState(false)

  const codeTaken = products.some(
    (p) => p.code.toLowerCase() === code.trim().toLowerCase() && p.id !== editing?.id,
  )
  const errors = {
    code: !code.trim()
      ? 'Enter a product code.'
      : codeTaken
        ? 'Another product already uses this code.'
        : null,
    name: !name.trim() ? 'Enter the product name.' : null,
    category: !categoryId ? 'Choose a category.' : null,
    uom: !uomId ? 'Choose the unit of measure.' : null,
    weight: !(Number(weight) >= 0) || weight === '' ? 'Enter the unit weight in grams.' : null,
    cost: !(Number(cost) >= 0) || cost === '' ? 'Enter the standard cost.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const item: Product = {
      id: editing?.id ?? newId('prd'),
      code: code.trim().toUpperCase(),
      name: name.trim(),
      categoryId: categoryId!,
      uomId: uomId!,
      unitWeightG: Number(weight),
      defaultStrategy: strategy,
      lotControlled: lot,
      serialControlled: serial,
      currentRevisionId: editing?.currentRevisionId ?? null,
      standardCostIdr: Number(cost),
      active: editing?.active ?? true,
    }
    dispatch({ type: 'products/upsert', item })
    toast(editing ? 'Product updated' : 'Product created', {
      tone: 'success',
      description: editing ? undefined : 'Add a revision with BOM, BOR and BOP before planning orders.',
    })
    onDone(item)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New product'}</DialogTitle>
        <DialogDescription>
          Master data only. Manufacturing definition lives in the revisions and changes through an ECO.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="gap-3 sm:grid-cols-[10rem_1fr] grid grid-cols-1">
          <FormField label="Code" required error={show(errors.code)}>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value)}
              placeholder="GB-100"
              invalid={!!show(errors.code)}
              className="font-mono"
            />
          </FormField>
          <FormField label="Name" required error={show(errors.name)}>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Gold bar 100 g"
              invalid={!!show(errors.name)}
            />
          </FormField>
        </div>
        <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
          <FormField label="Category" required error={show(errors.category)}>
            <Combobox
              items={productCategories}
              value={categoryId}
              onChange={setCategoryId}
              getKey={(c) => c.id}
              getLabel={(c) => c.name}
              getDescription={(c) => c.code}
              placeholder="Select category"
              searchPlaceholder="Search categories"
              invalid={!!show(errors.category)}
            />
          </FormField>
          <FormField label="Unit of measure" required error={show(errors.uom)}>
            <Combobox
              items={uoms}
              value={uomId}
              onChange={setUomId}
              getKey={(u) => u.id}
              getLabel={(u) => u.name}
              getDescription={(u) => u.code}
              getKeywords={(u) => [u.code]}
              placeholder="Select unit"
              searchPlaceholder="Search units"
              invalid={!!show(errors.uom)}
            />
          </FormField>
        </div>
        <div className="gap-3 sm:grid-cols-3 grid grid-cols-1">
          <FormField label="Unit weight (g)" required error={show(errors.weight)}>
            <Input
              type="number"
              min={0}
              step="any"
              value={weight}
              onChange={(e) => setWeight(e.target.value)}
              invalid={!!show(errors.weight)}
            />
          </FormField>
          <FormField label="Default strategy">
            <NativeSelect
              options={STRATEGY_OPTIONS}
              value={strategy}
              onChange={(e) => setStrategy(e.target.value as FulfillmentStrategy)}
            />
          </FormField>
          <FormField label="Standard cost (IDR)" required error={show(errors.cost)}>
            <Input
              type="number"
              min={0}
              step={1}
              value={cost}
              onChange={(e) => setCost(e.target.value)}
              invalid={!!show(errors.cost)}
            />
          </FormField>
        </div>
        <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
          <label className="gap-3 rounded-2xl px-4 py-3 flex items-center justify-between bg-surface-2">
            <span>
              <span className="text-sm font-medium block">Lot controlled</span>
              <span className="text-xs block text-muted">Finished goods receive a lot code</span>
            </span>
            <Switch checked={lot} onCheckedChange={setLot} aria-label="Lot controlled" />
          </label>
          <label className="gap-3 rounded-2xl px-4 py-3 flex items-center justify-between bg-surface-2">
            <span>
              <span className="text-sm font-medium block">Serial controlled</span>
              <span className="text-xs block text-muted">Each piece carries a serial number</span>
            </span>
            <Switch checked={serial} onCheckedChange={setSerial} aria-label="Serial controlled" />
          </label>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save changes' : 'Create product'}</Button>
      </DialogFooter>
    </form>
  )
}
