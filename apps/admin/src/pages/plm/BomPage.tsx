import { useScoped } from '../../state/scoped'
import { DocListPage } from './DocListPage'

export function BomPage() {
  const { boms } = useScoped()
  return (
    <DocListPage
      title="Bills of materials"
      description="What material each product revision consumes, per unit and per operation."
      kind="bom"
      docs={boms}
      countOf={(b) => b.items.length}
      countLabel="Items"
    />
  )
}
