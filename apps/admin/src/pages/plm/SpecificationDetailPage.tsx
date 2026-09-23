import { fmtDateShort, fmtNumber } from '@mes/fixtures'
import type { Characteristic } from '@mes/types'
import { SPEC_KIND_LABEL } from '@mes/types'
import { Button, Card, CardContent, CardHeader, CardTitle, ConfirmDialog, EmptyState, toast } from '@mes/ui'
import { Pencil, Plus } from 'lucide-react'
import { useMemo, useState } from 'react'
import { useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { CharacteristicDialog } from './CharacteristicDialog'
import { DocShell } from './DocShell'
import { isEditableState, listUsage } from './lib'
import { SpecKindBadge } from './SpecificationsPage'
import { SpecificationDialog } from './SpecificationDialog'
import { CharacteristicsTable } from './tables'

const LIST_PATH = '/plm/specifications'

export function SpecificationDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const spec = s.maps.specification.get(id)
  const [editingHeader, setEditingHeader] = useState(false)
  const [editing, setEditing] = useState<Characteristic | null>(null)
  const [itemOpen, setItemOpen] = useState(false)
  const [removing, setRemoving] = useState<Characteristic | null>(null)
  const usage = useMemo(() => listUsage(s.state, 'specIds', id), [s.state, id])

  if (!spec) {
    return (
      <Card>
        <EmptyState
          title="Specification not found"
          description="It may have been deleted or replaced by a newer revision."
          action={<BackButton fallback={LIST_PATH} />}
        />
      </Card>
    )
  }

  const editable = can('plm.manage') && isEditableState(spec.state)
  const numeric = spec.characteristics.filter((c) => c.type === 'numeric').length
  const operations = new Set(spec.characteristics.map((c) => c.operationSeq)).size
  const openItem = (item: Characteristic | null) => {
    setEditing(item)
    setItemOpen(true)
  }

  return (
    <DocShell
      doc={spec}
      label="Specification"
      idPrefix="spec"
      listPath={LIST_PATH}
      path={paths.specification}
      siblings={s.specifications}
      usage={usage}
      save={(item) => s.dispatch({ type: 'specifications/upsert', item })}
      remove={(docId) => s.dispatch({ type: 'specifications/remove', id: docId })}
      title={s.productName(spec.productId)}
      subtitle={SPEC_KIND_LABEL[spec.kind]}
      badges={<SpecKindBadge kind={spec.kind} />}
      metrics={[
        { label: 'Characteristics', value: fmtNumber(spec.characteristics.length) },
        { label: 'Numeric', value: fmtNumber(numeric), unit: 'with limits' },
        { label: 'Operations', value: fmtNumber(operations), unit: 'measured at' },
        { label: 'Created', value: fmtDateShort(spec.createdAt) },
      ]}
      actions={
        editable ? (
          <>
            <Button variant="outline" onClick={() => setEditingHeader(true)}>
              <Pencil />
              Edit
            </Button>
            <Button variant="outline" onClick={() => openItem(null)}>
              <Plus />
              Add characteristic
            </Button>
          </>
        ) : undefined
      }
    >
      <Card>
        <CardHeader>
          <CardTitle>Characteristics</CardTitle>
          <p className="text-sm text-muted">
            What is measured, the target and limits, the method and the operation it is checked at.
          </p>
        </CardHeader>
        <CardContent>
          <CharacteristicsTable
            spec={spec}
            onEdit={editable ? openItem : undefined}
            onRemove={editable ? setRemoving : undefined}
          />
        </CardContent>
      </Card>

      <SpecificationDialog open={editingHeader} onOpenChange={setEditingHeader} editing={spec} />
      <CharacteristicDialog spec={spec} item={editing} open={itemOpen} onOpenChange={setItemOpen} />
      <ConfirmDialog
        open={!!removing}
        onOpenChange={(open) => !open && setRemoving(null)}
        title={`Remove ${removing?.name ?? 'characteristic'}?`}
        description="Inspections already recorded keep their measurements."
        confirmLabel="Remove"
        destructive
        onConfirm={() => {
          if (!removing) return
          s.dispatch({
            type: 'specifications/upsert',
            item: { ...spec, characteristics: spec.characteristics.filter((c) => c.id !== removing.id) },
          })
          setRemoving(null)
          toast('Characteristic removed', { tone: 'default' })
        }}
      />
    </DocShell>
  )
}
