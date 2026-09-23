import { newId, nextCode, nowIso } from '@mes/fixtures'
import type { Eco } from '@mes/types'
import {
  Button,
  Chip,
  Combobox,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  FormField,
  Input,
  Textarea,
  toast,
} from '@mes/ui'
import { Check } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { RevisionBadge } from '../../components/badges'
import { ProductPicker, ReasonPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { ECO_AFFECTS, ECO_AFFECTS_LABEL, type EcoAffects, revisionsOf } from './lib'

export function EcoDialog({
  open,
  onOpenChange,
  productId,
  onSaved,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId?: string | null
  onSaved?: (eco: Eco) => void
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && (
          <EcoForm
            presetProductId={productId ?? null}
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

function EcoForm({
  presetProductId,
  onDone,
}: {
  presetProductId: string | null
  onDone: (saved: Eco | null) => void
}) {
  const { user, ecos, productRevisions, dispatch } = useScoped()
  const [title, setTitle] = useState('')
  const [productId, setProductId] = useState<string | null>(presetProductId)
  const [fromRevisionId, setFromRevisionId] = useState<string | null>(null)
  const [reasonId, setReasonId] = useState<string | null>(null)
  const [affects, setAffects] = useState<EcoAffects[]>([])
  const [description, setDescription] = useState('')
  const [tried, setTried] = useState(false)

  const revisions = useMemo(
    () => (productId ? revisionsOf(productRevisions, productId).filter((r) => r.state !== 'obsolete') : []),
    [productRevisions, productId],
  )
  const fromRevision =
    revisions.find((r) => r.id === fromRevisionId) ?? revisions.find((r) => r.state === 'released') ?? null

  const errors = {
    title: !title.trim() ? 'Give the change a title.' : null,
    product: !productId ? 'Choose the product.' : null,
    revision: productId && !fromRevision ? 'This product has no revision to change from.' : null,
    reason: !reasonId ? 'Choose the reason for the change.' : null,
    affects: !affects.length ? 'Pick at least one affected document.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const toggle = (a: EcoAffects) =>
    setAffects((list) => (list.includes(a) ? list.filter((x) => x !== a) : [...list, a]))

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const item: Eco = {
      id: newId('eco'),
      code: nextCode(
        ecos.map((x) => x.code),
        'ECO-',
        5,
      ),
      title: title.trim(),
      productId: productId!,
      fromRevisionId: fromRevision!.id,
      toRevisionId: null,
      reasonCodeId: reasonId!,
      description: description.trim(),
      status: 'draft',
      affects: ECO_AFFECTS.filter((a) => affects.includes(a)),
      requestedBy: user.id,
      requestedAt: nowIso(),
      effectiveFrom: null,
      approvals: [],
      releasedAt: null,
    }
    dispatch({ type: 'ecos/upsert', item })
    toast(`${item.code} created`, {
      tone: 'success',
      description: 'Submit it for review when the change is described.',
    })
    onDone(item)
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>New engineering change order</DialogTitle>
        <DialogDescription>
          Released data never changes in place. The ECO produces a new revision when it is released.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <FormField label="Title" required error={show(errors.title)}>
          <Input
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Reduce polishing cycle time"
            invalid={!!show(errors.title)}
          />
        </FormField>
        <div className="gap-3 sm:grid-cols-2 grid grid-cols-1">
          <FormField label="Product" required error={show(errors.product)}>
            <ProductPicker
              value={productId}
              onChange={(v) => {
                setProductId(v)
                setFromRevisionId(null)
              }}
              invalid={!!show(errors.product)}
            />
          </FormField>
          <FormField
            label="From revision"
            required
            error={show(errors.revision)}
            hint={!productId ? 'Choose a product first' : undefined}
          >
            <Combobox
              items={revisions}
              value={fromRevision?.id ?? null}
              onChange={setFromRevisionId}
              disabled={!productId}
              getKey={(r) => r.id}
              getLabel={(r) => r.rev}
              getDescription={(r) => `${r.state}${r.changeReason ? ` · ${r.changeReason}` : ''}`}
              renderIcon={(r) => <RevisionBadge state={r.state} />}
              placeholder="Select revision"
              searchPlaceholder="Search revisions"
              invalid={!!show(errors.revision)}
            />
          </FormField>
        </div>
        <FormField label="Reason" required error={show(errors.reason)}>
          <ReasonPicker
            kind="change"
            value={reasonId}
            onChange={setReasonId}
            invalid={!!show(errors.reason)}
          />
        </FormField>
        <FormField
          label="Affects"
          required
          error={show(errors.affects)}
          hint="Documents the new revision will replace"
        >
          <div className="gap-2 flex flex-wrap">
            {ECO_AFFECTS.map((a) => (
              <Chip
                key={a}
                variant="filter"
                active={affects.includes(a)}
                icon={affects.includes(a) ? <Check className="size-3.5" /> : undefined}
                onClick={() => toggle(a)}
              >
                {ECO_AFFECTS_LABEL[a]}
              </Chip>
            ))}
          </div>
        </FormField>
        <FormField label="Description" hint="What changes and why. Reviewers read this before approving.">
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="min-h-24"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={() => onDone(null)}>
          Cancel
        </Button>
        <Button type="submit">Create ECO</Button>
      </DialogFooter>
    </form>
  )
}
