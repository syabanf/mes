import { fmtNumber, newId } from '@mes/fixtures'
import type { Category, Uom, UomConversion } from '@mes/types'
import { Badge, type Column } from '@mes/ui'
import { useAuth } from '../../auth/auth'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, useEditor } from './entity'
import { pick } from './lib'

export function Categories() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Category>()
  const fields: Field<Category>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'kind',
      label: 'Applies to',
      kind: 'select',
      required: true,
      options: [
        { value: 'product', label: 'Products' },
        { value: 'material', label: 'Materials' },
      ],
    },
  ]
  const columns: Column<Category>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-semibold">{x.name}</span>,
    },
    {
      id: 'kind',
      header: 'Applies to',
      sortValue: (x) => x.kind,
      cell: (x) => <Badge variant="outline">{x.kind === 'product' ? 'Products' : 'Materials'}</Badge>,
    },
    {
      id: 'count',
      header: 'In use',
      hideBelow: 'sm',
      align: 'right',
      cell: (x) =>
        fmtNumber(
          (x.kind === 'product' ? s.products : s.materials).filter((i) => i.categoryId === x.id).length,
        ),
    },
  ]
  return (
    <>
      <EntityTable
        title="Categories"
        rows={s.categories}
        columns={columns}
        search={(x) => `${x.code} ${x.name}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'categories/remove', id: x.id })}
        removeBlocker={(x) =>
          [...s.products, ...s.materials].some((i) => i.categoryId === x.id)
            ? 'Still assigned to items'
            : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        size="sm"
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New category'}
        fields={fields}
        item={editor.item}
        blank={(): Category => ({ id: newId('cat'), code: '', name: '', kind: 'product' })}
        existing={s.categories}
        onSave={(item) => s.dispatch({ type: 'categories/upsert', item })}
      />
    </>
  )
}

export function Uoms() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Uom>()
  const fields: Field<Uom>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'precision',
      label: 'Decimals',
      kind: 'number',
      min: 0,
      step: 1,
      hint: 'Number of decimals a quantity in this unit carries.',
    },
  ]
  const columns: Column<Uom>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-semibold">{x.name}</span>,
    },
    { id: 'precision', header: 'Decimals', align: 'right', cell: (x) => x.precision },
  ]
  return (
    <>
      <EntityTable
        title="Units of measure"
        rows={s.uoms}
        columns={columns}
        search={(x) => `${x.code} ${x.name}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'uoms/remove', id: x.id })}
        removeBlocker={(x) =>
          [...s.products, ...s.materials].some((i) => i.uomId === x.id) ? 'Still used by items' : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        size="sm"
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New unit'}
        fields={fields}
        item={editor.item}
        blank={(): Uom => ({ id: newId('uom'), code: '', name: '', precision: 0 })}
        existing={s.uoms}
        onSave={(item) => s.dispatch({ type: 'uoms/upsert', item })}
      />
    </>
  )
}

export function Conversions() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<UomConversion>()
  const units = pick(
    s.uoms,
    (u) => u.name,
    (u) => u.code,
  )
  const items = [
    ...pick(
      s.products,
      (p) => p.name,
      (p) => `Product · ${p.code}`,
    ),
    ...pick(
      s.materials,
      (m) => m.name,
      (m) => `Material · ${m.code}`,
    ),
  ]
  const itemName = (id: string | null) =>
    id ? (s.maps.product.get(id)?.name ?? s.maps.material.get(id)?.name ?? 'Unknown item') : null
  const fields: Field<UomConversion>[] = [
    { key: 'fromUomId', label: 'From unit', kind: 'combobox', required: true, items: units },
    { key: 'toUomId', label: 'To unit', kind: 'combobox', required: true, items: units },
    {
      key: 'factor',
      label: 'Factor',
      kind: 'number',
      required: true,
      hint: '1 from-unit equals this many to-units.',
    },
    {
      key: 'itemId',
      label: 'Only for item',
      kind: 'combobox',
      clearable: true,
      items,
      hint: 'Leave empty for a general conversion.',
    },
  ]
  const columns: Column<UomConversion>[] = [
    { id: 'from', header: 'From', cell: (x) => s.uomCode(x.fromUomId) },
    { id: 'to', header: 'To', cell: (x) => s.uomCode(x.toUomId) },
    {
      id: 'factor',
      header: 'Factor',
      align: 'right',
      sortValue: (x) => x.factor,
      cell: (x) => <span className="tabular-nums">{fmtNumber(x.factor, 3)}</span>,
    },
    {
      id: 'item',
      header: 'Scope',
      hideBelow: 'sm',
      cell: (x) => itemName(x.itemId) ?? <Muted>General</Muted>,
    },
  ]
  return (
    <>
      <EntityTable
        title="UOM conversions"
        rows={s.state.uomConversions}
        columns={columns}
        search={(x) => `${s.uomCode(x.fromUomId)} ${s.uomCode(x.toUomId)} ${itemName(x.itemId) ?? ''}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'uomConversions/remove', id: x.id })}
        removeLabel={(x) => `${s.uomCode(x.fromUomId)} → ${s.uomCode(x.toUomId)}`}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? 'Edit conversion' : 'New conversion'}
        fields={fields}
        item={editor.item}
        blank={(): UomConversion => ({
          id: newId('cnv'),
          fromUomId: '',
          toUomId: '',
          factor: 1,
          itemId: null,
        })}
        existing={s.state.uomConversions}
        validate={(d) =>
          d.fromUomId && d.fromUomId === d.toUomId
            ? { toUomId: 'Pick a different unit.' }
            : d.factor <= 0
              ? { factor: 'Factor has to be above zero.' }
              : {}
        }
        onSave={(item) => s.dispatch({ type: 'uomConversions/upsert', item })}
      />
    </>
  )
}
