import { fmtAgo, fmtNumber, fromInput, nowIso, toDateTimeInput } from '@mes/fixtures'
import type { LotStatus, MaterialLot } from '@mes/types'
import { LOT_STATUS_LABEL } from '@mes/types'
import {
  Button,
  Chip,
  ChipRow,
  type Column,
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
import { Boxes, Lock, PackageCheck, PackagePlus, PauseOctagon, Search } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { LotStatusBadge } from '../../components/badges'
import { MoLink, paths } from '../../components/links'
import { LocationPicker, MaterialPicker, SupplierPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'

const STATUS_CHIPS: LotStatus[] = ['available', 'reserved', 'staged', 'hold', 'consumed', 'returned']

export function FloorStockPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const [params, setParams] = useSearchParams()
  const [receiving, setReceiving] = useState(params.get('receive') === '1')
  const [query, setQuery] = useHistoryState('query', '')
  const [status, setStatus] = useHistoryState<LotStatus | null>('status', null)
  const [locationId, setLocationId] = useHistoryState<string | null>('location', null)
  const [materialId, setMaterialId] = useHistoryState<string | null>('material', null)
  const navigate = useNavigate()
  const table = useTableHistory()

  const moByLot = useMemo(
    () => new Map(s.floorStock.filter((f) => f.moId).map((f) => [f.lotId, f.moId!])),
    [s.floorStock],
  )

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase()
    return [...s.materialLots]
      .filter(
        (l) =>
          (!status || l.status === status) &&
          (!locationId || l.locationId === locationId) &&
          (!materialId || l.materialId === materialId) &&
          (!q || l.code.toLowerCase().includes(q)),
      )
      .sort((a, b) => b.receivedAt.localeCompare(a.receivedAt))
  }, [s.materialLots, query, status, locationId, materialId])

  const count = (st: LotStatus) => s.materialLots.filter((l) => l.status === st).length

  const closeReceive = () => {
    setReceiving(false)
    if (params.has('receive'))
      setParams(
        (p) => {
          p.delete('receive')
          return p
        },
        { replace: true },
      )
  }

  const columns: Column<MaterialLot>[] = [
    {
      id: 'lot',
      header: 'Lot',
      sortValue: (l) => l.code,
      cell: (l) => (
        <div className="min-w-0">
          <p className="text-xs font-semibold font-mono">{l.code}</p>
          <p className="text-sm truncate">{s.materialName(l.materialId)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <LotStatusBadge status={l.status} />
          </div>
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (l) => l.qty,
      cell: (l) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtNumber(l.qty, 2)} <span className="text-xs text-muted">{s.uomCode(l.uomId)}</span>
        </span>
      ),
    },
    {
      id: 'location',
      header: 'Location',
      hideBelow: 'md',
      sortValue: (l) => s.locationName(l.locationId),
      cell: (l) => s.locationName(l.locationId),
    },
    {
      id: 'supplier',
      header: 'Supplier',
      hideBelow: 'xl',
      sortValue: (l) => s.maps.supplier.get(l.supplierId ?? '')?.name ?? '',
      cell: (l) => (
        <span className="text-muted">{s.maps.supplier.get(l.supplierId ?? '')?.name ?? 'No supplier'}</span>
      ),
    },
    {
      id: 'status',
      header: 'Status',
      hideBelow: 'sm',
      sortValue: (l) => l.status,
      cell: (l) => <LotStatusBadge status={l.status} />,
    },
    {
      id: 'received',
      header: 'Received',
      hideBelow: 'lg',
      sortValue: (l) => l.receivedAt,
      cell: (l) => <span className="text-muted">{fmtAgo(l.receivedAt, now)}</span>,
    },
    {
      id: 'mo',
      header: 'Order',
      hideBelow: 'lg',
      cell: (l) =>
        moByLot.get(l.id) ? (
          <MoLink moId={moByLot.get(l.id)!} showProduct={false} />
        ) : (
          <span className="text-muted">—</span>
        ),
    },
  ]

  return (
    <>
      <PageHeader
        title="Floor stock"
        description="Material lots in the warehouse and on the floor, with what happened to each one."
        actions={
          <>
            <Input
              variant="pill"
              aria-label="Search lots"
              leftIcon={<Search />}
              placeholder="Search lot code"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 sm:w-64 sm:flex-none flex-1"
            />
            {can('inventory.manage') && (
              <Button onClick={() => setReceiving(true)}>
                <PackagePlus />
                Receive lot
              </Button>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Available"
            value={count('available')}
            hint="Free to reserve"
            icon={<Boxes />}
            tone="success"
            onClick={() => setStatus('available')}
          />
          <StatCard
            label="Reserved"
            value={count('reserved')}
            hint="Locked to an order"
            icon={<Lock />}
            tone="info"
            onClick={() => setStatus('reserved')}
          />
          <StatCard
            label="Staged"
            value={count('staged')}
            hint="At production staging"
            icon={<PackageCheck />}
            tone="ink"
            onClick={() => setStatus('staged')}
          />
          <StatCard
            label="On hold"
            value={count('hold')}
            hint="Blocked by quality"
            icon={<PauseOctagon />}
            tone={count('hold') ? 'danger' : 'default'}
            onClick={() => setStatus('hold')}
          />
        </div>

        <div className="gap-2 flex flex-wrap items-center">
          <ChipRow className="max-w-full">
            <Chip
              variant="filter"
              active={!status}
              count={s.materialLots.length}
              onClick={() => setStatus(null)}
            >
              All
            </Chip>
            {STATUS_CHIPS.map((st) => (
              <Chip
                key={st}
                variant="filter"
                active={status === st}
                count={count(st)}
                onClick={() => setStatus(status === st ? null : st)}
              >
                {LOT_STATUS_LABEL[st]}
              </Chip>
            ))}
          </ChipRow>
          <LocationPicker
            variant="inline"
            clearable
            value={locationId}
            onChange={setLocationId}
            placeholder="Any location"
            aria-label="Filter by location"
          />
          <MaterialPicker
            variant="inline"
            clearable
            value={materialId}
            onChange={setMaterialId}
            placeholder="Any material"
            aria-label="Filter by material"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          getRowKey={(l) => l.id}
          onRowClick={(l) => navigate(paths.lotDetail(l.id))}
          resetPageKey={`${query}|${status}|${locationId}|${materialId}`}
          empty={
            <EmptyState compact title="No lots match" description="Receive a lot or clear the filters." />
          }
          {...table}
        />
      </div>

      <ReceiveLotDialog
        open={receiving}
        onOpenChange={(open) => (open ? setReceiving(true) : closeReceive())}
      />
    </>
  )
}

function ReceiveLotDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent size="md">{open && <ReceiveForm onDone={() => onOpenChange(false)} />}</DialogContent>
    </Dialog>
  )
}

function ReceiveForm({ onDone }: { onDone: () => void }) {
  const s = useScoped()
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [supplierId, setSupplierId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [locationId, setLocationId] = useState<string | null>(null)
  const [receivedAt, setReceivedAt] = useState(toDateTimeInput(nowIso()))
  const [expiresAt, setExpiresAt] = useState('')
  const [tried, setTried] = useState(false)

  const material = materialId ? s.maps.material.get(materialId) : undefined
  const n = Number(qty)
  const errors = {
    material: !material ? 'Choose the material.' : null,
    qty: !(n > 0) ? 'Enter the received quantity.' : null,
    location: !locationId ? 'Choose the warehouse location.' : null,
    receivedAt: !receivedAt ? 'Enter the received date.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const pickMaterial = (id: string | null) => {
    setMaterialId(id)
    const m = id ? s.maps.material.get(id) : undefined
    if (m?.supplierId) setSupplierId(m.supplierId)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !material) return
    s.dispatch({
      type: 'materialLots/receive',
      lot: {
        siteId: s.siteId,
        materialId: material.id,
        supplierId,
        qty: n,
        uomId: material.uomId,
        locationId: locationId!,
        receivedAt: fromInput(receivedAt),
        expiresAt: expiresAt ? fromInput(expiresAt) : null,
      },
    })
    toast('Lot received', {
      tone: 'success',
      description: `${fmtNumber(n, 2)} ${s.uomCode(material.uomId)} ${material.name}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Receive lot</DialogTitle>
        <DialogDescription>
          Books a material lot into the warehouse so it can be reserved. Purchasing and goods receipt against
          a PO stay in the ERP.
        </DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Material" required error={show(errors.material)} className="sm:col-span-2">
          <MaterialPicker value={materialId} onChange={pickMaterial} invalid={!!show(errors.material)} />
        </FormField>
        <FormField label="Supplier" hint="Optional">
          <SupplierPicker value={supplierId} onChange={setSupplierId} clearable />
        </FormField>
        <FormField
          label="Quantity"
          required
          error={show(errors.qty)}
          hint={material ? `In ${s.uomCode(material.uomId)}` : 'Unit follows the material'}
        >
          <Input
            type="number"
            min={0}
            step="any"
            inputMode="decimal"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        <FormField label="Location" required error={show(errors.location)} className="sm:col-span-2">
          <LocationPicker
            kind="warehouse"
            value={locationId}
            onChange={setLocationId}
            invalid={!!show(errors.location)}
          />
        </FormField>
        <FormField label="Received" required error={show(errors.receivedAt)}>
          <Input
            type="datetime-local"
            value={receivedAt}
            onChange={(e) => setReceivedAt(e.target.value)}
            invalid={!!show(errors.receivedAt)}
          />
        </FormField>
        <FormField label="Expiry" hint="Optional">
          <Input type="date" value={expiresAt} onChange={(e) => setExpiresAt(e.target.value)} />
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
