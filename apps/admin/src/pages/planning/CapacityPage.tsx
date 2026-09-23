import { type CapacityRow, capacityByWorkCenter, fmtNumber, fmtPercent } from '@mes/fixtures'
import {
  Badge,
  Banner,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ColumnChart,
  type Column,
  DataTable,
  EmptyState,
  PageHeader,
  PillTabs,
  ProgressBar,
  StatCard,
  toast,
} from '@mes/ui'
import { Clock, Factory, Gauge, Plus, TriangleAlert } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { type CapacityWindow, capacityWindow } from './lib'
import { WorkCenterDialog } from './WorkCenterDialog'

export function CapacityPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const navigate = useNavigate()
  const [window, setWindow] = useHistoryState<CapacityWindow>('window', 'this')
  const [creating, setCreating] = useState(false)
  const range = capacityWindow(window, now)
  const manage = can('masterdata.manage') || can('planning.manage')

  const rows = useMemo(
    () => capacityByWorkCenter(s.state, s.siteId, range.from, range.to),
    [s.state, s.siteId, range.from, range.to],
  )
  const stats = useMemo(
    () => ({
      required: rows.reduce((sum, r) => sum + r.requiredHours, 0),
      available: rows.reduce((sum, r) => sum + r.availableHours, 0),
      overloaded: rows.filter((r) => r.load > 1).length,
      under: rows.filter((r) => r.load < 0.5).length,
    }),
    [rows],
  )

  const machinesOf = (wcId: string) => s.machines.filter((m) => m.workCenterId === wcId && m.active)
  const availableMachines = (wcId: string) =>
    machinesOf(wcId).filter(
      (m) => m.maintenanceState !== 'in_maintenance' && m.maintenanceState !== 'unavailable',
    )

  const columns: Column<CapacityRow>[] = [
    {
      id: 'wc',
      header: 'Work center',
      sortValue: (r) => s.orgName(r.workCenterId),
      cell: (r) => (
        <div className="min-w-0">
          <p className="font-semibold">{s.orgName(r.workCenterId)}</p>
          <p className="text-xs font-mono text-muted">{s.maps.orgNode.get(r.workCenterId)?.code}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <Badge variant={r.load > 1 ? 'accent' : r.load > 0.85 ? 'warning' : 'default'}>
              {fmtPercent(r.load)}
            </Badge>
            {r.load > 1 && <Badge variant="danger">Conflict</Badge>}
          </div>
        </div>
      ),
    },
    {
      id: 'machines',
      header: 'Machines',
      hideBelow: 'md',
      align: 'right',
      cell: (r) => (
        <span className="tabular-nums">
          {availableMachines(r.workCenterId).length} / {machinesOf(r.workCenterId).length}
        </span>
      ),
    },
    {
      id: 'required',
      header: 'Required',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.requiredHours,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.requiredHours, 1)} h</span>,
    },
    {
      id: 'available',
      header: 'Available',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.availableHours,
      cell: (r) => <span className="tabular-nums">{fmtNumber(r.availableHours, 1)} h</span>,
    },
    {
      id: 'load',
      header: 'Load',
      width: '11rem',
      sortValue: (r) => r.load,
      cell: (r) => (
        <div>
          <div className="mb-1 text-xs flex items-center justify-between">
            <span className="font-semibold tabular-nums">{fmtPercent(r.load)}</span>
            {r.load > 1 && (
              <Badge variant="danger" className="sm:inline-flex hidden">
                Conflict
              </Badge>
            )}
          </div>
          <ProgressBar
            value={r.load}
            tone={r.load > 1 ? 'accent' : r.load > 0.85 ? 'warning' : 'ink'}
            aria-label={`${fmtPercent(r.load)} load`}
          />
        </div>
      ),
    },
    {
      id: 'wos',
      header: 'WOs',
      align: 'right',
      hideBelow: 'lg',
      sortValue: (r) => r.woCount,
      cell: (r) => <span className="tabular-nums">{r.woCount}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Capacity"
        description="Required hours from open work orders against the hours each work center can offer, so conflicts surface before dispatch."
        actions={
          <>
            <PillTabs
              value={window}
              onValueChange={(v) => setWindow(v as CapacityWindow)}
              items={[
                { value: 'this', label: 'This week' },
                { value: 'next', label: 'Next week' },
                { value: 'four', label: '4 weeks' },
              ]}
            />
            {manage && (
              <Button onClick={() => setCreating(true)}>
                <Plus />
                Add work center
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Required hours"
            value={fmtNumber(stats.required)}
            unit="h"
            hint={range.label}
            icon={<Clock />}
            tone="ink"
          />
          <StatCard
            label="Available hours"
            value={fmtNumber(stats.available)}
            unit="h"
            hint={`${rows.length} work centers`}
            icon={<Factory />}
          />
          <StatCard
            label="Overloaded"
            value={stats.overloaded}
            hint="Load above 100%"
            icon={<TriangleAlert />}
            tone={stats.overloaded ? 'danger' : 'success'}
          />
          <StatCard
            label="Under-utilised"
            value={stats.under}
            hint="Load below 50%"
            icon={<Gauge />}
            tone={stats.under ? 'warning' : 'default'}
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Load per work center</CardTitle>
          </CardHeader>
          <CardContent>
            <ColumnChart
              data={rows.map((r) => ({
                label: s.maps.orgNode.get(r.workCenterId)?.code ?? r.workCenterId,
                value: Math.round(r.load * 100),
                highlight: r.load > 1,
              }))}
              format={(v) => `${v}%`}
              referenceLine={{ value: 100, label: 'Capacity' }}
              ariaLabel="Load percentage per work center"
            />
          </CardContent>
        </Card>

        <Card>
          <DataTable
            columns={columns}
            rows={rows}
            getRowKey={(r) => r.workCenterId}
            onRowClick={(r) => navigate(`${paths.capacity(r.workCenterId)}?window=${window}`)}
            resetPageKey={window}
            initialSort={{ id: 'load', desc: true }}
            empty={
              <EmptyState
                compact
                title="No work centers"
                description="Add a work center to see its load against open work orders."
                action={
                  manage ? (
                    <Button size="sm" onClick={() => setCreating(true)}>
                      <Plus />
                      Add work center
                    </Button>
                  ) : undefined
                }
              />
            }
          />
        </Card>

        <Banner
          tone="info"
          title="Planner can identify capacity conflicts before dispatch"
          action={
            <Button asChild variant="outline" size="sm">
              <Link to="/manufacturing/dispatch">Open dispatch</Link>
            </Button>
          }
        >
          Overloaded work centers need work moved or extra shifts before their work orders reach the board.
        </Banner>
      </div>

      <WorkCenterDialog
        open={creating}
        onOpenChange={setCreating}
        onSaved={(wc) => {
          toast(`${wc.code} created`, { tone: 'success' })
          navigate(`${paths.capacity(wc.id)}?window=${window}`)
        }}
      />
    </>
  )
}
