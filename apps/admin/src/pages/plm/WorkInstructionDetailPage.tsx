import { fmtDateShort, fmtNumber } from '@mes/fixtures'
import type { InstructionStep } from '@mes/types'
import { Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, EmptyState, toast } from '@mes/ui'
import { MonitorPlay, Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { DocShell } from './DocShell'
import { isEditableState, listUsage } from './lib'
import { StepDialog } from './StepDialog'
import { InstructionSteps, StepKindTrail } from './tables'
import { WorkInstructionDialog } from './WorkInstructionDialog'

const LIST_PATH = '/plm/work-instructions'

export function WorkInstructionDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const wi = s.maps.workInstruction.get(id)
  const [editingHeader, setEditingHeader] = useState(false)
  const [editing, setEditing] = useState<InstructionStep | null>(null)
  const [stepOpen, setStepOpen] = useState(false)
  const [removing, setRemoving] = useState<InstructionStep | null>(null)
  const usage = useMemo(() => listUsage(s.state, 'workInstructionIds', id), [s.state, id])
  const routedFrom = useMemo(
    () => s.bops.filter((b) => b.operations.some((o) => o.workInstructionId === id)),
    [s.bops, id],
  )

  if (!wi) {
    return (
      <Card>
        <EmptyState
          title="Work instruction not found"
          description="It may have been deleted or replaced by a newer revision."
          action={<BackButton fallback={LIST_PATH} />}
        />
      </Card>
    )
  }

  const editable = can('plm.manage') && isEditableState(wi.state)
  const checklists = wi.steps
    .filter((st) => st.kind === 'checklist')
    .reduce((n, st) => n + st.items.length, 0)
  const safety = wi.steps.filter((st) => st.kind === 'safety').length
  const openStep = (step: InstructionStep | null) => {
    setEditing(step)
    setStepOpen(true)
  }

  return (
    <DocShell
      doc={wi}
      label="Work instruction"
      idPrefix="wi"
      listPath={LIST_PATH}
      path={paths.workInstruction}
      siblings={s.workInstructions}
      usage={usage}
      save={(item) => s.dispatch({ type: 'workInstructions/upsert', item })}
      remove={(docId) => s.dispatch({ type: 'workInstructions/remove', id: docId })}
      title={wi.title}
      subtitle={`Operation ${wi.operationSeq}`}
      metrics={[
        { label: 'Steps', value: fmtNumber(wi.steps.length) },
        { label: 'Checklist lines', value: fmtNumber(checklists) },
        { label: 'Safety steps', value: fmtNumber(safety) },
        { label: 'Created', value: fmtDateShort(wi.createdAt) },
      ]}
      actions={
        <>
          <Button asChild variant="outline">
            <Link to={`/shopfloor/instructions?wi=${wi.id}`}>
              <MonitorPlay />
              Preview as operator
            </Link>
          </Button>
          {editable && (
            <>
              <Button variant="outline" onClick={() => setEditingHeader(true)}>
                <Pencil />
                Edit
              </Button>
              <Button variant="outline" onClick={() => openStep(null)}>
                <Plus />
                Add step
              </Button>
            </>
          )}
        </>
      }
    >
      <Card>
        <CardHeader action={<StepKindTrail steps={wi.steps} />}>
          <CardTitle>Steps</CardTitle>
          <p className="text-sm text-muted">
            In the order the operator follows them at the station.
            {routedFrom.length > 0 && (
              <>
                {' '}
                Routed from{' '}
                {routedFrom.map((b, idx) => (
                  <span key={b.id}>
                    {idx > 0 && ', '}
                    <Link
                      to={paths.bop(b.id)}
                      className="text-xs font-mono hover:text-accent hover:underline"
                    >
                      {b.code}
                    </Link>
                  </span>
                ))}
                .
              </>
            )}
          </p>
        </CardHeader>
        <CardContent>
          <InstructionSteps
            wi={wi}
            onEdit={editable ? openStep : undefined}
            onRemove={editable ? setRemoving : undefined}
          />
        </CardContent>
      </Card>

      <WorkInstructionDialog open={editingHeader} onOpenChange={setEditingHeader} editing={wi} />
      <StepDialog wi={wi} step={editing} open={stepOpen} onOpenChange={setStepOpen} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove "${removing?.title ?? 'step'}"?`}
        description="The following steps move up one position."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (!removing) return
          s.dispatch({
            type: 'workInstructions/upsert',
            item: { ...wi, steps: wi.steps.filter((st) => st.id !== removing.id) },
          })
          setRemoving(null)
          toast('Step removed', { tone: 'default' })
        }}
      />
    </DocShell>
  )
}
