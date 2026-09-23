import { fmtNumber, plural } from '@mes/fixtures'
import { Badge, Button, Card, PageHeader, PillTabs, toast } from '@mes/ui'
import { RotateCcw, Wand2 } from 'lucide-react'
import { useMemo } from 'react'
import { Navigate, useNavigate, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { paths } from '../../components/links'
import { OrgNodePicker } from '../../components/pickers'
import { useHistoryState } from '../../lib/history-state'
import { useNow, useScoped } from '../../state/scoped'
import {
  type Move,
  type ScheduleSpan,
  autoSchedule,
  conflictCount,
  isOpenWo,
  machinesOnLine,
  replanFromNow,
  scheduleWindow,
} from './lib'
import { ScheduleGantt } from './ScheduleGantt'

export function SchedulePage() {
  const s = useScoped()
  const { can } = useAuth()
  const now = useNow(60_000)
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const [span, setSpan] = useHistoryState<ScheduleSpan>('span', 7)
  const [lineId, setLineId] = useHistoryState<string | null>('line', null)
  const deepLinkedId = params.get('wo')
  const canEdit = can('planning.manage') || can('wo.dispatch')

  const { from, days } = scheduleWindow(span, now)
  const machines = useMemo(() => machinesOnLine(s.machines, lineId), [s.machines, lineId])
  const visible = useMemo(() => {
    const ids = new Set(machines.map((m) => m.id))
    return s.workOrders.filter((w) => w.machineId && ids.has(w.machineId))
  }, [s.workOrders, machines])
  const unassigned = s.workOrders.filter((w) => isOpenWo(w) && !w.machineId).length
  const conflicts = conflictCount(visible)

  // The list used to open a sheet for ?wo=; that record now has its own page.
  if (deepLinkedId) return <Navigate to={paths.schedule(deepLinkedId)} replace />

  const applyMoves = (moves: Move[], label: string) => {
    for (const m of moves)
      s.dispatch({
        type: 'workOrders/reschedule',
        id: m.id,
        plannedStart: m.plannedStart,
        plannedEnd: m.plannedEnd,
      })
    toast(
      moves.length ? `${label}: ${plural(moves.length, 'work order')} moved` : `${label}: nothing to move`,
      { tone: moves.length ? 'success' : 'default' },
    )
  }

  return (
    <>
      <PageHeader
        title="Schedule"
        description="Finite schedule per machine. Every move here goes straight to the work order, so the board and the station see the same plan."
        actions={
          <>
            <PillTabs
              value={String(span)}
              onValueChange={(v) => setSpan(Number(v) as ScheduleSpan)}
              items={[
                { value: '3', label: '3 days' },
                { value: '7', label: '7 days' },
                { value: '14', label: '14 days' },
              ]}
            />
            <OrgNodePicker
              kind="line"
              variant="inline"
              clearable
              value={lineId}
              onChange={setLineId}
              placeholder="All lines"
              aria-label="Filter by line"
            />
            {canEdit && (
              <>
                <Button variant="outline" onClick={() => applyMoves(replanFromNow(visible, now), 'Replan')}>
                  <RotateCcw />
                  Replan from now
                </Button>
                <Button onClick={() => applyMoves(autoSchedule(visible, now), 'Auto schedule')}>
                  <Wand2 />
                  Auto schedule
                </Button>
              </>
            )}
          </>
        }
      />
      <div className="space-y-4">
        <div className="gap-2 text-sm flex flex-wrap items-center">
          <Badge variant={conflicts ? 'danger' : 'success'} dot>
            {conflicts ? `${conflicts} machine conflicts` : 'No machine conflicts'}
          </Badge>
          <Badge variant="muted">
            {fmtNumber(visible.filter(isOpenWo).length)} open work orders on {machines.length} machines
          </Badge>
          {unassigned > 0 && (
            <Badge variant="warning">{unassigned} without a machine, not on the chart</Badge>
          )}
        </div>

        <Card className="p-4">
          <ScheduleGantt
            machines={machines}
            workOrders={visible}
            days={days}
            from={from}
            now={now}
            selectedId={null}
            canEdit={canEdit}
            onSelect={(id) => navigate(paths.schedule(id))}
            onMove={(m) => applyMoves([m], 'Drag')}
          />
        </Card>
      </div>
    </>
  )
}
