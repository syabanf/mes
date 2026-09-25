import type { WorkOrder } from '@mes/types'
import { Button, Card, EmptyState, LazySentinel, SegmentedTabs, useLazyList } from '@mes/ui'
import { ArrowRight, BookOpen, CircleCheck, Sparkles } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link } from 'react-router'
import { Section } from '../../components/Section'
import { StatTile } from '../../components/StatTile'
import { WoCard, WoRailCard } from '../../components/WoCard'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { firstName, greeting } from '../../lib/time'
import { useMobileScope, useNow } from '../../state/scope'

type Filter = 'mine' | 'center' | 'done'
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'mine', label: 'Mine' },
  { value: 'center', label: 'Work center' },
  { value: 'done', label: 'Done' },
]

export function HomePage() {
  const { user, site, myWorkOrders, operatorWorkOrders, doneToday, workCenters } = useMobileScope()
  const now = useNow()
  const [filter, setFilter] = useState<Filter>('mine')

  const running = myWorkOrders.filter((w) => w.status === 'in_progress')
  const queue = useMemo(
    () =>
      myWorkOrders.filter((w) => w.status === 'ready' || w.status === 'assigned' || w.status === 'paused'),
    [myWorkOrders],
  )
  const lists: Record<Filter, WorkOrder[]> = {
    mine: myWorkOrders,
    center: operatorWorkOrders,
    done: doneToday,
  }
  const list = lists[filter]
  const lazy = useLazyList(list, { resetKey: filter })
  const centerNames = workCenters.map((c) => c.name).join(', ') || site.name

  return (
    <div className="space-y-6">
      <ScreenHeader greeting={`${greeting(now)} · ${centerNames}`} title={`Hi, ${firstName(user.name)}`} />

      <div className="gap-3 grid grid-cols-3">
        <StatTile to={paths.work} value={myWorkOrders.length} label="My work orders" tone="ink" />
        <StatTile to={`${paths.work}?tab=running`} value={running.length} label="Running" tone="accent" />
        <StatTile to={`${paths.work}?tab=done`} value={doneToday.length} label="Done today" tone="card" />
      </div>

      <Section
        title="Next up"
        count={queue.length}
        action={
          <Link to={paths.work} className="h-11 px-1 text-sm font-semibold flex items-center text-accent">
            All work
          </Link>
        }
      >
        {queue.length ? (
          <div className="-mx-5 scroll-px-5 gap-3 px-5 pb-1 no-scrollbar flex snap-x snap-mandatory overflow-x-auto">
            {queue.map((wo) => (
              <WoRailCard key={wo.id} wo={wo} />
            ))}
          </div>
        ) : (
          <Card>
            <EmptyState
              compact
              icon={<CircleCheck />}
              title="Nothing waiting to start"
              description="Work dispatched to you or to your work centers lands here."
              action={
                <Button asChild variant="outline" className="h-11">
                  <Link to={paths.instructions()}>
                    <BookOpen />
                    Read instructions
                  </Link>
                </Button>
              }
            />
          </Card>
        )}
      </Section>

      <Section title="Today">
        <SegmentedTabs
          items={FILTERS.map((f) => ({ ...f, count: lists[f.value].length }))}
          value={filter}
          onValueChange={(v) => setFilter(v as Filter)}
          className="[&_[role=tab]]:h-11"
        />
        {list.length ? (
          <div className="space-y-3">
            {lazy.visible.map((wo) => (
              <WoCard key={wo.id} wo={wo} />
            ))}
            <LazySentinel remaining={lazy.remaining} onLoad={lazy.loadMore} sentinelRef={lazy.sentinelRef} />
          </div>
        ) : (
          <Card>
            <EmptyState
              compact
              title={
                filter === 'done'
                  ? 'Nothing finished today yet'
                  : filter === 'center'
                    ? 'No open work at your work centers'
                    : 'No work assigned to you'
              }
              description={
                filter === 'done'
                  ? 'Completed operations from your shift show here.'
                  : 'The dispatcher assigns operations from the dispatch board.'
              }
            />
          </Card>
        )}
      </Section>

      <Link
        to={paths.instructions()}
        className="gap-3 p-5 flex items-center rounded-[24px] bg-info-soft transition-transform focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none active:scale-[0.98]"
      >
        <span className="size-11 [&_svg]:size-5 flex shrink-0 items-center justify-center rounded-full bg-card text-info">
          <Sparkles />
        </span>
        <span className="min-w-0 flex-1">
          <span className="text-sm font-semibold block">Work instructions</span>
          <span className="text-xs block text-body/70">
            Read the released steps for any product and operation.
          </span>
        </span>
        <ArrowRight aria-hidden="true" className="size-4 shrink-0 text-info" />
      </Link>
    </div>
  )
}
