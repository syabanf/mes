import { traceBackward } from '@mes/fixtures'
import type { Serial } from '@mes/types'
import {
  Badge,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Combobox,
  EmptyState,
  Input,
  KeyValue,
  PageHeader,
} from '@mes/ui'
import { Hash, Search } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { MoLink, paths } from '../../components/links'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { TraceTree } from './TraceTree'

const STATUS_VARIANT: Record<Serial['status'], 'info' | 'success' | 'muted' | 'danger'> = {
  in_production: 'info',
  finished: 'success',
  delivered: 'muted',
  scrapped: 'danger',
}
const STATUS_LABEL: Record<Serial['status'], string> = {
  in_production: 'In production',
  finished: 'Finished',
  delivered: 'Delivered',
  scrapped: 'Scrapped',
}

export function SerialTracePage() {
  const s = useScoped()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const serialId = params.get('id')
  const [query, setQuery] = useHistoryState('query', '')

  const setSerial = (id: string | null) =>
    setParams(
      (p) => {
        if (id) p.set('id', id)
        else p.delete('id')
        return p
      },
      { replace: true },
    )

  const serials = useMemo(
    () => [...s.serials].sort((a, b) => a.serialNo.localeCompare(b.serialNo)),
    [s.serials],
  )
  const hits = useMemo(() => {
    const q = query.trim().toLowerCase()
    return q ? serials.filter((x) => x.serialNo.toLowerCase().includes(q)).slice(0, 12) : []
  }, [serials, query])

  const serial = serialId ? s.serials.find((x) => x.id === serialId) : undefined
  const receipt = serial?.receiptId
    ? s.finishedGoodsReceipts.find((r) => r.id === serial.receiptId)
    : undefined
  const tree = useMemo(() => (serial ? traceBackward(s.state, serial.moId) : null), [s.state, serial])

  return (
    <>
      <PageHeader
        title="Serial trace"
        description="Find one serialized piece and walk back through the order that made it: batches, operations, machines, operators and material lots."
        actions={
          <Combobox
            items={serials}
            value={serialId}
            onChange={setSerial}
            clearable
            variant="inline"
            placeholder="Pick a serial"
            searchPlaceholder="Search serial numbers"
            getKey={(x) => x.id}
            getLabel={(x) => x.serialNo}
            getDescription={(x) => `${s.productName(x.productId)} · ${STATUS_LABEL[x.status]}`}
            className="min-w-0 sm:w-72 sm:flex-none flex-1"
            aria-label="Serial"
          />
        }
      />
      <div className="space-y-4">
        <Card>
          <CardContent className="space-y-2 p-5">
            <Input
              variant="soft"
              aria-label="Search serial number"
              leftIcon={<Search />}
              placeholder="Type a serial number"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && hits[0]) setSerial(hits[0].id)
              }}
            />
            {query.trim() && (
              <div className="gap-2 flex flex-wrap">
                {hits.length === 0 ? (
                  <span className="text-sm text-muted">No serial matches.</span>
                ) : (
                  hits.map((x) => (
                    <button
                      key={x.id}
                      type="button"
                      onClick={() => setSerial(x.id)}
                      className="h-8 gap-2 px-3 text-xs font-semibold inline-flex items-center rounded-full bg-surface-2 font-mono hover:bg-surface"
                    >
                      <Hash className="size-3.5 text-muted" />
                      {x.serialNo}
                    </button>
                  ))
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {!serial ? (
          <Card>
            <EmptyState
              icon={<Hash />}
              title="No serial selected"
              description="Search or pick a serial number to see its record."
            />
          </Card>
        ) : (
          <div className="gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] grid grid-cols-1">
            <Card>
              <CardHeader>
                <CardTitle className="font-mono">{serial.serialNo}</CardTitle>
                <CardDescription>{s.productName(serial.productId)}</CardDescription>
              </CardHeader>
              <CardContent>
                <KeyValue
                  bare
                  items={[
                    {
                      label: 'Product',
                      value: (
                        <Link to={paths.product(serial.productId)} className="hover:text-accent">
                          {s.productName(serial.productId)}
                        </Link>
                      ),
                    },
                    { label: 'Order', value: <MoLink moId={serial.moId} /> },
                    {
                      label: 'WIP',
                      value: (
                        <Link to={paths.wip(serial.wipId!)} className="text-xs font-mono hover:text-accent">
                          {s.maps.wip.get(serial.wipId ?? '')?.code ?? serial.wipId}
                        </Link>
                      ),
                      hidden: !serial.wipId,
                    },
                    {
                      label: 'Receipt',
                      value: receipt ? (
                        <span className="text-xs font-mono">
                          {receipt.code} · lot {receipt.lotCode}
                        </span>
                      ) : (
                        'Not received yet'
                      ),
                    },
                    {
                      label: 'Customer',
                      value: serial.customerId
                        ? (s.maps.customer.get(serial.customerId)?.name ?? serial.customerId)
                        : 'Not delivered',
                    },
                    {
                      label: 'Status',
                      value: (
                        <Badge variant={STATUS_VARIANT[serial.status]}>{STATUS_LABEL[serial.status]}</Badge>
                      ),
                    },
                    {
                      label: 'Genealogy',
                      value: (
                        <Link
                          to={paths.genealogy(serial.moId)}
                          className="text-accent-strong hover:underline"
                        >
                          Open order genealogy
                        </Link>
                      ),
                    },
                  ]}
                />
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <CardTitle>Backward trace</CardTitle>
                <CardDescription>What went into the order this serial came from.</CardDescription>
              </CardHeader>
              <CardContent>
                {tree ? (
                  <TraceTree root={tree} now={now} />
                ) : (
                  <EmptyState
                    compact
                    title="Order not found"
                    description="The manufacturing order behind this serial is missing."
                  />
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </>
  )
}
