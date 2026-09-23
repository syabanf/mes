import { newId, nowIso } from '@mes/fixtures'
import type { SpecKind, Specification } from '@mes/types'
import { SPEC_KIND_LABEL } from '@mes/types'
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
import { useNavigate } from 'react-router'
import { paths } from '../../components/links'
import { ProductPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { nextRev, specCode } from './lib'

const KINDS: SpecKind[] = ['product', 'process', 'quality']
const KIND_OPTIONS = KINDS.map((k) => ({ value: k, label: SPEC_KIND_LABEL[k] }))

export interface SpecificationDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The specification whose header fields change; omit to create a draft. */
  editing?: Specification | null
}

export function SpecificationDialog({ open, onOpenChange, editing = null }: SpecificationDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && <SpecificationForm editing={editing} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function SpecificationForm({ editing, onDone }: { editing: Specification | null; onDone: () => void }) {
  const s = useScoped()
  const navigate = useNavigate()
  const [productId, setProductId] = useState<string | null>(editing?.productId ?? null)
  const [kind, setKind] = useState<SpecKind>(editing?.kind ?? 'product')
  const [rev, setRev] = useState(editing?.rev ?? 'R01')
  const [code, setCode] = useState(editing?.code ?? '')
  const [codeTouched, setCodeTouched] = useState(!!editing)
  const [tried, setTried] = useState(false)

  const product = productId ? s.maps.product.get(productId) : undefined
  const suggested = product ? specCode(product.code, kind) : ''
  const shownCode = codeTouched ? code : suggested

  const pickProduct = (id: string | null) => {
    setProductId(id)
    if (id && !editing) setRev(nextRev(s.specifications, id))
  }

  const errors = {
    product: !productId ? 'Choose the product.' : null,
    rev: !rev.trim() ? 'Enter the revision, such as R01.' : null,
    code: !shownCode.trim()
      ? 'Enter the code.'
      : s.specifications.some((x) => x.code === shownCode.trim() && x.id !== editing?.id)
        ? 'Another specification already uses this code.'
        : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !productId) return
    const item: Specification = editing
      ? { ...editing, productId, kind, rev: rev.trim(), code: shownCode.trim() }
      : {
          id: newId('spec'),
          code: shownCode.trim(),
          productId,
          rev: rev.trim(),
          kind,
          state: 'draft',
          characteristics: [],
          createdAt: nowIso(),
        }
    s.dispatch({ type: 'specifications/upsert', item })
    toast(editing ? 'Specification updated' : `Specification ${item.code} created`, { tone: 'success' })
    onDone()
    if (!editing) navigate(paths.specification(item.id))
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New specification'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Header fields only. Characteristics are edited on the page.'
            : 'Starts as an empty draft. Add characteristics on the next screen.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <FormField label="Product" required error={show(errors.product)}>
          <ProductPicker value={productId} onChange={pickProduct} invalid={!!show(errors.product)} />
        </FormField>
        <div className="gap-3 grid grid-cols-2">
          <FormField label="Kind">
            <NativeSelect
              options={KIND_OPTIONS}
              value={kind}
              onChange={(e) => setKind(e.target.value as SpecKind)}
            />
          </FormField>
          <FormField label="Revision" required error={show(errors.rev)}>
            <Input
              value={rev}
              onChange={(e) => setRev(e.target.value.toUpperCase())}
              invalid={!!show(errors.rev)}
            />
          </FormField>
        </div>
        <FormField label="Code" required hint="Suggested from the product and kind" error={show(errors.code)}>
          <Input
            value={shownCode}
            onChange={(e) => {
              setCodeTouched(true)
              setCode(e.target.value.toUpperCase())
            }}
            className="font-mono"
            invalid={!!show(errors.code)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{editing ? 'Save' : 'Create draft'}</Button>
      </DialogFooter>
    </form>
  )
}
