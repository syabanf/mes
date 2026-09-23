import { useScoped } from '../../state/scoped'
import { DocListPage } from './DocListPage'

export function BorPage() {
  const { bors } = useScoped()
  return (
    <DocListPage
      title="Bills of resources"
      description="Work centers, machines, tooling and skills each operation needs, with standard times."
      kind="bor"
      docs={bors}
      countOf={(b) => b.items.length}
      countLabel="Operations"
    />
  )
}
