import { fmtNumber, fmtPercent, fmtWhen, sumBy } from '@mes/fixtures'
import type { Disposition, ScrapRecord } from '@mes/types'
import { DISPOSITION_LABEL, OPEN_MO_STATUSES } from '@mes/types'
import {
  BarList,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
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
  NativeSelect,
  PageHeader,
  StatCard,
  Textarea,
  toast,
} from '@mes/ui'
import { CalendarRange, PackageX, Percent, Tag } from 'lucide-react'
import { type FormEvent, useMemo, useState } from 'react'
import { Link } from 'react-router'
import { useAuth } from '../../auth/auth'
import { DispositionBadge } from '../../components/badges'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { MoPicker, ReasonPicker } from '../../components/pickers'
import { useTableHistory } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import { WipCombobox, WoCombobox } from './dialogs'
import { isThisWeek, isToday, operationName, rankBy } from './lib'

const DISPOSITIONS: Disposition[] = ['scrap', 'return', 'hold']
const DISPOSITION_OPTIONS = DISPOSITIONS.map((d) => ({ value: d, label: DISPOSITION_LABEL[d] }))
const activeFilter = (status: string) => status === 'released' || status === 'in_progress'

export function ScrapPage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const [recording, setRecording] = useState(false)
  const table = useTableHistory()

  const records = useMemo(
    () => [...s.scrapRecords].sort((a, b) => b.at.localeCompare(a.at)),
    [s.scrapRecords],
  )
  const stats = useMemo(() => {
    const open = s.manufacturingOrders.filter((m) => OPEN_MO_STATUSES.includes(m.status))
    const good = sumBy(open, (m) => m.goodQty)
    const scrap = sumBy(open, (m) => m.scrapQty)
    const byReason = rankBy(
      records,
      (r) => r.reasonCodeId,
      (r) => r.qty,
    )
    return {
      today: sumBy(
        records.filter((r) => isToday(r.at, now)),
        (r) => r.qty,
      ),
      week: sumBy(
        records.filter((r) => isThisWeek(r.at, now)),
        (r) => r.qty,
      ),
      topReason: byReason[0] ?? null,
      rate: good + scrap > 0 ? scrap / (good + scrap) : 0,
      byReason,
      byOperation: rankBy(
        records,
        (r) => `${r.operationSeq}|${operationName(s, s.maps.mo.get(r.moId), r.operationSeq)}`,
        (r) => r.qty,
      ),
    }
  }, [s, records, now])

  const columns: Column<ScrapRecord>[] = [
    {
      id: 'when',
      header: 'When',
      sortValue: (r) => r.at,
      cell: (r) => (
        <div className="min-w-0">
          <p className="whitespace-nowrap text-muted">{fmtWhen(r.at, now)}</p>
          <div className="mt-1.5 gap-1.5 sm:hidden flex flex-wrap">
            <DispositionBadge disposition={r.disposition} />
          </div>
        </div>
      ),
    },
    {
      id: 'mo',
      header: 'Order',
      sortValue: (r) => s.maps.mo.get(r.moId)?.code ?? '',
      cell: (r) => <MoLink moId={r.moId} />,
    },
    { id: 'wo', header: 'Work order', hideBelow: 'lg', cell: (r) => <WoLink woId={r.woId} /> },
    {
      id: 'op',
      header: 'Operation',
      hideBelow: 'md',
      sortValue: (r) => r.operationSeq,
      cell: (r) => (
        <span className="whitespace-nowrap">
          {r.operationSeq} · {operationName(s, s.maps.mo.get(r.moId), r.operationSeq)}
        </span>
      ),
    },
    {
      id: 'wip',
      header: 'WIP',
      hideBelow: 'xl',
      cell: (r) =>
        r.wipId ? (
          <Link
            to={paths.wip(r.wipId)}
            onClick={(e) => e.stopPropagation()}
            className="text-xs font-mono hover:text-accent"
          >
            {s.maps.wip.get(r.wipId)?.code ?? r.wipId}
          </Link>
        ) : (
          <span className="text-muted">—</span>
        ),
    },
    {
      id: 'qty',
      header: 'Qty',
      align: 'right',
      sortValue: (r) => r.qty,
      cell: (r) => <span className="font-semibold tabular-nums">{fmtNumber(r.qty)}</span>,
    },
    {
      id: 'reason',
      header: 'Reason',
      hideBelow: 'sm',
      sortValue: (r) => s.reasonLabel(r.reasonCodeId),
      cell: (r) => s.reasonLabel(r.reasonCodeId),
    },
    {
      id: 'operator',
      header: 'Operator',
      hideBelow: 'xl',
      cell: (r) => <PersonChip personId={r.operatorId} />,
    },
    {
      id: 'disposition',
      header: 'Disposition',
      hideBelow: 'sm',
      cell: (r) => <DispositionBadge disposition={r.disposition} />,
    },
    {
      id: 'note',
      header: 'Note',
      hideBelow: 'xl',
      cell: (r) => <span className="max-w-xs text-xs line-clamp-2 text-muted">{r.note || '—'}</span>,
    },
  ]

  return (
    <>
      <PageHeader
        title="Scrap"
        description="Pieces lost in production. A scrap record needs a quantity, a reason, the operation, the WIP batch, the operator and a disposition."
        actions={
          can('shopfloor.execute') && (
            <Button onClick={() => setRecording(true)}>
              <PackageX />
              Record scrap
            </Button>
          )
        }
      />
      <div className="space-y-4">
        <div className="gap-3 sm:gap-4 xl:grid-cols-4 grid grid-cols-2">
          <StatCard
            label="Scrapped today"
            value={fmtNumber(stats.today)}
            icon={<PackageX />}
            tone={stats.today ? 'danger' : 'success'}
          />
          <StatCard
            label="This week"
            value={fmtNumber(stats.week)}
            hint="Since Monday"
            icon={<CalendarRange />}
            tone="ink"
          />
          <StatCard
            label="Top reason"
            value={stats.topReason ? s.reasonLabel(stats.topReason.key) : '—'}
            hint={stats.topReason ? `${fmtNumber(stats.topReason.value)} pieces` : 'No scrap recorded'}
            icon={<Tag />}
            tone="warning"
          />
          <StatCard
            label="Scrap rate"
            value={fmtPercent(stats.rate, 1)}
            hint="Scrap over good plus scrap, open orders"
            icon={<Percent />}
            tone={stats.rate > 0.05 ? 'danger' : 'info'}
          />
        </div>

        <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
          <Card>
            <CardHeader>
              <CardTitle>By reason</CardTitle>
              <CardDescription>Pieces per reason code, all time.</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.byReason.length === 0 ? (
                <EmptyState compact title="No scrap yet" />
              ) : (
                <BarList
                  items={stats.byReason.slice(0, 8).map((r, i) => ({
                    key: r.key,
                    label: s.reasonLabel(r.key),
                    value: r.value,
                    hint: `${r.count} records`,
                    emphasis: i === 0,
                  }))}
                />
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader>
              <CardTitle>By operation</CardTitle>
              <CardDescription>Where the loss happens.</CardDescription>
            </CardHeader>
            <CardContent>
              {stats.byOperation.length === 0 ? (
                <EmptyState compact title="No scrap yet" />
              ) : (
                <BarList
                  items={stats.byOperation.slice(0, 8).map((r) => ({
                    key: r.key,
                    label: `Op ${r.key.replace('|', ' · ')}`,
                    value: r.value,
                    hint: `${r.count} records`,
                  }))}
                />
              )}
            </CardContent>
          </Card>
        </div>

        <Card>
          <DataTable
            columns={columns}
            rows={records}
            getRowKey={(r) => r.id}
            empty={
              <EmptyState
                compact
                title="No scrap records"
                description="Scrap reported at a station or from a hold release lands here."
              />
            }
            {...table}
          />
        </Card>
      </div>

      <Dialog open={recording} onOpenChange={setRecording}>
        <DialogContent size="md">
          {recording && <ScrapForm onDone={() => setRecording(false)} />}
        </DialogContent>
      </Dialog>
    </>
  )
}

function ScrapForm({ onDone }: { onDone: () => void }) {
  const s = useScoped()
  const [moId, setMoId] = useState<string | null>(null)
  const [woId, setWoId] = useState<string | null>(null)
  const [wipId, setWipId] = useState<string | null>(null)
  const [qty, setQty] = useState('')
  const [reasonId, setReasonId] = useState<string | null>(null)
  const [disposition, setDisposition] = useState<Disposition>('scrap')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  const wo = woId ? s.maps.wo.get(woId) : undefined
  const wip = wipId ? s.maps.wip.get(wipId) : undefined
  const n = Number(qty)
  const errors = {
    mo: !moId ? 'Choose the order.' : null,
    wo: !wo ? 'Choose the work order.' : null,
    wip: !wip ? 'Choose the batch to scrap.' : null,
    qty:
      !Number.isSafeInteger(n) || n <= 0
        ? 'Enter a positive whole quantity.'
        : wip && n > wip.qty
          ? `The batch holds ${fmtNumber(wip.qty)}.`
          : null,
    reason: !reasonId ? 'Choose a scrap reason.' : null,
  }
  const show = (message: string | null) => (tried ? (message ?? undefined) : undefined)

  const submit = (e: FormEvent) => {
    e.preventDefault()
    setTried(true)
    if (Object.values(errors).some(Boolean) || !moId || !wo || !reasonId) return
    s.dispatch({
      type: 'scrap/record',
      moId,
      woId: wo.id,
      wipId,
      operationSeq: wo.operationSeq,
      qty: n,
      reasonCodeId: reasonId,
      disposition,
      note,
    })
    toast('Scrap recorded', {
      tone: 'default',
      description: `${fmtNumber(n)} at operation ${wo.operationSeq} · ${s.reasonLabel(reasonId)}`,
    })
    onDone()
  }

  return (
    <form onSubmit={submit} noValidate>
      <DialogHeader>
        <DialogTitle>Record scrap</DialogTitle>
        <DialogDescription>The operator is you. The operation comes from the work order.</DialogDescription>
      </DialogHeader>
      <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
        <FormField label="Manufacturing order" required error={show(errors.mo)} className="sm:col-span-2">
          <MoPicker
            value={moId}
            onChange={(id) => {
              setMoId(id)
              setWoId(null)
              setWipId(null)
            }}
            filter={activeFilter}
            invalid={!!show(errors.mo)}
          />
        </FormField>
        <FormField label="Work order" required error={show(errors.wo)}>
          <WoCombobox moId={moId} value={woId} onChange={setWoId} invalid={!!show(errors.wo)} />
        </FormField>
        <FormField label="WIP batch" required error={show(errors.wip)}>
          <WipCombobox moId={moId} value={wipId} onChange={setWipId} clearable />
        </FormField>
        <FormField label="Quantity" required error={show(errors.qty)}>
          <Input
            type="number"
            min={1}
            inputMode="numeric"
            value={qty}
            onChange={(e) => setQty(e.target.value)}
            invalid={!!show(errors.qty)}
          />
        </FormField>
        <FormField label="Disposition">
          <NativeSelect
            options={DISPOSITION_OPTIONS}
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as Disposition)}
          />
        </FormField>
        <FormField label="Reason" required error={show(errors.reason)} className="sm:col-span-2">
          <ReasonPicker
            kind="scrap"
            value={reasonId}
            onChange={setReasonId}
            invalid={!!show(errors.reason)}
          />
        </FormField>
        <FormField label="Note" className="sm:col-span-2">
          <Textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-20"
            placeholder="What happened"
          />
        </FormField>
      </div>
      <DialogFooter>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button type="submit">Record scrap</Button>
      </DialogFooter>
    </form>
  )
}
