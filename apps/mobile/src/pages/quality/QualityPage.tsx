import { fmtAgo } from '@mes/fixtures'
import type { Inspection } from '@mes/types'
import { INSPECTION_STATUS_LABEL, INSPECTION_TRIGGER_LABEL } from '@mes/types'
import { Button, Card, EmptyState, IconTile, LazySentinel, SegmentedTabs, useLazyList } from '@mes/ui'
import { ClipboardCheck, Microscope } from 'lucide-react'
import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router'
import { INSPECTION_TONE, StatusText } from '../../components/badges'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { paths } from '../../lib/paths'
import { useMobileScope, useNow } from '../../state/scope'

type Tab = 'pending' | 'mine' | 'done'
const TABS: { value: Tab; label: string }[] = [
  { value: 'pending', label: 'Pending' },
  { value: 'mine', label: 'Mine' },
  { value: 'done', label: 'Done' },
]
const isTab = (v: string | null): v is Tab => v === 'pending' || v === 'mine' || v === 'done'
const isOpen = (i: Inspection) => i.status === 'pending' || i.status === 'in_progress'

export function QualityPage() {
  const { user, operatorInspections, maps } = useMobileScope()
  const now = useNow()
  const [params, setParams] = useSearchParams()
  const tabParam = params.get('tab')
  const tab: Tab = isTab(tabParam) ? tabParam : 'pending'

  const groups = useMemo(() => {
    const mineWo = (i: Inspection) =>
      !!i.woId && (maps.wo.get(i.woId)?.operatorIds.includes(user.id) ?? false)
    return {
      pending: operatorInspections.filter(isOpen),
      mine: operatorInspections.filter((i) => i.inspectorId === user.id || mineWo(i)),
      done: operatorInspections.filter((i) => !isOpen(i)),
    }
  }, [operatorInspections, maps.wo, user.id])
  const lazy = useLazyList(groups[tab], { resetKey: tab })

  const empty: Record<Tab, { title: string; description: string }> = {
    pending: {
      title: 'Nothing to inspect',
      description: 'Request an inspection from a running operation and it lands here.',
    },
    mine: {
      title: 'No inspections on your work',
      description: 'Inspections on operations assigned to you, and the ones you recorded.',
    },
    done: {
      title: 'No results yet',
      description: 'Passed and failed inspections on your work orders stay here.',
    },
  }

  return (
    <div className="space-y-5">
      <ScreenHeader greeting={`${groups.pending.length} waiting for results`} title="Quality" />

      <SegmentedTabs
        items={TABS.map((t) => ({ ...t, count: groups[t.value].length }))}
        value={tab}
        onValueChange={(v) => setParams(v === 'pending' ? {} : { tab: v }, { replace: true })}
        urgentValue="pending"
        className="[&_[role=tab]]:h-11"
      />

      {groups[tab].length ? (
        <div className="space-y-3">
          {lazy.visible.map((i) => (
            <InspectionCard key={i.id} inspection={i} now={now} />
          ))}
          <LazySentinel remaining={lazy.remaining} onLoad={lazy.loadMore} sentinelRef={lazy.sentinelRef} />
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<Microscope />}
            title={empty[tab].title}
            description={empty[tab].description}
            action={
              <Button asChild variant="outline" className="h-11">
                <Link to={paths.work}>Open my work</Link>
              </Button>
            }
          />
        </Card>
      )}
    </div>
  )
}

function InspectionCard({ inspection, now }: { inspection: Inspection; now: number }) {
  const { maps, productName, personName } = useMobileScope()
  const wo = inspection.woId ? maps.wo.get(inspection.woId) : undefined
  const open = isOpen(inspection)
  const failed = inspection.measurements.filter((m) => m.result === 'fail').length
  return (
    <Link
      to={paths.inspection(inspection.id)}
      className={
        open
          ? 'p-4 block rounded-[24px] bg-card shadow-card transition-transform active:scale-[0.98]'
          : 'p-4 block rounded-[24px] bg-card/70 shadow-card transition-transform active:scale-[0.98]'
      }
    >
      <div className="gap-3 flex items-center">
        <IconTile tone={INSPECTION_TONE[inspection.status]} size="lg" shape="round">
          <ClipboardCheck />
        </IconTile>
        <div className="min-w-0 flex-1">
          <div className="gap-2 flex items-center justify-between">
            <span className="font-semibold truncate font-mono text-[13px]">{inspection.code}</span>
            <StatusText
              tone={INSPECTION_TONE[inspection.status]}
              label={INSPECTION_STATUS_LABEL[inspection.status]}
            />
          </div>
          <p className="mt-0.5 truncate text-[13px] text-muted">
            {productName(inspection.productId)} · op {inspection.operationSeq}
            {wo ? ` · ${wo.operationName}` : ''}
          </p>
        </div>
      </div>
      <p className="mt-3 font-semibold leading-snug text-[15px]">
        {inspection.measurements.length} characteristics · {INSPECTION_TRIGGER_LABEL[inspection.trigger]}
      </p>
      <div className="mt-2.5 gap-2 text-sm flex items-center justify-between">
        <span className="truncate text-muted">
          {open
            ? `Requested ${fmtAgo(inspection.requestedAt, now)}`
            : `${personName(inspection.inspectorId)} · ${fmtAgo(inspection.completedAt ?? inspection.requestedAt, now)}`}
        </span>
        {!open && failed > 0 && (
          <span className="font-semibold shrink-0 text-[11px] text-accent">{failed} failed</span>
        )}
      </div>
    </Link>
  )
}
