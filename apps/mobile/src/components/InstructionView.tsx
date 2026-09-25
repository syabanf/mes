import type { InstructionStep, InstructionStepKind, WorkInstruction } from '@mes/types'
import { INSTRUCTION_STEP_LABEL } from '@mes/types'
import { Badge, KeyValue, cn } from '@mes/ui'
import {
  Check,
  FileText,
  Image as ImageIcon,
  ListChecks,
  Paperclip,
  Settings2,
  ShieldAlert,
  Video,
} from 'lucide-react'
import type { ReactNode } from 'react'

const STEP_ICON: Record<InstructionStepKind, ReactNode> = {
  text: <FileText />,
  checklist: <ListChecks />,
  image: <ImageIcon />,
  pdf: <Paperclip />,
  video: <Video />,
  safety: <ShieldAlert />,
  setup: <Settings2 />,
}

export const checkKey = (stepId: string, index: number) => `${stepId}:${index}`

/** Every checklist line of an instruction, so a screen can tell when all are ticked. */
export const checklistKeys = (wi: WorkInstruction) =>
  wi.steps.flatMap((step) =>
    step.kind === 'checklist' ? step.items.map((_, i) => checkKey(step.id, i)) : [],
  )

/** "Key: value" lines of a setup step become rows; any other body is one row. */
function setupItems(body: string) {
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const pairs = lines.map((l) => {
    const i = l.indexOf(':')
    return i > 0 ? { label: l.slice(0, i).trim(), value: l.slice(i + 1).trim() } : null
  })
  const all = pairs.filter((p) => !!p)
  return all.length && all.length === pairs.length ? all : [{ label: 'Setup', value: body }]
}

/** Operator-facing rendering of a work instruction: numbered steps, tickable checklists, safety callouts. */
export function InstructionView({
  instruction,
  checked,
  onToggle,
}: {
  instruction: WorkInstruction
  checked: Set<string>
  onToggle: (key: string) => void
}) {
  return (
    <ol className="space-y-3">
      {instruction.steps.map((step, i) => (
        <Step key={step.id} step={step} index={i} checked={checked} onToggle={onToggle} />
      ))}
    </ol>
  )
}

function Step({
  step,
  index,
  checked,
  onToggle,
}: {
  step: InstructionStep
  index: number
  checked: Set<string>
  onToggle: (key: string) => void
}) {
  const safety = step.kind === 'safety'
  return (
    <li
      className={cn(
        'p-4 rounded-[24px] shadow-card',
        safety ? 'bg-accent-soft text-accent-strong' : 'bg-card',
      )}
    >
      <div className="gap-3 flex items-start">
        <span
          className={cn(
            'size-10 text-sm font-bold flex shrink-0 items-center justify-center rounded-full tabular-nums',
            safety ? 'text-white bg-accent' : 'bg-surface',
          )}
        >
          {index + 1}
        </span>
        <div className="min-w-0 flex-1">
          <div className="gap-2 flex flex-wrap items-center">
            <span className={cn('[&_svg]:size-4', safety ? 'text-accent-strong' : 'text-muted')}>
              {STEP_ICON[step.kind]}
            </span>
            <h4 className="text-lg font-semibold leading-tight">{step.title}</h4>
            <Badge variant={safety ? 'accent' : 'outline'}>{INSTRUCTION_STEP_LABEL[step.kind]}</Badge>
          </div>
          {step.kind === 'setup' ? (
            <KeyValue
              bare
              labelWidth="md"
              className="mt-2 rounded-2xl px-3 bg-surface"
              items={setupItems(step.body)}
            />
          ) : (
            step.body && (
              <p
                className={cn(
                  'mt-1.5 text-base whitespace-pre-line',
                  safety ? 'text-accent-strong/90' : 'text-body',
                )}
              >
                {step.body}
              </p>
            )
          )}
          {step.kind === 'checklist' && step.items.length > 0 && (
            <ul className="mt-3 space-y-2">
              {step.items.map((item, idx) => {
                const key = checkKey(step.id, idx)
                const done = checked.has(key)
                return (
                  <li key={key}>
                    <button
                      type="button"
                      role="checkbox"
                      aria-checked={done}
                      onClick={() => onToggle(key)}
                      className="min-h-12 gap-3 rounded-2xl px-3 py-2 text-base flex w-full items-center bg-surface text-left transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]"
                    >
                      <span
                        className={cn(
                          'size-7 [&_svg]:size-4 flex shrink-0 items-center justify-center rounded-full border-2',
                          done ? 'text-white border-success bg-success' : 'border-border bg-card',
                        )}
                      >
                        {done && <Check strokeWidth={3} />}
                      </span>
                      <span className={cn('min-w-0 flex-1', done && 'text-muted line-through')}>{item}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {step.attachment && (
            <span className="mt-3 h-9 gap-2 px-3 text-xs font-semibold inline-flex items-center rounded-full bg-surface">
              <Paperclip className="size-3.5" />
              {step.attachment}
            </span>
          )}
        </div>
      </div>
    </li>
  )
}
