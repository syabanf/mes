import type { Product } from '@mes/types'
import { Banner, Button, type Column } from '@mes/ui'
import { Link } from 'react-router'
import { RevisionBadge } from '../../components/badges'
import { ProductLink } from '../../components/links'
import { useScoped } from '../../state/scoped'
import { EntityTable, Muted } from './entity'

const LINKS = [
  { to: '/plm/bom', label: 'BOM' },
  { to: '/plm/bor', label: 'BOR' },
  { to: '/plm/bop', label: 'BOP' },
  { to: '/plm/specifications', label: 'Specifications' },
  { to: '/plm/work-instructions', label: 'Work instructions' },
]

export function EngineeringPanel() {
  const s = useScoped()
  const count = (n: number) => (n ? <span className="tabular-nums">{n}</span> : <Muted>0</Muted>)
  const columns: Column<Product>[] = [
    {
      id: 'product',
      header: 'Product',
      sortValue: (p) => p.name,
      cell: (p) => <ProductLink productId={p.id} />,
    },
    {
      id: 'rev',
      header: 'Current revision',
      hideBelow: 'sm',
      cell: (p) => {
        const rev = p.currentRevisionId ? s.maps.revision.get(p.currentRevisionId) : undefined
        return rev ? (
          <span className="gap-2 inline-flex items-center">
            <span className="text-xs font-mono">{rev.rev}</span>
            <RevisionBadge state={rev.state} />
          </span>
        ) : (
          <Muted>None</Muted>
        )
      },
    },
    {
      id: 'bom',
      header: 'BOM',
      align: 'right',
      cell: (p) => count(s.boms.filter((b) => b.productId === p.id).length),
    },
    {
      id: 'bor',
      header: 'BOR',
      align: 'right',
      cell: (p) => count(s.bors.filter((b) => b.productId === p.id).length),
    },
    {
      id: 'bop',
      header: 'BOP',
      align: 'right',
      cell: (p) => count(s.bops.filter((b) => b.productId === p.id).length),
    },
    {
      id: 'spec',
      header: 'Specs',
      align: 'right',
      hideBelow: 'md',
      cell: (p) => count(s.specifications.filter((x) => x.productId === p.id).length),
    },
    {
      id: 'wi',
      header: 'Instructions',
      align: 'right',
      hideBelow: 'md',
      cell: (p) => count(s.workInstructions.filter((x) => x.productId === p.id).length),
    },
    {
      id: 'eco',
      header: 'ECOs',
      align: 'right',
      hideBelow: 'lg',
      cell: (p) => count(s.ecos.filter((x) => x.productId === p.id).length),
    },
  ]
  return (
    <div className="space-y-4">
      <Banner
        tone="neutral"
        title="PLM owns the engineering definition"
        action={
          <span className="gap-1 flex flex-wrap">
            {LINKS.map((l) => (
              <Button key={l.to} asChild variant="outline" size="sm">
                <Link to={l.to}>{l.label}</Link>
              </Button>
            ))}
          </span>
        }
      >
        This view counts what each product carries. Edit BOM, BOR, BOP, specifications and work instructions
        in PLM so revisions and ECOs stay governed.
      </Banner>
      <EntityTable
        title="Engineering data per product"
        rows={s.products}
        columns={columns}
        search={(p) => `${p.code} ${p.name}`}
        canManage={false}
        empty="No products yet."
      />
    </div>
  )
}
