import { fmtDateTime, fmtNumber } from '@mes/fixtures'
import type { Disposition, Measurement } from '@mes/types'
import { DISPOSITION_LABEL, INSPECTION_TRIGGER_LABEL, MEASUREMENT_TYPE_LABEL } from '@mes/types'
import {
  ActionMenu,
  Badge,
  Banner,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  ConfirmDialog,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  NativeSelect,
  PhotoInput,
  SegmentedControl,
  Switch,
  Textarea,
  toast,
} from '@mes/ui'
import { MoreHorizontal, Pencil, Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { DispositionBadge, InspectionStatusBadge, SeverityBadge } from '../../components/badges'
import { MoLink, PersonChip, WoLink, paths } from '../../components/links'
import { DefectCodePicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { DISPOSITION_OPTIONS, InspectionEditDialog } from './dialogs'
import { holdsWipOnRecord, isOpenInspection, numericResult } from './lib'

type DefectRow = { key: string; defectCodeId: string | null; qty: string; note: string }

export function InspectionDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const navigate = useNavigate()
  const inspection = s.maps.inspection.get(id)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  if (!inspection) {
    return (
      <Card>
        <EmptyState
          title="Inspection not found"
          description="It may have been removed or belongs to another site."
          action={<BackButton fallback="/quality/inspections" />}
        />
      </Card>
    )
  }

  const wo = inspection.woId ? s.maps.wo.get(inspection.woId) : undefined
  const wip = inspection.wipId ? s.maps.wip.get(inspection.wipId) : undefined
  const lot = inspection.lotId ? s.maps.lot.get(inspection.lotId) : undefined
  const plan = inspection.planId ? s.inspectionPlans.find((p) => p.id === inspection.planId) : undefined
  const hold = s.qualityHolds.find(
    (h) => h.target === 'wip' && h.targetId === inspection.wipId && h.status === 'active',
  )
  const defects = inspection.defectRecordIds
    .map((d) => s.defectRecords.find((r) => r.id === d))
    .filter((r) => !!r)
  const open = isOpenInspection(inspection)
  const execute = can('quality.execute')

  const menu = [
    execute && open
      ? { key: 'edit', label: 'Edit inspection', icon: <Pencil />, onSelect: () => setEditing(true) }
      : null,
    execute && open
      ? {
          key: 'delete',
          label: 'Delete inspection',
          icon: <Trash2 />,
          destructive: true,
          onSelect: () => setDeleting(true),
        }
      : null,
  ].filter((x): x is NonNullable<typeof x> => !!x)

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/quality/inspections" />
        <div className="gap-2 flex flex-wrap items-center">
          {execute && inspection.status === 'pending' && (
            <Button
              onClick={() => {
                s.dispatch({ type: 'inspections/start', id: inspection.id })
                toast('Inspection started', {
                  tone: 'success',
                  description: 'You are recorded as the inspector.',
                })
              }}
            >
              <Play />
              Start
            </Button>
          )}
          {menu.length > 0 && (
            <ActionMenu
              title={inspection.code}
              items={menu}
              trigger={
                <Button variant="outline" size="icon" aria-label="More actions">
                  <MoreHorizontal />
                </Button>
              }
            />
          )}
        </div>
      </div>

      {!open && (
        <Banner tone="info" title="Result retained for audit">
          Completed inspections cannot be edited or deleted. Request a new inspection to record a corrected
          result.
        </Banner>
      )}

      <Card variant="ink" className="p-5 relative overflow-hidden">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{inspection.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{s.productName(inspection.productId)}</h1>
            <p className="text-sm text-on-ink-muted">
              Operation {inspection.operationSeq}
              {wo ? ` · ${wo.operationName}` : ''} · {INSPECTION_TRIGGER_LABEL[inspection.trigger]}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap">
            <InspectionStatusBadge status={inspection.status} />
            <DispositionBadge disposition={inspection.disposition} />
          </div>
        </div>
        <div className="mt-5 gap-4 grid grid-cols-3">
          <Metric label="Characteristics" value={String(inspection.measurements.length)} />
          <Metric label="Sample" value={String(inspection.sampleSize)} unit="pcs" />
          <Metric
            label="Failed"
            value={String(inspection.measurements.filter((m) => m.result === 'fail').length)}
          />
        </div>
      </Card>

      {hold && (
        <Banner
          tone="danger"
          title={`${wip?.code ?? 'The batch'} is on quality hold (${hold.code})`}
          action={
            <Button asChild variant="outline" size="sm">
              <Link to={paths.hold(hold.id)}>Open hold</Link>
            </Button>
          }
        >
          Release it from the holds screen once a disposition is decided.
        </Banner>
      )}

      <div className="gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,2fr)] grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Context</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                { label: 'Order', value: <MoLink moId={inspection.moId} /> },
                { label: 'Work order', value: inspection.woId ? <WoLink woId={inspection.woId} /> : 'None' },
                {
                  label: 'WIP',
                  value: wip ? (
                    <Link to={paths.wip(wip.id)} className="text-xs font-mono hover:text-accent">
                      {wip.code}
                    </Link>
                  ) : (
                    'Any batch'
                  ),
                },
                {
                  label: 'Lot',
                  value: lot ? (
                    <Link to={paths.lot(lot.id)} className="text-xs font-mono hover:text-accent">
                      {lot.code}
                    </Link>
                  ) : (
                    'None'
                  ),
                  hidden: !lot,
                },
                {
                  label: 'Operation',
                  value: `${inspection.operationSeq}${wo ? ` · ${wo.operationName}` : ''}`,
                },
                { label: 'Trigger', value: INSPECTION_TRIGGER_LABEL[inspection.trigger] },
                { label: 'Sample size', value: `${inspection.sampleSize} pcs` },
                {
                  label: 'Plan',
                  value: plan ? `${plan.code} · every ${plan.every}` : 'No plan, spec from the snapshot',
                },
                { label: 'Inspector', value: <PersonChip personId={inspection.inspectorId} /> },
                { label: 'Requested', value: fmtDateTime(inspection.requestedAt) },
                {
                  label: 'Completed',
                  value: inspection.completedAt ? fmtDateTime(inspection.completedAt) : 'Not yet',
                },
                { label: 'Note', value: inspection.note, hidden: !inspection.note },
              ]}
            />
          </CardContent>
        </Card>

        {open ? (
          execute ? (
            <RecordCard key={inspection.id} inspectionId={inspection.id} />
          ) : (
            <Card>
              <EmptyState
                title="Waiting for results"
                description="A quality inspector records the measurements and decides the disposition."
              />
            </Card>
          )
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>Results</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {inspection.measurements.length === 0 ? (
                <EmptyState
                  compact
                  title="No characteristics measured"
                  description="The inspection was closed with a disposition only."
                />
              ) : (
                <div className="space-y-2">
                  {inspection.measurements.map((m) => (
                    <div
                      key={m.characteristicId}
                      className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2"
                    >
                      <span className="min-w-0 flex-1">
                        <span className="text-sm font-semibold block truncate">{m.name}</span>
                        <span className="text-xs block truncate text-muted">
                          {MEASUREMENT_TYPE_LABEL[m.type]}
                          {m.type === 'numeric' ? ` · ${limits(m)}` : ''}
                          {m.note ? ` · ${m.note}` : ''}
                        </span>
                      </span>
                      {m.type === 'numeric' && (
                        <span className="text-sm font-bold tabular-nums">
                          {m.value === null ? '—' : fmtNumber(m.value, 2)}{' '}
                          <span className="text-xs font-medium text-muted">{m.unit}</span>
                        </span>
                      )}
                      <ResultBadge result={m.result} />
                    </div>
                  ))}
                </div>
              )}
              <div>
                <p className="text-sm font-semibold">Defects recorded</p>
                {defects.length === 0 ? (
                  <p className="mt-1 text-sm text-muted">None.</p>
                ) : (
                  <ul className="mt-2 space-y-2">
                    {defects.map((d) => {
                      const code = s.maps.defectCode.get(d.defectCodeId)
                      return (
                        <li
                          key={d.id}
                          className="gap-3 rounded-2xl p-3 text-sm flex items-center bg-surface-2"
                        >
                          <span className="min-w-0 flex-1">
                            <span className="font-semibold block">{code?.name ?? d.defectCodeId}</span>
                            <span className="text-xs block text-muted">
                              <span className="font-mono">{code?.code}</span>
                              {d.note ? ` · ${d.note}` : ''}
                            </span>
                          </span>
                          <span className="font-bold tabular-nums">{d.qty}</span>
                          {code && <SeverityBadge severity={code.severity} />}
                        </li>
                      )
                    })}
                  </ul>
                )}
              </div>
              {inspection.photos.length > 0 && (
                <div>
                  <p className="text-sm font-semibold">Photos</p>
                  <div className="mt-2 gap-1.5 flex flex-wrap">
                    {inspection.photos.map((p) => (
                      <Badge key={p} variant="outline">
                        {p}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}
              <KeyValue
                bare
                items={[
                  { label: 'Disposition', value: <DispositionBadge disposition={inspection.disposition} /> },
                  { label: 'Note', value: inspection.note || 'None' },
                ]}
              />
            </CardContent>
          </Card>
        )}
      </div>

      <InspectionEditDialog open={editing} onOpenChange={setEditing} inspection={inspection} />
      <ConfirmDialog
        open={deleting}
        onOpenChange={setDeleting}
        title={`Delete ${inspection.code}?`}
        description="The request is removed before any result was recorded. Completed results remain in the audit trail."
        confirmLabel="Delete inspection"
        destructive
        onConfirm={() => {
          s.dispatch({ type: 'inspections/remove', id: inspection.id })
          setDeleting(false)
          toast('Inspection deleted', { tone: 'default', description: `${inspection.code} removed.` })
          navigate('/quality/inspections')
        }}
      />
    </div>
  )
}

function RecordCard({ inspectionId }: { inspectionId: string }) {
  const s = useScoped()
  const inspection = s.maps.inspection.get(inspectionId)!
  const [measurements, setMeasurements] = useState<Measurement[]>(() =>
    inspection.measurements.map((m) => ({ ...m })),
  )
  const [checks, setChecks] = useState<Record<string, boolean>>({})
  const [photos, setPhotos] = useState<Record<string, string[]>>({})
  const [defects, setDefects] = useState<DefectRow[]>([])
  const [disposition, setDisposition] = useState<Disposition>('accept')
  const [note, setNote] = useState('')
  const [tried, setTried] = useState(false)

  const patch = (idx: number, p: Partial<Measurement>) =>
    setMeasurements((list) => list.map((m, i) => (i === idx ? { ...m, ...p } : m)))
  const unanswered = useMemo(() => measurements.filter((m) => m.result === null), [measurements])
  const willHold =
    !!inspection.wipId && (disposition === 'hold' || holdsWipOnRecord(measurements, disposition))
  const failing = measurements.some((m) => m.result === 'fail')
  const badDefect = defects.some((d) => !d.defectCodeId || !(Number(d.qty) > 0))

  const submit = () => {
    setTried(true)
    if (unanswered.length || badDefect) return
    s.dispatch({
      type: 'inspections/record',
      id: inspection.id,
      measurements,
      disposition,
      note,
      defects: defects.map((d) => ({ defectCodeId: d.defectCodeId!, qty: Number(d.qty), note: d.note })),
    })
    toast(failing ? 'Inspection failed' : 'Inspection passed', {
      tone: failing ? 'danger' : 'success',
      description: `Disposition ${DISPOSITION_LABEL[disposition].toLowerCase()}${willHold ? '. The batch is on quality hold.' : '.'}`,
    })
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Record results</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {measurements.length === 0 ? (
          <EmptyState
            compact
            title="No characteristics"
            description="Nothing to measure at this operation. Record the disposition below."
          />
        ) : (
          <div className="space-y-2">
            {measurements.map((m, idx) => (
              <div key={m.characteristicId} className="rounded-2xl p-3 bg-surface-2">
                <div className="gap-2 flex flex-wrap items-center justify-between">
                  <span className="min-w-0">
                    <span className="text-sm font-semibold block">{m.name}</span>
                    <span className="text-xs block text-muted">
                      {MEASUREMENT_TYPE_LABEL[m.type]}
                      {m.type === 'numeric' ? ` · ${limits(m)}` : ''}
                    </span>
                  </span>
                  <ResultBadge result={m.result} pending={tried && m.result === null} />
                </div>
                <div className="mt-2">
                  {m.type === 'numeric' && (
                    <Input
                      type="number"
                      step="any"
                      inputMode="decimal"
                      aria-label={`${m.name} reading`}
                      value={m.value ?? ''}
                      rightSlot={<span className="text-xs text-muted">{m.unit}</span>}
                      onChange={(e) => {
                        const value = e.target.value === '' ? null : Number(e.target.value)
                        patch(idx, { value, result: numericResult({ value, min: m.min, max: m.max }) })
                      }}
                    />
                  )}
                  {(m.type === 'pass_fail' || m.type === 'visual') && (
                    <SegmentedControl
                      aria-label={m.name}
                      size="sm"
                      value={m.result}
                      onChange={(v) => patch(idx, { result: v as 'pass' | 'fail' })}
                      options={[
                        { value: 'pass', label: 'Pass', tone: 'success' },
                        { value: 'fail', label: 'Fail', tone: 'danger' },
                      ]}
                    />
                  )}
                  {m.type === 'checklist' && (
                    <label className="gap-3 text-sm flex items-center justify-between">
                      <span>{m.name} confirmed</span>
                      <Switch
                        size="sm"
                        checked={checks[m.characteristicId] ?? false}
                        onCheckedChange={(on) => {
                          setChecks((c) => ({ ...c, [m.characteristicId]: on }))
                          patch(idx, { result: on ? 'pass' : 'fail' })
                        }}
                      />
                    </label>
                  )}
                  {m.type === 'photo' && (
                    <PhotoInput
                      max={3}
                      photos={photos[m.characteristicId] ?? []}
                      onAdd={(urls) => {
                        const next = [...(photos[m.characteristicId] ?? []), ...urls]
                        setPhotos((p) => ({ ...p, [m.characteristicId]: next }))
                        patch(idx, { result: 'pass', note: `${next.length} photo(s) attached` })
                      }}
                      onRemove={(url) => {
                        const next = (photos[m.characteristicId] ?? []).filter((u) => u !== url)
                        setPhotos((p) => ({ ...p, [m.characteristicId]: next }))
                        patch(idx, {
                          result: next.length ? 'pass' : null,
                          note: next.length ? `${next.length} photo(s) attached` : '',
                        })
                      }}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        <div>
          <div className="gap-2 flex flex-wrap items-center justify-between">
            <p className="text-sm font-semibold">Defects</p>
            <Button
              variant="outline"
              size="sm"
              onClick={() =>
                setDefects((d) => [...d, { key: String(Date.now()), defectCodeId: null, qty: '1', note: '' }])
              }
            >
              <Plus />
              Add defect
            </Button>
          </div>
          {defects.length === 0 ? (
            <p className="mt-1 text-sm text-muted">No defects found in the sample.</p>
          ) : (
            <div className="mt-2 space-y-2">
              {defects.map((d, i) => (
                <div
                  key={d.key}
                  className="gap-2 rounded-2xl p-3 sm:grid-cols-[minmax(0,1fr)_5rem_minmax(0,1fr)_auto] grid grid-cols-1 bg-surface-2"
                >
                  <DefectCodePicker
                    variant="soft"
                    value={d.defectCodeId}
                    onChange={(v) =>
                      setDefects((list) => list.map((x, j) => (j === i ? { ...x, defectCodeId: v } : x)))
                    }
                    invalid={tried && !d.defectCodeId}
                  />
                  <Input
                    variant="soft"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    aria-label="Quantity"
                    value={d.qty}
                    onChange={(e) =>
                      setDefects((list) => list.map((x, j) => (j === i ? { ...x, qty: e.target.value } : x)))
                    }
                    invalid={tried && !(Number(d.qty) > 0)}
                  />
                  <Input
                    variant="soft"
                    placeholder="Note"
                    aria-label="Note"
                    value={d.note}
                    onChange={(e) =>
                      setDefects((list) => list.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove defect"
                    onClick={() => setDefects((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="gap-4 sm:grid-cols-2 grid grid-cols-1">
          <FormField label="Disposition" required>
            <NativeSelect
              options={DISPOSITION_OPTIONS}
              value={disposition}
              onChange={(e) => setDisposition(e.target.value as Disposition)}
            />
          </FormField>
          <FormField label="Note">
            <Textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="min-h-11"
              placeholder="Observations"
            />
          </FormField>
        </div>

        <Banner
          tone={willHold ? 'warning' : 'info'}
          title={willHold ? 'This result puts the batch on quality hold' : 'Hold rule'}
        >
          A failed inspection with any disposition other than Accept or Use as is puts the WIP batch on
          quality hold automatically. Choosing Hold does the same.
        </Banner>

        {tried && unanswered.length > 0 && (
          <p className="text-sm text-danger">{unanswered.length} characteristics still need a result.</p>
        )}
        <div className="gap-2 flex flex-wrap justify-end">
          <Button onClick={submit}>Submit results</Button>
        </div>
      </CardContent>
    </Card>
  )
}

function limits(m: Pick<Measurement, 'target' | 'min' | 'max' | 'unit'>) {
  const parts = [
    m.target !== null ? `target ${m.target}` : null,
    m.min !== null ? `min ${m.min}` : null,
    m.max !== null ? `max ${m.max}` : null,
  ].filter(Boolean)
  return parts.length ? `${parts.join(' · ')} ${m.unit}`.trim() : 'no limits'
}

function ResultBadge({ result, pending = false }: { result: 'pass' | 'fail' | null; pending?: boolean }) {
  if (result === 'pass') return <Badge variant="success">Pass</Badge>
  if (result === 'fail') return <Badge variant="danger">Fail</Badge>
  return <Badge variant={pending ? 'warning' : 'outline'}>Not measured</Badge>
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1.5 flex items-end leading-none">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}
