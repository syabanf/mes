import { newId } from '@mes/fixtures'
import type { IntegrationMapping, NumberingSequence, Person, ReasonCode, ReasonKind } from '@mes/types'
import {
  INTEGRATION_SYSTEMS,
  INTEGRATION_SYSTEM_LABEL,
  LOGIN_METHOD_LABEL,
  REASON_KINDS,
  REASON_KIND_LABEL,
  ROLE_LABEL,
} from '@mes/types'
import { Badge, Banner, Chip, ChipRow, type Column, UnderlineTabs } from '@mes/ui'
import { useState } from 'react'
import { useAuth } from '../../auth/auth'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, YesNo, useEditor } from './entity'
import { usePanelTab } from './lib'
import { blankPerson, personFields } from './PeoplePanel'

const TABS = [
  { value: 'reasons', label: 'Reason codes' },
  { value: 'numbering', label: 'Numbering' },
  { value: 'users', label: 'Users' },
  { value: 'mappings', label: 'Integration mappings' },
] as const

const ENTITY_KINDS: IntegrationMapping['entityKind'][] = [
  'machine',
  'product',
  'material',
  'customer',
  'supplier',
  'operator',
  'location',
]

export function SystemPanel() {
  const [tab, setTab] = usePanelTab(TABS)
  const body = {
    reasons: <ReasonCodes />,
    numbering: <Numbering />,
    users: <Users />,
    mappings: <Mappings />,
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

function ReasonCodes() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<ReasonCode>()
  const [kind, setKind] = useState<ReasonKind | null>(null)
  const rows = kind ? s.reasonCodes.filter((r) => r.kind === kind) : s.reasonCodes
  const fields: Field<ReasonCode>[] = [
    {
      key: 'kind',
      label: 'Kind',
      kind: 'select',
      required: true,
      options: REASON_KINDS.map((k) => ({ value: k, label: REASON_KIND_LABEL[k] })),
    },
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'label', label: 'Label', kind: 'text', required: true, span: 2 },
    { key: 'active', label: 'Active', kind: 'switch' },
  ]
  const columns: Column<ReasonCode>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'label',
      header: 'Label',
      sortValue: (x) => x.label,
      cell: (x) => <span className="font-semibold">{x.label}</span>,
    },
    {
      id: 'kind',
      header: 'Kind',
      sortValue: (x) => x.kind,
      cell: (x) => <Badge variant="outline">{REASON_KIND_LABEL[x.kind]}</Badge>,
    },
    { id: 'active', header: 'Active', hideBelow: 'sm', cell: (x) => <YesNo value={x.active} /> },
  ]
  return (
    <>
      <ChipRow>
        <Chip variant="filter" active={!kind} count={s.reasonCodes.length} onClick={() => setKind(null)}>
          All
        </Chip>
        {REASON_KINDS.map((k) => (
          <Chip
            key={k}
            variant="filter"
            active={kind === k}
            count={s.reasonCodes.filter((r) => r.kind === k).length}
            onClick={() => setKind(kind === k ? null : k)}
          >
            {REASON_KIND_LABEL[k]}
          </Chip>
        ))}
      </ChipRow>
      <EntityTable
        title="Reason codes"
        description="Every scrap, reject, rework, hold, pause, downtime, change and return records one of these."
        rows={rows}
        columns={columns}
        search={(x) => `${x.code} ${x.label}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'reasonCodes/remove', id: x.id })}
        removeBlocker={(x) =>
          s.scrapRecords.some((r) => r.reasonCodeId === x.id) ||
          s.qualityHolds.some((h) => h.reasonCodeId === x.id)
            ? 'Used on records'
            : null
        }
        removeLabel={(x) => x.label}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.label}` : 'New reason code'}
        fields={fields}
        item={editor.item}
        blank={(): ReasonCode => ({
          id: newId('rsn'),
          kind: kind ?? 'scrap',
          code: '',
          label: '',
          active: true,
        })}
        existing={s.reasonCodes}
        onSave={(item) => s.dispatch({ type: 'reasonCodes/upsert', item })}
      />
    </>
  )
}

function Numbering() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<NumberingSequence>()
  const fields: Field<NumberingSequence>[] = [
    {
      key: 'entity',
      label: 'Entity',
      kind: 'text',
      required: true,
      mono: true,
      readOnly: !!editor.item,
      hint: 'The reducer looks sequences up by this key.',
    },
    { key: 'label', label: 'Label', kind: 'text', required: true },
    { key: 'prefix', label: 'Prefix', kind: 'text', required: true, mono: true },
    {
      key: 'pattern',
      label: 'Pattern',
      kind: 'text',
      required: true,
      mono: true,
      hint: 'Documentation of the shape, e.g. MO-{YYYY}-{SEQ:5}.',
    },
    { key: 'next', label: 'Next number', kind: 'number', min: 1, step: 1, required: true },
  ]
  const columns: Column<NumberingSequence>[] = [
    {
      id: 'label',
      header: 'Sequence',
      sortValue: (x) => x.label,
      cell: (x) => (
        <div className="min-w-0">
          <p className="font-semibold">{x.label}</p>
          <Mono>{x.entity}</Mono>
        </div>
      ),
    },
    { id: 'prefix', header: 'Prefix', cell: (x) => <Mono>{x.prefix}</Mono> },
    { id: 'pattern', header: 'Pattern', hideBelow: 'md', cell: (x) => <Mono>{x.pattern}</Mono> },
    {
      id: 'next',
      header: 'Next',
      align: 'right',
      sortValue: (x) => x.next,
      cell: (x) => <Mono>{`${x.prefix}${String(x.next).padStart(5, '0')}`}</Mono>,
    },
  ]
  return (
    <>
      <EntityTable
        title="Numbering sequences"
        rows={s.state.numbering}
        columns={columns}
        search={(x) => `${x.entity} ${x.label} ${x.prefix}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'numbering/remove', id: x.id })}
        removeLabel={(x) => x.label}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.label}` : 'New sequence'}
        fields={fields}
        item={editor.item}
        blank={(): NumberingSequence => ({
          id: newId('num'),
          entity: '',
          label: '',
          prefix: '',
          pattern: '',
          next: 1,
        })}
        existing={s.state.numbering}
        uniqueKeys={['entity']}
        onSave={(item) => s.dispatch({ type: 'numbering/upsert', item })}
      />
    </>
  )
}

function Users() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Person>()
  const columns: Column<Person>[] = [
    {
      id: 'name',
      header: 'User',
      sortValue: (x) => x.name,
      cell: (x) => (
        <div className="min-w-0">
          <p className="font-semibold">{x.name}</p>
          <p className="text-xs truncate text-muted">{x.email}</p>
        </div>
      ),
    },
    { id: 'role', header: 'Role', sortValue: (x) => x.role, cell: (x) => ROLE_LABEL[x.role] },
    { id: 'login', header: 'Login', hideBelow: 'sm', cell: (x) => LOGIN_METHOD_LABEL[x.loginMethod] },
    {
      id: 'badge',
      header: 'Badge',
      hideBelow: 'md',
      cell: (x) => <Mono>{x.badge || <Muted>None</Muted>}</Mono>,
    },
    {
      id: 'sites',
      header: 'Sites',
      hideBelow: 'lg',
      cell: (x) => x.siteIds.map((id) => s.maps.site.get(id)?.code ?? id).join(', '),
    },
  ]
  return (
    <>
      <EntityTable
        title="Users"
        description="Login identity and role. Skills, shift and work centers live under People."
        rows={s.state.people}
        columns={columns}
        search={(x) => `${x.name} ${x.email} ${ROLE_LABEL[x.role]} ${x.badge}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'people/remove', id: x.id })}
        removeBlocker={(x) => (x.id === s.user.id ? 'You are signed in as this user' : null)}
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New user'}
        fields={personFields(s, true)}
        item={editor.item}
        blank={() => blankPerson(s.siteId)}
        existing={s.state.people}
        uniqueKeys={['email', 'badge']}
        onSave={(item) => s.dispatch({ type: 'people/upsert', item })}
      />
    </>
  )
}

function Mappings() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<IntegrationMapping>()
  const internalName = (m: IntegrationMapping) => {
    switch (m.entityKind) {
      case 'machine':
        return s.maps.machine.get(m.internalId)?.code
      case 'product':
        return s.maps.product.get(m.internalId)?.name
      case 'material':
        return s.maps.material.get(m.internalId)?.name
      case 'customer':
        return s.maps.customer.get(m.internalId)?.name
      case 'supplier':
        return s.maps.supplier.get(m.internalId)?.name
      case 'operator':
        return s.maps.person.get(m.internalId)?.name
      case 'location':
        return s.maps.location.get(m.internalId)?.name
    }
  }
  const fields: Field<IntegrationMapping>[] = [
    {
      key: 'system',
      label: 'System',
      kind: 'select',
      required: true,
      options: INTEGRATION_SYSTEMS.map((x) => ({ value: x, label: INTEGRATION_SYSTEM_LABEL[x] })),
    },
    {
      key: 'entityKind',
      label: 'Entity kind',
      kind: 'select',
      required: true,
      options: ENTITY_KINDS.map((k) => ({ value: k, label: k[0]!.toUpperCase() + k.slice(1) })),
    },
    {
      key: 'internalId',
      label: 'Internal id',
      kind: 'text',
      required: true,
      mono: true,
      hint: 'The platform id, e.g. MACHINE-00001.',
    },
    { key: 'externalId', label: 'External id', kind: 'text', required: true, mono: true },
  ]
  const columns: Column<IntegrationMapping>[] = [
    {
      id: 'system',
      header: 'System',
      sortValue: (x) => x.system,
      cell: (x) => <Badge variant="ink">{INTEGRATION_SYSTEM_LABEL[x.system]}</Badge>,
    },
    {
      id: 'kind',
      header: 'Entity',
      sortValue: (x) => x.entityKind,
      cell: (x) => <Badge variant="outline">{x.entityKind}</Badge>,
    },
    {
      id: 'internal',
      header: 'Internal',
      sortValue: (x) => x.internalId,
      cell: (x) => (
        <div className="min-w-0">
          <p className="text-sm truncate">{internalName(x) ?? <Muted>Unknown record</Muted>}</p>
          <Mono>{x.internalId}</Mono>
        </div>
      ),
    },
    { id: 'external', header: 'External id', cell: (x) => <Mono>{x.externalId}</Mono> },
  ]
  return (
    <>
      <Banner tone="neutral" title="External ids never become primary keys">
        Other systems reference the platform id. Mappings translate at the boundary and can be replaced
        without touching any record.
      </Banner>
      <EntityTable
        title="Integration mappings"
        rows={s.state.integrationMappings}
        columns={columns}
        search={(x) =>
          `${INTEGRATION_SYSTEM_LABEL[x.system]} ${x.entityKind} ${x.internalId} ${x.externalId} ${internalName(x) ?? ''}`
        }
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'integrationMappings/remove', id: x.id })}
        removeLabel={(x) => `${INTEGRATION_SYSTEM_LABEL[x.system]} mapping ${x.externalId}`}
        initialSort={{ id: 'system' }}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? 'Edit mapping' : 'New mapping'}
        fields={fields}
        item={editor.item}
        blank={(): IntegrationMapping => ({
          id: newId('map'),
          system: 'oee',
          entityKind: 'machine',
          internalId: '',
          externalId: '',
        })}
        existing={s.state.integrationMappings}
        validate={(d) =>
          s.state.integrationMappings.some(
            (m) =>
              m.id !== d.id &&
              m.system === d.system &&
              m.entityKind === d.entityKind &&
              m.internalId === d.internalId,
          )
            ? { internalId: 'This record is already mapped for that system.' }
            : {}
        }
        onSave={(item) => s.dispatch({ type: 'integrationMappings/upsert', item })}
      />
    </>
  )
}
