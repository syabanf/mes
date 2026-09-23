import { fmtDateShort, fmtNumber, toMs } from '@mes/fixtures'
import type { Characteristic } from '@mes/types'
import { INSPECTION_TRIGGER_LABEL, MEASUREMENT_TYPE_LABEL } from '@mes/types'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  ChipRow,
  type Column,
  Combobox,
  DataTable,
  EmptyState,
  LineChart,
  PageHeader,
  SplitStats,
} from '@mes/ui'
import { useEffect, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { RevisionBadge } from '../../components/badges'
import { paths } from '../../components/links'
import { ProductPicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { useScoped } from '../../state/scoped'
import { numericResult, releasedSpecs } from './lib'

type Row = Characteristic & { specCode: string }

export function QualityChecksPage() {
  const s = useScoped()
  const [params, setParams] = useSearchParams()
  const productId = params.get('product')
  const [operation, setOperation] = useHistoryState<number | null>('operation', null)
  const [characteristicId, setCharacteristicId] = useHistoryState<string | null>('characteristic', null)

  // Default to the product with the most inspections, so the chart has something to show.
  useEffect(() => {
    if (productId) return
    const counts = new Map<string, number>()
    for (const i of s.inspections) counts.set(i.productId, (counts.get(i.productId) ?? 0) + 1)
    const best =
      [...counts].sort((a, b) => b[1] - a[1])[0]?.[0] ??
      s.products.find((p) => p.active && p.currentRevisionId)?.id
    if (best) setParams((p) => ({ ...Object.fromEntries(p), product: best }), { replace: true })
  }, [productId, s.inspections, s.products, setParams])

  const setProduct = (id: string | null) => {
    setOperation(null)
    setCharacteristicId(null)
    setParams(
      (p) => {
        if (id) p.set('product', id)
        else p.delete('product')
        return p
      },
      { replace: true },
    )
  }

  const { revision, specs } = useMemo(
    () => (productId ? releasedSpecs(s.state, productId) : { revision: undefined, specs: [] }),
    [s.state, productId],
  )
  const rows = useMemo<Row[]>(
    () =>
      specs
        .flatMap((spec) => spec.characteristics.map((c) => ({ ...c, specCode: spec.code })))
        .sort((a, b) => a.operationSeq - b.operationSeq || a.name.localeCompare(b.name)),
    [specs],
  )
  const operations = useMemo(
    () => [...new Set(rows.map((r) => r.operationSeq))].sort((a, b) => a - b),
    [rows],
  )
  const filtered = operation === null ? rows : rows.filter((r) => r.operationSeq === operation)
  const plans = useMemo(
    () =>
      s.inspectionPlans
        .filter((p) => p.productId === productId)
        .sort((a, b) => a.operationSeq - b.operationSeq),
    [s.inspectionPlans, productId],
  )
  const opName = (seq: number) =>
    s.bops.flatMap((b) => b.operations).find((o) => o.seq === seq)?.name ?? `Operation ${seq}`

  const numeric = rows.filter((r) => r.type === 'numeric')
  const chosen = numeric.find((c) => c.id === characteristicId) ?? numeric[0]
  const series = useMemo(() => {
    if (!chosen || !productId) return []
    return s.inspections
      .filter((i) => i.productId === productId && i.completedAt)
      .flatMap((i) =>
        i.measurements
          .filter((m) => m.characteristicId === chosen.id && m.value !== null)
          .map((m) => ({ at: i.completedAt!, code: i.code, value: m.value!, min: m.min, max: m.max })),
      )
      .sort((a, b) => toMs(a.at) - toMs(b.at))
      .slice(-20)
  }, [s.inspections, chosen, productId])
  const summary = useMemo(() => {
    if (!series.length) return null
    const values = series.map((p) => p.value)
    return {
      mean: values.reduce((a, b) => a + b, 0) / values.length,
      min: Math.min(...values),
      max: Math.max(...values),
      out: series.filter((p) => numericResult(p) === 'fail').length,
    }
  }, [series])

  const columns: Column<Row>[] = [
    {
      id: 'name',
      header: 'Characteristic',
      sortValue: (r) => r.name,
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-sm font-semibold">{r.name}</p>
          <p className="text-xs text-muted">
            {MEASUREMENT_TYPE_LABEL[r.type]} · <span className="font-mono">{r.specCode}</span>
          </p>
          <p className="mt-1 text-xs sm:hidden text-muted tabular-nums">{limitText(r)}</p>
        </div>
      ),
    },
    {
      id: 'target',
      header: 'Target',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.target ?? -Infinity,
      cell: (r) => <span className="tabular-nums">{r.target ?? '—'}</span>,
    },
    {
      id: 'min',
      header: 'Min',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.min ?? -Infinity,
      cell: (r) => <span className="tabular-nums">{r.min ?? '—'}</span>,
    },
    {
      id: 'max',
      header: 'Max',
      align: 'right',
      hideBelow: 'sm',
      sortValue: (r) => r.max ?? -Infinity,
      cell: (r) => <span className="tabular-nums">{r.max ?? '—'}</span>,
    },
    {
      id: 'unit',
      header: 'Unit',
      hideBelow: 'md',
      cell: (r) => <span className="text-sm text-muted">{r.unit || '—'}</span>,
    },
    {
      id: 'method',
      header: 'Method',
      hideBelow: 'lg',
      cell: (r) => <span className="text-sm">{r.method || '—'}</span>,
    },
    {
      id: 'op',
      header: 'Operation',
      hideBelow: 'md',
      sortValue: (r) => r.operationSeq,
      cell: (r) => (
        <span className="text-sm">
          {r.operationSeq} · {opName(r.operationSeq)}
        </span>
      ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Quality checks"
        description="The targets a product is inspected against, taken from the released revision in PLM, and the plans that decide when a check is raised."
        actions={
          <ProductPicker
            value={productId}
            onChange={setProduct}
            variant="inline"
            className="min-w-0 sm:w-80 sm:flex-none flex-1"
            aria-label="Product"
          />
        }
      />
      <div className="space-y-4">
        {!productId ? (
          <Card>
            <EmptyState
              title="Pick a product"
              description="Its released quality specification and inspection plans appear here."
            />
          </Card>
        ) : (
          <>
            <div className="gap-3 flex flex-wrap items-center">
              <span className="text-sm text-muted">Revision</span>
              {revision ? (
                <>
                  <span className="text-sm font-semibold font-mono">{revision.rev}</span>
                  <RevisionBadge state={revision.state} />
                  <Link to={paths.product(productId)} className="text-sm text-accent-strong hover:underline">
                    Open in PLM
                  </Link>
                </>
              ) : (
                <Badge variant="warning">No revision</Badge>
              )}
            </div>
            <ChipRow>
              <Chip
                variant="filter"
                active={operation === null}
                count={rows.length}
                onClick={() => setOperation(null)}
              >
                All operations
              </Chip>
              {operations.map((seq) => (
                <Chip
                  key={seq}
                  variant="filter"
                  active={operation === seq}
                  count={rows.filter((r) => r.operationSeq === seq).length}
                  onClick={() => setOperation(operation === seq ? null : seq)}
                >
                  {seq} · {opName(seq)}
                </Chip>
              ))}
            </ChipRow>
            <div className="gap-4 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] grid grid-cols-1">
              <DataTable
                columns={columns}
                rows={filtered}
                getRowKey={(r) => r.id}
                pageSize={0}
                resetPageKey={`${productId}|${operation}`}
                empty="No quality characteristics on the released revision. Add a quality specification in PLM."
              />
              <Card>
                <CardHeader>
                  <CardTitle>Inspection plans</CardTitle>
                  <CardDescription>When a check is raised for this product.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {plans.length === 0 ? (
                    <EmptyState
                      compact
                      title="No plans"
                      description="Without a plan, inspections are requested by hand and use the snapshot's spec."
                    />
                  ) : (
                    plans.map((p) => (
                      <div key={p.id} className="rounded-2xl p-3 bg-surface-2">
                        <div className="gap-2 flex flex-wrap items-center justify-between">
                          <span className="text-xs font-semibold font-mono">{p.code}</span>
                          <Badge variant="ink">{INSPECTION_TRIGGER_LABEL[p.trigger]}</Badge>
                        </div>
                        <p className="mt-1 text-xs text-muted">
                          Op {p.operationSeq} · {opName(p.operationSeq)} · every {p.every} · sample{' '}
                          {p.sampleSize} · {s.maps.specification.get(p.specId)?.code ?? p.specId}
                        </p>
                      </div>
                    ))
                  )}
                </CardContent>
              </Card>
            </div>
            <Card>
              <CardHeader
                action={
                  numeric.length > 0 && (
                    <Combobox
                      items={numeric}
                      value={chosen?.id ?? null}
                      onChange={setCharacteristicId}
                      variant="inline"
                      placeholder="Characteristic"
                      searchPlaceholder="Search characteristics"
                      getKey={(c) => c.id}
                      getLabel={(c) => c.name}
                      getDescription={(c) => `Op ${c.operationSeq} · ${c.unit}`}
                      aria-label="Characteristic"
                    />
                  )
                }
              >
                <CardTitle>Recent results</CardTitle>
                <CardDescription>Last 20 numeric readings against the specification limits.</CardDescription>
              </CardHeader>
              <CardContent>
                {!chosen ? (
                  <EmptyState
                    compact
                    title="No numeric characteristic"
                    description="Trend charts need a numeric measurement."
                  />
                ) : series.length === 0 ? (
                  <EmptyState
                    compact
                    title="No readings yet"
                    description={`Completed inspections that measure ${chosen.name} appear here.`}
                  />
                ) : (
                  <>
                    <LineChart
                      ariaLabel={`${chosen.name} readings`}
                      data={series.map((p) => ({ label: fmtDateShort(p.at), value: p.value }))}
                      height={220}
                      showDots
                      format={(v) => `${fmtNumber(v, 2)}`}
                      zones={
                        chosen.min !== null && chosen.max !== null
                          ? [{ from: chosen.min, to: chosen.max, tone: 'success' }]
                          : []
                      }
                      referenceLines={[
                        ...(chosen.target !== null
                          ? [
                              {
                                value: chosen.target,
                                label: `Target ${chosen.target}`,
                                tone: 'muted' as const,
                              },
                            ]
                          : []),
                        ...(chosen.min !== null
                          ? [{ value: chosen.min, label: `Min ${chosen.min}`, tone: 'danger' as const }]
                          : []),
                        ...(chosen.max !== null
                          ? [{ value: chosen.max, label: `Max ${chosen.max}`, tone: 'danger' as const }]
                          : []),
                      ]}
                    />
                    {summary && (
                      <SplitStats
                        className="mt-5"
                        items={[
                          { label: `Mean ${chosen.unit}`, value: fmtNumber(summary.mean, 2) },
                          { label: 'Lowest', value: fmtNumber(summary.min, 2) },
                          { label: 'Highest', value: fmtNumber(summary.max, 2) },
                          {
                            label: 'Out of spec',
                            value: <span className={summary.out ? 'text-accent' : ''}>{summary.out}</span>,
                          },
                        ]}
                      />
                    )}
                  </>
                )}
              </CardContent>
            </Card>
          </>
        )}
      </div>
    </>
  )
}

function limitText(c: Characteristic) {
  if (c.type !== 'numeric') return 'Judged pass or fail'
  return (
    [
      c.target !== null ? `target ${c.target}` : null,
      c.min !== null ? `min ${c.min}` : null,
      c.max !== null ? `max ${c.max}` : null,
    ]
      .filter(Boolean)
      .join(' · ') + (c.unit ? ` ${c.unit}` : '')
  )
}
