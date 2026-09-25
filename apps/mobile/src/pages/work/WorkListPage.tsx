import type { WorkOrder } from '@mes/types'
import { Button, Card, Chip, EmptyState, LazySentinel, SegmentedTabs, useLazyList } from '@mes/ui'
import { CircleCheck, Hourglass, ListChecks } from 'lucide-react'
import { type ReactNode, useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { WoCard } from '../../components/WoCard'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { useMobileScope } from '../../state/scope'

type Tab = 'todo' | 'running' | 'done'
const TABS: { value: Tab; label: string }[] = [
  { value: 'todo', label: 'To do' },
  { value: 'running', label: 'Running' },
  { value: 'done', label: 'Done' },
]
const isTab = (v: string | null): v is Tab => v === 'todo' || v === 'running' || v === 'done'

export function WorkListPage() {
  const { site, operatorWorkOrders, doneToday, workCenters, orgName } = useMobileScope()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = isTab(tabParam) ? tabParam : 'todo'
  const center = params.get('wc')
  const update = (patch: Record<string, string | null>) =>
    setParams(
      (p) => {
        for (const [key, value] of Object.entries(patch)) {
          if (value) p.set(key, value)
          else p.delete(key)
        }
        return p
      },
      { replace: true },
    )

  const groups = useMemo(() => {
    const atCenter = (w: WorkOrder) => !center || w.workCenterId === center
    return {
      todo: operatorWorkOrders.filter((w) => w.status !== 'in_progress' && atCenter(w)),
      running: operatorWorkOrders.filter((w) => w.status === 'in_progress' && atCenter(w)),
      done: doneToday.filter(atCenter),
    }
  }, [operatorWorkOrders, doneToday, center])
  const lazy = useLazyList(groups[tab], { resetKey: [tab, center] })
  const open = groups.todo.length + groups.running.length

  const empty: Record<Tab, { icon: ReactNode; title: string; description: string; action?: ReactNode }> = {
    todo: {
      icon: <CircleCheck />,
      title: 'Nothing waiting for you',
      description: 'Operations dispatched to you or to your work centers land here.',
      action: groups.running.length ? (
        <Button variant="outline" className="h-11" onClick={() => update({ tab: 'running' })}>
          Open Running
        </Button>
      ) : undefined,
    },
    running: {
      icon: <Hourglass />,
      title: 'No operation running',
      description: 'Start one from To do and it moves here while it runs.',
      action: groups.todo.length ? (
        <Button variant="outline" className="h-11" onClick={() => update({ tab: null })}>
          Open To do
        </Button>
      ) : undefined,
    },
    done: {
      icon: <ListChecks />,
      title: 'Nothing completed today',
      description: 'Completed operations stay here until the end of the day.',
      action: (
        <Button asChild variant="outline" className="h-11">
          <Link to={paths.home}>Back home</Link>
        </Button>
      ),
    },
  }

  return (
    <div className="space-y-5">
      <ScreenHeader greeting={`${open} open · ${center ? orgName(center) : site.name}`} title="My work" />

      {workCenters.length > 1 && (
        <div
          role="group"
          aria-label="Work center"
          className="-mx-5 gap-2 px-5 pb-1 no-scrollbar flex overflow-x-auto"
        >
          <Chip variant="filter" active={!center} onClick={() => update({ wc: null })} className="h-11">
            All
          </Chip>
          {workCenters.map((c) => (
            <Chip
              key={c.id}
              variant="filter"
              active={center === c.id}
              onClick={() => update({ wc: c.id })}
              className="h-11"
            >
              {c.name}
            </Chip>
          ))}
        </div>
      )}

      <SegmentedTabs
        items={TABS.map((t) => ({ ...t, count: groups[t.value].length }))}
        value={tab}
        onValueChange={(v) => update({ tab: v === 'todo' ? null : v })}
        urgentValue="running"
        className="[&_[role=tab]]:h-11"
      />

      {groups[tab].length ? (
        <div className="space-y-3">
          {lazy.visible.map((wo) => (
            <WoCard key={wo.id} wo={wo} />
          ))}
          <LazySentinel remaining={lazy.remaining} onLoad={lazy.loadMore} sentinelRef={lazy.sentinelRef} />
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={empty[tab].icon}
            title={empty[tab].title}
            description={empty[tab].description}
            action={empty[tab].action}
          />
        </Card>
      )}
    </div>
  )
}
