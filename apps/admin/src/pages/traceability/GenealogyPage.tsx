import { fmtDateTime, fmtNumber, plural, traceBackward } from '@mes/fixtures'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  EmptyState,
  KeyValue,
  PageHeader,
  SplitStats,
  toast,
} from '@mes/ui'
import { ChevronRight, Download, GitBranch } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { InspectionStatusBadge, MoStatusBadge, WoStatusBadge } from '../../components/badges'
import { PersonChip, WoLink, paths } from '../../components/links'
import { MoPicker } from '../../components/pickers'
import { useNow, useScoped } from '../../state/scoped'
import { TraceTree } from './TraceTree'
import { countKinds, downloadJson, manufacturingRecord } from './lib'

const traceable = (status: string) =>
  status === 'in_progress' || status === 'completed' || status === 'closed'

export function GenealogyPage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const moId = params.get('mo')

  const setMo = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('mo', id)
        else p.delete('mo')
        return p
      },
      { replace: true },
    )

  const mo = moId ? s.maps.mo.get(moId) : undefined
  const tree = useMemo(() => (moId ? traceBackward(s.state, moId) : null), [s.state, moId])
  const counts = useMemo(() => countKinds(tree), [tree])
  const record = useMemo(() => (moId ? manufacturingRecord(s.state, moId) : null), [s.state, moId])

  const summary = [
    { label: 'Finished product', count: counts.product },
    { label: 'Batch', count: counts.batch },
    { label: 'WIP', count: counts.wip },
    { label: 'Operations', count: counts.operation },
    { label: 'Machine', count: counts.machine },
    { label: 'Operator', count: counts.operator },
    { label: 'Material lot', count: counts.lot },
    { label: 'Supplier', count: counts.supplier },
  ]

  const exportRecord = () => {
    if (!record || !mo) return
    downloadJson(`${mo.code}-manufacturing-record.json`, {
      exportedAt: new Date().toISOString(),
      site: s.site.code,
      ...record,
    })
    toast('Record exported', { tone: 'success', description: `${mo.code}-manufacturing-record.json` })
  }

  return (
    <>
      <PageHeader
        title="Genealogy"
        description="Backward trace from a finished order: batches, operations, the machines and operators that ran them, and the material lots and suppliers behind them."
        actions={
          <MoPicker
            value={moId}
            onChange={setMo}
            clearable
            variant="inline"
            filter={traceable}
            placeholder="Select order"
            className="min-w-0 sm:w-80 sm:flex-none flex-1"
            aria-label="Manufacturing order"
          />
        }
      />
      <div className="space-y-4">
        {!mo || !tree || !record ? (
          <Card>
            <EmptyState
              icon={<GitBranch />}
              title="Pick an order"
              description="Running, completed and closed orders have a genealogy."
            />
          </Card>
        ) : (
          <>
            <Card className="p-4">
              <p className="mb-2 text-xs font-semibold tracking-wider text-muted uppercase">
                Genealogy summary
              </p>
              <ol className="gap-1 pb-1 no-scrollbar flex items-center overflow-x-auto">
                {summary.map((step, i) => (
                  <li key={step.label} className="gap-1 flex shrink-0 items-center">
                    <span className="h-10 gap-2 px-4 text-sm font-semibold inline-flex items-center rounded-full bg-surface-2">
                      {step.label}
                      <span className="px-1.5 font-bold rounded-full bg-card py-px text-[10px] tabular-nums shadow-card">
                        {step.count}
                      </span>
                    </span>
                    {i < summary.length - 1 && <ChevronRight className="size-4 text-muted" />}
                  </li>
                ))}
              </ol>
            </Card>

            <div className="gap-4 xl:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] grid grid-cols-1">
              <Card>
                <CardHeader
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link to={paths.mo(mo.id)}>Open order</Link>
                    </Button>
                  }
                >
                  <CardTitle className="gap-2 flex flex-wrap items-center">
                    {mo.code} <MoStatusBadge status={mo.status} />
                  </CardTitle>
                  <CardDescription>{s.productName(mo.productId)}</CardDescription>
                </CardHeader>
                <CardContent>
                  <TraceTree root={tree} now={now} expandDepth={3} />
                </CardContent>
              </Card>

              <Card>
                <CardHeader
                  action={
                    <Button variant="outline" size="sm" onClick={exportRecord}>
                      <Download />
                      Export record
                    </Button>
                  }
                >
                  <CardTitle>Electronic manufacturing record</CardTitle>
                  <CardDescription>All evidence collected for this order.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-5">
                  <KeyValue
                    bare
                    items={[
                      { label: 'Revision', value: mo.snapshot?.rev ?? 'No snapshot' },
                      {
                        label: 'Started',
                        value: mo.actualStart ? fmtDateTime(mo.actualStart) : 'Not started',
                      },
                      { label: 'Finished', value: mo.actualEnd ? fmtDateTime(mo.actualEnd) : 'Running' },
                      {
                        label: 'Output',
                        value: `${fmtNumber(mo.goodQty)} good · ${fmtNumber(mo.rejectQty)} reject · ${fmtNumber(mo.reworkQty)} rework · ${fmtNumber(mo.scrapQty)} scrap`,
                      },
                    ]}
                  />

                  <Section title="Work orders" count={record.workOrders.length}>
                    {s.workOrders
                      .filter((w) => w.moId === mo.id)
                      .sort((a, b) => a.operationSeq - b.operationSeq)
                      .map((w) => (
                        <div key={w.id} className="rounded-2xl p-3 bg-surface-2">
                          <div className="gap-2 flex flex-wrap items-center justify-between">
                            <span className="text-sm font-semibold">
                              {w.operationSeq} · {w.operationName}{' '}
                              <WoLink woId={w.id} className="ml-1 text-muted" />
                            </span>
                            <WoStatusBadge status={w.status} />
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {w.actualStart
                              ? `${fmtDateTime(w.actualStart)} → ${w.actualEnd ? fmtDateTime(w.actualEnd) : 'running'}`
                              : 'Not started'}{' '}
                            · {s.maps.machine.get(w.machineId ?? '')?.code ?? 'no machine'} ·{' '}
                            {fmtNumber(w.goodQty)} good
                          </p>
                          {w.operatorIds.length > 0 && (
                            <div className="mt-2 gap-3 text-xs flex flex-wrap">
                              {w.operatorIds.map((id) => (
                                <PersonChip key={id} personId={id} />
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                  </Section>

                  <Section title="Inspections" count={record.inspections.length}>
                    {s.inspections
                      .filter((i) => i.moId === mo.id)
                      .map((i) => (
                        <Link
                          key={i.id}
                          to={paths.inspection(i.id)}
                          className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 hover:bg-surface"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="text-xs font-semibold block font-mono">{i.code}</span>
                            <span className="text-xs block text-muted">
                              Op {i.operationSeq} · {i.measurements.filter((m) => m.result === 'pass').length}
                              /{i.measurements.length} pass · {i.disposition ?? 'no disposition'}
                            </span>
                          </span>
                          <InspectionStatusBadge status={i.status} />
                        </Link>
                      ))}
                  </Section>

                  <Section title="Material consumption" count={record.consumption.length}>
                    {record.consumption.map((c, i) => (
                      <div key={i} className="gap-3 rounded-2xl p-3 text-sm flex items-center bg-surface-2">
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold block truncate">{c.material}</span>
                          <span className="text-xs block truncate text-muted">
                            lot {c.lot} · op {c.operationSeq ?? '?'} · {c.by ?? 'system'}
                          </span>
                        </span>
                        <span className="font-bold tabular-nums">{fmtNumber(c.qty, 2)}</span>
                      </div>
                    ))}
                  </Section>

                  <SplitStats
                    items={[
                      { label: 'Holds', value: record.holds.length },
                      { label: 'Scrap entries', value: record.scrap.length },
                      { label: 'Rework orders', value: record.rework.length },
                      { label: 'Events', value: record.events.length },
                    ]}
                  />
                </CardContent>
              </Card>
            </div>
          </>
        )}
      </div>
    </>
  )
}

function Section({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <div>
      <p className="mb-2 text-sm font-semibold">
        {title} <span className="text-xs font-medium text-muted">{plural(count, 'record')}</span>
      </p>
      {count === 0 ? (
        <p className="text-sm text-muted">None recorded.</p>
      ) : (
        <div className="space-y-2">{children}</div>
      )}
    </div>
  )
}
