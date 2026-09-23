import { fmtNumber, fmtWhen, sumBy } from '@mes/fixtures'
import type { MaterialTxn } from '@mes/types'
import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  type Column,
  DataTable,
  EmptyState,
  FormField,
  Input,
  PageHeader,
  StatCard,
  toast,
} from '@mes/ui'
import { CalendarRange, Tag, Undo2 } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { MoLink, PersonChip, paths } from '../../components/links'
import { LocationPicker, MoPicker, ReasonPicker } from '../../components/pickers'
import { useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { LotCombobox, RequirementCombobox } from './dialogs'
import { isThisMonth, isToday, rankBy } from './lib'

const returnableFilter = (status: string) =>
  status === 'released' || status === 'in_progress' || status === 'completed'

export function ReturnPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const table = useTableHistory()

  const returns = useMemo(
    () => s.materialTxns.filter((t) => t.kind === 'return').sort((a, b) => b.at.localeCompare(a.at)),
    [s.materialTxns],
  )
  const stats = useMemo(
    () => ({
      today: sumBy(
        returns.filter((t) => isToday(t.at, now)),
        (t) => t.qty,
      ),
      month: sumBy(
        returns.filter((t) => isThisMonth(t.at, now)),
        (t) => t.qty,
      ),
      topReason:
        rankBy(
          returns.filter((t) => t.note),
          (t) => t.note,
          (t) => t.qty,
        )[0] ?? null,
    }),
    [returns, now],
  )

  const columns: Column<MaterialTxn>[] = [
    {
      id: 'when',
      header: 'When',
      sortValue: (t) => t.at,
      cell: (t) => <span className="whitespace-nowrap text-muted">{fmtWhen(t.at, now)}</span>,
    },
    {
      id: 'material',
      header: 'Material',
      sortValue: (t) => s.materialName(t.materialId),
      cell: (t) => (
        <div className="min-w-0">
          <p className="font-medium truncate">{s.materialName(t.materialId)}</p>
          {t.lotId && (
            <Link
              to={paths.lotDetail(t.lotId)}
              onClick={(e) => e.stopPropagation()}
              className="font-mono text-[11px] text-muted hover:text-accent"
            >
              {s.maps.lot.get(t.lotId)?.code}
            </Link>
          )}
        </div>
      ),
    },
    {
      id: 'qty',
      header: 'Quantity',
      align: 'right',
      sortValue: (t) => t.qty,
      cell: (t) => (
        <span className="whitespace-nowrap tabular-nums">
          {fmtNumber(t.qty, 2)} <span className="text-xs text-muted">{s.uomCode(t.uomId)}</span>
        </span>
      ),
    },
    {
      id: 'mo',
      header: 'Order',
      hideBelow: 'md',
      cell: (t) => (t.moId ? <MoLink moId={t.moId} showProduct={false} /> : '—'),
    },
    { id: 'to', header: 'Returned to', hideBelow: 'lg', cell: (t) => s.locationName(t.toLocationId) },
    {
      id: 'reason',
      header: 'Reason',
      hideBelow: 'sm',
      cell: (t) => t.note || <span className="text-muted">—</span>,
    },
    { id: 'by', header: 'By', hideBelow: 'xl', cell: (t) => <PersonChip personId={t.by} /> },
  ]

  return (
    <>
      <PageHeader
        title="Material return"
        description="Unused issued material goes back to a return location, the lot becomes available again and the requirement line drops the issued quantity. Credit notes and the warehouse ledger stay in the ERP."
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-3 grid grid-cols-2">
          <StatCard
            label="Returned today"
            value={fmtNumber(stats.today, 1)}
            hint="Across all units"
            icon={<Undo2 />}
            tone="ink"
          />
          <StatCard
            label="This month"
            value={fmtNumber(stats.month, 1)}
            icon={<CalendarRange />}
            tone="info"
          />
          <StatCard
            label="Top reason"
            value={stats.topReason?.key ?? '—'}
            hint={stats.topReason ? `${fmtNumber(stats.topReason.value, 1)} returned` : 'No returns yet'}
            icon={<Tag />}
            tone="warning"
            className="xl:col-span-1 col-span-2"
          />
        </div>

        <div className="gap-4 xl:grid-cols-[minmax(0,26rem)_1fr] grid grid-cols-1">
          {can('inventory.manage') ? (
            <ReturnForm />
          ) : (
            <Card>
              <EmptyState
                compact
                title="Returns need the inventory permission"
                description="Supervisors and warehouse staff book returns."
              />
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Return transactions</CardTitle>
              <CardDescription>Newest first.</CardDescription>
            </CardHeader>
            <DataTable
              columns={columns}
              rows={returns}
              getRowKey={(t) => t.id}
              empty={
                <EmptyState
                  compact
                  title="No returns yet"
                  description="Book a return on the left and it appears here."
                />
              }
              {...table}
            />
          </Card>
        </div>
      </div>
    </>
  )
}

function ReturnForm() {
  const s = useScoped()
  const [moId, setMoId] = useState<string | null>(null)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [lotId, setLotId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [locationId, setLocationId] = useState<string | null>(null)
  const [reasonId, setReasonId] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const requirement = s.materialRequirements.find((r) => r.moId === moId && r.materialId === materialId)
  // Lots that were staged or issued to this order, and still hold quantity.
  const lots = useMemo(() => {
    const ids = new Set(
      s.materialTxns
        .filter(
          (t) =>
            t.moId === moId &&
            t.materialId === materialId &&
            (t.kind === 'issue' || t.kind === 'stage') &&
            t.lotId,
        )
        .map((t) => t.lotId!),
    )
    return s.materialLots.filter(
      (l) => ids.has(l.id) && l.qty > 0 && l.status !== 'consumed' && l.status !== 'returned',
    )
  }, [s.materialTxns, s.materialLots, moId, materialId])
  const lot = lots.find((l) => l.id === lotId)
  const n = Number(qty)
  const errors = {
    mo: !moId ? 'Choose the order.' : null,
    material: !materialId ? 'Choose the material.' : null,
    lot: !lot ? 'Choose the lot to return.' : null,
    qty: !(n > 0)
      ? 'Enter the quantity.'
      : lot && n > lot.qty
        ? `Only ${fmtNumber(lot.qty, 2)} left in this lot.`
        : null,
    location: !locationId ? 'Choose the return location.' : null,
    reason: !reasonId ? 'Choose a return reason.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !moId || !materialId || !lot || !locationId || !reasonId)
      return
    s.dispatch({
      type: 'materials/return',
      moId,
      materialId,
      lotId: lot.id,
      qty: n,
      toLocationId: locationId,
      reasonCodeId: reasonId,
    })
    toast('Material returned', {
      tone: 'success',
      description: `${fmtNumber(n, 2)} ${s.uomCode(lot.uomId)} ${s.materialName(materialId)} to ${s.locationName(locationId)}`,
    })
    setLotId(null)
    setQty('')
    setTried(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Return material</CardTitle>
        <CardDescription>Floor → return location.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField label="Manufacturing order" required error={show(errors.mo)}>
            <MoPicker
              value={moId}
              onChange={(id) => {
                setMoId(id)
                setMaterialId(null)
                setLotId(null)
                setQty('')
              }}
              filter={returnableFilter}
              invalid={!!show(errors.mo)}
            />
          </FormField>
          <FormField label="Material" required error={show(errors.material)}>
            <RequirementCombobox
              moId={moId}
              value={materialId}
              onChange={(id) => {
                setMaterialId(id)
                setLotId(null)
                const r = s.materialRequirements.find((x) => x.moId === moId && x.materialId === id)
                setQty(r && r.issuedQty > 0 ? String(r.issuedQty) : '')
              }}
              invalid={!!show(errors.material)}
            />
          </FormField>
          <FormField
            label="Lot"
            required
            error={show(errors.lot)}
            hint={
              materialId && lots.length === 0
                ? 'Nothing was staged or issued to this order for this material.'
                : undefined
            }
          >
            <LotCombobox
              lots={lots}
              value={lotId}
              onChange={setLotId}
              disabled={!materialId}
              invalid={!!show(errors.lot)}
            />
          </FormField>
          <FormField
            label="Quantity"
            required
            error={show(errors.qty)}
            hint={
              requirement
                ? `${fmtNumber(requirement.issuedQty, 2)} ${s.uomCode(requirement.uomId)} issued, ${fmtNumber(requirement.returnedQty, 2)} already returned`
                : undefined
            }
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
          <FormField label="Return location" required error={show(errors.location)}>
            <LocationPicker
              kind="return"
              value={locationId}
              onChange={setLocationId}
              invalid={!!show(errors.location)}
            />
          </FormField>
          <FormField label="Reason" required error={show(errors.reason)}>
            <ReasonPicker
              kind="return"
              value={reasonId}
              onChange={setReasonId}
              invalid={!!show(errors.reason)}
            />
          </FormField>
          <Button type="submit" className="w-full">
            <Undo2 />
            Return material
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
