import { newId } from '@mes/fixtures'
import type { InstructionStep, InstructionStepKind, WorkInstruction } from '@mes/types'
import { INSTRUCTION_STEP_LABEL } from '@mes/types'
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
  Textarea,
  toast,
} from '@mes/ui'
import { type FormEvent, useState } from 'react'
import { useScoped } from '../../state/scoped'
import { linesOf } from './lib'

const KINDS: InstructionStepKind[] = ['text', 'checklist', 'setup', 'safety', 'image', 'pdf', 'video']
const KIND_ITEMS = KINDS.map((k) => ({ id: k, label: INSTRUCTION_STEP_LABEL[k] }))
const KIND_HINT: Record<InstructionStepKind, string> = {
  text: 'A paragraph the operator reads.',
  checklist: 'Lines the operator ticks one by one.',
  setup: 'Parameter: value lines, rendered as a table.',
  safety: 'Shown as a warning before the work starts.',
  image: 'A picture with a caption.',
  pdf: 'A drawing or document to open.',
  video: 'A short clip to watch.',
}
const withAttachment = (kind: InstructionStepKind) => kind === 'image' || kind === 'pdf' || kind === 'video'

export interface StepDialogProps {
  wi: WorkInstruction
  /** The step to edit, or null to append a new one. */
  step: InstructionStep | null
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function StepDialog({ wi, step, open, onOpenChange }: StepDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">
        {open && <StepForm wi={wi} step={step} onDone={() => onOpenChange(false)} />}
      </DialogContent>
    </Dialog>
  )
}

function StepForm({
  wi,
  step,
  onDone,
}: {
  wi: WorkInstruction
  step: InstructionStep | null
  onDone: () => void
}) {
  const s = useScoped()
  const [kind, setKind] = useState<InstructionStepKind>(step?.kind ?? 'text')
  const [title, setTitle] = useState(step?.title ?? '')
  const [body, setBody] = useState(step?.body ?? '')
  const [items, setItems] = useState(step?.items.join('\n') ?? '')
  const [attachment, setAttachment] = useState(step?.attachment ?? '')
  const [tried, setTried] = useState(false)

  const errors = {
    title: !title.trim() ? 'Give the step a title.' : null,
    body:
      kind !== 'checklist' && !withAttachment(kind) && !body.trim() ? 'Write what the operator does.' : null,
    items: kind === 'checklist' && linesOf(items).length === 0 ? 'Add at least one line to tick.' : null,
    attachment: withAttachment(kind) && !attachment.trim() ? 'Name the file the operator opens.' : null,
  }
  const show = (m: string | null) => (tried ? (m ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean)) return
    const next: InstructionStep = {
      id: step?.id ?? newId('step'),
      kind,
      title: title.trim(),
      body: body.trim(),
      items: kind === 'checklist' ? linesOf(items) : [],
      attachment: withAttachment(kind) ? attachment.trim() : null,
    }
    const steps = step ? wi.steps.map((x) => (x.id === step.id ? next : x)) : [...wi.steps, next]
    s.dispatch({ type: 'workInstructions/upsert', item: { ...wi, steps } })
    toast(step ? 'Step updated' : 'Step added', { tone: 'success' })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>{step ? step.title : `Add step ${wi.steps.length + 1}`}</DialogTitle>
        <DialogDescription>
          {wi.code} · {wi.rev}. Steps show in order at the station.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-3">
        <div className="gap-3 sm:grid-cols-[10rem_1fr] grid grid-cols-1">
          <FormField label="Kind" hint={KIND_HINT[kind]}>
            <Combobox
              items={KIND_ITEMS}
              value={kind}
              onChange={(v) => setKind((v as InstructionStepKind | null) ?? 'text')}
              searchPlaceholder="Search kinds"
              getKey={(k) => k.id}
              getLabel={(k) => k.label}
            />
          </FormField>
          <FormField label="Title" required error={show(errors.title)}>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} invalid={!!show(errors.title)} />
          </FormField>
        </div>
        <FormField
          label={kind === 'checklist' ? 'Introduction' : kind === 'setup' ? 'Parameters' : 'Body'}
          required={kind !== 'checklist' && !withAttachment(kind)}
          hint={kind === 'setup' ? 'One "Parameter: value" per line' : undefined}
          error={show(errors.body)}
        >
          <Textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            className="min-h-24"
            invalid={!!show(errors.body)}
          />
        </FormField>
        {kind === 'checklist' && (
          <FormField label="Checklist items" required hint="One item per line" error={show(errors.items)}>
            <Textarea
              value={items}
              onChange={(e) => setItems(e.target.value)}
              className="min-h-28"
              invalid={!!show(errors.items)}
            />
          </FormField>
        )}
        {withAttachment(kind) && (
          <FormField
            label="Attachment"
            required
            hint="File name shown to the operator"
            error={show(errors.attachment)}
          >
            <Input
              value={attachment}
              onChange={(e) => setAttachment(e.target.value)}
              placeholder={
                kind === 'image' ? 'mold-setup.jpg' : kind === 'pdf' ? 'drawing-rev2.pdf' : 'pour-demo.mp4'
              }
              invalid={!!show(errors.attachment)}
            />
          </FormField>
        )}
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">{step ? 'Save' : 'Add step'}</Button>
      </DialogFooter>
    </form>
  )
}
