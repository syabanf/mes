import { fmtDateShort, fmtIdr, fmtNumber } from '@mes/fixtures'
import type { BomItem } from '@mes/types'
import { Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, EmptyState, toast } from '@mes/ui'
import { Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { BomItemDialog } from './BomItemDialog'
import { DocShell } from './DocShell'
import { DOC_LIST_PATH, bomUnitCost, docUsage, isEditableState } from './lib'
import { BomTable } from './tables'

export function BomDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const bom = s.maps.bom.get(id)
  const [editing, setEditing] = useState<BomItem | null>(null)
  const [itemOpen, setItemOpen] = useState(false)
  const [removing, setRemoving] = useState<BomItem | null>(null)
  const usage = useMemo(() => docUsage(s.state, 'bomId', id), [s.state, id])

  if (!bom) {
    return (
      <Card>
        <EmptyState
          title="BOM not found"
          description="It may have been deleted or replaced by a newer revision."
          action={<BackButton fallback={DOC_LIST_PATH.bom} />}
        />
      </Card>
    )
  }

  const editable = can('plm.manage') && isEditableState(bom.state)
  const cost = bomUnitCost(bom, (mid) => s.maps.material.get(mid))
  const openItem = (item: BomItem | null) => {
    setEditing(item)
    setItemOpen(true)
  }

  return (
    <DocShell
      doc={bom}
      label="BOM"
      idPrefix="bom"
      listPath={DOC_LIST_PATH.bom}
      path={paths.bom}
      siblings={s.boms}
      usage={usage}
      save={(item) => s.dispatch({ type: 'boms/upsert', item })}
      remove={(docId) => s.dispatch({ type: 'boms/remove', id: docId })}
      title={s.productName(bom.productId)}
      subtitle="Bill of materials"
      metrics={[
        { label: 'Items', value: fmtNumber(bom.items.length) },
        { label: 'Material cost', value: fmtIdr(cost), unit: 'per unit' },
        {
          label: 'Used by',
          value: fmtNumber(usage.revisions.length),
          unit: `rev · ${usage.mos.length} orders`,
        },
        { label: 'Created', value: fmtDateShort(bom.createdAt) },
      ]}
      actions={
        editable ? (
          <Button variant="outline" onClick={() => openItem(null)}>
            <Plus />
            Add item
          </Button>
        ) : undefined
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Items</CardTitle>
          <p className="text-sm text-muted">
            Quantity per finished unit, the scrap allowance and the operation that consumes it.
          </p>
        </CardHeader>
        <CardContent>
          <BomTable
            bom={bom}
            onEdit={editable ? openItem : undefined}
            onRemove={editable ? setRemoving : undefined}
          />
        </CardContent>
      </Card>

      <BomItemDialog bom={bom} item={editing} open={itemOpen} onOpenChange={setItemOpen} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing ? s.materialName(removing.materialId) : 'item'}?`}
        description="The line leaves this draft. Released orders keep the snapshot they were created with."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (!removing) return
          s.dispatch({
            type: 'boms/upsert',
            item: { ...bom, items: bom.items.filter((i) => i.id !== removing.id) },
          })
          setRemoving(null)
          toast('BOM item removed', { tone: 'default' })
        }}
      />
    </DocShell>
  )
}
