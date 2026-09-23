import { DAY, fmtAgo, fmtNumber, fmtWhen, toMs } from '@mes/fixtures'
import type { IntegrationLog, IntegrationSystem } from '@mes/types'
import { INTEGRATION_SYSTEM_LABEL } from '@mes/types'
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
  IconTile,
  PageHeader,
  StatCard,
  Switch,
  toast,
} from '@mes/ui'
import {
  Activity,
  ArrowDownLeft,
  ArrowUpRight,
  Building2,
  Cpu,
  Gauge,
  Handshake,
  Package,
  RefreshCw,
  UserRound,
  Users,
  Warehouse,
  Wrench,
} from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../../auth/auth'
import { ConnectionBadge } from '../../components/badges'
import { useNow, useScoped } from '../../state/scoped'
import { EVENT_TYPES, OWNERSHIP, SYSTEM_ORDER } from './lib'

const SYSTEM_ICON: Record<IntegrationSystem, ReactNode> = {
  device_monitoring: <Activity />,
  oee: <Gauge />,
  cmms: <Wrench />,
  erp: <Building2 />,
  wms: <Warehouse />,
  hris: <Users />,
  crm: <Handshake />,
}
const LOG_VARIANT = { ok: 'success', error: 'danger', pending: 'warning' } as const

export function ExternalSystemsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(30_000)
  const navigate = useNavigate()
  const toMappings = () => navigate('/master-data/system?tab=mappings')
  const manage = can('integration.manage')

  const connections = useMemo(
    () =>
      [...s.integrationConnections].sort(
        (a, b) => SYSTEM_ORDER.indexOf(a.system) - SYSTEM_ORDER.indexOf(b.system),
      ),
    [s.integrationConnections],
  )
  const logs = useMemo(
    () => [...s.integrationLogs].sort((a, b) => toMs(b.at) - toMs(a.at)),
    [s.integrationLogs],
  )
  const eventCounts = useMemo(() => {
    const since = now - DAY
    const counts = new Map<string, number>()
    for (const e of s.productionEvents)
      if (toMs(e.at) >= since) counts.set(e.type, (counts.get(e.type) ?? 0) + 1)
    return counts
  }, [s.productionEvents, now])
  const mapped = (kind: 'machine' | 'product' | 'customer') =>
    new Set(s.state.integrationMappings.filter((m) => m.entityKind === kind).map((m) => m.internalId)).size

  const columns: Column<IntegrationLog>[] = [
    {
      id: 'dir',
      header: <span className="sr-only">Direction</span>,
      width: '3rem',
      cell: (l) => (
        <IconTile size="sm" tone={l.direction === 'in' ? 'info' : 'ink'}>
          {l.direction === 'in' ? <ArrowDownLeft /> : <ArrowUpRight />}
        </IconTile>
      ),
    },
    {
      id: 'at',
      header: 'Time',
      sortValue: (l) => l.at,
      cell: (l) => <span className="text-xs tabular-nums">{fmtWhen(l.at, now)}</span>,
    },
    {
      id: 'system',
      header: 'System',
      sortValue: (l) => l.system,
      cell: (l) => <Badge variant="outline">{INTEGRATION_SYSTEM_LABEL[l.system]}</Badge>,
    },
    {
      id: 'event',
      header: 'Event',
      hideBelow: 'sm',
      cell: (l) => <span className="text-xs font-mono">{l.event}</span>,
    },
    {
      id: 'ref',
      header: 'Ref',
      hideBelow: 'md',
      cell: (l) => <span className="text-xs font-mono">{l.ref}</span>,
    },
    {
      id: 'summary',
      header: 'Summary',
      hideBelow: 'lg',
      cell: (l) => <span className="text-xs">{l.summary}</span>,
    },
    {
      id: 'status',
      header: 'Status',
      cell: (l) => (
        <Badge variant={LOG_VARIANT[l.status]} dot={l.status === 'pending'}>
          {l.status}
        </Badge>
      ),
    },
    {
      id: 'ms',
      header: 'ms',
      align: 'right',
      hideBelow: 'md',
      sortValue: (l) => l.durationMs,
      cell: (l) => <span className="text-xs tabular-nums">{fmtNumber(l.durationMs)}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="External systems"
        description="Connections to the systems around MES, who owns which data, and the events crossing the bus."
      />
      <div className="space-y-4">
        <Banner tone="info" title="Demo integration data">
          Connection health and event history are sample data. Sync now records a local request; it does not
          contact an external system.
        </Banner>
        {connections.length === 0 ? (
          <Card>
            <EmptyState
              title="No connections configured"
              description="Integration connections come from the platform setup."
            />
          </Card>
        ) : (
          <div className="gap-4 md:grid-cols-2 xl:grid-cols-3 grid grid-cols-1">
            {connections.map((c) => (
              <Card key={c.id} className="p-5 flex flex-col">
                <div className="gap-3 flex items-start justify-between">
                  <div className="min-w-0 gap-3 flex items-center">
                    <IconTile
                      tone={c.state === 'connected' ? 'ink' : c.state === 'degraded' ? 'warning' : 'default'}
                    >
                      {SYSTEM_ICON[c.system]}
                    </IconTile>
                    <div className="min-w-0">
                      <p className="font-semibold truncate">{c.name}</p>
                      <p className="text-xs text-muted">{INTEGRATION_SYSTEM_LABEL[c.system]}</p>
                    </div>
                  </div>
                  <ConnectionBadge state={c.state} />
                </div>
                <p className="mt-3 text-xs truncate font-mono text-muted" title={c.endpoint}>
                  {c.endpoint}
                </p>
                <div className="mt-3 gap-2 text-xs flex flex-wrap items-center justify-between text-muted">
                  <span>Last sync {c.lastSyncAt ? fmtAgo(c.lastSyncAt, now) : 'never'}</span>
                  <span className="tabular-nums">{fmtNumber(c.throughput)} events/h</span>
                </div>
                <div className="mt-4 gap-2 pt-4 flex items-center justify-between border-t border-border">
                  <label className="gap-2 text-sm flex items-center">
                    <Switch
                      size="sm"
                      checked={c.enabled}
                      disabled={!manage}
                      aria-label={`Enable ${c.name}`}
                      onCheckedChange={(enabled) => {
                        s.dispatch({ type: 'integrationConnections/toggle', id: c.id, enabled })
                        toast(`${c.name} ${enabled ? 'enabled' : 'disabled'}`, { tone: 'default' })
                      }}
                    />
                    {c.enabled ? 'Enabled' : 'Disabled'}
                  </label>
                  {manage && (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!c.enabled}
                      onClick={() => {
                        s.dispatch({ type: 'integrationConnections/sync', id: c.id })
                        toast(`Demo sync request recorded for ${c.name}`, { tone: 'default' })
                      }}
                    >
                      <RefreshCw />
                      Sync now
                    </Button>
                  )}
                </div>
              </Card>
            ))}
          </div>
        )}

        <div className="gap-3 sm:grid-cols-3 sm:gap-4 grid grid-cols-1">
          <StatCard
            label="Mapped machines"
            value={mapped('machine')}
            unit={`of ${s.state.machines.length}`}
            hint="Open integration mappings"
            icon={<Cpu />}
            tone="ink"
            onClick={toMappings}
          />
          <StatCard
            label="Mapped products"
            value={mapped('product')}
            unit={`of ${s.products.length}`}
            hint="Open integration mappings"
            icon={<Package />}
            onClick={toMappings}
          />
          <StatCard
            label="Mapped customers"
            value={mapped('customer')}
            unit={`of ${s.customers.length}`}
            hint="Open integration mappings"
            icon={<UserRound />}
            onClick={toMappings}
          />
        </div>

        <div className="gap-4 xl:grid-cols-2 grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>Data ownership</CardTitle>
              <CardDescription>
                Source of truth per domain. MES reads the rest and never rewrites it.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <table className="text-sm w-full">
                <tbody>
                  {OWNERSHIP.map((row) => (
                    <tr key={row.domain} className="border-t border-border first:border-t-0">
                      <td className="py-1.5 pr-3">{row.domain}</td>
                      <td className="py-1.5 text-right">
                        <Badge variant={row.owner === 'MES' ? 'ink' : 'outline'}>{row.owner}</Badge>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Event bus</CardTitle>
              <CardDescription>Events published in the last 24 hours, by type.</CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="gap-1 sm:grid-cols-2 grid grid-cols-1">
                {EVENT_TYPES.map((t) => {
                  const n = eventCounts.get(t) ?? 0
                  return (
                    <li
                      key={t}
                      className="gap-2 rounded-xl px-2 py-1 text-xs flex items-center justify-between hover:bg-surface-2"
                    >
                      <span className={`truncate font-mono ${n ? '' : 'text-muted'}`}>{t}</span>
                      <span
                        className={`px-2 py-0.5 font-semibold shrink-0 rounded-full tabular-nums ${n ? 'bg-ink text-on-ink' : 'bg-surface text-muted'}`}
                      >
                        {n}
                      </span>
                    </li>
                  )
                })}
              </ul>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Integration log</CardTitle>
          </CardHeader>
          <DataTable
            columns={columns}
            rows={logs}
            getRowKey={(l) => l.id}
            pageSize={15}
            empty={
              <EmptyState
                compact
                title="No messages yet"
                description="Log lines appear as systems exchange events."
              />
            }
          />
        </Card>
      </div>
    </>
  )
}
