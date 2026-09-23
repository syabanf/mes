import { fmtDateShort, fmtNumber, fmtPercent } from '@mes/fixtures'
import { Card, type Column, DataTable, PageHeader, PillTabs, ProgressBar, Sparkline, StatCard } from '@mes/ui'
import { Cpu, Gauge, TriangleAlert, Wrench } from 'lucide-react'
import { useMemo } from 'react'
import { useNavigate } from 'react-router'
import { MachineStateBadge, MaintenanceStateBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { NEXT_7_DAYS, isOpenWo, plannedHours, shiftHoursPerDay } from './lib'
import { OperatorsTab, ToolsTab } from './ResourceLoadTabs'

type Tab = 'machines' | 'operators' | 'tools'

export function ResourceLoadPage() {
  const [tab, setTab] = useHistoryState<Tab>('tab', 'machines')
  return (
    <>
      <PageHeader
        title="Resource load"
        description="Planned hours on each machine, operator and tool for the next seven days, against what they can offer."
        actions={
          <PillTabs
            value={tab}
            onValueChange={(v) => setTab(v as Tab)}
            items={[
              { value: 'machines', label: 'Machines' },
              { value: 'operators', label: 'Operators' },
              { value: 'tools', label: 'Tools & molds' },
            ]}
          />
        }
      />
      <div className="space-y-4">
        {tab === 'machines' ? <MachinesTab /> : tab === 'operators' ? <OperatorsTab /> : <ToolsTab />}
      </div>
    </>
  )
}

function MachinesTab() {
  const s = useScoped()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const perDay = shiftHoursPerDay(s.shifts)
  const rows = useMemo(
    () =>
      s.machines
        .filter((m) => m.active)
        .map((m) => {
          const wos = s.workOrders.filter((w) => w.machineId === m.id && isOpenWo(w))
          const planned = plannedHours(wos, now, now + NEXT_7_DAYS)
          const available = perDay * 7
          const oee = [...s.oeeSnapshots.filter((o) => o.machineId === m.id)]
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(-14)
          return {
            machine: m,
            wos: wos.length,
            planned,
            available,
            utilisation: available ? planned / available : 0,
            oee,
          }
        }),
    [s, now, perDay],
  )
  type Row = (typeof rows)[number]
  const stats = {
    running: rows.filter((r) => r.machine.state === 'running').length,
    down: rows.filter((r) => r.machine.state === 'down' || r.machine.maintenanceState === 'in_maintenance')
      .length,
    utilisation: rows.length ? rows.reduce((sum, r) => sum + r.utilisation, 0) / rows.length : 0,
    overloaded: rows.filter((r) => r.utilisation > 1).length,
  }
  const columns: Column<Row>[] = [
    {
      id: 'machine',
      header: 'Machine',
      sortValue: (r) => r.machine.code,
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-semibold">{r.machine.code}</p>
          <p className="text-xs truncate text-muted">
            {r.machine.name} · {s.orgName(r.machine.workCenterId)}
          </p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <MachineStateBadge state={r.machine.state} />
            <MaintenanceStateBadge state={r.machine.maintenanceState} />
          </div>
        </div>
      ),
    },
    {
      id: 'state',
      header: 'State',
      hideBelow: 'sm',
      cell: (r) => <MachineStateBadge state={r.machine.state} />,
    },
    {
      id: 'maint',
      header: 'Maintenance',
      hideBelow: 'lg',
      cell: (r) => <MaintenanceStateBadge state={r.machine.maintenanceState} />,
    },
    {
      id: 'wos',
      header: 'Open WOs',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.wos,
      cell: (r) => <span className="tabular-nums">{r.wos}</span>,
    },
    {
      id: 'planned',
      header: 'Planned 7d',
      align: 'right',
      hideBelow: 'md',
      sortValue: (r) => r.planned,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.planned, 1)} h</span>,
    },
    {
      id: 'util',
      header: 'Utilisation',
      width: '10rem',
      sortValue: (r) => r.utilisation,
      cell: (r) => (
        <div>
          <p className="mb-1 text-xs font-semibold tabular-nums">{fmtPercent(r.utilisation)}</p>
          <ProgressBar
            value={r.utilisation}
            tone={r.utilisation > 1 ? 'accent' : r.utilisation > 0.85 ? 'warning' : 'ink'}
            aria-label={`${fmtPercent(r.utilisation)} utilisation`}
          />
        </div>
      ),
    },
    {
      id: 'oee',
      header: 'OEE 14d',
      hideBelow: 'xl',
      width: '9rem',
      cell: (r) =>
        r.oee.length ? (
          <Sparkline
            data={r.oee.map((o) => Math.round(o.oee * 100))}
            labels={r.oee.map((o) => fmtDateShort(`${o.date}T00:00:00+07:00`))}
            format={(v) => `${v}%`}
            height={28}
            ariaLabel={`OEE trend for ${r.machine.code}`}
          />
        ) : (
          <span className="text-xs text-muted">No snapshots</span>
        ),
    },
  ]
  return (
    <>
      <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
        <StatCard
          label="Machines running"
          value={stats.running}
          unit={`of ${rows.length}`}
          icon={<Cpu />}
          tone="ink"
        />
        <StatCard
          label="Down or in maintenance"
          value={stats.down}
          icon={<Wrench />}
          tone={stats.down ? 'danger' : 'success'}
        />
        <StatCard
          label="Average utilisation"
          value={fmtPercent(stats.utilisation)}
          hint="Planned hours over shift hours, next 7 days"
          icon={<Gauge />}
        />
        <StatCard
          label="Overloaded"
          value={stats.overloaded}
          hint="More planned than available"
          icon={<TriangleAlert />}
          tone={stats.overloaded ? 'warning' : 'default'}
        />
      </div>
      <Card>
        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(r) => r.machine.id}
          onRowClick={(r) => navigate(paths.machine(r.machine.id))}
          initialSort={{ id: 'util', desc: true }}
          empty="No active machines on this site."
        />
      </Card>
    </>
  )
}
