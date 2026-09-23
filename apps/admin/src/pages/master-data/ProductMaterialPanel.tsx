import { fmtIdr, newId } from '@mes/fixtures'
import type { Material, Product } from '@mes/types'
import { MATERIAL_CLASS_LABEL, STRATEGY_LABEL, STRATEGY_SHORT } from '@mes/types'
import { Badge, type Column, UnderlineTabs } from '@mes/ui'
import { useAuth } from '../../auth/auth'
import { StrategyBadge } from '../../components/badges'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, YesNo, useEditor } from './entity'
import { pick, usePanelTab } from './lib'
import { Categories, Conversions, Uoms } from './ProductMaterialUnits'

const TABS = [
  { value: 'products', label: 'Products' },
  { value: 'materials', label: 'Materials' },
  { value: 'categories', label: 'Categories' },
  { value: 'uoms', label: 'UOM' },
  { value: 'conversions', label: 'UOM conversions' },
] as const

export function ProductMaterialPanel() {
  const [tab, setTab] = usePanelTab(TABS)
  const body = {
    products: <Products />,
    materials: <Materials />,
    categories: <Categories />,
    uoms: <Uoms />,
    conversions: <Conversions />,
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

function Products() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Product>()
  const fields: Field<Product>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'categoryId',
      label: 'Category',
      kind: 'combobox',
      required: true,
      items: pick(
        s.categories.filter((c) => c.kind === 'product'),
        (c) => c.name,
        (c) => c.code,
      ),
    },
    {
      key: 'uomId',
      label: 'Unit',
      kind: 'combobox',
      required: true,
      items: pick(
        s.uoms,
        (u) => u.name,
        (u) => u.code,
      ),
    },
    { key: 'unitWeightG', label: 'Unit weight (g)', kind: 'number', min: 0 },
    {
      key: 'defaultStrategy',
      label: 'Default strategy',
      kind: 'select',
      options: (['mto', 'mts', 'hybrid'] as const).map((v) => ({ value: v, label: STRATEGY_LABEL[v] })),
    },
    { key: 'standardCostIdr', label: 'Standard cost (IDR)', kind: 'number', min: 0 },
    { key: 'lotControlled', label: 'Lot controlled', kind: 'switch' },
    { key: 'serialControlled', label: 'Serial controlled', kind: 'switch' },
    { key: 'active', label: 'Active', kind: 'switch' },
  ]
  const columns: Column<Product>[] = [
    {
      id: 'product',
      header: 'Product',
      sortValue: (x) => x.name,
      cell: (x) => (
        <div className="min-w-0">
          <p className="font-semibold">{x.name}</p>
          <Mono>{x.code}</Mono>
          <div className="mt-1.5 gap-1.5 sm:hidden flex">
            <StrategyBadge strategy={x.defaultStrategy} />
            {!x.active && <Badge variant="muted">Inactive</Badge>}
          </div>
        </div>
      ),
    },
    {
      id: 'category',
      header: 'Category',
      hideBelow: 'md',
      cell: (x) => s.maps.category.get(x.categoryId)?.name ?? <Muted>None</Muted>,
    },
    { id: 'uom', header: 'Unit', hideBelow: 'sm', cell: (x) => s.uomCode(x.uomId) },
    {
      id: 'strategy',
      header: 'Strategy',
      hideBelow: 'sm',
      sortValue: (x) => STRATEGY_SHORT[x.defaultStrategy],
      cell: (x) => <StrategyBadge strategy={x.defaultStrategy} />,
    },
    {
      id: 'control',
      header: 'Lot / serial',
      hideBelow: 'lg',
      cell: (x) =>
        `${x.lotControlled ? 'Lot' : ''}${x.lotControlled && x.serialControlled ? ' · ' : ''}${x.serialControlled ? 'Serial' : ''}` || (
          <Muted>None</Muted>
        ),
    },
    {
      id: 'cost',
      header: 'Std cost',
      hideBelow: 'xl',
      align: 'right',
      sortValue: (x) => x.standardCostIdr,
      cell: (x) => <span className="tabular-nums">{fmtIdr(x.standardCostIdr)}</span>,
    },
    { id: 'active', header: 'Active', hideBelow: 'sm', cell: (x) => <YesNo value={x.active} /> },
  ]
  return (
    <>
      <EntityTable
        title="Products"
        description="Finished goods. Engineering data per revision lives in PLM."
        rows={s.products}
        columns={columns}
        search={(x) => `${x.code} ${x.name}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'products/remove', id: x.id })}
        removeBlocker={(x) =>
          s.state.manufacturingOrders.some((m) => m.productId === x.id)
            ? 'Has manufacturing orders'
            : s.productRevisions.some((r) => r.productId === x.id)
              ? 'Has revisions in PLM'
              : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        size="lg"
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New product'}
        fields={fields}
        item={editor.item}
        blank={(): Product => ({
          id: newId('prd'),
          code: '',
          name: '',
          categoryId: '',
          uomId: s.uoms[0]?.id ?? '',
          unitWeightG: 0,
          defaultStrategy: 'mto',
          lotControlled: true,
          serialControlled: false,
          currentRevisionId: null,
          standardCostIdr: 0,
          active: true,
        })}
        existing={s.products}
        onSave={(item) => s.dispatch({ type: 'products/upsert', item })}
      />
    </>
  )
}

function Materials() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Material>()
  const fields: Field<Material>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'categoryId',
      label: 'Category',
      kind: 'combobox',
      required: true,
      items: pick(
        s.categories.filter((c) => c.kind === 'material'),
        (c) => c.name,
        (c) => c.code,
      ),
    },
    {
      key: 'materialClass',
      label: 'Class',
      kind: 'select',
      required: true,
      options: (['raw', 'consumable', 'packaging', 'semi_finished'] as const).map((v) => ({
        value: v,
        label: MATERIAL_CLASS_LABEL[v],
      })),
    },
    {
      key: 'uomId',
      label: 'Unit',
      kind: 'combobox',
      required: true,
      items: pick(
        s.uoms,
        (u) => u.name,
        (u) => u.code,
      ),
    },
    {
      key: 'supplierId',
      label: 'Default supplier',
      kind: 'combobox',
      clearable: true,
      items: pick(
        s.suppliers,
        (x) => x.name,
        (x) => x.code,
      ),
    },
    { key: 'unitCostIdr', label: 'Unit cost (IDR)', kind: 'number', min: 0 },
    { key: 'lotControlled', label: 'Lot controlled', kind: 'switch' },
    { key: 'active', label: 'Active', kind: 'switch' },
  ]
  const columns: Column<Material>[] = [
    {
      id: 'material',
      header: 'Material',
      sortValue: (x) => x.name,
      cell: (x) => (
        <div className="min-w-0">
          <p className="font-semibold">{x.name}</p>
          <Mono>{x.code}</Mono>
        </div>
      ),
    },
    {
      id: 'class',
      header: 'Class',
      hideBelow: 'sm',
      sortValue: (x) => x.materialClass,
      cell: (x) => MATERIAL_CLASS_LABEL[x.materialClass],
    },
    { id: 'uom', header: 'Unit', hideBelow: 'md', cell: (x) => s.uomCode(x.uomId) },
    {
      id: 'supplier',
      header: 'Supplier',
      hideBelow: 'lg',
      cell: (x) => (x.supplierId ? (s.maps.supplier.get(x.supplierId)?.name ?? '') : <Muted>None</Muted>),
    },
    {
      id: 'cost',
      header: 'Unit cost',
      hideBelow: 'xl',
      align: 'right',
      sortValue: (x) => x.unitCostIdr,
      cell: (x) => <span className="tabular-nums">{fmtIdr(x.unitCostIdr)}</span>,
    },
    { id: 'lot', header: 'Lot', hideBelow: 'lg', cell: (x) => <YesNo value={x.lotControlled} /> },
    { id: 'active', header: 'Active', hideBelow: 'sm', cell: (x) => <YesNo value={x.active} /> },
  ]
  return (
    <>
      <EntityTable
        title="Materials"
        rows={s.materials}
        columns={columns}
        search={(x) => `${x.code} ${x.name}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'materials/remove', id: x.id })}
        removeBlocker={(x) =>
          s.state.materialLots.some((l) => l.materialId === x.id)
            ? 'Has material lots'
            : s.boms.some((b) => b.items.some((i) => i.materialId === x.id))
              ? 'Used in a BOM'
              : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        size="lg"
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New material'}
        fields={fields}
        item={editor.item}
        blank={(): Material => ({
          id: newId('mat'),
          code: '',
          name: '',
          categoryId: '',
          materialClass: 'raw',
          uomId: s.uoms[0]?.id ?? '',
          lotControlled: true,
          supplierId: null,
          unitCostIdr: 0,
          active: true,
        })}
        existing={s.materials}
        onSave={(item) => s.dispatch({ type: 'materials/upsert', item })}
      />
    </>
  )
}
