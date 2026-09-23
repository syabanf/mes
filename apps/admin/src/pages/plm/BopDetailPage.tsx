import { fmtDateShort, fmtDuration, fmtNumber, sumBy } from '@mes/fixtures'
import type { Operation } from '@mes/types'
import { Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, EmptyState, toast } from '@mes/ui'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { DocShell } from './DocShell'
import { DOC_LIST_PATH, docUsage, isEditableState } from './lib'
import { OperationDialog } from './OperationDialog'
import { BopTable, OpTrail } from './tables'

export function BopDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const bop = s.maps.bop.get(id)
  const [editing, setEditing] = useState<Operation | null>(null)
  const [opOpen, setOpOpen] = useState(false)
  const [removing, setRemoving] = useState<Operation | null>(null)
  const usage = useMemo(() => docUsage(s.state, 'bopId', id), [s.state, id])

  if (!bop) {
    return (
      <Card>
        <EmptyState
          title="BOP not found"
          description="It may have been deleted or replaced by a newer revision."
          action={<BackButton fallback={DOC_LIST_PATH.bop} />}
        />
      </Card>
    )
  }

  const editable = can('plm.manage') && isEditableState(bop.state)
  const leadMin = sumBy(bop.operations, (o) => o.setupMin + o.queueMin + o.transferMin)
  const gates = bop.operations.filter((o) => o.qualityRequired).length
  const openOp = (op: Operation | null) => {
    setEditing(op)
    setOpOpen(true)
  }

  return (
    <DocShell
      doc={bop}
      label="BOP"
      idPrefix="bop"
      listPath={DOC_LIST_PATH.bop}
      path={paths.bop}
      siblings={s.bops}
      usage={usage}
      save={(item) => s.dispatch({ type: 'bops/upsert', item })}
      remove={(docId) => s.dispatch({ type: 'bops/remove', id: docId })}
      title={s.productName(bop.productId)}
      subtitle="Bill of process"
      metrics={[
        { label: 'Operations', value: fmtNumber(bop.operations.length) },
        { label: 'Fixed lead', value: fmtDuration(leadMin), unit: 'setup, queue, transfer' },
        { label: 'Quality gates', value: fmtNumber(gates) },
        {
          label: 'Used by',
          value: fmtNumber(usage.revisions.length),
          unit: `rev · ${usage.mos.length} orders`,
        },
      ]}
      actions={
        editable ? (
          <Button variant="outline" onClick={() => openOp(null)}>
            <Plus />
            Add operation
          </Button>
        ) : undefined
      }
    >
      <Card>
        <CardHeader action={<OpTrail bop={bop} />}>
          <CardTitle>Routing</CardTitle>
          <p className="text-sm text-muted">
            Ordered operations with their times, dependencies and quality gates. Created{' '}
            {fmtDateShort(bop.createdAt)}.
          </p>
        </CardHeader>
        <CardContent>
          <BopTable
            bop={bop}
            onEdit={editable ? openOp : undefined}
            onRemove={editable ? setRemoving : undefined}
          />
        </CardContent>
      </Card>

      <OperationDialog bop={bop} op={editing} open={opOpen} onOpenChange={setOpOpen} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove op ${removing?.seq ?? ''} ${removing?.name ?? ''}?`}
        description="Operations that list it as a predecessor drop that dependency."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (!removing) return
          const operations = bop.operations
            .filter((o) => o.id !== removing.id)
            .map((o) => ({
              ...o,
              predecessorSeqs: o.predecessorSeqs.filter((seq) => seq !== removing.seq),
              reworkToSeq: o.reworkToSeq === removing.seq ? null : o.reworkToSeq,
            }))
          s.dispatch({ type: 'bops/upsert', item: { ...bop, operations } })
          setRemoving(null)
          toast('Operation removed', { tone: 'default' })
        }}
      />
    </DocShell>
  )
}
