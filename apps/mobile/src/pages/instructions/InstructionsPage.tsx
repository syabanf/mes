import type { WorkInstruction } from '@mes/types'
import { REVISION_STATE_LABEL } from '@mes/types'
import { Badge, Card, Chip, EmptyState, FormField } from '@mes/ui'
import { BookOpen } from 'lucide-react'
import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router'
import { InstructionView } from '../../components/InstructionView'
import { ProductPicker } from '../../components/pickers'
import { ScreenHeader } from '../../layouts/ScreenHeader'
import { useMobileScope } from '../../state/scope'

/** Product → operation chips → the instruction rendered large. `?wi=` opens one directly. */
export function InstructionsPage() {
  const s = useMobileScope()
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
    setParams({ wi: wi.id }, { replace: true })
  }
  const changeProduct = (id: string | null) => {
    setProductId(id)
    setWiId(null)
    setParams({}, { replace: true })
  }
  const toggle = (key: string) =>
    setChecked((prev) => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })

  return (
    <div className="space-y-6">
      <ScreenHeader greeting="Released steps per product and operation" title="Instructions" />

      <FormField label="Product">
        <ProductPicker value={productId} onChange={changeProduct} clearable className="h-12" />
      </FormField>

      {productId && rows.length > 0 && (
        <div
          role="group"
          aria-label="Operation"
          className="-mx-5 gap-2 px-5 pb-1 no-scrollbar flex overflow-x-auto"
        >
          {rows.map((r) => (
            <Chip
              key={r.key}
              variant="filter"
              active={!!r.instruction && r.instruction.id === wiId}
              disabled={!r.instruction}
              onClick={() => r.instruction && pick(r.instruction)}
              className="h-11"
            >
              <span className="tabular-nums">{r.seq}</span>
              {r.name}
            </Chip>
          ))}
        </div>
      )}

      {instruction ? (
        <div className="space-y-3">
          <div className="p-4 rounded-[24px] bg-card shadow-card">
            <div className="gap-2 flex flex-wrap items-center">
              <h2 className="text-lg font-bold leading-tight">{instruction.title}</h2>
              <Badge variant={instruction.state === 'released' ? 'success' : 'outline'}>
                {REVISION_STATE_LABEL[instruction.state]}
              </Badge>
            </div>
            <p className="mt-1 text-sm text-muted">
              <span className="font-mono">{instruction.code}</span> · rev {instruction.rev} · operation{' '}
              {instruction.operationSeq} · {instruction.steps.length} steps
            </p>
          </div>
          <InstructionView instruction={instruction} checked={checked} onToggle={toggle} />
        </div>
      ) : (
        <Card>
          <EmptyState
            icon={<BookOpen />}
            title={!productId ? 'Pick a product' : rows.length === 0 ? 'No operations' : 'Pick an operation'}
            description={
              !productId
                ? 'Its operations and their instructions list here.'
                : rows.length === 0
                  ? 'This product has no released routing or instructions yet.'
                  : 'Operations without an instruction are greyed out.'
            }
          />
        </Card>
      )}
    </div>
  )
}
