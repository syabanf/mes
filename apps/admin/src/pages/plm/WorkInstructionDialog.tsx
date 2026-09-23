import { newId, nowIso } from '@mes/fixtures'
import type { WorkInstruction } from '@mes/types'
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
import { nextRev, wiCode } from './lib'

export interface WorkInstructionDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** The instruction whose header fields change; omit to create a draft. */
  editing?: WorkInstruction | null
}

export function WorkInstructionDialog({ open, onOpenChange, editing = null }: WorkInstructionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="sm">
        {open && <WorkInstructionForm editing={editing} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function WorkInstructionForm({ editing, onDone }: { editing: WorkInstruction | null; onDone: () => void }) {
  const s = useScoped()
  const navigate = useNavigate()
  const [productId, setProductId] = useState<string | null>(editing?.productId ?? null)
  const [title, setTitle] = useState(editing?.title ?? '')
  const [seq, setSeq] = useState(String(editing?.operationSeq ?? 10))
  const [rev, setRev] = useState(editing?.rev ?? 'R01')
  const [code, setCode] = useState(editing?.code ?? '')
  const [codeTouched, setCodeTouched] = useState(!!editing)
  const [tried, setTried] = useState(false)

  const product = productId ? s.maps.product.get(productId) : undefined
  const suggested = product && Number(seq) > 0 ? wiCode(product.code, Number(seq)) : ''
  const shownCode = codeTouched ? code : suggested

  const pickProduct = (id: string | null) => {
    setProductId(id)
    if (id && !editing) setRev(nextRev(s.workInstructions, id))
  }

  const errors = {
    product: !productId ? 'Choose the product.' : null,
    title: !title.trim() ? 'Give the instruction a title.' : null,
    seq: !(Number(seq) > 0) ? 'Enter the operation sequence.' : null,
    rev: !rev.trim() ? 'Enter the revision, such as R01.' : null,
    code: !shownCode.trim()
      ? 'Enter the code.'
      : s.workInstructions.some((x) => x.code === shownCode.trim() && x.id !== editing?.id)
        ? 'Another instruction already uses this code.'
        : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !productId) return
    const item: WorkInstruction = editing
      ? {
          ...editing,
          productId,
          title: title.trim(),
          operationSeq: Number(seq),
          rev: rev.trim(),
          code: shownCode.trim(),
        }
      : {
          id: newId('wi'),
          code: shownCode.trim(),
          productId,
          operationSeq: Number(seq),
          rev: rev.trim(),
          state: 'draft',
          title: title.trim(),
          steps: [],
          createdAt: nowIso(),
        }
    s.dispatch({ type: 'workInstructions/upsert', item })
    toast(editing ? 'Work instruction updated' : `Work instruction ${item.code} created`, { tone: 'success' })
    onDone()
    if (!editing) navigate(paths.workInstruction(item.id))
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{editing ? `Edit ${editing.code}` : 'New work instruction'}</DialogTitle>
        <DialogDescription>
          {editing
            ? 'Header fields only. Steps are edited on the page.'
            : 'Starts as an empty draft. Add steps on the next screen.'}
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <FormField label="Product" required error={show(errors.product)}>
          <ProductPicker value={productId} onChange={pickProduct} invalid={!!show(errors.product)} />
        </FormField>
        <FormField label="Title" required error={show(errors.title)}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Casting: pour and cool"
            invalid={!!show(errors.title)}
          />
        </FormField>
        <div className="gap-3 grid grid-cols-2">
          <FormField label="Operation seq" required error={show(errors.seq)}>
            <Input
              type="number"
              min={1}
              step={1}
              value={seq}
              onChange={(e) => setSeq(e.target.value)}
              invalid={!!show(errors.seq)}
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
        <FormField
          label="Code"
          required
          hint="Suggested from the product and operation"
          error={show(errors.code)}
        >
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
