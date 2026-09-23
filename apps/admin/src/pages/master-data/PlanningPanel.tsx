import { DAY, addMonths, dayKey, fmtMonth, fromDayKey, newId, nowMs, startOfMonth, wib } from '@mes/fixtures'
import type { CalendarDay, ProductionPolicy, Shift, Weekday } from '@mes/types'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Chip,
  type Column,
  FormField,
  Input,
  UnderlineTabs,
  cn,
  toast,
} from '@mes/ui'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { useState } from 'react'
import { useAuth } from '../../auth/auth'
import { useScoped } from '../../state/scoped'
import { EntityDialog, EntityTable, type Field, Mono, Muted, useEditor } from './entity'
import { usePanelTab } from './lib'

const TABS = [
  { value: 'shifts', label: 'Shifts' },
  { value: 'calendar', label: 'Production calendar' },
  { value: 'policies', label: 'Production policies' },
] as const

const WEEKDAYS: { day: Weekday; label: string }[] = [
  { day: 1, label: 'Mon' },
  { day: 2, label: 'Tue' },
  { day: 3, label: 'Wed' },
  { day: 4, label: 'Thu' },
  { day: 5, label: 'Fri' },
  { day: 6, label: 'Sat' },
  { day: 0, label: 'Sun' },
]

const TIME = /^([01]\d|2[0-3]):[0-5]\d$/

export function PlanningPanel() {
  const [tab, setTab] = usePanelTab(TABS)
  return (
    <div className="space-y-4">
      <UnderlineTabs
        value={tab}
        onValueChange={(v) => setTab(v as (typeof TABS)[number]['value'])}
        items={[...TABS]}
      />
      {tab === 'shifts' ? <Shifts /> : tab === 'calendar' ? <Calendar /> : <Policies />}
    </div>
  )
}

function Shifts() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<Shift>()
  const fields: Field<Shift>[] = [
    { key: 'code', label: 'Code', kind: 'text', required: true, mono: true },
    { key: 'name', label: 'Name', kind: 'text', required: true },
    { key: 'start', label: 'Start', kind: 'text', required: true, placeholder: '07:00', mono: true },
    {
      key: 'end',
      label: 'End',
      kind: 'text',
      required: true,
      placeholder: '15:00',
      mono: true,
      hint: 'A night shift ends after midnight.',
    },
    { key: 'breakMin', label: 'Break (minutes)', kind: 'number', min: 0, step: 5 },
    {
      key: 'days',
      label: 'Days',
      kind: 'custom',
      required: true,
      span: 2,
      render: (d, set) => (
        <div className="gap-1.5 flex flex-wrap">
          {WEEKDAYS.map((w) => (
            <Chip
              key={w.day}
              active={d.days.includes(w.day)}
              onClick={() =>
                set({
                  days: d.days.includes(w.day)
                    ? d.days.filter((x) => x !== w.day)
                    : [...d.days, w.day].sort(),
                })
              }
            >
              {w.label}
            </Chip>
          ))}
        </div>
      ),
    },
  ]
  const columns: Column<Shift>[] = [
    { id: 'code', header: 'Code', sortValue: (x) => x.code, cell: (x) => <Mono>{x.code}</Mono> },
    {
      id: 'name',
      header: 'Name',
      sortValue: (x) => x.name,
      cell: (x) => <span className="font-semibold">{x.name}</span>,
    },
    {
      id: 'time',
      header: 'Hours',
      sortValue: (x) => x.start,
      cell: (x) => (
        <span className="tabular-nums">
          {x.start} – {x.end}
        </span>
      ),
    },
    { id: 'break', header: 'Break', hideBelow: 'md', align: 'right', cell: (x) => `${x.breakMin} min` },
    {
      id: 'days',
      header: 'Days',
      hideBelow: 'sm',
      cell: (x) => (
        <span className="gap-1 flex flex-wrap">
          {WEEKDAYS.filter((w) => x.days.includes(w.day)).map((w) => (
            <Badge key={w.day} variant="outline">
              {w.label}
            </Badge>
          ))}
        </span>
      ),
    },
    {
      id: 'people',
      header: 'People',
      hideBelow: 'lg',
      align: 'right',
      cell: (x) => s.people.filter((p) => p.shiftId === x.id).length,
    },
  ]
  return (
    <>
      <EntityTable
        title="Shifts"
        description="Shift length and days feed capacity and the scheduler."
        rows={s.shifts}
        columns={columns}
        search={(x) => `${x.code} ${x.name}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'shifts/remove', id: x.id })}
        removeBlocker={(x) => (s.people.some((p) => p.shiftId === x.id) ? 'People are assigned to it' : null)}
        removeLabel={(x) => x.name}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.name}` : 'New shift'}
        fields={fields}
        item={editor.item}
        blank={(): Shift => ({
          id: newId('shf'),
          code: '',
          name: '',
          start: '07:00',
          end: '15:00',
          days: [1, 2, 3, 4, 5],
          breakMin: 30,
        })}
        existing={s.shifts}
        validate={(d) => ({
          ...(!TIME.test(d.start) ? { start: 'Use HH:MM.' } : {}),
          ...(!TIME.test(d.end) ? { end: 'Use HH:MM.' } : {}),
        })}
        onSave={(item) => s.dispatch({ type: 'shifts/upsert', item })}
      />
    </>
  )
}

function Calendar() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const [month, setMonth] = useState(() => startOfMonth(nowMs()))
  const [selected, setSelected] = useState<string | null>(null)
  const [note, setNote] = useState('')
  const byDate = new Map(s.calendarDays.map((d) => [d.date, d]))
  const first = wib(month)
  const daysInMonth = wib(addMonths(month, 1) - DAY).day
  const leading = (first.weekday + 6) % 7
  const cells: (number | null)[] = [
    ...Array<null>(leading).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ]
  const today = dayKey(nowMs())
  const keyOf = (day: number) => dayKey(fromDayKey(dayKey(month), 0, 0) + (day - 1) * DAY)
  const isWorking = (key: string) => byDate.get(key)?.working ?? wib(fromDayKey(key)).weekday !== 0

  const pickDay = (key: string) => {
    setSelected(key)
    setNote(byDate.get(key)?.note ?? '')
  }
  const toggle = (key: string) => {
    const existing = byDate.get(key)
    const item: CalendarDay = {
      id: existing?.id ?? newId('cal'),
      siteId: s.siteId,
      date: key,
      working: !isWorking(key),
      note: existing?.note ?? '',
    }
    s.dispatch({ type: 'calendarDays/upsert', item })
    pickDay(key)
    toast(`${key} set to ${item.working ? 'working' : 'non-working'}`, { tone: 'default' })
  }
  const saveNote = () => {
    if (!selected) return
    const existing = byDate.get(selected)
    s.dispatch({
      type: 'calendarDays/upsert',
      item: {
        id: existing?.id ?? newId('cal'),
        siteId: s.siteId,
        date: selected,
        working: isWorking(selected),
        note,
      },
    })
    toast('Note saved', { tone: 'success' })
  }
  const nonWorking = cells.filter((d): d is number => d !== null && !isWorking(keyOf(d))).length

  return (
    <Card>
      <CardHeader
        action={
          <span className="gap-1 flex items-center">
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Previous month"
              onClick={() => setMonth((m) => addMonths(m, -1))}
            >
              <ChevronLeft />
            </Button>
            <span className="min-w-24 text-sm font-semibold text-center">{fmtMonth(month)}</span>
            <Button
              variant="outline"
              size="icon-sm"
              aria-label="Next month"
              onClick={() => setMonth((m) => addMonths(m, 1))}
            >
              <ChevronRight />
            </Button>
          </span>
        }
      >
        <CardTitle>Production calendar</CardTitle>
        <CardDescription>
          {s.site.name} · {nonWorking} non-working days this month.{' '}
          {manage ? 'Click a day to toggle it.' : ''} Sundays are non-working unless marked otherwise.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="gap-1 font-semibold tracking-wider grid grid-cols-7 text-center text-[11px] text-muted uppercase">
          {WEEKDAYS.map((w) => (
            <span key={w.day} className="py-1">
              {w.label}
            </span>
          ))}
        </div>
        <div className="mt-1 gap-1 grid grid-cols-7">
          {cells.map((day, i) => {
            if (day === null) return <span key={`pad-${i}`} />
            const key = keyOf(day)
            const working = isWorking(key)
            const entry = byDate.get(key)
            return (
              <button
                key={key}
                type="button"
                onClick={() => (manage ? toggle(key) : pickDay(key))}
                aria-pressed={selected === key}
                title={entry?.note || (working ? 'Working day' : 'Non-working day')}
                className={cn(
                  'rounded-2xl text-sm flex aspect-square flex-col items-center justify-center transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
                  working
                    ? 'bg-surface-2 hover:bg-surface'
                    : 'bg-accent-soft text-accent-strong hover:bg-accent-soft/70',
                  selected === key && 'ring-2 ring-ink',
                  key === today && 'font-bold underline',
                )}
              >
                <span className="tabular-nums">{day}</span>
                {entry?.note && <span aria-hidden className="mt-0.5 size-1 rounded-full bg-current" />}
              </button>
            )
          })}
        </div>
        {selected && (
          <div className="mt-4 gap-2 rounded-2xl p-3 flex flex-wrap items-end bg-surface-2">
            <FormField label={`Note for ${selected}`} className="min-w-48 flex-1">
              <Input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Public holiday, plant shutdown"
                disabled={!manage}
              />
            </FormField>
            {manage && (
              <Button variant="outline" onClick={saveNote}>
                Save note
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

function Policies() {
  const s = useScoped()
  const manage = useAuth().can('masterdata.manage')
  const editor = useEditor<ProductionPolicy>()
  const fields: Field<ProductionPolicy>[] = [
    {
      key: 'key',
      label: 'Key',
      kind: 'text',
      required: true,
      mono: true,
      readOnly: !!editor.item,
      hint: 'Identifier the modules read, e.g. release.require_material.',
    },
    { key: 'label', label: 'Label', kind: 'text', required: true },
    { key: 'value', label: 'Value', kind: 'text', required: true, span: 2 },
    { key: 'description', label: 'Description', kind: 'text', span: 2 },
  ]
  const columns: Column<ProductionPolicy>[] = [
    {
      id: 'policy',
      header: 'Policy',
      sortValue: (x) => x.label,
      cell: (x) => (
        <div className="min-w-0">
          <p className="font-semibold">{x.label}</p>
          <Mono>{x.key}</Mono>
        </div>
      ),
    },
    { id: 'value', header: 'Value', cell: (x) => <Badge variant="ink">{x.value}</Badge> },
    { id: 'desc', header: 'Description', hideBelow: 'md', cell: (x) => x.description || <Muted>None</Muted> },
  ]
  return (
    <>
      <EntityTable
        title="Production policies"
        description="Site-level switches and thresholds the execution modules read."
        rows={s.productionPolicies}
        columns={columns}
        search={(x) => `${x.key} ${x.label} ${x.value}`}
        canManage={manage}
        onAdd={editor.create}
        onEdit={editor.edit}
        onRemove={(x) => s.dispatch({ type: 'productionPolicies/remove', id: x.id })}
        removeLabel={(x) => x.label}
      />
      <EntityDialog
        open={editor.open}
        onOpenChange={editor.setOpen}
        title={editor.item ? `Edit ${editor.item.label}` : 'New policy'}
        fields={fields}
        item={editor.item}
        blank={(): ProductionPolicy => ({
          id: newId('pol'),
          siteId: s.siteId,
          key: '',
          label: '',
          value: '',
          description: '',
        })}
        existing={s.productionPolicies}
        uniqueKeys={['key']}
        onSave={(item) => s.dispatch({ type: 'productionPolicies/upsert', item })}
      />
    </>
  )
}
