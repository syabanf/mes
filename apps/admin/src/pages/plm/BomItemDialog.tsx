import { newId } from '@mes/fixtures'
import type { Bom, BomItem } from '@mes/types'
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
  toast,
} from '@mes/ui'
import { type FormEvent, useMemo, useState } from 'react'
import { MaterialPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'

export interface BomItemDialogProps {
  bom: Bom
  /** The item to edit, or null to add a new one. */
  item: BomItem | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function BomItemDialog({ bom, item, open, onOpenChange }: BomItemDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <BomItemForm bom={bom} item={item} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function BomItemForm({ bom, item, onDone }: { bom: Bom; item: BomItem | null; onDone: () => void }) {
  const s = useScoped()
  const [materialId, setMaterialId] = useState<string | null>(item?.materialId ?? null)
  const [uomId, setUomId] = useState<string | null>(item?.uomId ?? null)
  const [qty, setQty] = useState(item ? String(item.qtyPerUnit) : '')
  const [scrap, setScrap] = useState(item ? String(Math.round(item.scrapFactor * 1000) / 10) : '0')
  const [seq, setSeq] = useState(item ? String(item.consumeAtSeq) : '10')
  const [substitutes, setSubstitutes] = useState<string[]>(item?.substituteMaterialIds ?? [])
  const [tried, setTried] = useState(false)

  const alternatives = useMemo(
    () => s.materials.filter((m) => m.active && m.id !== materialId),
    [s.materials, materialId],
  )

  const pickMaterial = (id: string | null) => {
    setMaterialId(id)
    const material = id ? s.maps.material.get(id) : undefined
    if (material) setUomId(material.uomId)
    setSubstitutes((prev) => prev.filter((x) => x !== id))
  }

  const errors = {
    material: !materialId
      ? 'Choose the material.'
      : bom.items.some((i) => i.materialId === materialId && i.id !== item?.id)
        ? 'This material is already on the BOM. Edit that line instead.'
        : null,
    uom: !uomId ? 'Choose the unit.' : null,
    qty: !(Number(qty) > 0) ? 'Enter a quantity above zero.' : null,
    scrap: !(Number(scrap) >= 0) ? 'Scrap cannot be negative.' : null,
    seq: !(Number(seq) > 0) ? 'Enter the operation sequence.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !materialId || !uomId) return
    const next: BomItem = {
      id: item?.id ?? newId('bomi'),
      materialId,
      qtyPerUnit: Number(qty),
      uomId,
      scrapFactor: Number(scrap) / 100,
      consumeAtSeq: Number(seq),
      substituteMaterialIds: substitutes,
      childBomId: item?.childBomId ?? null,
    }
    const items = item ? bom.items.map((i) => (i.id === item.id ? next : i)) : [...bom.items, next]
    s.dispatch({ type: 'boms/upsert', item: { ...bom, items } })
    toast(item ? 'BOM item updated' : 'BOM item added', { tone: 'success' })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{item ? s.materialName(item.materialId) : 'Add material'}</DialogTitle>
        <DialogDescription>
          {bom.code} · {bom.rev}. Quantity per finished unit, before scrap.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <FormField label="Material" required error={show(errors.material)}>
          <MaterialPicker value={materialId} onChange={pickMaterial} invalid={!!show(errors.material)} />
        </FormField>
        <div className="gap-3 sm:grid-cols-3 grid grid-cols-1">
          <FormField label="Qty per unit" required error={show(errors.qty)}>
            <Input
              type="number"
              min={0}
              step="any"
              value={qty}
              onChange={(e) => setQty(e.target.value)}
              invalid={!!show(errors.qty)}
            />
          </FormField>
          <FormField label="Unit" required error={show(errors.uom)}>
            <Combobox
              items={s.uoms}
              value={uomId}
              onChange={setUomId}
              placeholder="Select unit"
              searchPlaceholder="Search units"
              getKey={(u) => u.id}
              getLabel={(u) => u.code}
              getDescription={(u) => u.name}
              invalid={!!show(errors.uom)}
            />
          </FormField>
          <FormField label="Scrap %" error={show(errors.scrap)}>
            <Input
              type="number"
              min={0}
              step="0.1"
              value={scrap}
              onChange={(e) => setScrap(e.target.value)}
              invalid={!!show(errors.scrap)}
            />
          </FormField>
        </div>
        <div className="gap-3 sm:grid-cols-[8rem_1fr] grid grid-cols-1">
          <FormField label="Consume at op" required error={show(errors.seq)}>
            <Input
              type="number"
              min={1}
              step={1}
              value={seq}
              onChange={(e) => setSeq(e.target.value)}
              invalid={!!show(errors.seq)}
            />
          </FormField>
          <FormField label="Substitutes" hint="Materials the planner may swap in">
            <MultiCombobox
              items={alternatives}
              values={substitutes}
              onChange={setSubstitutes}
              placeholder="No substitutes"
              searchPlaceholder="Search code or name"
              getKey={(m) => m.id}
              getLabel={(m) => m.name}
              getDescription={(m) => m.code}
              getKeywords={(m) => [m.code]}
            />
          </FormField>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{item ? 'Save' : 'Add item'}</Button>
      </DialogFooter>
    </form>
  )
}
