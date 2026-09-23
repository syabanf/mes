import { fmtDateShort, fmtDateTime, fmtWhen, toMs } from '@mes/fixtures'
import type { Machine, MaintenanceRecord } from '@mes/types'
import { MAINTENANCE_KIND_LABEL, MAINTENANCE_STATUS_LABEL, OPEN_WO_STATUSES } from '@mes/types'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  StatCard,
  Steps,
  type StepState,
  toast,
} from '@mes/ui'
import { CalendarClock, CircleCheck, Wrench, XOctagon } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { MachineStateBadge, MaintenanceStateBadge } from '../../components/badges'
import { WoLink, paths } from '../../components/links'
import { useNow, useScoped } from '../../state/scoped'

const STATUS_VARIANT = {
  requested: 'warning',
  scheduled: 'info',
  in_progress: 'accent',
  completed: 'success',
} as const

export function CmmsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const manage = can('integration.manage')

  const records = useMemo(
    () => [...s.maintenanceRecords].sort((a, b) => toMs(b.plannedStart) - toMs(a.plannedStart)),
    [s.maintenanceRecords],
  )
  const live =
    records.find((r) => r.status === 'in_progress') ??
    records.find((r) => r.status === 'requested') ??
    records.find((r) => r.status === 'scheduled' && r.impactedWoIds.length > 0)
  const lastCompleted = records.find((r) => r.status === 'completed')
  const liveMachine = live ? s.maps.machine.get(live.machineId) : undefined
  const stats = {
    available: s.machines.filter((m) => m.maintenanceState === 'available').length,
    planned: s.machines.filter((m) => m.maintenanceState === 'planned').length,
    inMaintenance: s.machines.filter((m) => m.maintenanceState === 'in_maintenance').length,
    unavailable: s.machines.filter((m) => m.maintenanceState === 'unavailable').length,
  }

  const outageDone: StepState = live || lastCompleted ? 'done' : 'upcoming'
  const outage = [
    {
      key: 'wo',
      label: 'WO running',
      hint: live?.impactedWoIds.length ? s.maps.wo.get(live.impactedWoIds[0]!)?.code : undefined,
    },
    {
      key: 'alarm',
      label: 'Machine alarm',
      hint: live?.sourceAlarm ?? liveMachine?.telemetry.alarm ?? undefined,
    },
    {
      key: 'dm',
      label: 'Device monitoring',
      hint: liveMachine ? `${liveMachine.code} ${liveMachine.state}` : undefined,
    },
    { key: 'oee', label: 'OEE downtime', hint: liveMachine ? 'Downtime recorded' : undefined },
    { key: 'cmms', label: 'CMMS work request', hint: live?.code },
    { key: 'pause', label: 'MES WO pause', hint: live ? `${live.impactedWoIds.length} paused` : undefined },
    {
      key: 'risk',
      label: 'MO at risk',
      hint: live
        ? `${new Set(live.impactedWoIds.map((id) => s.maps.wo.get(id)?.moId)).size} orders`
        : undefined,
    },
  ].map((step, i, arr) => ({
    ...step,
    state: (live ? (i === arr.length - 1 ? 'current' : 'done') : outageDone) as StepState,
  }))
  const recovery = [
    {
      key: 'done',
      label: 'CMMS completed',
      hint: lastCompleted?.completedAt ? fmtWhen(lastCompleted.completedAt, now) : undefined,
    },
    {
      key: 'avail',
      label: 'Machine available',
      hint: lastCompleted ? s.maps.machine.get(lastCompleted.machineId)?.code : undefined,
    },
    {
      key: 'resume',
      label: 'MES resume',
      hint: lastCompleted ? `${lastCompleted.impactedWoIds.length} work orders resumed` : undefined,
    },
  ].map((step) => ({
    ...step,
    state: (live ? 'upcoming' : lastCompleted ? 'done' : 'upcoming') as StepState,
  }))

  const complete = (r: MaintenanceRecord) => {
    s.dispatch({ type: 'maintenance/complete', id: r.id })
    toast(`${r.code} completed`, {
      tone: 'success',
      description: `${s.maps.machine.get(r.machineId)?.code ?? ''} available; paused work resumes.`,
    })
  }

  const recordColumns: Column<MaintenanceRecord>[] = [
    {
      id: 'code',
      header: 'Record',
      sortValue: (r) => r.code,
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{r.code}</p>
          <p className="text-sm truncate">{r.title}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <Badge variant={STATUS_VARIANT[r.status]}>{MAINTENANCE_STATUS_LABEL[r.status]}</Badge>
          </div>
        </div>
      ),
    },
    {
      id: 'machine',
      header: 'Machine',
      sortValue: (r) => s.maps.machine.get(r.machineId)?.code ?? '',
      cell: (r) => (
        <span className="font-semibold">{s.maps.machine.get(r.machineId)?.code ?? r.machineId}</span>
      ),
    },
    { id: 'kind', header: 'Kind', hideBelow: 'md', cell: (r) => MAINTENANCE_KIND_LABEL[r.kind] },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (r) => r.status,
      cell: (r) => (
        <Badge variant={STATUS_VARIANT[r.status]} dot={r.status === 'in_progress'}>
          {MAINTENANCE_STATUS_LABEL[r.status]}
        </Badge>
      ),
    },
    {
      id: 'window',
      header: 'Planned window',
      hideBelow: 'lg',
      sortValue: (r) => r.plannedStart,
      cell: (r) => (
        <span className="text-xs tabular-nums">
          {fmtDateTime(r.plannedStart)} → {fmtDateTime(r.plannedEnd)}
        </span>
      ),
    },
    {
      id: 'impact',
      header: 'Impacted WOs',
      hideBelow: 'md',
      cell: (r) =>
        r.impactedWoIds.length ? (
          <span className="gap-2 flex flex-wrap">
            {r.impactedWoIds.map((id) => (
              <WoLink key={id} woId={id} />
            ))}
          </span>
        ) : (
          <span className="text-muted">None</span>
        ),
    },
    {
      id: 'completed',
      header: 'Completed',
      hideBelow: 'xl',
      cell: (r) => (r.completedAt ? fmtWhen(r.completedAt, now) : <span className="text-muted">–</span>),
    },
    {
      id: 'action',
      header: <span className="sr-only">Action</span>,
      align: 'right',
      cell: (r) =>
        manage && r.status !== 'completed' ? (
          <Button variant="outline" size="sm" onClick={() => complete(r)}>
            <CircleCheck />
            Mark completed
          </Button>
        ) : null,
    },
  ]

  const openWos = (m: Machine) =>
    s.workOrders.filter((w) => w.machineId === m.id && OPEN_WO_STATUSES.includes(w.status)).length
  const nextPlanned = (m: Machine) =>
    records
      .filter((r) => r.machineId === m.id && r.status !== 'completed' && r.status !== 'in_progress')
      .sort((a, b) => toMs(a.plannedStart) - toMs(b.plannedStart))[0]
  const machineColumns: Column<Machine>[] = [
    {
      id: 'machine',
      header: 'Machine',
      sortValue: (m) => m.code,
      cell: (m) => (
        <div className="min-w-0">
          <p className="font-semibold">{m.code}</p>
          <p className="text-xs truncate text-muted">
            {m.name} · {s.orgName(m.workCenterId)}
          </p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <MaintenanceStateBadge state={m.maintenanceState} />
          </div>
        </div>
      ),
    },
    {
      id: 'maint',
      header: 'CMMS state',
      hideBelow: 'sm',
      sortValue: (m) => m.maintenanceState,
      cell: (m) => <MaintenanceStateBadge state={m.maintenanceState} />,
    },
    {
      id: 'state',
      header: 'Live state',
      hideBelow: 'md',
      cell: (m) => <MachineStateBadge state={m.state} />,
    },
    {
      id: 'next',
      header: 'Next planned',
      hideBelow: 'lg',
      cell: (m) => {
        const r = nextPlanned(m)
        return r ? (
          <span className="text-xs">
            {fmtDateShort(r.plannedStart)} · {r.title}
          </span>
        ) : (
          <span className="text-muted">None</span>
        )
      },
    },
    {
      id: 'wos',
      header: 'Open WOs',
      align: 'right',
      sortValue: (m) => openWos(m),
      cell: (m) => <span className="tabular-nums">{openWos(m)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="CMMS"
        description="Equipment health from the CMMS next to what production has assigned to it. Maintenance state gates dispatch."
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Machines available"
            value={stats.available}
            unit={`of ${s.machines.length}`}
            icon={<CircleCheck />}
            tone="success"
          />
          <StatCard label="Maintenance planned" value={stats.planned} icon={<CalendarClock />} tone="info" />
          <StatCard
            label="In maintenance"
            value={stats.inMaintenance}
            icon={<Wrench />}
            tone={stats.inMaintenance ? 'warning' : 'default'}
          />
          <StatCard
            label="Unavailable"
            value={stats.unavailable}
            icon={<XOctagon />}
            tone={stats.unavailable ? 'danger' : 'default'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Failure to recovery</CardTitle>
            <CardDescription>
              {live
                ? `Live example: ${live.code} on ${liveMachine?.code ?? live.machineId}${live.sourceAlarm ? ` after "${live.sourceAlarm}"` : ''}, ${live.impactedWoIds.length} work orders paused.`
                : lastCompleted
                  ? `Last cycle closed with ${lastCompleted.code}.`
                  : 'No maintenance records yet.'}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <Steps steps={outage} />
            <p className="font-semibold tracking-wider text-[11px] text-muted uppercase">After maintenance</p>
            <Steps steps={recovery} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Maintenance records</CardTitle>
            <CardDescription>
              Requests MES raised and planned work the CMMS scheduled. Completing one simulates the CMMS
              callback.
            </CardDescription>
          </CardHeader>
          <DataTable
            columns={recordColumns}
            rows={records}
            getRowKey={(r) => r.id}
            pageSize={8}
            empty={
              <EmptyState
                compact
                title="No maintenance records"
                description="Raise one from Device monitoring when a machine alarms."
              />
            }
          />
        </Card>

        <Banner
          tone="warning"
          title="Production cannot assign equipment that is unavailable due to maintenance"
        >
          The machine picker greys out machines in maintenance or unavailable. Machine failure pauses the
          running work order and marks its order at risk until the CMMS completes the work.
        </Banner>

        <Card>
          <CardHeader>
            <CardTitle>Machines</CardTitle>
          </CardHeader>
          <DataTable
            columns={machineColumns}
            rows={s.machines.filter((m) => m.active)}
            getRowKey={(m) => m.id}
            onRowClick={(m) => navigate(paths.machine(m.id))}
            initialSort={{ id: 'maint', desc: true }}
            empty="No active machines."
          />
        </Card>
      </div>
    </>
  )
}
