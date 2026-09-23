import { fmtNumber, fmtWhen, sumBy } from '@mes/fixtures'
import type { FgStock, FinishedGoodsReceipt, ManufacturingOrder } from '@mes/types'
import {
  Button,
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  Combobox,
  DataTable,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  StatCard,
  toast,
} from '@mes/ui'
import { CalendarRange, GitBranch, Lock, PackageCheck, Warehouse } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { MoLink, PersonChip, ProductLink, paths } from '../../components/links'
import { LocationPicker } from '../../components/pickers'
import { useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { isThisWeek, isToday } from './lib'

export function FinishedGoodsPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const [receiving, setReceiving] = useState(false)
  const table = useTableHistory()

  const receipts = useMemo(
    () => [...s.finishedGoodsReceipts].sort((a, b) => b.at.localeCompare(a.at)),
    [s.finishedGoodsReceipts],
  )
  const stats = useMemo(
    () => ({
      today: sumBy(
        receipts.filter((r) => isToday(r.at, now)),
        (r) => r.qty,
      ),
      week: sumBy(
        receipts.filter((r) => isThisWeek(r.at, now)),
        (r) => r.qty,
      ),
      onHand: sumBy(s.fgStock, (f) => f.qty),
      allocated: sumBy(s.fgStock, (f) => f.allocatedQty),
    }),
    [receipts, s.fgStock, now],
  )
  const latestMoByProduct = useMemo(() => {
    const map = new Map<string, string>()
    for (const r of receipts) if (!map.has(r.productId)) map.set(r.productId, r.moId)
    return map
  }, [receipts])

  const receiptColumns: Column<FinishedGoodsReceipt>[] = [
    {
      id: 'code',
      header: 'Receipt',
      sortValue: (r) => r.code,
      cell: (r) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{r.code}</p>
          <p className="text-sm truncate">{s.productName(r.productId)}</p>
          <p className="text-xs sm:hidden text-muted">{fmtWhen(r.at, now)}</p>
        </div>
      ),
    },
    { id: 'mo', header: 'Order', hideBelow: 'md', cell: (r) => <MoLink moId={r.moId} showProduct={false} /> },
    {
      id: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (r) => r.qty,
      cell: (r) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtNumber(r.qty)} <span className="text-xs text-muted">{s.uomCode(r.uomId)}</span>
        </span>
      ),
    },
    {
      id: 'lot',
      header: 'Lot',
      hideBelow: 'lg',
      cell: (r) => <span className="text-xs font-mono">{r.lotCode}</span>,
    },
    { id: 'location', header: 'Location', hideBelow: 'lg', cell: (r) => s.locationName(r.locationId) },
    {
      id: 'serials',
      header: 'Serials',
      hideBelow: 'xl',
      align: 'right',
      sortValue: (r) => r.serialIds.length,
      cell: (r) =>
        r.serialIds.length ? (
          <Link
            to={paths.serial(r.serialIds[0]!)}
            onClick={(e) => e.stopPropagation()}
            className="tabular-nums hover:text-accent hover:underline"
          >
            {fmtNumber(r.serialIds.length)}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: 'by',
      header: 'Received',
      hideBelow: 'sm',
      sortValue: (r) => r.at,
      cell: (r) => <PersonChip personId={r.by} hint={fmtWhen(r.at, now)} />,
    },
  ]

  const stockColumns: Column<FgStock>[] = [
    {
      id: 'product',
      header: 'Product',
      sortValue: (f) => s.productName(f.productId),
      cell: (f) => <ProductLink productId={f.productId} />,
    },
    { id: 'location', header: 'Location', hideBelow: 'md', cell: (f) => s.locationName(f.locationId) },
    {
      id: 'qty',
      header: 'On hand',
      align: 'right',
      sortValue: (f) => f.qty,
      cell: (f) => <span className="font-semibold tabular-nums">{fmtNumber(f.qty)}</span>,
    },
    {
      id: 'allocated',
      header: 'Allocated',
      hideBelow: 'sm',
      align: 'right',
      sortValue: (f) => f.allocatedQty,
      cell: (f) => <span className="text-muted tabular-nums">{fmtNumber(f.allocatedQty)}</span>,
    },
    {
      id: 'free',
      header: 'Free',
      align: 'right',
      sortValue: (f) => f.qty - f.allocatedQty,
      cell: (f) => <span className="tabular-nums">{fmtNumber(f.qty - f.allocatedQty)}</span>,
    },
    {
      id: 'trace',
      header: '',
      hideBelow: 'lg',
      align: 'right',
      cell: (f) => {
        const moId = latestMoByProduct.get(f.productId)
        return moId ? (
          <Button asChild variant="ghost" size="sm">
            <Link to={paths.genealogy(moId)}>
              <GitBranch />
              Trace
            </Link>
          </Button>
        ) : null
      },
    },
  ]

  return (
    <>
      <PageHeader
        title="Finished goods"
        description="Receipts from completed production and the stock they build. Shipping, invoicing and the warehouse ledger stay in the ERP and WMS."
        actions={
          can('inventory.manage') && (
            <Button onClick={() => setReceiving(true)}>
              <PackageCheck />
              Receive finished goods
            </Button>
          )
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Received today"
            value={fmtNumber(stats.today)}
            icon={<PackageCheck />}
            tone="ink"
          />
          <StatCard
            label="This week"
            value={fmtNumber(stats.week)}
            hint="Since Monday"
            icon={<CalendarRange />}
            tone="info"
          />
          <StatCard
            label="On hand"
            value={fmtNumber(stats.onHand)}
            hint="All finished goods locations"
            icon={<Warehouse />}
            tone="success"
          />
          <StatCard
            label="Allocated"
            value={fmtNumber(stats.allocated)}
            hint={`${fmtNumber(stats.onHand - stats.allocated)} free`}
            icon={<Lock />}
            tone="warning"
          />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Receipts</CardTitle>
            <CardDescription>
              One receipt per handover from production. Serial-controlled products get their serials generated
              here.
            </CardDescription>
          </CardHeader>
          <DataTable
            columns={receiptColumns}
            rows={receipts}
            getRowKey={(r) => r.id}
            empty={
              <EmptyState
                compact
                title="No receipts yet"
                description="Receive good quantity from a completed order."
              />
            }
            {...table}
          />
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Finished goods stock</CardTitle>
            <CardDescription>What make-to-stock demand allocates against.</CardDescription>
          </CardHeader>
          <DataTable
            columns={stockColumns}
            rows={s.fgStock}
            getRowKey={(f) => f.id}
            pageSize={0}
            empty={<EmptyState compact title="No stock" description="Stock builds from receipts." />}
          />
        </Card>
      </div>

      <Dialog open={receiving} onOpenChange={setReceiving}>
        <DialogContent size="sm">
          {receiving && <ReceiveForm onDone={() => setReceiving(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ReceiveForm({ onDone }: { onDone: () => void }) {
  const s = useScoped()
  const [moId, setMoId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [locationId, setLocationId] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const receivedByMo = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of s.finishedGoodsReceipts) map.set(r.moId, (map.get(r.moId) ?? 0) + r.qty)
    return map
  }, [s.finishedGoodsReceipts])
  const remaining = (m: ManufacturingOrder) => m.goodQty - (receivedByMo.get(m.id) ?? 0)
  const orders = useMemo(
    () =>
      s.manufacturingOrders
        .filter((m) => m.status === 'completed' && remaining(m) > 0)
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [s.manufacturingOrders, receivedByMo],
  )

  const mo = orders.find((m) => m.id === moId)
  const product = mo ? s.maps.product.get(mo.productId) : undefined
  const n = Number(qty)
  const errors = {
    mo: !mo ? 'Choose the order.' : null,
    qty:
      !Number.isSafeInteger(n) || n <= 0
        ? 'Enter a positive whole quantity.'
        : mo && n > remaining(mo)
          ? `Only ${fmtNumber(remaining(mo))} good pieces left to receive.`
          : null,
    location: !locationId ? 'Choose the finished goods location.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !mo || !locationId) return
    s.dispatch({ type: 'finishedGoods/receive', moId: mo.id, qty: n, locationId })
    toast('Finished goods received', {
      tone: 'success',
      description: `${fmtNumber(n)} ${s.productName(mo.productId)} from ${mo.code}${product?.serialControlled ? ', serials generated' : ''}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Receive finished goods</DialogTitle>
        <DialogDescription>
          Moves good quantity from an order into stock. Serial-controlled products get one serial per piece.
        </DialogDescription>
      </DialogHeader>
      <div className="space-y-4">
        <FormField
          label="Manufacturing order"
          required
          error={show(errors.mo)}
          hint={orders.length === 0 ? 'No order has unreceived good quantity.' : undefined}
        >
          <Combobox
            items={orders}
            value={moId}
            onChange={(id) => {
              setMoId(id)
              const m = orders.find((x) => x.id === id)
              setQty(m ? String(remaining(m)) : '')
            }}
            placeholder="Select order"
            searchPlaceholder="Search orders"
            getKey={(m) => m.id}
            getLabel={(m) => m.code}
            getDescription={(m) =>
              `${s.productName(m.productId)} · ${fmtNumber(remaining(m))} good to receive · ${m.status}`
            }
            invalid={!!show(errors.mo)}
          />
        </FormField>
        <FormField
          label="Quantity"
          required
          error={show(errors.qty)}
          hint={
            mo
              ? `${fmtNumber(remaining(mo))} ${s.uomCode(mo.uomId)} remaining${product?.serialControlled ? ' · serial controlled' : ''}`
              : undefined
          }
        >
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        <FormField label="Location" required error={show(errors.location)}>
          <LocationPicker
            kind="finished_goods"
            value={locationId}
            onChange={setLocationId}
            invalid={!!show(errors.location)}
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Receive</Button>
      </DialogFooter>
    </form>
  )
}
