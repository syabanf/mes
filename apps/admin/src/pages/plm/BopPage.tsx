import { useScoped } from '../../state/scoped'
import { DocListPage } from './DocListPage'
import { OpTrail } from './tables'

export function BopPage() {
  const { bops } = useScoped()
  return (
    <DocListPage
      title="Bills of process"
      description="Routings: the ordered operations, times and quality gates a work order follows."
      kind="bop"
      docs={bops}
      countOf={(b) => b.operations.length}
      countLabel="Operations"
      extra={{ id: 'trail', header: 'Sequence', hideBelow: 'md', cell: (b) => <OpTrail bop={b} /> }}
    />
  )
}
