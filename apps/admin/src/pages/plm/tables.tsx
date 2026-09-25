import { fmtIdr, fmtNumber, fmtPercent, workCenterForSite } from '@mes/fixtures'
import type {
  BomItem,
  BorItem,
  Bom,
  Bop,
  Bor,
  Characteristic,
  InstructionStep,
  InstructionStepKind,
  Operation,
  Specification,
  WorkInstruction,
} from '@mes/types'
import { INSTRUCTION_STEP_LABEL, MEASUREMENT_TYPE_LABEL, SPEC_KIND_LABEL } from '@mes/types'
import { Badge, Banner, Button, type Column, DataTable, EmptyState, KeyValue, cn } from '@mes/ui'
import {
  ArrowRight,
  CheckSquare,
  ChevronDown,
  FileText,
  Image,
  ListChecks,
  Lock,
  Paperclip,
  Pencil,
  ShieldAlert,
  Trash2,
  Video,
  Wrench,
} from 'lucide-react'
import type { ReactNode } from 'react'
import { Link } from 'react-router'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { bomUnitCost, fmtSeconds } from './lib'

// Shared tables for BOM, BOR, BOP, specifications and work instructions. The product detail tabs
// and the document pages render the same components, so a released document looks the same everywhere.
// Pass `onEdit` / `onRemove` to show row actions; the page owns the dialogs.

export function LockBadge() {
  return (
    <Badge variant="muted">
      <Lock />
      Released
    </Badge>
  )
}

export interface RowActionProps<T> {
  onEdit?: (item: T) => void
  onRemove?: (item: T) => void
}

function RowActions<T>({ item, label, onEdit, onRemove }: RowActionProps<T> & { item: T; label: string }) {
  return (
    <span className="gap-0.5 inline-flex items-center">
      {onEdit && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${label}`}
          onClick={(e) => {
            e.stopPropagation()
            onEdit(item)
          }}
        >
          <Pencil />
        </Button>
      )}
      {onRemove && (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Remove ${label}`}
          className="text-muted hover:text-danger"
          onClick={(e) => {
            e.stopPropagation()
            onRemove(item)
          }}
        >
          <Trash2 />
        </Button>
      )}
    </span>
  )
}

function CodeChips({ codes, empty = 'None' }: { codes: string[]; empty?: string }) {
  if (!codes.length) return <span className="text-xs text-muted">{empty}</span>
  return (
    <span className="gap-1 flex flex-wrap">
      {codes.map((c) => (
        <span key={c} className="px-2 py-0.5 rounded-full bg-surface font-mono text-[11px]">
          {c}
        </span>
      ))}
    </span>
  )
}

// ─── BOM ────────────────────────────────────────────────────────

export function BomTable({ bom, onEdit, onRemove }: { bom: Bom } & RowActionProps<BomItem>) {
  const s = useScoped()
  const material = (id: string) => s.maps.material.get(id)
  const total = bomUnitCost(bom, material)

  const columns: Column<BomItem>[] = [
    {
      id: 'material',
      header: 'Material',
      sortValue: (i) => s.materialName(i.materialId),
      cell: (i) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{s.materialName(i.materialId)}</p>
          <p className="font-mono text-[11px] text-muted">{material(i.materialId)?.code ?? i.materialId}</p>
          <p className="mt-1 sm:hidden text-[11px] text-muted">
            {fmtNumber(i.qtyPerUnit, 3)} {s.uomCode(i.uomId)} · scrap {fmtPercent(i.scrapFactor, 1)} · op{' '}
            {i.consumeAtSeq}
          </p>
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Qty per unit',
      align: 'right',
      sortValue: (i) => i.qtyPerUnit,
      cell: (i) => <span className="tabular-nums">{fmtNumber(i.qtyPerUnit, 3)}</span>,
    },
    { id: 'uom', header: 'UoM', hideBelow: 'sm', cell: (i) => s.uomCode(i.uomId) },
    {
      id: 'scrap',
      header: 'Scrap',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (i) => i.scrapFactor,
      cell: (i) => <span className="tabular-nums">{fmtPercent(i.scrapFactor, 1)}</span>,
    },
    {
      id: 'op',
      header: 'Consume at',
      align: 'right',
      hideBelow: 'md',
      sortValue: (i) => i.consumeAtSeq,
      cell: (i) => <span className="tabular-nums">Op {i.consumeAtSeq}</span>,
    },
    {
      id: 'subs',
      header: 'Substitutes',
      hideBelow: 'lg',
      cell: (i) => <CodeChips codes={i.substituteMaterialIds.map((id) => material(id)?.code ?? id)} />,
    },
    {
      id: 'cost',
      header: 'Line cost',
      align: 'right',
      hideBelow: 'md',
      sortValue: (i) => i.qtyPerUnit * (1 + i.scrapFactor) * (material(i.materialId)?.unitCostIdr ?? 0),
      cell: (i) => (
        <span className="tabular-nums">
          {fmtIdr(i.qtyPerUnit * (1 + i.scrapFactor) * (material(i.materialId)?.unitCostIdr ?? 0))}
        </span>
      ),
    },
  ]
  if (onEdit || onRemove)
    columns.push({
      id: 'actions',
      header: '',
      width: '5rem',
      align: 'right',
      cell: (i) => (
        <RowActions item={i} label={s.materialName(i.materialId)} onEdit={onEdit} onRemove={onRemove} />
      ),
    })

  return (
    <div>
      <DataTable
        columns={columns}
        rows={bom.items}
        getRowKey={(i) => i.id}
        pageSize={0}
        initialSort={{ id: 'op' }}
        empty="This BOM has no items."
      />
      <div className="mt-3 gap-2 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between bg-surface-2">
        <span className="text-sm text-muted">Material cost per unit, scrap included</span>
        <span className="text-base font-bold tabular-nums">{fmtIdr(total)}</span>
      </div>
    </div>
  )
}

// ─── BOR ────────────────────────────────────────────────────────

/** Work center name at the current site, or the bare code when this site has no such node. */
function useWorkCenterName() {
  const s = useScoped()
  return (code: string) => {
    const wc = workCenterForSite(s.orgNodes, s.siteId, code)
    return wc ? s.orgName(wc.id) : code
  }
}

export function BorTable({ bor, onEdit, onRemove }: { bor: Bor } & RowActionProps<BorItem>) {
  const s = useScoped()
  const workCenterName = useWorkCenterName()
  const resourceCodes = (ids: string[]) => ids.map((id) => s.maps.resource.get(id)?.code ?? id)
  const machineCodes = (ids: string[]) => ids.map((id) => s.maps.machine.get(id)?.code ?? id)
  const skillNames = (ids: string[]) => ids.map((id) => s.maps.skill.get(id)?.name ?? id)

  const columns: Column<BorItem>[] = [
    {
      id: 'op',
      header: 'Operation',
      sortValue: (i) => i.operationSeq,
      cell: (i) => (
        <div className="gap-3 flex items-start">
          <span className="size-9 rounded-xl text-xs font-bold flex shrink-0 items-center justify-center bg-surface tabular-nums">
            {i.operationSeq}
          </span>
          <div className="min-w-0">
            <p className="text-sm font-medium truncate">{workCenterName(i.workCenterCode)}</p>
            <p className="truncate text-[11px] text-muted">
              {i.operatorCount} operator{i.operatorCount === 1 ? '' : 's'} · setup {i.standardSetupMin} min ·
              cycle {fmtSeconds(i.standardCycleSec)}
            </p>
            <div className="mt-1.5 md:hidden">
              <CodeChips codes={machineCodes(i.machineIds)} empty="Any machine" />
            </div>
          </div>
        </div>
      ),
    },
    {
      id: 'machines',
      header: 'Machines',
      hideBelow: 'md',
      cell: (i) => <CodeChips codes={machineCodes(i.machineIds)} empty="Any machine" />,
    },
    {
      id: 'resources',
      header: 'Tools and molds',
      hideBelow: 'lg',
      cell: (i) => (
        <CodeChips codes={resourceCodes([...i.toolIds, ...i.moldIds, ...i.fixtureIds, ...i.utilityIds])} />
      ),
    },
    {
      id: 'skills',
      header: 'Skills',
      hideBelow: 'xl',
      cell: (i) => (
        <span className="text-xs">
          {skillNames(i.skillIds).join(', ') || <span className="text-muted">None</span>}
        </span>
      ),
    },
    {
      id: 'operators',
      header: 'Operators',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (i) => i.operatorCount,
      cell: (i) => <span className="tabular-nums">{i.operatorCount}</span>,
    },
    {
      id: 'setup',
      header: 'Setup',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (i) => i.standardSetupMin,
      cell: (i) => <span className="tabular-nums">{i.standardSetupMin} min</span>,
    },
    {
      id: 'cycle',
      header: 'Cycle',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (i) => i.standardCycleSec,
      cell: (i) => <span className="tabular-nums">{fmtSeconds(i.standardCycleSec)}</span>,
    },
    {
      id: 'labor',
      header: 'Labor / unit',
      align: 'right',
      hideBelow: 'md',
      sortValue: (i) => i.laborMinPerUnit,
      cell: (i) => <span className="tabular-nums">{fmtNumber(i.laborMinPerUnit, 2)} min</span>,
    },
  ]
  if (onEdit || onRemove)
    columns.push({
      id: 'actions',
      header: '',
      width: '5rem',
      align: 'right',
      cell: (i) => (
        <RowActions item={i} label={`operation ${i.operationSeq}`} onEdit={onEdit} onRemove={onRemove} />
      ),
    })

  return (
    <div>
      <DataTable
        columns={columns}
        rows={bor.items}
        getRowKey={(i) => i.id}
        pageSize={0}
        initialSort={{ id: 'op' }}
        empty="This BOR has no operations."
      />
    </div>
  )
}

// ─── BOP ────────────────────────────────────────────────────────

/** Compact "10 › 20 › 30" chip trail of a routing. */
export function OpTrail({ bop, className }: { bop: Bop; className?: string }) {
  const ops = [...bop.operations].sort((a, b) => a.seq - b.seq)
  if (!ops.length) return <span className="text-xs text-muted">No operations</span>
  return (
    <span className={cn('gap-1 inline-flex flex-wrap items-center', className)}>
      {ops.map((op, idx) => (
        <span key={op.id} className="gap-1 inline-flex items-center">
          {idx > 0 && <span className="text-[10px] text-muted">›</span>}
          <span
            className={cn(
              'px-2 py-0.5 rounded-full font-mono text-[11px]',
              op.qualityRequired ? 'bg-info-soft text-info' : 'bg-surface',
            )}
            title={`${op.code} · ${op.name}`}
          >
            {op.seq}
          </span>
        </span>
      ))}
    </span>
  )
}

export function BopTable({ bop, onEdit, onRemove }: { bop: Bop } & RowActionProps<Operation>) {
  const s = useScoped()
  const workCenterName = useWorkCenterName()
  const ops = [...bop.operations].sort((a, b) => a.seq - b.seq)

  return (
    <div className="space-y-2">
      {ops.length === 0 && (
        <EmptyState
          compact
          title="No operations"
          description="A routing needs at least one operation before it can be released."
        />
      )}
      {ops.map((op) => {
        const wi = op.workInstructionId ? s.maps.workInstruction.get(op.workInstructionId) : undefined
        return (
          <div
            key={op.id}
            className="gap-3 rounded-2xl p-3 sm:grid-cols-[2.5rem_1fr_auto] grid grid-cols-[2.5rem_1fr] items-start bg-surface-2"
          >
            <span className="size-10 rounded-xl text-xs font-bold flex items-center justify-center bg-card tabular-nums shadow-card">
              {op.seq}
            </span>
            <div className="min-w-0">
              <p className="gap-x-2 gap-y-1 flex flex-wrap items-center">
                <span className="text-sm font-semibold">{op.name}</span>
                <span className="font-mono text-[11px] text-muted">{op.code}</span>
                {op.parallel && <Badge variant="info">Parallel</Badge>}
                {op.qualityRequired && (
                  <Badge variant="warning" dot>
                    Quality check
                  </Badge>
                )}
              </p>
              <p className="mt-0.5 text-xs text-muted">
                {workCenterName(op.workCenterCode)} · setup {op.setupMin} min · cycle{' '}
                {fmtSeconds(op.cycleSec)} · queue {op.queueMin} min · transfer {op.transferMin} min
              </p>
              <p className="mt-1 gap-x-3 gap-y-1 text-xs flex flex-wrap items-center text-muted">
                <span>After: {op.predecessorSeqs.length ? op.predecessorSeqs.join(', ') : 'start'}</span>
                {op.reworkToSeq !== null && (
                  <span className="gap-1 inline-flex items-center">
                    Rework <ArrowRight className="size-3" /> op {op.reworkToSeq}
                  </span>
                )}
                {wi ? (
                  <Link
                    to={paths.workInstruction(wi.id)}
                    className="gap-1 font-medium inline-flex items-center text-foreground hover:text-accent"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <FileText className="size-3" /> {wi.code}
                  </Link>
                ) : (
                  <span>No work instruction</span>
                )}
              </p>
            </div>
            {(onEdit || onRemove) && (
              <div className="sm:col-start-3 col-start-2">
                <RowActions item={op} label={op.name} onEdit={onEdit} onRemove={onRemove} />
              </div>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Specifications ─────────────────────────────────────────────

const limit = (v: number | null, unit: string) =>
  v === null ? (
    <span className="text-muted">—</span>
  ) : (
    <span className="tabular-nums">{`${fmtNumber(v, 2)} ${unit}`.trim()}</span>
  )

export function CharacteristicsTable({
  spec,
  onEdit,
  onRemove,
}: { spec: Specification } & RowActionProps<Characteristic>) {
  const columns: Column<Characteristic>[] = [
    {
      id: 'name',
      header: 'Characteristic',
      sortValue: (c) => c.name,
      cell: (c) => (
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{c.name}</p>
          <p className="text-[11px] text-muted">
            {MEASUREMENT_TYPE_LABEL[c.type]} · op {c.operationSeq}
            <span className="sm:hidden">
              {c.target !== null && ` · target ${fmtNumber(c.target, 2)} ${c.unit}`}
              {c.min !== null &&
                c.max !== null &&
                ` · ${fmtNumber(c.min, 2)} to ${fmtNumber(c.max, 2)} ${c.unit}`}
            </span>
          </p>
        </div>
      ),
    },
    {
      id: 'target',
      header: 'Target',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (c) => c.target,
      cell: (c) => limit(c.target, c.unit),
    },
    {
      id: 'min',
      header: 'Min',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (c) => c.min,
      cell: (c) => limit(c.min, c.unit),
    },
    {
      id: 'max',
      header: 'Max',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (c) => c.max,
      cell: (c) => limit(c.max, c.unit),
    },
    {
      id: 'method',
      header: 'Method',
      hideBelow: 'md',
      cell: (c) => (
        <span className="text-xs">{c.method || <span className="text-muted">Not specified</span>}</span>
      ),
    },
    {
      id: 'op',
      header: 'Operation',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (c) => c.operationSeq,
      cell: (c) => <span className="tabular-nums">Op {c.operationSeq}</span>,
    },
  ]
  if (onEdit || onRemove)
    columns.push({
      id: 'actions',
      header: '',
      width: '5rem',
      align: 'right',
      cell: (c) => <RowActions item={c} label={c.name} onEdit={onEdit} onRemove={onRemove} />,
    })
  return (
    <DataTable
      columns={columns}
      rows={spec.characteristics}
      getRowKey={(c) => c.id}
      pageSize={0}
      initialSort={{ id: 'op' }}
      empty={`${SPEC_KIND_LABEL[spec.kind]} without characteristics yet.`}
    />
  )
}

// ─── Work instructions ──────────────────────────────────────────

const STEP_ICON: Record<InstructionStepKind, ReactNode> = {
  text: <FileText />,
  checklist: <ListChecks />,
  image: <Image />,
  pdf: <Paperclip />,
  video: <Video />,
  safety: <ShieldAlert />,
  setup: <Wrench />,
}

export function StepKindIcon({ kind, className }: { kind: InstructionStepKind; className?: string }) {
  return (
    <span
      title={INSTRUCTION_STEP_LABEL[kind]}
      className={cn(
        '[&_svg]:size-3.5 inline-flex',
        kind === 'safety' ? 'text-accent' : 'text-muted',
        className,
      )}
    >
      {STEP_ICON[kind]}
    </span>
  )
}

/** One icon per step, for table cells. */
export function StepKindTrail({ steps }: { steps: InstructionStep[] }) {
  if (!steps.length) return <span className="text-xs text-muted">No steps</span>
  return (
    <span className="gap-1 inline-flex flex-wrap items-center">
      {steps.map((st) => (
        <span key={st.id} className="size-6 rounded-lg flex items-center justify-center bg-surface">
          <StepKindIcon kind={st.kind} />
        </span>
      ))}
    </span>
  )
}

function SetupBlock({ body }: { body: string }) {
  // Setup steps carry "Parameter: value" lines; anything else renders as a plain sentence.
  const lines = body
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const pairs = lines.map((l) => l.split(':')).filter((p) => p.length >= 2)
  if (pairs.length === lines.length && pairs.length > 0) {
    return (
      <KeyValue
        bare
        className="rounded-2xl px-4 bg-surface-2"
        items={pairs.map(([label, ...rest]) => ({ label: label!.trim(), value: rest.join(':').trim() }))}
      />
    )
  }
  return <p className="rounded-2xl px-4 py-3 text-sm bg-surface-2">{body}</p>
}

function AttachmentChip({ kind, name }: { kind: InstructionStepKind; name: string }) {
  return (
    <span className="gap-2 px-3 py-1.5 text-xs font-medium inline-flex items-center rounded-full bg-surface">
      <StepKindIcon kind={kind} />
      <span className="truncate">{name}</span>
      <span className="text-[10px] text-muted uppercase">{INSTRUCTION_STEP_LABEL[kind]}</span>
    </span>
  )
}

export function StepBody({ step }: { step: InstructionStep }) {
  switch (step.kind) {
    case 'checklist':
      return (
        <ul className="space-y-1.5">
          {step.body && <li className="text-sm text-muted">{step.body}</li>}
          {step.items.map((item, idx) => (
            <li key={idx} className="gap-2 text-sm flex items-start">
              <CheckSquare className="mt-0.5 size-4 shrink-0 text-muted" />
              <span>{item}</span>
            </li>
          ))}
        </ul>
      )
    case 'safety':
      return (
        <Banner tone="danger" title="Safety">
          {step.body}
        </Banner>
      )
    case 'setup':
      return <SetupBlock body={step.body} />
    case 'image':
    case 'pdf':
    case 'video':
      return (
        <div className="space-y-2">
          {step.body && <p className="text-sm">{step.body}</p>}
          {step.attachment ? (
            <AttachmentChip kind={step.kind} name={step.attachment} />
          ) : (
            <span className="text-xs text-muted">Attachment missing</span>
          )}
        </div>
      )
    default:
      return <p className="text-sm whitespace-pre-line">{step.body}</p>
  }
}

/** The operator view of one instruction: an accordion of steps. */
export function InstructionSteps({
  wi,
  defaultOpen = true,
  onEdit,
  onRemove,
}: { wi: WorkInstruction; defaultOpen?: boolean } & RowActionProps<InstructionStep>) {
  if (!wi.steps.length)
    return (
      <EmptyState
        compact
        title="No steps"
        description="Add steps so the operator has something to follow at the station."
      />
    )
  return (
    <ol className="space-y-2">
      {wi.steps.map((step, idx) => (
        <li key={step.id}>
          <details open={defaultOpen} className="group rounded-2xl bg-surface-2">
            <summary className="gap-3 p-3 flex cursor-pointer list-none items-center [&::-webkit-details-marker]:hidden">
              <span className="size-8 rounded-xl text-xs font-bold flex shrink-0 items-center justify-center bg-card tabular-nums shadow-card">
                {idx + 1}
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-sm font-semibold block truncate">{step.title}</span>
                <span className="block text-[11px] text-muted">{INSTRUCTION_STEP_LABEL[step.kind]}</span>
              </span>
              <StepKindIcon kind={step.kind} />
              {(onEdit || onRemove) && (
                <RowActions item={step} label={step.title} onEdit={onEdit} onRemove={onRemove} />
              )}
              <ChevronDown className="size-4 text-muted transition-transform group-open:rotate-180" />
            </summary>
            <div className="px-3 pb-3 pl-14">
              <StepBody step={step} />
            </div>
          </details>
        </li>
      ))}
    </ol>
  )
}
