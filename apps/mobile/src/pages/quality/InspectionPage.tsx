import { fmtDateTime, fmtNumber } from '@mes/fixtures'
import type { Disposition, Measurement } from '@mes/types'
import { DISPOSITIONS, DISPOSITION_LABEL, INSPECTION_TRIGGER_LABEL, MEASUREMENT_TYPE_LABEL } from '@mes/types'
import {
  Badge,
  Banner,
  Button,
  Card,
  EmptyState,
  FormField,
  Input,
  KeyValue,
  NativeSelect,
  PhotoInput,
  SegmentedControl,
  Textarea,
  toast,
} from '@mes/ui'
import { Play, Plus, Trash2 } from 'lucide-react'
import { useMemo, useState } from 'react'
import { Link, useParams } from 'react-router'
import { DispositionBadge, InspectionStatusBadge } from '../../components/badges'
import { DefectCodePicker } from '../../components/pickers'
import { StickyBar } from '../../components/StickyBar'
import { DetailHeader } from '../../layouts/DetailHeader'
import { paths } from '../../lib/paths'
import { holdsWipOnRecord, limits, numericResult } from '../../lib/wo'
import { useMobileScope } from '../../state/scope'

const DISPOSITION_OPTIONS = DISPOSITIONS.map((d) => ({ value: d, label: DISPOSITION_LABEL[d] }))
type DefectRow = { key: string; defectCodeId: string | null; qty: string; note: string }

export function InspectionPage() {
  const { id = '' } = useParams()
  const s = useMobileScope()
  const inspection = s.maps.inspection.get(id)
  if (!inspection || !inspection.woId || !s.canOpen(inspection.woId)) {
    return (
      <div className="space-y-5">
        <DetailHeader title="Inspection" fallback={paths.quality} />
        <Card>
          <EmptyState
            title="Inspection not found"
            description="It may belong to another site or to work outside your work centers."
            action={
              <Button asChild variant="outline" className="h-11">
                <Link to={paths.quality}>Quality queue</Link>
              </Button>
            }
          />
        </Card>
      </div>
    )
  }

  const wo = s.maps.wo.get(inspection.woId)
  const open = inspection.status === 'pending' || inspection.status === 'in_progress'
  const failed = inspection.measurements.filter((m) => m.result === 'fail').length

  return (
    <div className="space-y-5 pb-4">
      <DetailHeader
        title={inspection.code}
        mono
        subtitle={`${s.productName(inspection.productId)} · operation ${inspection.operationSeq}`}
        fallback={paths.quality}
      />

      <Card variant="ink" className="p-6">
        <div className="gap-3 flex items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs truncate font-mono text-on-ink-muted">{wo?.code ?? inspection.code}</p>
            <h2 className="mt-1 text-2xl font-bold leading-tight tracking-tight">
              {s.productName(inspection.productId)}
            </h2>
            <p className="mt-1 text-sm text-on-ink-muted">
              Operation {inspection.operationSeq}
              {wo ? ` · ${wo.operationName}` : ''} · {INSPECTION_TRIGGER_LABEL[inspection.trigger]}
            </p>
          </div>
          <InspectionStatusBadge status={inspection.status} />
        </div>
        <div className="mt-5 gap-3 grid grid-cols-3">
          <Metric label="Characteristics" value={inspection.measurements.length} />
          <Metric label="Sample" value={inspection.sampleSize} unit="pcs" />
          <Metric label="Failed" value={failed} />
        </div>
      </Card>

      <KeyValue
        items={[
          {
            label: 'Work order',
            value: wo ? (
              <Link to={paths.workOrder(wo.id)} className="text-xs font-semibold font-mono">
                {wo.code}
              </Link>
            ) : (
              'None'
            ),
          },
          { label: 'Inspector', value: s.personName(inspection.inspectorId) },
          { label: 'Requested', value: fmtDateTime(inspection.requestedAt) },
          {
            label: 'Completed',
            value: inspection.completedAt ? fmtDateTime(inspection.completedAt) : 'Not yet',
          },
          { label: 'Note', value: inspection.note, hidden: !inspection.note },
        ]}
      />

      {open ? (
        <RecordForm key={inspection.id} inspectionId={inspection.id} />
      ) : (
        <div className="space-y-3">
          <h2 className="text-base font-bold">Results</h2>
          {inspection.measurements.length === 0 ? (
            <Card>
              <EmptyState
                compact
                title="No characteristics measured"
                description="The inspection was closed with a disposition only."
              />
            </Card>
          ) : (
            inspection.measurements.map((m) => (
              <div
                key={m.characteristicId}
                className="gap-3 p-4 flex items-center rounded-[24px] bg-card shadow-card"
              >
                <span className="min-w-0 flex-1">
                  <span className="text-sm font-semibold block truncate">{m.name}</span>
                  <span className="text-xs block truncate text-muted">
                    {MEASUREMENT_TYPE_LABEL[m.type]}
                    {m.type === 'numeric' ? ` · ${limits(m)}` : ''}
                  </span>
                </span>
                {m.type === 'numeric' && (
                  <span className="text-sm font-bold tabular-nums">
                    {m.value === null ? 'n/a' : fmtNumber(m.value, 2)}{' '}
                    <span className="text-xs font-medium text-muted">{m.unit}</span>
                  </span>
                )}
                <ResultBadge result={m.result} />
              </div>
            ))
          )}
          <KeyValue
            items={[
              { label: 'Disposition', value: <DispositionBadge disposition={inspection.disposition} /> },
              { label: 'Defects', value: `${inspection.defectRecordIds.length} recorded` },
            ]}
          />
        </div>
      )}
    </div>
  )
}

function RecordForm({ inspectionId }: { inspectionId: string }) {
  const s = useMobileScope()
  const inspection = s.maps.inspection.get(inspectionId)!
  const [measurements, setMeasurements] = useState<Measurement[]>(() =>
    inspection.measurements.map((m) => ({ ...m })),
  )
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

  const start = () => {
    s.dispatch({ type: 'inspections/start', id: inspection.id })
    toast('Inspection started', { tone: 'success', description: 'You are recorded as the inspector.' })
  }
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
    <div className="space-y-4 pb-24">
      <div className="gap-2 flex items-center justify-between">
        <h2 className="text-base font-bold">Record results</h2>
        {inspection.status === 'pending' && (
          <Button variant="outline" size="sm" className="h-10" onClick={start}>
            <Play />
            Start
          </Button>
        )}
      </div>

      {measurements.length === 0 ? (
        <Card>
          <EmptyState
            compact
            title="No characteristics"
            description="Nothing to measure at this operation. Record the disposition below."
          />
        </Card>
      ) : (
        measurements.map((m, idx) => (
          <div key={m.characteristicId} className="p-4 rounded-[24px] bg-card shadow-card">
            <div className="gap-2 flex items-center justify-between">
              <span className="min-w-0">
                <span className="text-sm font-semibold block">{m.name}</span>
                <span className="text-xs block text-muted">
                  {MEASUREMENT_TYPE_LABEL[m.type]}
                  {m.type === 'numeric' ? ` · ${limits(m)}` : ''}
                </span>
              </span>
              <ResultBadge result={m.result} pending={tried && m.result === null} />
            </div>
            <div className="mt-3">
              {m.type === 'numeric' && (
                <Input
                  variant="soft"
                  type="number"
                  step="any"
                  inputMode="decimal"
                  aria-label={`${m.name} reading`}
                  value={m.value ?? ''}
                  rightSlot={<span className="text-xs text-muted">{m.unit}</span>}
                  inputClassName="h-14 text-xl font-bold tabular-nums"
                  onChange={(e) => {
                    const value = e.target.value === '' ? null : Number(e.target.value)
                    patch(idx, { value, result: numericResult({ value, min: m.min, max: m.max }) })
                  }}
                />
              )}
              {(m.type === 'pass_fail' || m.type === 'visual' || m.type === 'checklist') && (
                <SegmentedControl
                  aria-label={m.name}
                  className="[&_[role=radio]]:h-12 w-full"
                  value={m.result}
                  onChange={(v) => patch(idx, { result: v as 'pass' | 'fail' })}
                  options={[
                    { value: 'pass', label: m.type === 'checklist' ? 'Confirmed' : 'Pass', tone: 'success' },
                    { value: 'fail', label: m.type === 'checklist' ? 'Not OK' : 'Fail', tone: 'danger' },
                  ]}
                />
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
        ))
      )}

      <div className="p-4 rounded-[24px] bg-card shadow-card">
        <div className="gap-2 flex items-center justify-between">
          <p className="text-sm font-semibold">Defects</p>
          <Button
            variant="outline"
            size="sm"
            className="h-10"
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
          <div className="mt-3 space-y-3">
            {defects.map((d, i) => (
              <div key={d.key} className="space-y-2 rounded-2xl p-3 bg-surface">
                <DefectCodePicker
                  variant="soft"
                  className="bg-card"
                  value={d.defectCodeId}
                  onChange={(v) =>
                    setDefects((list) => list.map((x, j) => (j === i ? { ...x, defectCodeId: v } : x)))
                  }
                  invalid={tried && !d.defectCodeId}
                />
                <div className="gap-2 flex">
                  <Input
                    variant="soft"
                    className="w-24 shrink-0"
                    inputClassName="h-12 bg-card text-center font-bold tabular-nums"
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
                    inputClassName="h-12 bg-card"
                    placeholder="Note"
                    aria-label="Note"
                    value={d.note}
                    onChange={(e) =>
                      setDefects((list) => list.map((x, j) => (j === i ? { ...x, note: e.target.value } : x)))
                    }
                  />
                  <Button
                    variant="ghost"
                    size="icon-lg"
                    className="size-12 shrink-0"
                    aria-label="Remove defect"
                    onClick={() => setDefects((list) => list.filter((_, j) => j !== i))}
                  >
                    <Trash2 />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="space-y-4 p-4 rounded-[24px] bg-card shadow-card">
        <FormField label="Disposition" required>
          <NativeSelect
            variant="soft"
            className="[&_select]:h-12"
            options={DISPOSITION_OPTIONS}
            value={disposition}
            onChange={(e) => setDisposition(e.target.value as Disposition)}
          />
        </FormField>
        <FormField label="Note">
          <Textarea
            variant="soft"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            className="min-h-20"
            placeholder="Observations"
          />
        </FormField>
      </div>

      <Banner
        tone={willHold ? 'warning' : 'info'}
        title={willHold ? 'This result puts the batch on quality hold' : 'Hold rule'}
      >
        A failed result with any disposition other than Accept or Use as is puts the WIP batch on quality
        hold.
      </Banner>

      <StickyBar
        note={
          tried && unanswered.length > 0
            ? `${unanswered.length} characteristics still need a result`
            : undefined
        }
      >
        <Button size="lg" className="h-14 w-full" onClick={submit}>
          Submit results
        </Button>
      </StickyBar>
    </div>
  )
}

function ResultBadge({ result, pending = false }: { result: 'pass' | 'fail' | null; pending?: boolean }) {
  if (result === 'pass') return <Badge variant="success">Pass</Badge>
  if (result === 'fail') return <Badge variant="danger">Fail</Badge>
  return <Badge variant={pending ? 'warning' : 'outline'}>Not measured</Badge>
}

function Metric({ label, value, unit }: { label: string; value: number; unit?: string }) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1.5 flex items-end leading-none">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{fmtNumber(value)}</span>
        {unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}
