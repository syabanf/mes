import { fmtDate } from '@mes/fixtures'
import type { WorkInstruction } from '@mes/types'
import {
  Badge,
  Banner,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  FormField,
  PageHeader,
  cn,
} from '@mes/ui'
import { BookOpen, FileText } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { RevisionBadge } from '../../components/badges'
import { ProductPicker } from '../../components/pickers'
import { useScoped } from '../../state/scoped'
import { InstructionView } from './InstructionView'

export function ShopfloorInstructionsPage() {
  const s = useScoped()
  const [params, setParams] = useSearchParams()
  const deep = s.maps.workInstruction.get(params.get('wi') ?? '')
  const deepId = deep?.id ?? null
  const deepProduct = deep?.productId ?? null
  const [productId, setProductId] = useState<string | null>(deepProduct)
  const [wiId, setWiId] = useState<string | null>(deepId)
  const [checked, setChecked] = useState<Set<string>>(() => new Set())

  useEffect(() => {
    if (deepId && deepProduct) {
      setProductId(deepProduct)
      setWiId(deepId)
    }
  }, [deepId, deepProduct])

  const rows = useMemo(() => {
    if (!productId) return []
    const product = s.maps.product.get(productId)
    const revision = product?.currentRevisionId ? s.maps.revision.get(product.currentRevisionId) : undefined
    const bop = revision?.bopId ? s.maps.bop.get(revision.bopId) : undefined
    const own = s.workInstructions.filter((wi) => wi.productId === productId)
    const forSeq = (seq: number, preferred: string | null) =>
      (preferred ? own.find((wi) => wi.id === preferred) : undefined) ??
      own.find((wi) => wi.operationSeq === seq && wi.state === 'released') ??
      own.find((wi) => wi.operationSeq === seq)
    if (bop)
      return bop.operations.map((op) => ({
        key: `op-${op.seq}`,
        seq: op.seq,
        name: op.name,
        instruction: forSeq(op.seq, op.workInstructionId),
      }))
    return [...own]
      .sort((a, b) => a.operationSeq - b.operationSeq)
      .map((wi) => ({
        key: wi.id,
        seq: wi.operationSeq,
        name: wi.title,
        instruction: wi as WorkInstruction | undefined,
      }))
  }, [s, productId])

  const instruction = wiId ? s.maps.workInstruction.get(wiId) : undefined

  const pick = (wi: WorkInstruction) => {
    setWiId(wi.id)
    setChecked(new Set())
    setParams(
      (p) => {
        p.set('wi', wi.id)
        return p
      },
      { replace: true },
    )
  }
  const changeProduct = (id: string | null) => {
    setProductId(id)
    setWiId(null)
    setParams(
      (p) => {
        p.delete('wi')
        return p
      },
      { replace: true },
    )
  }
  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <>
      <PageHeader
        title="Work instructions"
        description="Browse the operator instructions per product and operation, the way they read at the station."
      />
      <div className="gap-4 lg:grid-cols-[20rem_minmax(0,1fr)] grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Product and operation</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <FormField label="Product">
              <ProductPicker value={productId} onChange={changeProduct} clearable />
            </FormField>
            {!productId ? (
              <EmptyState
                compact
                icon={<BookOpen />}
                title="Pick a product"
                description="Its operations and their instructions list here."
              />
            ) : rows.length === 0 ? (
              <EmptyState
                compact
                title="No operations"
                description="This product has no released routing or instructions yet."
              />
            ) : (
              <ul className="space-y-1">
                {rows.map((r) => {
                  const active = !!r.instruction && r.instruction.id === wiId
                  return (
                    <li key={r.key}>
                      <button
                        type="button"
                        disabled={!r.instruction}
                        onClick={() => r.instruction && pick(r.instruction)}
                        className={cn(
                          'min-h-12 gap-3 rounded-2xl px-3 py-2 text-sm flex w-full items-center text-left transition-colors focus-visible:ring-2 focus-visible:ring-accent/40 focus-visible:outline-none disabled:opacity-50',
                          active ? 'bg-ink text-on-ink' : 'bg-surface-2 hover:bg-surface',
                        )}
                      >
                        <span
                          className={cn(
                            'size-8 rounded-xl text-xs font-bold flex shrink-0 items-center justify-center tabular-nums',
                            active ? 'bg-white/15' : 'bg-card shadow-card',
                          )}
                        >
                          {r.seq}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="font-semibold block truncate">{r.name}</span>
                          <span
                            className={cn(
                              'text-xs block truncate',
                              active ? 'text-on-ink-muted' : 'text-muted',
                            )}
                          >
                            {r.instruction
                              ? `${r.instruction.code} · rev ${r.instruction.rev} · ${r.instruction.steps.length} steps`
                              : 'No instruction'}
                          </span>
                        </span>
                        {r.instruction && (
                          <FileText
                            className={cn('size-4 shrink-0', active ? 'text-on-ink-muted' : 'text-muted')}
                          />
                        )}
                      </button>
                    </li>
                  )
                })}
              </ul>
            )}
          </CardContent>
        </Card>

        <Card>
          {instruction ? (
            <>
              <CardHeader>
                <div className="gap-2 flex flex-wrap items-center">
                  <CardTitle className="text-xl">{instruction.title}</CardTitle>
                  <RevisionBadge state={instruction.state} />
                  <Badge variant="outline">rev {instruction.rev}</Badge>
                </div>
                <p className="text-sm text-muted">
                  {instruction.code} · {s.productName(instruction.productId)} · operation{' '}
                  {instruction.operationSeq} · {instruction.steps.length} steps · created{' '}
                  {fmtDate(instruction.createdAt)}
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <Banner tone="neutral" title="What operators see">
                  Operators receive the exact revision frozen in the manufacturing order snapshot at release.
                  This browser shows the current engineering copy, revision {instruction.rev}.
                </Banner>
                <InstructionView instruction={instruction} checked={checked} onToggle={toggle} large />
              </CardContent>
            </>
          ) : (
            <EmptyState
              icon={<BookOpen />}
              title="No instruction selected"
              description="Choose an operation on the left, or open a link from a work order."
            />
          )}
        </Card>
      </div>
    </>
  )
}
