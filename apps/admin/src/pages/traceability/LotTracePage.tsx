import { fmtDateTime, fmtNumber, traceForward } from '@mes/fixtures'
import { LOT_STATUS_LABEL } from '@mes/types'
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Combobox,
  EmptyState,
  Input,
  KeyValue,
  PageHeader,
  StatCard,
  cn,
} from '@mes/ui'
import { Boxes, Building2, GitBranch, PackageCheck, Search } from 'lucide-react'
import { useMemo } from 'react'
import { useSearchParams } from 'react-router'
import { LotStatusBadge } from '../../components/badges'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { TraceTree } from './TraceTree'
import { countKinds } from './lib'

export function LotTracePage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const lotId = params.get('id')
  const [query, setQuery] = useHistoryState('query', '')

  const setLot = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('id', id)
        else p.delete('id')
        return p
      },
      { replace: true },
    )

  // Every lot, consumed ones included: the whole point of forward trace is following used material.
  const lots = useMemo(
    () => [...s.materialLots].sort((a, b) => b.receivedAt.localeCompare(a.receivedAt)),
    [s.materialLots],
  )
  const matching = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return lots
    return lots.filter((l) =>
      `${l.code} ${s.materialName(l.materialId)} ${s.maps.supplier.get(l.supplierId ?? '')?.name ?? ''}`
        .toLowerCase()
        .includes(q),
    )
  }, [lots, query, s])

  const lot = lotId ? s.maps.lot.get(lotId) : undefined
  const tree = useMemo(() => (lotId ? traceForward(s.state, lotId) : null), [s.state, lotId])
  const counts = useMemo(() => countKinds(tree), [tree])

  return (
    <>
      <PageHeader
        title="Lot trace"
        description="Forward trace from a raw material lot: every order it went into, the WIP batches, the finished goods and the customers that received them."
      />
      <div className="gap-4 xl:grid-cols-[20rem_minmax(0,1fr)] grid grid-cols-1">
        <div className="space-y-3">
          <Combobox
            items={lots}
            value={lotId}
            onChange={setLot}
            clearable
            placeholder="Select lot"
            searchPlaceholder="Search lots"
            getKey={(l) => l.id}
            getLabel={(l) => l.code}
            getDescription={(l) =>
              `${s.materialName(l.materialId)} · ${fmtNumber(l.qty)} ${s.uomCode(l.uomId)} · ${LOT_STATUS_LABEL[l.status]}`
            }
            aria-label="Lot"
          />
          <Input
            variant="pill"
            aria-label="Filter lots"
            leftIcon={<Search />}
            placeholder="Filter by code, material or supplier"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
          <Card>
            <CardContent className="space-y-1 p-2 max-h-[32rem] overflow-y-auto">
              {matching.length === 0 ? (
                <EmptyState compact title="No lots match" description="Try a different code or material." />
              ) : (
                matching.slice(0, 60).map((l) => (
                  <button
                    key={l.id}
                    type="button"
                    onClick={() => setLot(l.id)}
                    className={cn(
                      'gap-3 rounded-2xl p-3 flex w-full items-center text-left transition-colors hover:bg-surface-2',
                      l.id === lotId && 'bg-surface-2',
                    )}
                  >
                    <span className="min-w-0 flex-1">
                      <span className="text-xs font-semibold block truncate font-mono">{l.code}</span>
                      <span className="text-xs block truncate text-muted">
                        {s.materialName(l.materialId)}
                      </span>
                    </span>
                    <LotStatusBadge status={l.status} />
                  </button>
                ))
              )}
              {matching.length > 60 && (
                <p className="px-3 py-2 text-xs text-muted">
                  {matching.length - 60} more. Narrow the filter.
                </p>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          {!lot ? (
            <Card>
              <EmptyState
                icon={<GitBranch />}
                title="Pick a lot to trace"
                description="The forward trace shows where every piece of the lot ended up."
              />
            </Card>
          ) : (
            <>
              <Card>
                <CardHeader>
                  <CardTitle className="font-mono">{lot.code}</CardTitle>
                </CardHeader>
                <CardContent>
                  <KeyValue
                    bare
                    items={[
                      {
                        label: 'Material',
                        value: `${s.materialName(lot.materialId)} · ${s.maps.material.get(lot.materialId)?.code ?? ''}`,
                      },
                      {
                        label: 'Supplier',
                        value: s.maps.supplier.get(lot.supplierId ?? '')?.name ?? 'No supplier',
                      },
                      { label: 'Quantity', value: `${fmtNumber(lot.qty)} ${s.uomCode(lot.uomId)} remaining` },
                      { label: 'Received', value: fmtDateTime(lot.receivedAt) },
                      { label: 'Expires', value: fmtDateTime(lot.expiresAt!), hidden: !lot.expiresAt },
                      { label: 'Status', value: <LotStatusBadge status={lot.status} /> },
                      { label: 'Location', value: s.locationName(lot.locationId) },
                    ]}
                  />
                </CardContent>
              </Card>
              <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
                <StatCard label="Orders touched" value={counts.mo} icon={<GitBranch />} tone="ink" />
                <StatCard label="WIP batches" value={counts.wip} icon={<Boxes />} tone="info" />
                <StatCard
                  label="Finished receipts"
                  value={counts.receipt}
                  icon={<PackageCheck />}
                  tone="success"
                />
                <StatCard label="Customers" value={counts.customer} icon={<Building2 />} tone="default" />
              </div>
              <Card>
                <CardHeader>
                  <CardTitle>Forward trace</CardTitle>
                </CardHeader>
                <CardContent>
                  {tree && tree.children.length > 0 ? (
                    <TraceTree root={tree} now={now} />
                  ) : (
                    <EmptyState
                      compact
                      title="Not used yet"
                      description="This lot has not been consumed by any order."
                    />
                  )}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </>
  )
}
