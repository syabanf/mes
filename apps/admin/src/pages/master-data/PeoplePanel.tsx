import { type Permission, can, newId } from '@mes/fixtures'
import type { Person, Skill, SkillLevel } from '@mes/types'
import { AVAILABILITY_LABEL, LOGIN_METHOD_LABEL, ROLES, ROLE_LABEL, SKILL_LEVEL_LABEL } from '@mes/types'
import {
  Avatar,
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  NativeSelect,
  UnderlineTabs,
} from '@mes/ui'
import { Check } from 'lucide-react'
import { useAuth } from '../../auth/auth'
import { ShiftPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, useEditor } from './entity'
import { pick, usePanelTab } from './lib'

const TABS = [
  { value: 'people', label: 'People' },
  { value: 'skills', label: 'Skills' },
  { value: 'roles', label: 'Roles & permissions' },
] as const

/** Same list as packages/fixtures/src/permissions.ts, kept local so the matrix has fixed columns. */
const PERMISSIONS: Permission[] = [
  'masterdata.manage',
  'plm.manage',
  'eco.approve',
  'order.manage',
  'demand.manage',
  'mo.manage',
  'mo.release',
  'wo.dispatch',
  'shopfloor.execute',
  'inventory.manage',
  'quality.execute',
  'quality.release',
  'planning.manage',
  'integration.manage',
]

const LEVELS: SkillLevel[] = [1, 2, 3, 4]
const AVAILABILITY_VARIANT = { on_shift: 'success', off_shift: 'muted', leave: 'warning' } as const

export function PeoplePanel() {
  const [tab, setTab] = usePanelTab(TABS)
  return (
    <div className="space-y-4">
      <UnderlineTabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]['value'])}
        items={[...TABS]}
      />
      {tab === 'people' ? <People /> : tab === 'skills' ? <Skills /> : <RoleMatrix />}
    </div>
  )
}

export function personFields(s: ReturnType<typeof useScoped>, loginOnly = false): Field<Person>[] {
  const identity: Field<Person>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    {
      key: 'role',
      label: 'Role',
      kind: 'select',
      required: true,
      options: ROLES.map((r) => ({ value: r, label: ROLE_LABEL[r] })),
    },
    { key: 'email', label: 'Email', kind: 'text', required: true },
  ]
  const login: Field<Person>[] = [
    {
      key: 'loginMethod',
      label: 'Login method',
      kind: 'select',
      required: true,
      options: (['rfid', 'nfc', 'qr', 'pin'] as const).map((v) => ({
        value: v,
        label: LOGIN_METHOD_LABEL[v],
      })),
    },
    { key: 'badge', label: 'Badge / tag', kind: 'text', mono: true, required: true },
  ]
  if (loginOnly) return [...identity, ...login]
  return [
    ...identity,
    {
      key: 'siteIds',
      label: 'Sites',
      kind: 'multi',
      required: true,
      items: pick(
        s.state.sites,
        (x) => x.name,
        (x) => x.code,
      ),
    },
    {
      key: 'shiftId',
      label: 'Shift',
      kind: 'custom',
      render: (d, set) => <ShiftPicker clearable value={d.shiftId} onChange={(v) => set({ shiftId: v })} />,
    },
    {
      key: 'workCenterIds',
      label: 'Qualified work centers',
      kind: 'multi',
      span: 2,
      items: pick(
        s.workCenters,
        (x) => x.name,
        (x) => x.code,
      ),
      hint: 'Empty means any work center.',
    },
    {
      key: 'skills',
      label: 'Skill levels',
      kind: 'custom',
      span: 2,
      render: (d, set) => (
        <div className="gap-2 sm:grid-cols-2 grid grid-cols-1">
          {s.skills.map((skill) => (
            <label
              key={skill.id}
              className="gap-2 rounded-2xl px-3 py-2 text-sm flex items-center justify-between bg-surface-2"
            >
              <span className="min-w-0 truncate">{skill.name}</span>
              <NativeSelect
                variant="inline"
                aria-label={`${skill.name} level`}
                value={d.skills[skill.id] ? String(d.skills[skill.id]) : ''}
                placeholder="None"
                options={LEVELS.map((l) => ({ value: String(l), label: `${l} · ${SKILL_LEVEL_LABEL[l]}` }))}
                onChange={(e) => {
                  const next = { ...d.skills }
                  if (e.target.value) next[skill.id] = Number(e.target.value) as SkillLevel
                  else delete next[skill.id]
                  set({ skills: next })
                }}
              />
            </label>
          ))}
          {s.skills.length === 0 && <Muted>Define skills first.</Muted>}
        </div>
      ),
    },
    ...login,
    {
      key: 'availability',
      label: 'Availability',
      kind: 'select',
      options: (['on_shift', 'off_shift', 'leave'] as const).map((v) => ({
        value: v,
        label: AVAILABILITY_LABEL[v],
      })),
    },
    {
      key: 'color',
      label: 'Avatar colour',
      kind: 'custom',
      render: (d, set) => (
        <input
          type="color"
          aria-label="Avatar colour"
          value={d.color || '#888888'}
          onChange={(e) => set({ color: e.target.value })}
          className="h-11 rounded-2xl p-1 w-full cursor-pointer border border-border bg-card"
        />
      ),
    },
  ]
}

export const blankPerson = (siteId: string): Person => ({
  id: newId('per'),
  code: '',
  name: '',
  role: 'operator',
  email: '',
  siteIds: [siteId],
  shiftId: null,
  skills: {},
  workCenterIds: [],
  loginMethod: 'rfid',
  badge: '',
  availability: 'on_shift',
  color: '#4f6d7a',
})

function People() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Person>()
  const columns: Column<Person>[] = [
    {
      id: 'person',
      header: 'Person',
      sortValue: (x) => x.name,
      cell: (x) => (
        <span className="min-w-0 gap-3 flex items-center">
          <Avatar name={x.name} color={x.color} size="sm" />
          <span className="min-w-0">
            <span className="font-semibold block truncate">{x.name}</span>
            <Mono>{x.code}</Mono>
          </span>
        </span>
      ),
    },
    { id: 'role', header: 'Role', sortValue: (x) => x.role, cell: (x) => ROLE_LABEL[x.role] },
    {
      id: 'shift',
      header: 'Shift',
      hideBelow: 'md',
      cell: (x) => (x.shiftId ? (s.maps.shift.get(x.shiftId)?.name ?? '') : <Muted>None</Muted>),
    },
    {
      id: 'skills',
      header: 'Skills',
      hideBelow: 'lg',
      cell: (x) => (
        <span className="gap-1 flex flex-wrap">
          {Object.entries(x.skills).map(([id, level]) => (
            <Badge key={id} variant="outline">
              {s.maps.skill.get(id)?.name ?? id} · L{level}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: 'wc',
      header: 'Work centers',
      hideBelow: 'xl',
      cell: (x) =>
        x.workCenterIds.length ? x.workCenterIds.map((id) => s.orgName(id)).join(', ') : <Muted>Any</Muted>,
    },
    {
      id: 'avail',
      header: 'Availability',
      hideBelow: 'sm',
      sortValue: (x) => x.availability,
      cell: (x) => (
        <Badge variant={AVAILABILITY_VARIANT[x.availability]} dot>
          {AVAILABILITY_LABEL[x.availability]}
        </Badge>
      ),
    },
  ]
  return (
    <>
      <EntityTable
        title="People"
        description="Operators, supervisors and every other user of the platform at this site."
        rows={s.people}
        columns={columns}
        search={(x) => `${x.code} ${x.name} ${x.email} ${ROLE_LABEL[x.role]}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'people/remove', id: x.id })}
        removeBlocker={(x) =>
          x.id === s.user.id
            ? 'You are signed in as this person'
            : s.workOrders.some((w) => w.operatorIds.includes(x.id))
              ? 'Assigned to work orders'
              : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        size="lg"
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New person'}
        fields={personFields(s)}
        item={editor.item}
        blank={() => blankPerson(s.siteId)}
        existing={s.state.people}
        uniqueKeys={['email', 'badge']}
        onSave={(item) => s.dispatch({ type: 'people/upsert', item })}
      />
    </>
  )
}

function Skills() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Skill>()
  const fields: Field<Skill>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
  ]
  const columns: Column<Skill>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-semibold">{x.name}</span>,
    },
    {
      id: 'people',
      header: 'Qualified people',
      align: 'right',
      hideBelow: 'sm',
      cell: (x) => s.people.filter((p) => (p.skills[x.id] ?? 0) >= 2).length,
    },
  ]
  return (
    <>
      <EntityTable
        title="Skills"
        description="Levels: 1 trainee, 2 qualified, 3 senior, 4 trainer. Level 2 and up counts as qualified for a BOR requirement."
        rows={s.skills}
        columns={columns}
        search={(x) => `${x.code} ${x.name}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'skills/remove', id: x.id })}
        removeBlocker={(x) =>
          s.bors.some((b) => b.items.some((i) => i.skillIds.includes(x.id))) ? 'Required by a BOR' : null
        }
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        size="sm"
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New skill'}
        fields={fields}
        item={editor.item}
        blank={(): Skill => ({ id: newId('skl'), code: '', name: '' })}
        existing={s.skills}
        onSave={(item) => s.dispatch({ type: 'skills/upsert', item })}
      />
    </>
  )
}

function RoleMatrix() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Roles and permissions</CardTitle>
        <CardDescription>
          Fixed matrix from the platform RBAC. Assign a role on the person to grant its permissions.
        </CardDescription>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <table className="text-xs w-full border-collapse">
          <thead>
            <tr>
              <th className="left-0 px-2 py-2 font-semibold tracking-wide sticky bg-card text-left text-muted uppercase">
                Permission
              </th>
              {ROLES.map((r) => (
                <th
                  key={r}
                  className="px-2 py-2 font-semibold tracking-wide text-center text-muted uppercase"
                >
                  {ROLE_LABEL[r]}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERMISSIONS.map((p) => (
              <tr key={p} className="border-t border-border">
                <td className="left-0 px-2 py-2 sticky bg-card font-mono">{p}</td>
                {ROLES.map((r) => (
                  <td key={r} className="px-2 py-2 text-center">
                    {can(r, p) ? (
                      <Check className="size-4 mx-auto text-success" aria-label="Granted" />
                    ) : (
                      <span className="text-silver">·</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </CardContent>
    </Card>
  )
}
