import { newId, nowIso } from '@mes/fixtures'
import type { Bom, Bop, Bor } from '@mes/types'
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
import { useNavigate } from 'react-router'
import { paths } from '../../components/links'
import { ProductPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { DOC_KIND_LABEL, type DocKind, docCode, nextRev } from './lib'

export interface DocDialogProps {
  kind: DocKind
  open: boolean
  onOpenChange: (open: boolean) => void
}

/** Creates an empty draft BOM, BOR or BOP for a product and opens it. */
export function DocDialog({ kind, open, onOpenChange }: DocDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && <DocForm kind={kind} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function DocForm({ kind, onDone }: { kind: DocKind; onDone: () => void }) {
  const s = useScoped()
  const navigate = useNavigate()
  const docs = kind === 'bom' ? s.boms : kind === 'bor' ? s.bors : s.bops
  const [productId, setProductId] = useState<string | null>(null)
  const [rev, setRev] = useState('R01')
  const [tried, setTried] = useState(false)
  const label = DOC_KIND_LABEL[kind]
  const product = productId ? s.maps.product.get(productId) : undefined
  const code = product ? docCode(kind, product.code, rev.trim()) : ''

  const pickProduct = (id: string | null) => {
    setProductId(id)
    if (id) setRev(nextRev(docs, id))
  }

  const errors = {
    product: !productId ? 'Choose the product the document describes.' : null,
    rev: !rev.trim()
      ? 'Enter the revision, such as R01.'
      : docs.some((d) => d.productId === productId && d.rev === rev.trim())
        ? 'This product already has that revision.'
        : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !productId) return
    const base = {
      id: newId(kind),
      code,
      productId,
      rev: rev.trim(),
      state: 'draft' as const,
      createdAt: nowIso(),
    }
    switch (kind) {
      case 'bom': {
        const item: Bom = { ...base, items: [] }
        s.dispatch({ type: 'boms/upsert', item })
        break
      }
      case 'bor': {
        const item: Bor = { ...base, items: [] }
        s.dispatch({ type: 'bors/upsert', item })
        break
      }
      case 'bop': {
        const item: Bop = { ...base, operations: [] }
        s.dispatch({ type: 'bops/upsert', item })
        break
      }
    }
    toast(`${label} ${code} created`, {
      tone: 'success',
      description: 'Add items, then submit it for review.',
    })
    onDone()
    navigate(paths[kind](base.id))
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>New {label}</DialogTitle>
        <DialogDescription>
          Starts as an empty draft. The code follows the product and revision.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <FormField label="Product" required error={show(errors.product)}>
          <ProductPicker value={productId} onChange={pickProduct} invalid={!!show(errors.product)} />
        </FormField>
        <div className="gap-3 grid grid-cols-2">
          <FormField label="Revision" required error={show(errors.rev)}>
            <Input
              value={rev}
              onChange={(e) => setRev(e.target.value.toUpperCase())}
              invalid={!!show(errors.rev)}
            />
          </FormField>
          <FormField label="Code" hint="Built from the product code">
            <Input value={code} readOnly placeholder={`${label}-…`} className="font-mono" />
          </FormField>
        </div>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Create draft</Button>
      </DialogFooter>
    </form>
  )
}
