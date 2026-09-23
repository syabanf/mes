import { DAY, MINUTE, fmtDateShort, fmtTime, fmtWeekday, toIso, toMs } from '@mes/fixtures'
import type { Machine, WorkOrder } from '@mes/types'
import { EmptyState, cn } from '@mes/ui'
import { type PointerEvent as ReactPointerEvent, useRef, useState } from 'react'
import { useScoped } from '../../state/scoped'
import { type Move, durationMs, isMovable, isOpenWo } from './lib'

const DAY_PX = 192
const ROW_H = 44
const LABEL_W = 176
const SNAP = 15 * MINUTE
const HOUR_TICKS = [6, 12, 18]

type Drag = { id: string; originX: number; deltaMs: number; moved: boolean }

function barClass(wo: WorkOrder) {
  if (wo.priority === 'critical') return 'bg-accent text-white'
  switch (wo.status) {
    case 'in_progress':
      return 'bg-info text-white'
    case 'paused':
    case 'hold':
      return 'bg-warning text-white'
    case 'completed':
      return 'bg-success text-white'
    case 'waiting':
      return 'bg-silver/60 text-foreground'
    default:
      return 'bg-ink text-on-ink'
  }
}

export function ScheduleGantt({
  machines,
  workOrders,
  days,
  from,
  now,
  selectedId,
  canEdit,
  onSelect,
  onMove,
}: {
  machines: Machine[]
  workOrders: WorkOrder[]
  days: number[]
  from: number
  now: number
  selectedId: string | null
  canEdit: boolean
  onSelect: (id: string) => void
  onMove: (move: Move) => void
}) {
  const s = useScoped()
  const [drag, setDrag] = useState<Drag | null>(null)
  const dragRef = useRef<Drag | null>(null)
  const width = days.length * DAY_PX
  const to = from + days.length * DAY
  const x = (ms: number) => ((ms - from) / DAY) * DAY_PX

  const groups = [...s.workCenters]
    .map((wc) => ({ wc, machines: machines.filter((m) => m.workCenterId === wc.id) }))
    .filter((g) => g.machines.length > 0)

  if (groups.length === 0) {
    return (
      <EmptyState
        title="No machines on this line"
        description="Pick another line or add machines under Master data › Resources."
      />
    )
  }

  const start = (e: ReactPointerEvent<HTMLButtonElement>, wo: WorkOrder) => {
    if (!canEdit || !isMovable(wo)) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const d: Drag = { id: wo.id, originX: e.clientX, deltaMs: 0, moved: false }
    dragRef.current = d
    setDrag(d)
  }
  const move = (e: ReactPointerEvent<HTMLButtonElement>) => {
    const d = dragRef.current
    if (!d) return
    const dx = e.clientX - d.originX
    const deltaMs = Math.round(((dx / DAY_PX) * DAY) / SNAP) * SNAP
    const next = { ...d, deltaMs, moved: d.moved || Math.abs(dx) > 4 }
    dragRef.current = next
    setDrag(next)
  }
  const end = (wo: WorkOrder) => {
    const d = dragRef.current
    dragRef.current = null
    setDrag(null)
    if (!d) {
      onSelect(wo.id)
      return
    }
    if (!d.moved || d.deltaMs === 0) {
      onSelect(wo.id)
      return
    }
    const startMs = toMs(wo.plannedStart) + d.deltaMs
    onMove({ id: wo.id, plannedStart: toIso(startMs), plannedEnd: toIso(startMs + durationMs(wo)) })
  }

  const nowX = x(now)

  return (
    <div className="overflow-x-auto">
      <div style={{ width: LABEL_W + width }} className="relative">
        <div className="top-0 sticky z-10 flex bg-card" style={{ marginLeft: LABEL_W }}>
          {days.map((day) => (
            <div key={day} className="shrink-0 border-l border-border" style={{ width: DAY_PX }}>
              <p className="px-2 pt-1 text-xs font-semibold">
                {fmtWeekday(day)} <span className="text-muted">{fmtDateShort(day)}</span>
              </p>
              <div className="h-4 relative">
                {HOUR_TICKS.map((h) => (
                  <span
                    key={h}
                    className="top-0 absolute text-[10px] text-muted tabular-nums"
                    style={{ left: (h / 24) * DAY_PX - 10 }}
                  >
                    {String(h).padStart(2, '0')}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
        {groups.map((g) => (
          <div key={g.wc.id}>
            <div
              className="px-3 py-1 font-semibold tracking-wider flex items-center bg-surface-2 text-[11px] text-muted uppercase"
              style={{ width: LABEL_W + width }}
            >
              {g.wc.name}
            </div>
            {g.machines.map((m) => {
              const bars = workOrders.filter(
                (w) =>
                  w.machineId === m.id &&
                  isOpenWo(w) &&
                  toMs(w.plannedEnd) > from &&
                  toMs(w.plannedStart) < to,
              )
              return (
                <div key={m.id} className="flex border-b border-border" style={{ height: ROW_H }}>
                  <div
                    className="left-0 px-3 sticky z-10 flex shrink-0 flex-col justify-center bg-card"
                    style={{ width: LABEL_W }}
                  >
                    <span className="text-xs font-semibold truncate">{m.code}</span>
                    <span className="truncate text-[11px] text-muted">{m.name}</span>
                  </div>
                  <div className="relative shrink-0" style={{ width }}>
                    {days.map((day, i) => (
                      <div
                        key={day}
                        className="inset-y-0 absolute border-l border-border"
                        style={{ left: i * DAY_PX }}
                      >
                        {HOUR_TICKS.map((h) => (
                          <span
                            key={h}
                            className="inset-y-0 absolute border-l border-dashed border-border/60"
                            style={{ left: (h / 24) * DAY_PX }}
                          />
                        ))}
                      </div>
                    ))}
                    {bars.map((w) => {
                      const dragging = drag?.id === w.id ? drag.deltaMs : 0
                      const startMs = toMs(w.plannedStart) + dragging
                      const endMs = startMs + durationMs(w)
                      const left = Math.max(0, x(startMs))
                      const right = Math.min(width, x(endMs))
                      const mo = s.maps.mo.get(w.moId)
                      return (
                        <button
                          key={w.id}
                          type="button"
                          title={`${w.code} · ${mo ? s.productName(mo.productId) : ''} · ${fmtTime(startMs)}–${fmtTime(endMs)}`}
                          onPointerDown={(e) => start(e, w)}
                          onPointerMove={move}
                          onPointerUp={() => end(w)}
                          onPointerCancel={() => {
                            dragRef.current = null
                            setDrag(null)
                          }}
                          className={cn(
                            'top-2 h-7 min-w-1.5 rounded-lg px-2 font-semibold absolute flex items-center overflow-hidden text-[11px] shadow-card transition-shadow select-none focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none',
                            barClass(w),
                            selectedId === w.id && 'ring-2 ring-accent ring-offset-1 ring-offset-card',
                            canEdit && isMovable(w) ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
                            drag?.id === w.id && 'z-20 opacity-90',
                          )}
                          style={{ left, width: Math.max(6, right - left), touchAction: 'none' }}
                        >
                          <span className="truncate">
                            {w.code} · op {w.operationSeq}
                          </span>
                        </button>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        ))}
        {nowX >= 0 && nowX <= width && (
          <div
            aria-hidden
            className="bottom-0 top-9 pointer-events-none absolute z-10 w-px bg-accent"
            style={{ left: LABEL_W + nowX }}
          >
            <span className="-left-4 -top-4 px-1.5 font-bold text-white absolute rounded-full bg-accent text-[10px]">
              now
            </span>
          </div>
        )}
      </div>
      <p className="mt-2 text-[11px] text-muted">
        One column per day, ticks every 6 hours.{' '}
        {canEdit
          ? 'Drag a bar to move a work order that has not started; click it to open details.'
          : 'Click a bar to open details.'}
      </p>
    </div>
  )
}
