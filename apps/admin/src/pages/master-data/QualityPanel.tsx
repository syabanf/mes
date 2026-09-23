import { newId } from '@mes/fixtures'
import type { DefectCode, InspectionPlan, InspectionTrigger } from '@mes/types'
import { INSPECTION_TRIGGER_LABEL, SEVERITY_LABEL, SPEC_KIND_LABEL } from '@mes/types'
import { Badge, type Column, Combobox, UnderlineTabs } from '@mes/ui'
import { useAuth } from '../../auth/auth'
import { SeverityBadge } from '../../components/badges'
import { ProductLink } from '../../components/links'
import { ProductPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, YesNo, useEditor } from './entity'
import { usePanelTab } from './lib'

const TABS = [
  { value: 'defects', label: 'Defect codes' },
  { value: 'plans', label: 'Inspection plans' },
] as const

const TRIGGERS = Object.keys(INSPECTION_TRIGGER_LABEL) as InspectionTrigger[]

export function QualityPanel() {
  const [tab, setTab] = usePanelTab(TABS)
  return (
    <div className="space-y-4">
      <UnderlineTabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]['value'])}
        items={[...TABS]}
      />
      {tab === 'defects' ? <DefectCodes /> : <InspectionPlans />}
    </div>
  )
}

function DefectCodes() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<DefectCode>()
  const fields: Field<DefectCode>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'category',
      label: 'Category',
      kind: 'text',
      required: true,
      hint: 'Surface, dimension, weight, packaging and so on.',
    },
    {
      key: 'severity',
      label: 'Severity',
      kind: 'select',
      required: true,
      options: (['minor', 'major', 'critical'] as const).map((v) => ({ value: v, label: SEVERITY_LABEL[v] })),
    },
    { key: 'active', label: 'Active', kind: 'switch' },
  ]
  const columns: Column<DefectCode>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-semibold">{x.name}</span>,
    },
    {
      id: 'category',
      header: 'Category',
      hideBelow: 'sm',
      sortValue: (x) => x.category,
      cell: (x) => <Badge variant="outline">{x.category}</Badge>,
    },
    {
      id: 'severity',
      header: 'Severity',
      sortValue: (x) => x.severity,
      cell: (x) => <SeverityBadge severity={x.severity} />,
    },
    { id: 'active', header: 'Active', hideBelow: 'md', cell: (x) => <YesNo value={x.active} /> },
  ]
  return (
    <>
      <EntityTable
        title="Defect codes"
        rows={s.defectCodes}
        columns={columns}
        search={(x) => `${x.code} ${x.name} ${x.category}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'defectCodes/remove', id: x.id })}
        removeBlocker={(x) =>
          s.defectRecords.some((d) => d.defectCodeId === x.id) ? 'Recorded on inspections' : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New defect code'}
        fields={fields}
        item={editor.item}
        blank={(): DefectCode => ({
          id: newId('dfc'),
          code: '',
          name: '',
          category: '',
          severity: 'minor',
          active: true,
        })}
        existing={s.defectCodes}
        onSave={(item) => s.dispatch({ type: 'defectCodes/upsert', item })}
      />
    </>
  )
}

function InspectionPlans() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<InspectionPlan>()
  const fields: Field<InspectionPlan>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    {
      key: 'productId',
      label: 'Product',
      kind: 'custom',
      required: true,
      render: (d, set) => (
        <ProductPicker
          value={d.productId || null}
          onChange={(v) => set({ productId: v ?? '', specId: '' })}
        />
      ),
    },
    { key: 'operationSeq', label: 'Operation sequence', kind: 'number', min: 1, step: 10, required: true },
    {
      key: 'trigger',
      label: 'Trigger',
      kind: 'select',
      required: true,
      options: TRIGGERS.map((t) => ({ value: t, label: INSPECTION_TRIGGER_LABEL[t] })),
    },
    {
      key: 'specId',
      label: 'Specification',
      kind: 'custom',
      required: true,
      span: 2,
      render: (d, set) => {
        const specs = s.specifications.filter((x) => x.productId === d.productId)
        return (
          <Combobox
            items={specs}
            getKey={(x) => x.id}
            getLabel={(x) => x.code}
            getDescription={(x) =>
              `${SPEC_KIND_LABEL[x.kind]} · rev ${x.rev} · ${x.characteristics.length} characteristics`
            }
            value={d.specId || null}
            onChange={(v) => set({ specId: v ?? '' })}
            placeholder={d.productId ? 'Select specification' : 'Pick the product first'}
            searchPlaceholder="Search"
            disabled={!d.productId}
          />
        )
      },
    },
    { key: 'sampleSize', label: 'Sample size', kind: 'number', min: 1, step: 1, required: true },
    {
      key: 'every',
      label: 'Every',
      kind: 'number',
      min: 1,
      step: 1,
      required: true,
      hint: 'Batches, pieces or minutes between checks, depending on the trigger.',
    },
  ]
  const columns: Column<InspectionPlan>[] = [
    { id: 'code', header: 'Plan', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'product',
      header: 'Product',
      sortValue: (x) => s.productName(x.productId),
      cell: (x) => <ProductLink productId={x.productId} />,
    },
    { id: 'op', header: 'Op', align: 'right', hideBelow: 'sm', cell: (x) => x.operationSeq },
    { id: 'trigger', header: 'Trigger', hideBelow: 'sm', cell: (x) => INSPECTION_TRIGGER_LABEL[x.trigger] },
    {
      id: 'spec',
      header: 'Specification',
      hideBelow: 'md',
      cell: (x) => <Mono>{s.maps.specification.get(x.specId)?.code ?? <Muted>Missing</Muted>}</Mono>,
    },
    {
      id: 'sample',
      header: 'Sample / every',
      hideBelow: 'lg',
      align: 'right',
      cell: (x) => `${x.sampleSize} / ${x.every}`,
    },
  ]
  return (
    <>
      <EntityTable
        title="Inspection plans"
        description="When quality checks are requested during execution and which specification they measure."
        rows={s.inspectionPlans}
        columns={columns}
        search={(x) => `${x.code} ${s.productName(x.productId)} ${INSPECTION_TRIGGER_LABEL[x.trigger]}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'inspectionPlans/remove', id: x.id })}
        removeBlocker={(x) =>
          s.inspections.some((i) => i.planId === x.id) ? 'Inspections reference it' : null
        }
        removeLabel={(x) => x.code}
      />
      <EntityDialog
        size="lg"
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.code}` : 'New inspection plan'}
        fields={fields}
        item={editor.item}
        blank={(): InspectionPlan => ({
          id: newId('ipn'),
          code: '',
          productId: '',
          operationSeq: 10,
          trigger: 'start',
          specId: '',
          sampleSize: s.settings.defaultSampleSize,
          every: 1,
        })}
        existing={s.inspectionPlans}
        onSave={(item) => s.dispatch({ type: 'inspectionPlans/upsert', item })}
      />
    </>
  )
}
