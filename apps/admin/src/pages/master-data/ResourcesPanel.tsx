import { fmtNumber, newId, nowIso } from '@mes/fixtures'
import type { Machine, Resource, ResourceKind } from '@mes/types'
import {
  INTEGRATION_SYSTEM_LABEL,
  RESOURCE_KINDS,
  RESOURCE_KIND_LABEL,
  RESOURCE_STATUS_LABEL,
} from '@mes/types'
import { Badge, type Column, Input, ProgressBar, UnderlineTabs } from '@mes/ui'
import { useAuth } from '../../auth/auth'
import { MachineStateBadge, MaintenanceStateBadge } from '../../components/badges'
import { OrgNodePicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, YesNo, useEditor } from './entity'
import { nextMachineId, pick, usePanelTab } from './lib'

const TABS = [
  { value: 'machines', label: 'Machines' },
  { value: 'tool', label: 'Tools' },
  { value: 'mold', label: 'Molds' },
  { value: 'fixture', label: 'Fixtures' },
  { value: 'utility', label: 'Utilities' },
] as const

const MAPPED_SYSTEMS = ['oee', 'device_monitoring', 'cmms'] as const

export function ResourcesPanel() {
  const [tab, setTab] = usePanelTab(TABS)
  return (
    <div className="space-y-4">
      <UnderlineTabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]['value'])}
        items={[...TABS]}
      />
      {tab === 'machines' ? <Machines /> : <Resources kind={tab} />}
    </div>
  )
}

function Machines() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Machine>()
  const mappings = (machineId: string) =>
    s.state.integrationMappings.filter((m) => m.entityKind === 'machine' && m.internalId === machineId)
  const fields: Field<Machine>[] = [
    {
      key: 'id',
      label: 'Canonical id',
      kind: 'custom',
      span: 2,
      hint: 'Machine must have one canonical identity, shared by MES, OEE, Device Monitoring and CMMS.',
      render: (d) => (
        <div className="space-y-2">
          <Input value={d.id} readOnly inputClassName="bg-surface font-mono text-xs" />
          <div className="gap-1.5 flex flex-wrap">
            {MAPPED_SYSTEMS.map((sys) => {
              const m = mappings(d.id).find((x) => x.system === sys)
              return (
                <Badge key={sys} variant={m ? 'ink' : 'outline'} className="font-mono">
                  {INTEGRATION_SYSTEM_LABEL[sys]}: {m?.externalId ?? 'not mapped'}
                </Badge>
              )
            })}
          </div>
        </div>
      ),
    },
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'workCenterId',
      label: 'Work center',
      kind: 'custom',
      required: true,
      render: (d, set) => (
        <OrgNodePicker
          kind="work_center"
          value={d.workCenterId || null}
          onChange={(v) => set({ workCenterId: v ?? '' })}
        />
      ),
    },
    {
      key: 'lineId',
      label: 'Line',
      kind: 'custom',
      required: true,
      render: (d, set) => (
        <OrgNodePicker kind="line" value={d.lineId || null} onChange={(v) => set({ lineId: v ?? '' })} />
      ),
    },
    { key: 'model', label: 'Model', kind: 'text' },
    {
      key: 'eligibleProductIds',
      label: 'Eligible products',
      kind: 'multi',
      items: pick(
        s.products,
        (p) => p.name,
        (p) => p.code,
      ),
      hint: 'Empty means any product.',
    },
    { key: 'active', label: 'Active', kind: 'switch' },
  ]
  const columns: Column<Machine>[] = [
    {
      id: 'machine',
      header: 'Machine',
      sortValue: (x) => x.code,
      cell: (x) => (
        <div className="min-w-0">
          <p className="font-semibold">
            {x.code} <span className="font-normal text-muted">{x.name}</span>
          </p>
          <Mono>{x.id}</Mono>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <MachineStateBadge state={x.state} />
          </div>
        </div>
      ),
    },
    {
      id: 'wc',
      header: 'Work center',
      hideBelow: 'sm',
      sortValue: (x) => s.orgName(x.workCenterId),
      cell: (x) => `${s.orgName(x.workCenterId)} · ${s.orgName(x.lineId)}`,
    },
    { id: 'model', header: 'Model', hideBelow: 'lg', cell: (x) => x.model || <Muted>None</Muted> },
    { id: 'state', header: 'State', hideBelow: 'sm', cell: (x) => <MachineStateBadge state={x.state} /> },
    {
      id: 'maint',
      header: 'CMMS',
      hideBelow: 'md',
      cell: (x) => <MaintenanceStateBadge state={x.maintenanceState} />,
    },
    {
      id: 'mapped',
      header: 'Mappings',
      hideBelow: 'xl',
      cell: (x) => (
        <span className="gap-1 flex flex-wrap">
          {MAPPED_SYSTEMS.map((sys) => (
            <Badge key={sys} variant={mappings(x.id).some((m) => m.system === sys) ? 'ink' : 'outline'}>
              {INTEGRATION_SYSTEM_LABEL[sys]}
            </Badge>
          ))}
        </span>
      ),
    },
    { id: 'active', header: 'Active', hideBelow: 'md', cell: (x) => <YesNo value={x.active} /> },
  ]
  return (
    <>
      <EntityTable
        title="Machines"
        description="Shared manufacturing master. The canonical MACHINE id is the only key other systems reference."
        rows={s.machines}
        columns={columns}
        search={(x) => `${x.id} ${x.code} ${x.name} ${x.model}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'machines/remove', id: x.id })}
        removeBlocker={(x) =>
          s.workOrders.some((w) => w.machineId === x.id) ? 'Assigned to work orders' : null
        }
        removeLabel={(x) => x.code}
      />
      <EntityDialog
        size="lg"
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.code}` : 'New machine'}
        fields={fields}
        item={editor.item}
        blank={(): Machine => ({
          id: nextMachineId(s.state.machines),
          code: '',
          name: '',
          workCenterId: '',
          lineId: '',
          model: '',
          state: 'idle',
          maintenanceState: 'available',
          eligibleProductIds: [],
          telemetry: {
            at: nowIso(),
            temperatureC: null,
            speedRpm: null,
            currentA: null,
            pressureBar: null,
            vibrationMmS: null,
            counter: 0,
            alarm: null,
          },
          active: true,
        })}
        existing={s.state.machines}
        onSave={(item) => s.dispatch({ type: 'machines/upsert', item })}
      />
    </>
  )
}

function Resources({ kind }: { kind: ResourceKind }) {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Resource>()
  const rows = s.resources.filter((r) => r.kind === kind)
  const label = RESOURCE_KIND_LABEL[kind]
  const fields: Field<Resource>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'kind',
      label: 'Kind',
      kind: 'select',
      required: true,
      options: RESOURCE_KINDS.map((k) => ({ value: k, label: RESOURCE_KIND_LABEL[k] })),
    },
    {
      key: 'status',
      label: 'Status',
      kind: 'select',
      required: true,
      options: (['available', 'in_use', 'maintenance', 'retired'] as const).map((v) => ({
        value: v,
        label: RESOURCE_STATUS_LABEL[v],
      })),
    },
    {
      key: 'workCenterId',
      label: 'Work center',
      kind: 'custom',
      render: (d, set) => (
        <OrgNodePicker
          kind="work_center"
          clearable
          value={d.workCenterId}
          onChange={(v) => set({ workCenterId: v })}
        />
      ),
    },
    ...(kind === 'mold'
      ? [
          {
            key: 'cavities',
            label: 'Cavities per shot',
            kind: 'number',
            min: 1,
            step: 1,
          } satisfies Field<Resource>,
        ]
      : []),
    {
      key: 'usageCount',
      label: 'Usage count',
      kind: 'number',
      min: 0,
      step: 1,
      hint: 'Shots or cycles since the last refurbishment.',
    },
    {
      key: 'lifeLimit',
      label: 'Life limit',
      kind: 'number',
      min: 0,
      step: 1,
      hint: 'Leave empty when the resource has no wear limit.',
    },
  ]
  const columns: Column<Resource>[] = [
    {
      id: 'resource',
      header: label,
      sortValue: (x) => x.code,
      cell: (x) => (
        <div className="min-w-0">
          <p className="font-semibold">{x.name}</p>
          <Mono>{x.code}</Mono>
        </div>
      ),
    },
    { id: 'wc', header: 'Work center', hideBelow: 'sm', cell: (x) => s.orgName(x.workCenterId) },
    {
      id: 'status',
      header: 'Status',
      sortValue: (x) => x.status,
      cell: (x) => (
        <Badge
          variant={
            x.status === 'available'
              ? 'success'
              : x.status === 'in_use'
                ? 'info'
                : x.status === 'maintenance'
                  ? 'warning'
                  : 'muted'
          }
        >
          {RESOURCE_STATUS_LABEL[x.status]}
        </Badge>
      ),
    },
    ...(kind === 'mold'
      ? [
          {
            id: 'cav',
            header: 'Cavities',
            align: 'right',
            hideBelow: 'md',
            cell: (x) => x.cavities ?? <Muted>–</Muted>,
          } satisfies Column<Resource>,
        ]
      : []),
    {
      id: 'life',
      header: 'Usage / life',
      hideBelow: 'md',
      width: '11rem',
      sortValue: (x) => (x.lifeLimit ? x.usageCount / x.lifeLimit : null),
      cell: (x) =>
        x.lifeLimit ? (
          <div>
            <p className="mb-1 text-xs tabular-nums">
              {fmtNumber(x.usageCount)} / {fmtNumber(x.lifeLimit)}
            </p>
            <ProgressBar
              value={x.usageCount / x.lifeLimit}
              tone={x.usageCount / x.lifeLimit > 0.8 ? 'warning' : 'ink'}
              aria-label="Life used"
            />
          </div>
        ) : (
          <Muted>No limit</Muted>
        ),
    },
  ]
  return (
    <>
      <EntityTable
        key={kind}
        title={`${label}s`}
        rows={rows}
        columns={columns}
        search={(x) => `${x.code} ${x.name}`}
        canManage={manage}
        addLabel={`Add ${label.toLowerCase()}`}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'resources/remove', id: x.id })}
        removeBlocker={(x) =>
          s.workOrders.some((w) => w.toolIds.includes(x.id) || w.moldIds.includes(x.id))
            ? 'Assigned to work orders'
            : null
        }
        removeLabel={(x) => x.code}
        empty={`No ${label.toLowerCase()}s yet.`}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.code}` : `New ${label.toLowerCase()}`}
        fields={fields}
        item={editor.item}
        blank={(): Resource => ({
          id: newId(kind),
          code: '',
          name: '',
          kind,
          workCenterId: null,
          status: 'available',
          cavities: kind === 'mold' ? 1 : null,
          usageCount: 0,
          lifeLimit: null,
        })}
        existing={s.state.resources}
        onSave={(item) =>
          s.dispatch({
            type: 'resources/upsert',
            item: {
              ...item,
              lifeLimit: item.lifeLimit || null,
              cavities: item.kind === 'mold' ? item.cavities || null : null,
            },
          })
        }
      />
    </>
  )
}
