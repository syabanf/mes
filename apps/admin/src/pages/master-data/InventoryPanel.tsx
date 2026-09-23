import { fmtNumber, newId } from '@mes/fixtures'
import type {
  InventoryLocation,
  InventoryLocationKind,
  InventoryPolicy,
  LotRule,
  SerialRule,
} from '@mes/types'
import { LOCATION_KIND_LABEL } from '@mes/types'
import { Badge, type Column, Combobox, UnderlineTabs } from '@mes/ui'
import { useAuth } from '../../auth/auth'
import { ProductLink } from '../../components/links'
import { OrgNodePicker, ProductPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, useEditor } from './entity'
import { pick, usePanelTab } from './lib'

const TABS = [
  { value: 'locations', label: 'Inventory locations' },
  { value: 'policies', label: 'Inventory policies' },
  { value: 'lots', label: 'Lot rules' },
  { value: 'serials', label: 'Serial rules' },
] as const

const LOCATION_KINDS = Object.keys(LOCATION_KIND_LABEL) as InventoryLocationKind[]

export function InventoryPanel() {
  const [tab, setTab] = usePanelTab(TABS)
  const body = {
    locations: <Locations />,
    policies: <Policies />,
    lots: <LotRules />,
    serials: <SerialRules />,
  }[tab]
  return (
    <div className="space-y-4">
      <UnderlineTabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]['value'])}
        items={[...TABS]}
      />
      {body}
    </div>
  )
}

function Locations() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<InventoryLocation>()
  const fields: Field<InventoryLocation>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'kind',
      label: 'Kind',
      kind: 'select',
      required: true,
      options: LOCATION_KINDS.map((k) => ({ value: k, label: LOCATION_KIND_LABEL[k] })),
    },
    {
      key: 'orgNodeId',
      label: 'Org node',
      kind: 'custom',
      hint: 'Line or work center the location belongs to.',
      render: (d, set) => (
        <OrgNodePicker clearable value={d.orgNodeId} onChange={(v) => set({ orgNodeId: v })} />
      ),
    },
  ]
  const columns: Column<InventoryLocation>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-semibold">{x.name}</span>,
    },
    {
      id: 'kind',
      header: 'Kind',
      sortValue: (x) => x.kind,
      cell: (x) => <Badge variant="outline">{LOCATION_KIND_LABEL[x.kind]}</Badge>,
    },
    {
      id: 'org',
      header: 'Org node',
      hideBelow: 'md',
      cell: (x) => (x.orgNodeId ? s.orgPath(x.orgNodeId) : <Muted>Site level</Muted>),
    },
  ]
  return (
    <>
      <EntityTable
        title="Inventory locations"
        rows={s.inventoryLocations}
        columns={columns}
        search={(x) => `${x.code} ${x.name} ${LOCATION_KIND_LABEL[x.kind]}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'inventoryLocations/remove', id: x.id })}
        removeBlocker={(x) =>
          s.materialLots.some((l) => l.locationId === x.id) || s.wips.some((w) => w.locationId === x.id)
            ? 'Holds stock or WIP'
            : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New location'}
        fields={fields}
        item={editor.item}
        blank={(): InventoryLocation => ({
          id: newId('loc'),
          siteId: s.siteId,
          code: '',
          name: '',
          kind: 'warehouse',
          orgNodeId: null,
        })}
        existing={s.inventoryLocations}
        onSave={(item) => s.dispatch({ type: 'inventoryLocations/upsert', item })}
      />
    </>
  )
}

function Policies() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<InventoryPolicy>()
  const fields: Field<InventoryPolicy>[] = [
    {
      key: 'productId',
      label: 'Product',
      kind: 'custom',
      required: true,
      span: 2,
      render: (d, set) => (
        <ProductPicker value={d.productId || null} onChange={(v) => set({ productId: v ?? '' })} />
      ),
    },
    { key: 'safetyStock', label: 'Safety stock', kind: 'number', min: 0 },
    { key: 'minStock', label: 'Minimum stock', kind: 'number', min: 0 },
    { key: 'reorderPoint', label: 'Reorder point', kind: 'number', min: 0, required: true },
    { key: 'maxStock', label: 'Maximum stock', kind: 'number', min: 0, required: true },
    { key: 'replenishQty', label: 'Replenish quantity', kind: 'number', min: 0, required: true },
    {
      key: 'productionMultiple',
      label: 'Production multiple',
      kind: 'number',
      min: 1,
      required: true,
      hint: 'Orders round up to this batch size.',
    },
  ]
  const num = (v: number) => <span className="tabular-nums">{fmtNumber(v)}</span>
  const columns: Column<InventoryPolicy>[] = [
    {
      id: 'product',
      header: 'Product',
      sortValue: (x) => s.productName(x.productId),
      cell: (x) => <ProductLink productId={x.productId} />,
    },
    { id: 'safety', header: 'Safety', align: 'right', hideBelow: 'lg', cell: (x) => num(x.safetyStock) },
    { id: 'min', header: 'Min', align: 'right', hideBelow: 'md', cell: (x) => num(x.minStock) },
    {
      id: 'rop',
      header: 'Reorder',
      align: 'right',
      sortValue: (x) => x.reorderPoint,
      cell: (x) => num(x.reorderPoint),
    },
    { id: 'max', header: 'Max', align: 'right', hideBelow: 'sm', cell: (x) => num(x.maxStock) },
    { id: 'rq', header: 'Replenish', align: 'right', hideBelow: 'md', cell: (x) => num(x.replenishQty) },
    {
      id: 'mult',
      header: 'Multiple',
      align: 'right',
      hideBelow: 'lg',
      cell: (x) => num(x.productionMultiple),
    },
  ]
  return (
    <>
      <EntityTable
        title="Inventory policies"
        description="Per product: when the replenishment check proposes a make-to-stock order and how much."
        rows={s.inventoryPolicies}
        columns={columns}
        search={(x) => `${s.productName(x.productId)} ${s.productCode(x.productId)}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'inventoryPolicies/remove', id: x.id })}
        removeLabel={(x) => s.productName(x.productId)}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={
          editor.item ? `Edit policy for ${s.productName(editor.item.productId)}` : 'New inventory policy'
        }
        fields={fields}
        item={editor.item}
        blank={(): InventoryPolicy => ({
          id: newId('ipl'),
          siteId: s.siteId,
          productId: '',
          safetyStock: 0,
          minStock: 0,
          reorderPoint: 0,
          maxStock: 0,
          replenishQty: 0,
          productionMultiple: 1,
        })}
        existing={s.inventoryPolicies}
        uniqueKeys={['productId']}
        validate={(d) => ({
          ...(d.maxStock < d.reorderPoint
            ? { maxStock: 'Maximum has to be at or above the reorder point.' }
            : {}),
          ...(d.productionMultiple < 1 ? { productionMultiple: 'At least 1.' } : {}),
        })}
        onSave={(item) => s.dispatch({ type: 'inventoryPolicies/upsert', item })}
      />
    </>
  )
}

function LotRules() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<LotRule>()
  const itemName = (r: LotRule) =>
    r.itemKind === 'product' ? s.productName(r.itemId) : s.materialName(r.itemId)
  const fields: Field<LotRule>[] = [
    {
      key: 'itemKind',
      label: 'Applies to',
      kind: 'select',
      required: true,
      options: [
        { value: 'product', label: 'Product' },
        { value: 'material', label: 'Material' },
      ],
    },
    {
      key: 'itemId',
      label: 'Item',
      kind: 'custom',
      required: true,
      render: (d, set) => {
        const items =
          d.itemKind === 'product'
            ? pick(
                s.products,
                (p) => p.name,
                (p) => p.code,
              )
            : pick(
                s.materials,
                (m) => m.name,
                (m) => m.code,
              )
        return (
          <Combobox
            items={items}
            getKey={(x) => x.id}
            getLabel={(x) => x.label}
            getDescription={(x) => x.description}
            value={d.itemId || null}
            onChange={(v) => set({ itemId: v ?? '' })}
            placeholder={`Select ${d.itemKind}`}
            searchPlaceholder="Search"
          />
        )
      },
    },
    {
      key: 'pattern',
      label: 'Lot pattern',
      kind: 'text',
      required: true,
      mono: true,
      hint: 'Tokens: {YY} {MM} {DD} {SEQ}.',
    },
    {
      key: 'expiryDays',
      label: 'Expiry (days)',
      kind: 'number',
      min: 0,
      step: 1,
      hint: 'Leave empty when lots do not expire.',
    },
  ]
  const columns: Column<LotRule>[] = [
    {
      id: 'item',
      header: 'Item',
      sortValue: itemName,
      cell: (x) => <span className="font-semibold">{itemName(x)}</span>,
    },
    {
      id: 'kind',
      header: 'Kind',
      hideBelow: 'sm',
      cell: (x) => <Badge variant="outline">{x.itemKind === 'product' ? 'Product' : 'Material'}</Badge>,
    },
    { id: 'pattern', header: 'Pattern', cell: (x) => <Mono>{x.pattern}</Mono> },
    {
      id: 'expiry',
      header: 'Expiry',
      hideBelow: 'md',
      align: 'right',
      cell: (x) => (x.expiryDays ? `${x.expiryDays} days` : <Muted>None</Muted>),
    },
  ]
  return (
    <>
      <EntityTable
        title="Lot rules"
        rows={s.state.lotRules}
        columns={columns}
        search={(x) => `${itemName(x)} ${x.pattern}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'lotRules/remove', id: x.id })}
        removeLabel={(x) => `the rule for ${itemName(x)}`}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? 'Edit lot rule' : 'New lot rule'}
        fields={fields}
        item={editor.item}
        blank={(): LotRule => ({
          id: newId('lrl'),
          itemId: '',
          itemKind: 'material',
          pattern: 'LOT-{YY}{MM}-{SEQ}',
          expiryDays: null,
        })}
        existing={s.state.lotRules}
        uniqueKeys={['itemId']}
        onSave={(item) =>
          s.dispatch({ type: 'lotRules/upsert', item: { ...item, expiryDays: item.expiryDays || null } })
        }
      />
    </>
  )
}

function SerialRules() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<SerialRule>()
  const fields: Field<SerialRule>[] = [
    {
      key: 'productId',
      label: 'Product',
      kind: 'custom',
      required: true,
      span: 2,
      render: (d, set) => (
        <ProductPicker
          filter={(p) => p.serialControlled}
          value={d.productId || null}
          onChange={(v) => set({ productId: v ?? '' })}
        />
      ),
    },
    {
      key: 'pattern',
      label: 'Serial pattern',
      kind: 'text',
      required: true,
      mono: true,
      hint: 'Tokens: {PRODUCT} {YY} {SEQ}.',
    },
    { key: 'nextSeq', label: 'Next sequence', kind: 'number', min: 1, step: 1, required: true },
  ]
  const columns: Column<SerialRule>[] = [
    {
      id: 'product',
      header: 'Product',
      sortValue: (x) => s.productName(x.productId),
      cell: (x) => <ProductLink productId={x.productId} />,
    },
    { id: 'pattern', header: 'Pattern', cell: (x) => <Mono>{x.pattern}</Mono> },
    {
      id: 'next',
      header: 'Next',
      align: 'right',
      cell: (x) => <span className="tabular-nums">{x.nextSeq}</span>,
    },
  ]
  return (
    <>
      <EntityTable
        title="Serial rules"
        description="Only serial-controlled products can carry a rule."
        rows={s.state.serialRules}
        columns={columns}
        search={(x) => `${s.productName(x.productId)} ${x.pattern}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'serialRules/remove', id: x.id })}
        removeLabel={(x) => `the rule for ${s.productName(x.productId)}`}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? 'Edit serial rule' : 'New serial rule'}
        fields={fields}
        item={editor.item}
        blank={(): SerialRule => ({
          id: newId('srl'),
          productId: '',
          pattern: '{PRODUCT}-{YY}-{SEQ}',
          nextSeq: 1,
        })}
        existing={s.state.serialRules}
        uniqueKeys={['productId']}
        onSave={(item) => s.dispatch({ type: 'serialRules/upsert', item })}
      />
    </>
  )
}
