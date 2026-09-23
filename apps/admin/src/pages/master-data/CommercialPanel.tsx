import { newId } from '@mes/fixtures'
import type { Customer, Supplier } from '@mes/types'
import { type Column, UnderlineTabs } from '@mes/ui'
import { useAuth } from '../../auth/auth'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, useEditor } from './entity'
import { pick, usePanelTab } from './lib'

const TABS = [
  { value: 'customers', label: 'Customers' },
  { value: 'suppliers', label: 'Suppliers' },
] as const

export function CommercialPanel() {
  const [tab, setTab] = usePanelTab(TABS)
  return (
    <div className="space-y-4">
      <UnderlineTabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]['value'])}
        items={[...TABS]}
      />
      {tab === 'customers' ? <Customers /> : <Suppliers />}
    </div>
  )
}

function Customers() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Customer>()
  const fields: Field<Customer>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'city', label: 'City', kind: 'text' },
    { key: 'contact', label: 'Contact person', kind: 'text' },
    { key: 'email', label: 'Email', kind: 'text' },
    {
      key: 'externalId',
      label: 'CRM id',
      kind: 'text',
      mono: true,
      hint: 'Mapped through integration mapping; never the primary key.',
    },
  ]
  const columns: Column<Customer>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-semibold">{x.name}</span>,
    },
    { id: 'city', header: 'City', hideBelow: 'sm', cell: (x) => x.city },
    { id: 'contact', header: 'Contact', hideBelow: 'md', cell: (x) => `${x.contact} · ${x.email}` },
    {
      id: 'ext',
      header: 'CRM id',
      hideBelow: 'lg',
      cell: (x) => (x.externalId ? <Mono>{x.externalId}</Mono> : <Muted>Not mapped</Muted>),
    },
  ]
  return (
    <>
      <EntityTable
        title="Customers"
        rows={s.customers}
        columns={columns}
        search={(x) => `${x.code} ${x.name} ${x.city} ${x.contact}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'customers/remove', id: x.id })}
        removeBlocker={(x) =>
          s.marketingOrders.some((o) => o.customerId === x.id) ? 'Has marketing orders' : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New customer'}
        fields={fields}
        item={editor.item}
        blank={(): Customer => ({
          id: newId('cus'),
          code: '',
          name: '',
          city: '',
          contact: '',
          email: '',
          externalId: null,
        })}
        existing={s.customers}
        onSave={(item) =>
          s.dispatch({ type: 'customers/upsert', item: { ...item, externalId: item.externalId || null } })
        }
      />
    </>
  )
}

function Suppliers() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Supplier>()
  const fields: Field<Supplier>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'city', label: 'City', kind: 'text' },
    { key: 'contact', label: 'Contact person', kind: 'text' },
    {
      key: 'materialIds',
      label: 'Materials supplied',
      kind: 'multi',
      span: 2,
      items: pick(
        s.materials,
        (m) => m.name,
        (m) => m.code,
      ),
    },
    {
      key: 'externalId',
      label: 'ERP id',
      kind: 'text',
      mono: true,
      hint: 'Mapped through integration mapping; never the primary key.',
    },
  ]
  const columns: Column<Supplier>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-semibold">{x.name}</span>,
    },
    { id: 'city', header: 'City', hideBelow: 'sm', cell: (x) => x.city },
    {
      id: 'materials',
      header: 'Materials',
      hideBelow: 'md',
      sortValue: (x) => x.materialIds.length,
      cell: (x) => (
        <span className="text-xs">
          {x.materialIds.map((id) => s.materialName(id)).join(', ') || <Muted>None</Muted>}
        </span>
      ),
    },
    {
      id: 'ext',
      header: 'ERP id',
      hideBelow: 'lg',
      cell: (x) => (x.externalId ? <Mono>{x.externalId}</Mono> : <Muted>Not mapped</Muted>),
    },
  ]
  return (
    <>
      <EntityTable
        title="Suppliers"
        rows={s.suppliers}
        columns={columns}
        search={(x) => `${x.code} ${x.name} ${x.city}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'suppliers/remove', id: x.id })}
        removeBlocker={(x) =>
          s.materials.some((m) => m.supplierId === x.id) ? 'Set as default supplier on a material' : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New supplier'}
        fields={fields}
        item={editor.item}
        blank={(): Supplier => ({
          id: newId('sup'),
          code: '',
          name: '',
          city: '',
          contact: '',
          materialIds: [],
          externalId: null,
        })}
        existing={s.suppliers}
        onSave={(item) =>
          s.dispatch({ type: 'suppliers/upsert', item: { ...item, externalId: item.externalId || null } })
        }
      />
    </>
  )
}
