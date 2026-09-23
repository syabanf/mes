import { fmtDateTime, fmtNumber, fmtWhen } from '@mes/fixtures'
import type { ConsumptionMode, MaterialTxn } from '@mes/types'
import { CONSUMPTION_MODE_LABEL } from '@mes/types'
import {
  Badge,
  BarList,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  ChipRow,
  type Column,
  DataTable,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  NativeSelect,
  PageHeader,
  toast,
} from '@mes/ui'
import { Flame } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { MoPicker } from '../../components/pickers'
import { useHistoryState, useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { LotCombobox, RequirementCombobox, WoCombobox, useMaterialLots } from './dialogs'
import { CONSUMABLE_LOT_STATUSES, isToday, rankBy } from './lib'

const MODES: ConsumptionMode[] = ['manual', 'scan', 'automatic']
const MODE_OPTIONS = MODES.map((m) => ({ value: m, label: CONSUMPTION_MODE_LABEL[m] }))
const activeFilter = (status: string) => status === 'released' || status === 'in_progress'

export function ConsumptionPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const [mode, setMode] = useHistoryState<ConsumptionMode | null>('mode', null)
  const table = useTableHistory()

  const all = useMemo(
    () => s.materialTxns.filter((t) => t.kind === 'consume').sort((a, b) => b.at.localeCompare(a.at)),
    [s.materialTxns],
  )
  const rows = useMemo(() => all.filter((t) => !mode || t.mode === mode), [all, mode])
  const today = useMemo(
    () =>
      rankBy(
        all.filter((t) => isToday(t.at, now)),
        (t) => t.materialId,
        (t) => t.qty,
      ),
    [all, now],
  )
  const latest = all[0]

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
          <div className="mt-1.5 sm:hidden">
            <Badge variant="outline">{CONSUMPTION_MODE_LABEL[t.mode]}</Badge>
          </div>
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
    {
      id: 'wo',
      header: 'Work order',
      hideBelow: 'lg',
      cell: (t) => (t.woId ? <WoLink woId={t.woId} /> : '—'),
    },
    {
      id: 'op',
      header: 'Op',
      hideBelow: 'lg',
      align: 'center',
      cell: (t) => <span className="tabular-nums">{t.operationSeq ?? '—'}</span>,
    },
    {
      id: 'mode',
      header: 'Mode',
      hideBelow: 'sm',
      sortValue: (t) => t.mode,
      cell: (t) => (
        <Badge variant={t.mode === 'automatic' ? 'info' : 'outline'}>{CONSUMPTION_MODE_LABEL[t.mode]}</Badge>
      ),
    },
    { id: 'by', header: 'Operator', hideBelow: 'xl', cell: (t) => <PersonChip personId={t.by} /> },
  ]

  return (
    <>
      <PageHeader
        title="Consumption"
        description="Material used up by an operation. Every record names the lot, so a finished product traces back to what went into it."
      />
      <div className="gap-4 xl:grid-cols-[minmax(0,26rem)_1fr] grid grid-cols-1">
        <div className="space-y-4">
          {can('shopfloor.execute') || can('inventory.manage') ? (
            <ConsumeForm />
          ) : (
            <Card>
              <EmptyState
                compact
                title="Recording needs a shop floor role"
                description="Operators and supervisors record consumption at the station."
              />
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Consumed today</CardTitle>
              <CardDescription>Per material, in the material's own unit.</CardDescription>
            </CardHeader>
            <CardContent>
              {today.length === 0 ? (
                <EmptyState
                  compact
                  icon={<Flame />}
                  title="Nothing consumed today"
                  description="Records made today add up here."
                />
              ) : (
                <BarList
                  items={today.slice(0, 8).map((r) => ({
                    key: r.key,
                    label: s.materialName(r.key),
                    value: r.value,
                    display: `${fmtNumber(r.value, 1)} ${s.uomCode(s.maps.material.get(r.key)?.uomId ?? '')}`,
                    hint: `${r.count} records`,
                  }))}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>Traceability answer</CardTitle>
              <CardDescription>
                For every consumption the system knows the material, lot, quantity, source location, order,
                work order, operation, time and operator.
              </CardDescription>
            </CardHeader>
            <CardContent>
              {latest ? (
                <KeyValue
                  bare
                  items={[
                    { label: 'Material', value: s.materialName(latest.materialId) },
                    {
                      label: 'Lot',
                      value: latest.lotId ? (
                        <Link
                          to={paths.lotDetail(latest.lotId)}
                          className="text-xs font-mono hover:text-accent"
                        >
                          {s.maps.lot.get(latest.lotId)?.code}
                        </Link>
                      ) : (
                        'Not lot controlled'
                      ),
                    },
                    { label: 'Quantity', value: `${fmtNumber(latest.qty, 2)} ${s.uomCode(latest.uomId)}` },
                    { label: 'From', value: s.locationName(latest.fromLocationId) },
                    {
                      label: 'Order',
                      value: latest.moId ? <MoLink moId={latest.moId} showProduct={false} /> : '—',
                    },
                    { label: 'Work order', value: latest.woId ? <WoLink woId={latest.woId} /> : '—' },
                    { label: 'Operation', value: latest.operationSeq ?? '—' },
                    { label: 'Time', value: fmtDateTime(latest.at) },
                    { label: 'Operator', value: <PersonChip personId={latest.by} /> },
                  ]}
                />
              ) : (
                <EmptyState
                  compact
                  title="No record yet"
                  description="The latest consumption is shown here as the worked example."
                />
              )}
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <ChipRow className="max-w-full">
            <Chip variant="filter" active={!mode} count={all.length} onClick={() => setMode(null)}>
              All
            </Chip>
            {MODES.map((m) => (
              <Chip
                key={m}
                variant="filter"
                active={mode === m}
                count={all.filter((t) => t.mode === m).length}
                onClick={() => setMode(mode === m ? null : m)}
              >
                {CONSUMPTION_MODE_LABEL[m]}
              </Chip>
            ))}
          </ChipRow>
          <Card>
            <DataTable
              columns={columns}
              rows={rows}
              getRowKey={(t) => t.id}
              resetPageKey={mode}
              empty={
                <EmptyState
                  compact
                  title="No consumption records"
                  description="Records appear when an operation consumes an issued lot."
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

function ConsumeForm() {
  const s = useScoped()
  const [moId, setMoId] = useState<string | null>(null)
  const [woId, setWoId] = useState<string | null>(null)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [lotId, setLotId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [mode, setMode] = useState<ConsumptionMode>('manual')
  const [tried, setTried] = useState(false)

  const requirement = s.materialRequirements.find((r) => r.moId === moId && r.materialId === materialId)
  const lots = useMaterialLots(materialId, CONSUMABLE_LOT_STATUSES)
  const lot = lots.find((l) => l.id === lotId)
  const n = Number(qty)
  const errors = {
    mo: !moId ? 'Choose the order.' : null,
    wo: !woId ? 'Choose the work order that consumed it.' : null,
    material: !materialId ? 'Choose the material.' : null,
    lot: !lot ? 'Choose the lot.' : null,
    qty: !(n > 0)
      ? 'Enter the quantity.'
      : lot && n > lot.qty
        ? `Only ${fmtNumber(lot.qty, 2)} left in this lot.`
        : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !moId || !woId || !materialId || !lot) return
    s.dispatch({ type: 'materials/consume', moId, woId, materialId, lotId: lot.id, qty: n, mode })
    toast('Consumption recorded', {
      tone: 'success',
      description: `${fmtNumber(n, 2)} ${s.uomCode(lot.uomId)} ${s.materialName(materialId)} from lot ${lot.code}`,
    })
    setLotId(null)
    setQty('')
    setTried(false)
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record consumption</CardTitle>
        <CardDescription>Manual entry for what the station did not scan.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField label="Manufacturing order" required error={show(errors.mo)}>
            <MoPicker
              value={moId}
              onChange={(id) => {
                setMoId(id)
                setWoId(null)
                setMaterialId(null)
                setLotId(null)
                setQty('')
              }}
              filter={activeFilter}
              invalid={!!show(errors.mo)}
            />
          </FormField>
          <FormField label="Work order" required error={show(errors.wo)}>
            <WoCombobox moId={moId} value={woId} onChange={setWoId} invalid={!!show(errors.wo)} />
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
          <FormField label="Lot" required error={show(errors.lot)}>
            <LotCombobox
              lots={lots}
              value={lotId}
              onChange={setLotId}
              disabled={!materialId}
              invalid={!!show(errors.lot)}
            />
          </FormField>
          <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
            <FormField
              label="Quantity"
              required
              error={show(errors.qty)}
              hint={
                requirement
                  ? `${fmtNumber(requirement.issuedQty, 2)} ${s.uomCode(requirement.uomId)} issued`
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
            <FormField label="Mode">
              <NativeSelect
                options={MODE_OPTIONS}
                value={mode}
                onChange={(e) => setMode(e.target.value as ConsumptionMode)}
              />
            </FormField>
          </div>
          <Button type="submit" className="w-full">
            <Flame />
            Record consumption
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
