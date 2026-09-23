import { fmtDateShort, fmtNumber, sumBy } from '@mes/fixtures'
import type { BorItem } from '@mes/types'
import { Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, EmptyState, toast } from '@mes/ui'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { BorItemDialog } from './BorItemDialog'
import { DocShell } from './DocShell'
import { DOC_LIST_PATH, docUsage, isEditableState } from './lib'
import { BorTable } from './tables'

export function BorDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const bor = s.maps.bor.get(id)
  const [editing, setEditing] = useState<BorItem | null>(null)
  const [itemOpen, setItemOpen] = useState(false)
  const [removing, setRemoving] = useState<BorItem | null>(null)
  const usage = useMemo(() => docUsage(s.state, 'borId', id), [s.state, id])

  if (!bor) {
    return (
      <Card>
        <EmptyState
          title="BOR not found"
          description="It may have been deleted or replaced by a newer revision."
          action={<BackButton fallback={DOC_LIST_PATH.bor} />}
        />
      </Card>
    )
  }

  const editable = can('plm.manage') && isEditableState(bor.state)
  const laborPerUnit = sumBy(bor.items, (i) => i.laborMinPerUnit)
  const setupTotal = sumBy(bor.items, (i) => i.standardSetupMin)
  const openItem = (item: BorItem | null) => {
    setEditing(item)
    setItemOpen(true)
  }

  return (
    <DocShell
      doc={bor}
      label="BOR"
      idPrefix="bor"
      listPath={DOC_LIST_PATH.bor}
      path={paths.bor}
      siblings={s.bors}
      usage={usage}
      save={(item) => s.dispatch({ type: 'bors/upsert', item })}
      remove={(docId) => s.dispatch({ type: 'bors/remove', id: docId })}
      title={s.productName(bor.productId)}
      subtitle="Bill of resources"
      metrics={[
        { label: 'Operations', value: fmtNumber(bor.items.length) },
        { label: 'Labor', value: fmtNumber(laborPerUnit, 1), unit: 'min per unit' },
        { label: 'Setup', value: fmtNumber(setupTotal), unit: 'min total' },
        {
          label: 'Used by',
          value: fmtNumber(usage.revisions.length),
          unit: `rev · ${usage.mos.length} orders`,
        },
      ]}
      actions={
        editable ? (
          <Button variant="outline" onClick={() => openItem(null)}>
            <Plus />
            Add operation
          </Button>
        ) : undefined
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Resources per operation</CardTitle>
          <p className="text-sm text-muted">
            Work center, eligible machines, tooling, skills and standard times. Created{' '}
            {fmtDateShort(bor.createdAt)}.
          </p>
        </CardHeader>
        <CardContent>
          <BorTable
            bor={bor}
            onEdit={editable ? openItem : undefined}
            onRemove={editable ? setRemoving : undefined}
          />
        </CardContent>
      </Card>

      <BorItemDialog bor={bor} item={editing} open={itemOpen} onOpenChange={setItemOpen} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove operation ${removing?.operationSeq ?? ''}?`}
        description="The line leaves this draft. Capacity planning stops counting its standard times."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (!removing) return
          s.dispatch({
            type: 'bors/upsert',
            item: { ...bor, items: bor.items.filter((i) => i.id !== removing.id) },
          })
          setRemoving(null)
          toast('BOR operation removed', { tone: 'default' })
        }}
      />
    </DocShell>
  )
}
