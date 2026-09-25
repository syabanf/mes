import { fmtAgo, isMoOverdue, toMs } from '@mes/fixtures'
import {
  Button,
  EmptyState,
  IconTile,
  Popover,
  PopoverContent,
  PopoverTrigger,
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  type Tone,
  cn,
  useIsPhone,
} from '@mes/ui'
import {
  Bell,
  BellOff,
  ClipboardList,
  GitCompareArrows,
  Microscope,
  PackageSearch,
  PauseOctagon,
  Siren,
  TriangleAlert,
  Wrench,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { useNavigate } from 'react-router'
import { paths } from '../components/links'
import { useAuth } from '../auth/auth'
import { usePersistentState } from '../lib/storage'
import { useNow, useScoped } from '../state/scoped'
import { stationWorkOrders } from '../pages/manufacturing/wo-lib'

interface NotificationItem {
  id: string
  tone: Tone
  icon: ReactNode
  title: string
  body: string
  at: string
  to: string
  mine: boolean
}

/** Attention items derived from the current state: nothing is stored, so they clear themselves. */
export function useNotifications(): NotificationItem[] {
  const s = useScoped()
  const { user } = useAuth()
  const now = useNow(60_000)
  return useMemo(() => {
    const items: NotificationItem[] = []
    for (const mo of s.manufacturingOrders) {
      if (mo.atRisk && mo.status !== 'closed' && mo.status !== 'cancelled')
        items.push({
          id: `risk-${mo.id}`,
          tone: 'danger',
          icon: <Siren />,
          title: `${mo.code} at risk`,
          body: mo.atRiskReason,
          at: mo.events.at(-1)?.at ?? mo.createdAt,
          to: paths.mo(mo.id),
          mine:
            user?.role === 'planner' || user?.role === 'supervisor' || user?.role === 'production_manager',
        })
      else if (isMoOverdue(mo, now))
        items.push({
          id: `late-${mo.id}`,
          tone: 'warning',
          icon: <TriangleAlert />,
          title: `${mo.code} past planned finish`,
          body: `${s.productName(mo.productId)} · ${mo.goodQty} of ${mo.qty} good`,
          at: mo.plannedEnd,
          to: paths.mo(mo.id),
          mine:
            user?.role === 'planner' || user?.role === 'supervisor' || user?.role === 'production_manager',
        })
    }
    for (const h of s.qualityHolds.filter((h) => h.status === 'active'))
      items.push({
        id: `hold-${h.id}`,
        tone: 'danger',
        icon: <PauseOctagon />,
        title: `${h.code} blocks ${h.target.toUpperCase()}`,
        body: `${s.reasonLabel(h.reasonCodeId)} · ${(h.moId && s.maps.mo.get(h.moId)?.code) || 'No order'}`,
        at: h.heldAt,
        to: paths.hold(h.id),
        mine: user?.role === 'quality' || user?.role === 'supervisor',
      })
    for (const i of s.inspections.filter((i) => i.status === 'pending' || i.status === 'in_progress'))
      items.push({
        id: `ins-${i.id}`,
        tone: 'info',
        icon: <Microscope />,
        title: `${i.code} ${i.status === 'pending' ? 'waiting for an inspector' : 'inspection in progress'}`,
        body: `${s.maps.mo.get(i.moId)?.code ?? ''} · operation ${i.operationSeq}`,
        at: i.requestedAt,
        to: paths.inspection(i.id),
        mine: user?.role === 'quality',
      })
    for (const r of s.replenishments.filter((r) => r.status === 'proposed'))
      items.push({
        id: `rpl-${r.id}`,
        tone: 'warning',
        icon: <PackageSearch />,
        title: `Replenish ${s.productName(r.productId)}`,
        body: `Projected ${r.projected} below reorder point ${r.reorderPoint}`,
        at: r.createdAt,
        to: '/demand/replenishment',
        mine: user?.role === 'planner' || user?.role === 'warehouse',
      })
    for (const e of s.ecos.filter((e) => e.status === 'review'))
      items.push({
        id: `eco-${e.id}`,
        tone: 'info',
        icon: <GitCompareArrows />,
        title: `${e.code} awaits approval`,
        body: e.title,
        at: e.requestedAt,
        to: paths.eco(e.id),
        mine: user?.role === 'engineer',
      })
    for (const m of s.maintenanceRecords.filter(
      (m) => m.status === 'in_progress' || m.status === 'requested',
    ))
      items.push({
        id: `mnt-${m.id}`,
        tone: 'warning',
        icon: <Wrench />,
        title: `${s.maps.machine.get(m.machineId)?.code ?? m.machineId} in maintenance`,
        body: m.title,
        at: m.plannedStart,
        to: '/integration/cmms',
        mine: user?.role === 'supervisor' || user?.role === 'production_manager',
      })
    if (user?.role === 'operator')
      for (const wo of stationWorkOrders(s, user.id).filter(
        (w) => w.operatorIds.includes(user.id) && (w.status === 'in_progress' || w.status === 'paused'),
      ))
        items.push({
          id: `my-wo-${wo.id}`,
          tone: 'info',
          icon: <ClipboardList />,
          title: `${wo.code} is your active work`,
          body: wo.operationName,
          at: wo.actualStart ?? wo.plannedStart,
          to: paths.station(wo.id),
          mine: true,
        })
    return items.sort((a, b) => toMs(b.at) - toMs(a.at))
  }, [s, now, user?.id, user?.role])
}

export function NotificationsButton() {
  const { user, site } = useAuth()
  const items = useNotifications()
  const [readIds, setReadIds] = usePersistentState<string[]>(`mes.admin.read.${user?.id}.${site?.id}`, [])
  const [scope, setScope] = useState<'mine' | 'site'>(user?.role === 'admin' ? 'site' : 'mine')
  const [open, setOpen] = useState(false)
  const isPhone = useIsPhone()
  const navigate = useNavigate()
  const visibleItems = scope === 'mine' ? items.filter((i) => i.mine) : items
  const unread = visibleItems.filter((i) => !readIds.includes(i.id)).length

  const openItem = (n: NotificationItem) => {
    setReadIds((ids) => (ids.includes(n.id) ? ids : [...ids, n.id]))
    setOpen(false)
    navigate(n.to)
  }
  const markAll = () => setReadIds((ids) => [...new Set([...ids, ...visibleItems.map((i) => i.id)])])

  const trigger = (
    <Button
      variant="card"
      size="icon-lg"
      className="relative"
      aria-label={unread ? `Notifications, ${unread} unread` : 'Notifications'}
    >
      <Bell />
      {unread > 0 && (
        <span className="-right-1 -top-1 px-1 font-bold absolute flex h-[19px] min-w-[19px] items-center justify-center rounded-full border-2 border-surface bg-accent text-[10.5px] text-on-ink">
          {unread > 99 ? '99+' : unread}
        </span>
      )}
    </Button>
  )

  const body = (
    <>
      <div className="gap-3 px-4 pb-2 pt-4 flex items-center justify-between">
        <div>
          <p className="text-base font-semibold">Attention required</p>
          <p className="text-xs text-muted">{unread ? `${unread} unread` : 'All caught up'}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={markAll} disabled={!unread}>
          Mark all read
        </Button>
      </div>
      <div className="gap-2 px-4 pb-2 flex" role="group" aria-label="Notification scope">
        <Button size="sm" variant={scope === 'mine' ? 'soft' : 'ghost'} onClick={() => setScope('mine')}>
          For me
        </Button>
        <Button size="sm" variant={scope === 'site' ? 'soft' : 'ghost'} onClick={() => setScope('site')}>
          Site alerts
        </Button>
      </div>
      <div className="p-2 max-h-[min(70dvh,480px)] overflow-y-auto">
        {visibleItems.length === 0 ? (
          <EmptyState
            compact
            icon={<BellOff />}
            title="Nothing needs attention"
            description={
              scope === 'mine'
                ? 'Your assigned work and role-specific alerts will appear here.'
                : 'At-risk orders, holds, inspections and replenishment proposals show up here.'
            }
          />
        ) : (
          visibleItems.map((n) => {
            const isRead = readIds.includes(n.id)
            return (
              <button
                key={n.id}
                type="button"
                onClick={() => openItem(n)}
                className={cn(
                  'gap-3 rounded-2xl p-3 flex w-full items-start text-left transition-colors hover:bg-surface',
                  isRead && 'opacity-70',
                )}
              >
                <IconTile size="sm" tone={n.tone}>
                  {n.icon}
                </IconTile>
                <span className="min-w-0 flex-1">
                  <span className="gap-2 flex items-start justify-between">
                    <span className="text-sm font-semibold leading-snug">{n.title}</span>
                    {!isRead && (
                      <span className="mt-1.5 size-2 shrink-0 rounded-full bg-accent" aria-label="Unread" />
                    )}
                  </span>
                  <span className="mt-0.5 text-xs block text-muted">{n.body}</span>
                  <span className="mt-1 font-medium block text-[11px] text-silver">{fmtAgo(n.at)}</span>
                </span>
              </button>
            )
          })
        )}
      </div>
    </>
  )

  if (isPhone) {
    return (
      <Sheet open={open} onOpenChange={setOpen}>
        <SheetTrigger asChild>{trigger}</SheetTrigger>
        <SheetContent side="bottom" aria-describedby={undefined}>
          <SheetHeader className="sr-only">
            <SheetTitle>Notifications</SheetTitle>
          </SheetHeader>
          {body}
        </SheetContent>
      </Sheet>
    )
  }
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent align="end" className="p-0 w-[400px]">
        {body}
      </PopoverContent>
    </Popover>
  )
}
