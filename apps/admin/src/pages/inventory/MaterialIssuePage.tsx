import { fmtNumber, fmtWhen, sumBy } from '@mes/fixtures'
import type { MaterialRequirement, MaterialTxn } from '@mes/types'
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
  cn,
  toast,
} from '@mes/ui'
import { ArrowRight, Clock, Forklift, PackageCheck } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { RequirementBadge } from '../../components/badges'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { MoPicker } from '../../components/pickers'
import { useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { LotCombobox, WoCombobox, useMaterialLots } from './dialogs'
import { ISSUABLE_LOT_STATUSES, isToday, remainingToIssue } from './lib'

const activeFilter = (status: string) => status === 'released' || status === 'in_progress'

export function MaterialIssuePage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const table = useTableHistory()

  const issues = useMemo(
    () => s.materialTxns.filter((t) => t.kind === 'issue').sort((a, b) => b.at.localeCompare(a.at)),
    [s.materialTxns],
  )
  const stats = useMemo(() => {
    const active = new Set(s.manufacturingOrders.filter((m) => activeFilter(m.status)).map((m) => m.id))
    const lines = s.materialRequirements.filter((r) => active.has(r.moId))
    return {
      issuedToday: sumBy(
        issues.filter((t) => isToday(t.at, now)),
        (t) => t.qty,
      ),
      awaiting: lines.filter((r) => r.stagedQty > 0).length,
      staged: sumBy(lines, (r) => r.stagedQty),
    }
  }, [s.manufacturingOrders, s.materialRequirements, issues, now])

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
    {
      id: 'wo',
      header: 'Work order',
      hideBelow: 'lg',
      cell: (t) => (t.woId ? <WoLink woId={t.woId} /> : <span className="text-muted">Order level</span>),
    },
    { id: 'by', header: 'By', hideBelow: 'xl', cell: (t) => <PersonChip personId={t.by} /> },
  ]

  return (
    <>
      <PageHeader
        title="Material issue"
        description="Hand staged material to production. Floor stock moves from staging to the floor and the requirement line records it as issued."
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-3 grid grid-cols-2">
          <StatCard
            label="Issued today"
            value={fmtNumber(stats.issuedToday, 1)}
            hint="Across all units"
            icon={<Forklift />}
            tone="ink"
          />
          <StatCard
            label="Awaiting issue"
            value={stats.awaiting}
            hint="Lines staged but not issued"
            icon={<Clock />}
            tone={stats.awaiting ? 'warning' : 'success'}
          />
          <StatCard
            label="Staged quantity"
            value={fmtNumber(stats.staged, 1)}
            hint="Ready at staging"
            icon={<PackageCheck />}
            tone="info"
            className="xl:col-span-1 col-span-2"
          />
        </div>

        <div className="gap-4 xl:grid-cols-[minmax(0,26rem)_1fr] grid grid-cols-1">
          {can('inventory.manage') ? (
            <IssueForm />
          ) : (
            <Card>
              <EmptyState
                compact
                title="Issue needs the inventory permission"
                description="Supervisors and warehouse staff issue material. The history on the right stays visible."
              />
            </Card>
          )}
          <Card>
            <CardHeader>
              <CardTitle>Issue transactions</CardTitle>
              <CardDescription>Newest first.</CardDescription>
            </CardHeader>
            <DataTable
              columns={columns}
              rows={issues}
              getRowKey={(t) => t.id}
              empty={
                <EmptyState
                  compact
                  title="Nothing issued yet"
                  description="Issue a staged lot and the transaction appears here."
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

function IssueForm() {
  const s = useScoped()
  const [moId, setMoId] = useState<string | null>(null)
  const [materialId, setMaterialId] = useState<string | null>(null)
  const [lotId, setLotId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [woId, setWoId] = useState<string | null>(null)
  const [tried, setTried] = useState(false)

  const requirements = useMemo(
    () =>
      s.materialRequirements.filter((r) => r.moId === moId).sort((a, b) => a.operationSeq - b.operationSeq),
    [s.materialRequirements, moId],
  )
  const requirement = requirements.find((r) => r.materialId === materialId)
  const lots = useMaterialLots(materialId, ISSUABLE_LOT_STATUSES)
  const lot = lots.find((l) => l.id === lotId)
  const n = Number(qty)

  const suggest = (r: MaterialRequirement | undefined, lotQty: number | undefined) =>
    r ? String(Math.min(remainingToIssue(r), lotQty ?? remainingToIssue(r)) || '') : ''

  const errors = {
    mo: !moId ? 'Choose the order.' : null,
    material: !requirement ? 'Pick a requirement line.' : null,
    lot: !lot ? 'Choose the lot to issue.' : null,
    qty: !(n > 0)
      ? 'Enter the quantity.'
      : lot && n > lot.qty
        ? `Only ${fmtNumber(lot.qty, 2)} in this lot.`
        : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const reset = () => {
    setMaterialId(null)
    setLotId(null)
    setQty('')
    setWoId(null)
    setTried(false)
  }

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !moId || !requirement || !lot) return
    s.dispatch({
      type: 'materials/issue',
      moId,
      woId,
      materialId: requirement.materialId,
      lotId: lot.id,
      qty: n,
    })
    toast('Material issued', {
      tone: 'success',
      description: `${fmtNumber(n, 2)} ${s.uomCode(lot.uomId)} ${s.materialName(requirement.materialId)} to ${s.maps.mo.get(moId)?.code}`,
    })
    setLotId(null)
    setQty('')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Issue material</CardTitle>
        <CardDescription>Staging → floor. Pick the order, the requirement line and the lot.</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={submit} noValidate className="space-y-4">
          <FormField label="Manufacturing order" required error={show(errors.mo)}>
            <MoPicker
              value={moId}
              onChange={(id) => {
                setMoId(id)
                reset()
              }}
              filter={activeFilter}
              invalid={!!show(errors.mo)}
            />
          </FormField>
          <FormField label="Requirement line" required error={show(errors.material)}>
            {moId ? (
              requirements.length === 0 ? (
                <p className="rounded-2xl px-3 py-2 text-sm bg-surface-2 text-muted">
                  This order has no material requirement.
                </p>
              ) : (
                <div role="radiogroup" className="space-y-1.5">
                  {requirements.map((r) => {
                    const checked = r.materialId === materialId
                    return (
                      <button
                        key={r.id}
                        type="button"
                        role="radio"
                        aria-checked={checked}
                        onClick={() => {
                          setMaterialId(r.materialId)
                          setLotId(null)
                          setQty(suggest(r, undefined))
                        }}
                        className={cn(
                          'gap-3 rounded-2xl p-3 text-sm flex w-full items-center text-left transition-colors',
                          checked ? 'bg-ink text-on-ink' : 'bg-surface-2 hover:bg-surface',
                        )}
                      >
                        <span
                          className={cn(
                            'size-4 flex shrink-0 items-center justify-center rounded-full border-2',
                            checked ? 'border-white' : 'border-border',
                          )}
                        >
                          {checked && <span className="size-2 bg-white rounded-full" />}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold block truncate">{s.materialName(r.materialId)}</span>
                          <span
                            className={cn(
                              'text-xs block truncate',
                              checked ? 'text-on-ink-muted' : 'text-muted',
                            )}
                          >
                            Op {r.operationSeq} · {fmtNumber(r.stagedQty, 1)} staged ·{' '}
                            {fmtNumber(remainingToIssue(r), 1)} of {fmtNumber(r.requiredQty, 1)}{' '}
                            {s.uomCode(r.uomId)} to issue
                          </span>
                        </span>
                        {!checked && <RequirementBadge status={r.status} />}
                      </button>
                    )
                  })}
                </div>
              )
            ) : (
              <p className="rounded-2xl px-3 py-2 text-sm bg-surface-2 text-muted">Choose an order first.</p>
            )}
          </FormField>
          <FormField
            label="Lot"
            required
            error={show(errors.lot)}
            hint={
              materialId && lots.length === 0
                ? 'No staged or reserved lot for this material. Stage one from the requirement.'
                : undefined
            }
          >
            <LotCombobox
              lots={lots}
              value={lotId}
              onChange={(id) => {
                setLotId(id)
                setQty(suggest(requirement, lots.find((l) => l.id === id)?.qty))
              }}
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
                ? `${fmtNumber(remainingToIssue(requirement), 2)} ${s.uomCode(requirement.uomId)} remaining on the line`
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
          <FormField label="Work order" hint="Optional: issue to one operation instead of the order.">
            <WoCombobox moId={moId} value={woId} onChange={setWoId} clearable />
          </FormField>
          <Button type="submit" className="w-full">
            <ArrowRight />
            Issue to production
          </Button>
        </form>
      </CardContent>
    </Card>
  )
}
