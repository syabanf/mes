import { fmtNumber, fmtPercent } from '@mes/fixtures'
import { AVAILABILITY_LABEL, RESOURCE_KIND_LABEL, RESOURCE_STATUS_LABEL } from '@mes/types'
import { Badge, Card, type Column, DataTable, ProgressBar, StatCard } from '@mes/ui'
import { Cpu, Gauge, Hammer, TriangleAlert, UserRound, Wrench } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useNow, useScoped } from '../../state/scoped'
import { NEXT_7_DAYS, isOpenWo, plannedHours } from './lib'

const AVAILABILITY_VARIANT = { on_shift: 'success', off_shift: 'muted', leave: 'warning' } as const
const RESOURCE_VARIANT = {
  available: 'success',
  in_use: 'info',
  maintenance: 'warning',
  retired: 'muted',
} as const

export function OperatorsTab() {
  const s = useScoped()
  const now = useNow(60_000)
  const rows = useMemo(
    () =>
      s.operators.map((p) => {
        const wos = s.workOrders.filter((w) => w.operatorIds.includes(p.id) && isOpenWo(w))
        return {
          person: p,
          wos: wos.length,
          planned: plannedHours(wos, now, now + NEXT_7_DAYS),
          skills: Object.entries(p.skills),
        }
      }),
    [s, now],
  )
  type Row = (typeof rows)[number]
  const stats = {
    onShift: rows.filter((r) => r.person.availability === 'on_shift').length,
    leave: rows.filter((r) => r.person.availability === 'leave').length,
    planned: rows.reduce((sum, r) => sum + r.planned, 0),
    idle: rows.filter((r) => r.wos === 0 && r.person.availability !== 'leave').length,
  }
  const columns: Column<Row>[] = [
    {
      id: 'person',
      header: 'Operator',
      sortValue: (r) => r.person.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-semibold">{r.person.name}</p>
          <p className="text-xs font-mono text-muted">{r.person.code}</p>
          <div className="mt-1.5 sm:hidden">
            <Badge variant={AVAILABILITY_VARIANT[r.person.availability]} dot>
              {AVAILABILITY_LABEL[r.person.availability]}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      id: 'shift',
      header: 'Shift',
      hideBelow: 'md',
      sortValue: (r) => r.person.shiftId ?? '',
      cell: (r) =>
        r.person.shiftId ? (
          (s.maps.shift.get(r.person.shiftId)?.name ?? '')
        ) : (
          <span className="text-muted">None</span>
        ),
    },
    {
      id: 'skills',
      header: 'Skills',
      hideBelow: 'lg',
      cell: (r) => (
        <span className="gap-1 flex flex-wrap">
          {r.skills.length === 0 && <span className="text-xs text-muted">None</span>}
          {r.skills.map(([id, level]) => (
            <Badge key={id} variant="outline">
              {s.maps.skill.get(id)?.name ?? id} · L{level}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: 'wos',
      header: 'Assigned WOs',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.wos,
      cell: (r) => <span className="tabular-nums">{r.wos}</span>,
    },
    {
      id: 'avail',
      header: 'Availability',
      hideBelow: 'sm',
      sortValue: (r) => r.person.availability,
      cell: (r) => (
        <Badge variant={AVAILABILITY_VARIANT[r.person.availability]} dot>
          {AVAILABILITY_LABEL[r.person.availability]}
        </Badge>
      ),
    },
    {
      id: 'planned',
      header: 'Planned 7d',
      align: 'right',
      sortValue: (r) => r.planned,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.planned, 1)} h</span>,
    },
  ]
  return (
    <>
      <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
        <StatCard
          label="On shift"
          value={stats.onShift}
          unit={`of ${rows.length}`}
          icon={<UserRound />}
          tone="ink"
        />
        <StatCard
          label="On leave"
          value={stats.leave}
          icon={<TriangleAlert />}
          tone={stats.leave ? 'warning' : 'success'}
        />
        <StatCard
          label="Planned hours"
          value={fmtNumber(stats.planned)}
          unit="h"
          hint="Next 7 days"
          icon={<Gauge />}
        />
        <StatCard
          label="Without assignment"
          value={stats.idle}
          hint="Available but no open work order"
          icon={<Hammer />}
        />
      </div>
      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.person.id}
          initialSort={{ id: 'planned', desc: true }}
          empty="No operators on this site."
        />
      </Card>
    </>
  )
}

export function ToolsTab() {
  const s = useScoped()
  const navigate = useNavigate()
  const rows = useMemo(
    () =>
      s.resources.map((r) => {
        const wos = s.workOrders.filter(
          (w) => (w.toolIds.includes(r.id) || w.moldIds.includes(r.id)) && isOpenWo(w),
        )
        return { resource: r, wos: wos.length, usage: r.lifeLimit ? r.usageCount / r.lifeLimit : null }
      }),
    [s],
  )
  type Row = (typeof rows)[number]
  const stats = {
    available: rows.filter((r) => r.resource.status === 'available').length,
    inUse: rows.filter((r) => r.resource.status === 'in_use').length,
    maintenance: rows.filter((r) => r.resource.status === 'maintenance').length,
    worn: rows.filter((r) => r.usage !== null && r.usage > 0.8).length,
  }
  const columns: Column<Row>[] = [
    {
      id: 'resource',
      header: 'Resource',
      sortValue: (r) => r.resource.code,
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-semibold">{r.resource.code}</p>
          <p className="text-xs truncate text-muted">
            {r.resource.name} · {s.orgName(r.resource.workCenterId)}
          </p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <Badge variant="outline">{RESOURCE_KIND_LABEL[r.resource.kind]}</Badge>
            <Badge variant={RESOURCE_VARIANT[r.resource.status]}>
              {RESOURCE_STATUS_LABEL[r.resource.status]}
            </Badge>
          </div>
        </div>
      ),
    },
    {
      id: 'kind',
      header: 'Kind',
      hideBelow: 'sm',
      sortValue: (r) => r.resource.kind,
      cell: (r) => RESOURCE_KIND_LABEL[r.resource.kind],
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (r) => r.resource.status,
      cell: (r) => (
        <Badge variant={RESOURCE_VARIANT[r.resource.status]}>
          {RESOURCE_STATUS_LABEL[r.resource.status]}
        </Badge>
      ),
    },
    {
      id: 'life',
      header: 'Usage / life',
      width: '11rem',
      sortValue: (r) => r.usage,
      cell: (r) =>
        r.usage === null ? (
          <span className="text-xs text-muted">No life limit</span>
        ) : (
          <div>
            <p className="mb-1 text-xs tabular-nums">
              {fmtNumber(r.resource.usageCount)} / {fmtNumber(r.resource.lifeLimit ?? 0)}{' '}
              <span className="text-muted">({fmtPercent(r.usage)})</span>
            </p>
            <ProgressBar
              value={r.usage}
              tone={r.usage > 0.8 ? 'warning' : 'ink'}
              aria-label={`${fmtPercent(r.usage)} of life used`}
            />
          </div>
        ),
    },
    {
      id: 'wos',
      header: 'Assigned WOs',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.wos,
      cell: (r) => <span className="tabular-nums">{r.wos}</span>,
    },
  ]
  return (
    <>
      <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
        <StatCard
          label="Available"
          value={stats.available}
          unit={`of ${rows.length}`}
          icon={<Hammer />}
          tone="ink"
        />
        <StatCard label="In use" value={stats.inUse} icon={<Cpu />} tone="info" />
        <StatCard
          label="In maintenance"
          value={stats.maintenance}
          icon={<Wrench />}
          tone={stats.maintenance ? 'warning' : 'success'}
        />
        <StatCard
          label="Near life limit"
          value={stats.worn}
          hint="Above 80% of the limit"
          icon={<TriangleAlert />}
          tone={stats.worn ? 'danger' : 'default'}
        />
      </div>
      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.resource.id}
          onRowClick={() => navigate('/master-data/resources')}
          initialSort={{ id: 'life', desc: true }}
          empty="No tools, molds or fixtures on this site."
        />
      </Card>
    </>
  )
}
