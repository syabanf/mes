import {
  currentRevision,
  fmtDate,
  fmtDateTime,
  fmtIdr,
  fmtNumber,
  groupBy,
  productOnHand,
} from '@mes/fixtures'
import type { Eco, Product, ProductRevision, Specification, WorkInstruction } from '@mes/types'
import { SPEC_KIND_LABEL, STRATEGY_LABEL } from '@mes/types'
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  EmptyState,
  KeyValue,
  UnderlineTabs,
} from '@mes/ui'
import {
  ArrowUpRight,
  Boxes,
  ClipboardList,
  FileDiff,
  FileText,
  Pencil,
  Plus,
  Ruler,
  Wrench,
} from 'lucide-react'
import { type ReactNode, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router'
import { useAuth } from '../../auth/auth'
import { BackButton } from '../../components/BackButton'
import { EcoStatusBadge, RevisionBadge, StrategyBadge } from '../../components/badges'
import { PersonChip, paths } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { PRODUCT_TABS, type ProductTab, openMosFor, productTabPath, revisionsOf } from './lib'
import { ProductDialog } from './ProductDialog'
import {
  BomTable,
  BopTable,
  BorTable,
  CharacteristicsTable,
  InstructionSteps,
  LockBadge,
  StepKindTrail,
} from './tables'

export function ProductDetailPage() {
  const { id = '' } = useParams()
  const s = useScoped()
  const { can } = useAuth()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState(false)
  const product = s.maps.product.get(id)
  const tabParam = params.get('tab')
  const tab: ProductTab = PRODUCT_TABS.includes(tabParam as ProductTab)
    ? (tabParam as ProductTab)
    : 'overview'
  const setTab = (next: string) =>
    setParams(
      (p) => {
        if (next === 'overview') p.delete('tab')
        else p.set('tab', next)
        return p
      },
      { replace: true },
    )

  const d = useMemo(() => {
    if (!product) return null
    const revision = currentRevision(s.state, product.id)
    const revisions = revisionsOf(s.productRevisions, product.id)
    const bom = revision?.bomId ? s.maps.bom.get(revision.bomId) : undefined
    const bor = revision?.borId ? s.maps.bor.get(revision.borId) : undefined
    const bop = revision?.bopId ? s.maps.bop.get(revision.bopId) : undefined
    const ownSpecs = s.specifications.filter((x) => x.productId === product.id)
    const ownWis = s.workInstructions.filter((x) => x.productId === product.id)
    const specs = revision?.specIds.length
      ? ownSpecs.filter((x) => revision.specIds.includes(x.id))
      : ownSpecs
    const wis = (
      revision?.workInstructionIds.length
        ? ownWis.filter((x) => revision.workInstructionIds.includes(x.id))
        : ownWis
    ).sort((a, b) => a.operationSeq - b.operationSeq)
    const ecos = s.ecos
      .filter((e) => e.productId === product.id)
      .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt))
    return {
      revision,
      revisions,
      bom,
      bor,
      bop,
      specs,
      wis,
      ecos,
      openMos: openMosFor(s.manufacturingOrders, product.id),
      onHand: productOnHand(s.state, product.id, s.siteId),
    }
  }, [s, product])

  if (!product || !d) {
    return (
      <Card>
        <EmptyState
          title="Product not found"
          description="It may have been removed or renamed."
          action={<BackButton fallback="/plm/products" />}
        />
      </Card>
    )
  }

  const { revision, revisions, bom, bor, bop, specs, wis, ecos } = d
  const manage = can('plm.manage')
  const characteristics = specs.reduce((n, x) => n + x.characteristics.length, 0)
  const counts: Record<ProductTab, number | undefined> = {
    overview: undefined,
    bom: bom?.items.length ?? 0,
    bor: bor?.items.length ?? 0,
    bop: bop?.operations.length ?? 0,
    spec: characteristics,
    wi: wis.length,
    eco: ecos.filter((e) => e.status !== 'released' && e.status !== 'rejected').length,
  }

  return (
    <div className="space-y-4">
      <div className="gap-2 flex flex-wrap items-center justify-between">
        <BackButton fallback="/plm/products" />
        <div className="gap-2 flex flex-wrap items-center">
          {manage && (
            <Button variant="outline" onClick={() => setEditing(true)}>
              <Pencil />
              Edit product
            </Button>
          )}
          {manage && (
            <Button asChild>
              <Link to={`/plm/eco?new=1&product=${product.id}`}>
                <Plus />
                New ECO
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card variant="ink" className="p-5 relative overflow-hidden">
        <div className="gap-3 flex flex-wrap items-start justify-between">
          <div className="min-w-0">
            <p className="text-xs font-mono text-on-ink-muted">{product.code}</p>
            <h1 className="mt-1 text-2xl font-bold tracking-tight">{product.name}</h1>
            <p className="text-sm text-on-ink-muted">
              {fmtNumber(product.unitWeightG, 1)} g · {STRATEGY_LABEL[product.defaultStrategy]} ·{' '}
              {s.maps.category.get(product.categoryId)?.name ?? 'Uncategorised'}
            </p>
          </div>
          <div className="gap-2 flex flex-wrap items-center">
            {revision ? (
              <>
                <span className="text-sm font-semibold font-mono">{revision.rev}</span>
                <RevisionBadge state={revision.state} />
              </>
            ) : (
              <Badge variant="outline">No revision</Badge>
            )}
            <StrategyBadge strategy={product.defaultStrategy} />
          </div>
        </div>
        <div className="mt-5 gap-4 grid grid-cols-3">
          <Metric label="Open MOs" value={fmtNumber(d.openMos.length)} />
          <Metric
            label="On hand"
            value={fmtNumber(d.onHand.qty)}
            unit={`${s.uomCode(product.uomId)} · ${fmtNumber(d.onHand.free)} free`}
          />
          <Metric
            label="Revisions"
            value={fmtNumber(revisions.length)}
            unit={`${revisions.filter((r) => r.state === 'released').length} released`}
          />
        </div>
      </Card>

      <UnderlineTabs
        value={tab}
        onValueChange={setTab}
        items={[
          { value: 'overview', label: 'Overview' },
          { value: 'bom', label: 'BOM', count: counts.bom },
          { value: 'bor', label: 'BOR', count: counts.bor },
          { value: 'bop', label: 'BOP', count: counts.bop },
          { value: 'spec', label: 'Specifications', count: counts.spec },
          { value: 'wi', label: 'Work instructions', count: counts.wi },
          { value: 'eco', label: 'ECO', count: counts.eco },
        ]}
      />

      {tab === 'overview' && (
        <Overview product={product} revision={revision} revisions={revisions} counts={counts} />
      )}
      {tab === 'bom' && (
        <DocCard
          title="Bill of materials"
          doc={bom}
          path={bom ? paths.bom(bom.id) : undefined}
          kind="BOM"
          description="What material goes into one unit and at which operation it is consumed."
        >
          {bom && <BomTable bom={bom} />}
        </DocCard>
      )}
      {tab === 'bor' && (
        <DocCard
          title="Bill of resources"
          doc={bor}
          path={bor ? paths.bor(bor.id) : undefined}
          kind="BOR"
          description="Work centers, machines, tooling and skills each operation needs."
        >
          {bor && <BorTable bor={bor} />}
        </DocCard>
      )}
      {tab === 'bop' && (
        <DocCard
          title="Bill of process"
          doc={bop}
          path={bop ? paths.bop(bop.id) : undefined}
          kind="BOP"
          description="The routing: ordered operations with their times, dependencies and quality gates."
        >
          {bop && <BopTable bop={bop} />}
        </DocCard>
      )}
      {tab === 'spec' && <SpecsTab specs={specs} />}
      {tab === 'wi' && <InstructionsTab wis={wis} />}
      {tab === 'eco' && <EcoTab ecos={ecos} productId={product.id} canManage={manage} />}

      <ProductDialog open={editing} onOpenChange={setEditing} editing={product} />
    </div>
  )
}

function Metric({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div>
      <p className="font-semibold tracking-wider text-[11px] text-on-ink-muted uppercase">{label}</p>
      <p className="mt-1 gap-1.5 flex flex-wrap items-end leading-none">
        <span className="text-3xl font-bold tracking-tight tabular-nums">{value}</span>
        {unit && <span className="pb-0.5 text-xs font-semibold text-on-ink-muted">{unit}</span>}
      </p>
    </div>
  )
}

function DocCard({
  title,
  description,
  doc,
  path,
  kind,
  children,
}: {
  title: string
  description: string
  doc: { code: string; rev: string; state: ProductRevision['state'] } | undefined
  path: string | undefined
  kind: string
  children: ReactNode
}) {
  return (
    <Card>
      <CardHeader
        action={
          doc && path ? (
            <div className="gap-2 flex flex-wrap items-center">
              {doc.state === 'released' ? <LockBadge /> : <RevisionBadge state={doc.state} />}
              <Button asChild variant="outline" size="sm">
                <Link to={path}>
                  <span className="font-mono">
                    {doc.code} · {doc.rev}
                  </span>
                  <ArrowUpRight />
                </Link>
              </Button>
            </div>
          ) : undefined
        }
      >
        <CardTitle>{title}</CardTitle>
        <p className="text-sm text-muted">{description}</p>
      </CardHeader>
      <CardContent>
        {doc ? (
          children
        ) : (
          <EmptyState
            compact
            title={`No ${kind} on the current revision`}
            description={`Raise an ECO to attach a ${kind} before the product can be planned.`}
          />
        )}
        {doc && (
          <p className="mt-3 text-xs text-muted">
            {doc.state === 'released'
              ? `Released data is read only. Open the ${kind} to copy it as a new draft, or raise an ECO.`
              : `Open the ${kind} to add, edit or remove lines.`}
          </p>
        )}
      </CardContent>
    </Card>
  )
}

function Overview({
  product,
  revision,
  revisions,
  counts,
}: {
  product: Product
  revision: ProductRevision | undefined
  revisions: ProductRevision[]
  counts: Record<ProductTab, number | undefined>
}) {
  const s = useScoped()
  const questions: { tab: ProductTab; question: string; answer: string; count: number; icon: ReactNode }[] = [
    { tab: 'bom', question: 'What material?', answer: 'BOM items', count: counts.bom ?? 0, icon: <Boxes /> },
    {
      tab: 'bor',
      question: 'What resource?',
      answer: 'BOR operations',
      count: counts.bor ?? 0,
      icon: <Wrench />,
    },
    {
      tab: 'bop',
      question: 'What process?',
      answer: 'BOP operations',
      count: counts.bop ?? 0,
      icon: <ClipboardList />,
    },
    {
      tab: 'spec',
      question: 'What specification?',
      answer: 'characteristics',
      count: counts.spec ?? 0,
      icon: <Ruler />,
    },
    {
      tab: 'wi',
      question: 'What instruction?',
      answer: 'work instructions',
      count: counts.wi ?? 0,
      icon: <FileText />,
    },
  ]
  const answered = questions.filter((q) => q.count > 0).length

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="gap-2 flex flex-wrap items-start justify-between">
          <div>
            <h2 className="font-semibold">Answer the PLM questions</h2>
            <p className="text-xs text-muted">
              A product is ready for production when all five have an answer on the released revision.
            </p>
          </div>
          <Badge variant={answered === questions.length ? 'success' : 'warning'}>
            {answered} of {questions.length} answered
          </Badge>
        </div>
        <div className="mt-4 gap-2 sm:grid-cols-2 xl:grid-cols-5 grid grid-cols-1">
          {questions.map((q) => (
            <Link
              key={q.tab}
              to={productTabPath(product.id, q.tab)}
              className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
            >
              <span
                className={`size-9 rounded-xl [&_svg]:size-4 flex shrink-0 items-center justify-center ${q.count ? 'bg-success-soft text-success' : 'bg-warning-soft text-warning'}`}
              >
                {q.icon}
              </span>
              <span className="min-w-0">
                <span className="text-sm font-semibold block">{q.question}</span>
                <span className="text-xs block truncate text-muted">
                  {q.count} {q.answer}
                </span>
              </span>
            </Link>
          ))}
        </div>
      </Card>

      <div className="gap-4 lg:grid-cols-2 grid grid-cols-1">
        <Card>
          <CardHeader>
            <CardTitle>Product</CardTitle>
          </CardHeader>
          <CardContent>
            <KeyValue
              bare
              items={[
                { label: 'Code', value: <span className="text-xs font-mono">{product.code}</span> },
                {
                  label: 'Category',
                  value: s.maps.category.get(product.categoryId)?.name ?? 'Uncategorised',
                },
                {
                  label: 'Unit',
                  value: `${s.maps.uom.get(product.uomId)?.name ?? ''} (${s.uomCode(product.uomId)})`,
                },
                { label: 'Unit weight', value: `${fmtNumber(product.unitWeightG, 1)} g` },
                { label: 'Strategy', value: STRATEGY_LABEL[product.defaultStrategy] },
                {
                  label: 'Control',
                  value:
                    [product.lotControlled ? 'Lot' : null, product.serialControlled ? 'Serial' : null]
                      .filter(Boolean)
                      .join(' and ') || 'None',
                },
                { label: 'Standard cost', value: fmtIdr(product.standardCostIdr) },
                {
                  label: 'Current revision',
                  value: revision ? (
                    <span className="gap-2 inline-flex items-center">
                      <span className="text-xs font-mono">{revision.rev}</span>
                      <RevisionBadge state={revision.state} />
                    </span>
                  ) : (
                    'None'
                  ),
                },
                {
                  label: 'Effective',
                  value: revision?.effectiveFrom
                    ? `${fmtDate(revision.effectiveFrom)} → ${revision.effectiveUntil ? fmtDate(revision.effectiveUntil) : 'open'}`
                    : 'Not effective yet',
                  hidden: !revision,
                },
              ]}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader
            action={
              <Button asChild variant="ghost" size="sm">
                <Link to="/plm/revisions">All revisions</Link>
              </Button>
            }
          >
            <CardTitle>Revision timeline</CardTitle>
          </CardHeader>
          <CardContent>
            {revisions.length === 0 ? (
              <EmptyState
                compact
                title="No revisions"
                description="The first revision is created with the product's BOM, BOR and BOP."
              />
            ) : (
              <ol className="space-y-3 pl-5 relative border-l border-border">
                {[...revisions].reverse().map((r) => (
                  <li key={r.id} className="relative">
                    <span
                      className={`top-1.5 size-3 absolute -left-[26px] rounded-full ring-4 ring-card ${r.state === 'released' ? 'bg-success' : r.state === 'obsolete' ? 'bg-border' : 'bg-warning'}`}
                    />
                    <div className="gap-2 flex flex-wrap items-center">
                      <span className="text-sm font-semibold font-mono">{r.rev}</span>
                      <RevisionBadge state={r.state} />
                      {r.id === revision?.id && <Badge variant="ink">Current</Badge>}
                    </div>
                    <p className="mt-0.5 text-xs text-muted">
                      {r.effectiveFrom
                        ? `Effective ${fmtDate(r.effectiveFrom)} → ${r.effectiveUntil ? fmtDate(r.effectiveUntil) : 'open'}`
                        : `Created ${fmtDate(r.createdAt)}`}
                    </p>
                    {r.releasedBy && (
                      <p className="mt-1 text-xs">
                        <PersonChip
                          personId={r.releasedBy}
                          hint={r.releasedAt ? fmtDateTime(r.releasedAt) : undefined}
                        />
                      </p>
                    )}
                    {r.changeReason && <p className="mt-1 text-xs text-muted">{r.changeReason}</p>}
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function SpecsTab({ specs }: { specs: Specification[] }) {
  const groups = [...groupBy(specs, (x) => x.kind)]
  if (!specs.length) {
    return (
      <Card>
        <EmptyState
          title="No specifications"
          description="Product, process and quality characteristics attach to a revision through an ECO."
        />
      </Card>
    )
  }
  return (
    <div className="space-y-4">
      {groups.map(([kind, list]) => (
        <Card key={kind}>
          <CardHeader>
            <CardTitle>{SPEC_KIND_LABEL[kind]}</CardTitle>
            <p className="text-sm text-muted">
              {list.length === 1 ? 'One specification' : `${list.length} specifications`} on this revision.
            </p>
          </CardHeader>
          <CardContent className="space-y-4">
            {list.map((spec) => (
              <div key={spec.id}>
                <p className="mb-2 gap-2 text-xs flex flex-wrap items-center">
                  <Link
                    to={paths.specification(spec.id)}
                    className="font-semibold font-mono hover:text-accent"
                  >
                    {spec.code} · {spec.rev}
                  </Link>
                  {spec.state === 'released' ? <LockBadge /> : <RevisionBadge state={spec.state} />}
                  <Button asChild variant="ghost" size="sm" className="ml-auto">
                    <Link to={paths.specification(spec.id)}>
                      Open
                      <ArrowUpRight />
                    </Link>
                  </Button>
                </p>
                <CharacteristicsTable spec={spec} />
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function InstructionsTab({ wis }: { wis: WorkInstruction[] }) {
  if (!wis.length) {
    return (
      <Card>
        <EmptyState
          title="No work instructions"
          description="Instructions attach to operations and show at the station when the work order starts."
        />
      </Card>
    )
  }
  return (
    <div className="space-y-4">
      {wis.map((wi) => (
        <Card key={wi.id}>
          <CardHeader
            action={
              <div className="gap-2 flex flex-wrap items-center">
                {wi.state === 'released' ? <LockBadge /> : <RevisionBadge state={wi.state} />}
                <Button asChild variant="outline" size="sm">
                  <Link to={paths.workInstruction(wi.id)}>
                    Open
                    <ArrowUpRight />
                  </Link>
                </Button>
              </div>
            }
          >
            <CardTitle>
              <Link to={paths.workInstruction(wi.id)} className="hover:text-accent">
                Op {wi.operationSeq} · {wi.title}
              </Link>
            </CardTitle>
            <p className="gap-2 text-sm flex flex-wrap items-center text-muted">
              <span className="text-xs font-mono">
                {wi.code} · {wi.rev}
              </span>
              <StepKindTrail steps={wi.steps} />
            </p>
          </CardHeader>
          <CardContent>
            <InstructionSteps wi={wi} defaultOpen={false} />
          </CardContent>
        </Card>
      ))}
    </div>
  )
}

function EcoTab({ ecos, productId, canManage }: { ecos: Eco[]; productId: string; canManage: boolean }) {
  const s = useScoped()
  return (
    <Card>
      <CardHeader
        action={
          canManage ? (
            <Button asChild variant="outline" size="sm">
              <Link to={`/plm/eco?new=1&product=${productId}`}>
                <Plus />
                New ECO
              </Link>
            </Button>
          ) : undefined
        }
      >
        <CardTitle>Engineering change orders</CardTitle>
        <p className="text-sm text-muted">
          Every change to released data starts here and ends in a new revision.
        </p>
      </CardHeader>
      <CardContent className="space-y-2">
        {ecos.length === 0 ? (
          <EmptyState
            compact
            icon={<FileDiff />}
            title="No change orders"
            description="Raise an ECO to change the BOM, BOR, BOP, specifications or instructions."
          />
        ) : (
          ecos.map((eco) => (
            <Link
              key={eco.id}
              to={paths.eco(eco.id)}
              className="gap-3 rounded-2xl p-3 flex items-center bg-surface-2 transition-colors hover:bg-surface"
            >
              <span className="min-w-0 flex-1">
                <span className="text-sm font-semibold block truncate">{eco.title}</span>
                <span className="text-xs block truncate text-muted">
                  {eco.code} · from {s.maps.revision.get(eco.fromRevisionId)?.rev ?? '?'} ·{' '}
                  {s.personName(eco.requestedBy)} · {fmtDate(eco.requestedAt)}
                </span>
              </span>
              <EcoStatusBadge status={eco.status} />
            </Link>
          ))
        )}
      </CardContent>
    </Card>
  )
}
