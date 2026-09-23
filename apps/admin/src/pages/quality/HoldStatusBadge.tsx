import type { HoldStatus } from '@mes/types'
import { Badge } from '@mes/ui'

export function HoldStatusBadge({ status }: { status: HoldStatus }) {
  return status === 'active' ? (
    <Badge variant="danger" dot>
      Active
    </Badge>
  ) : (
    <Badge variant="muted">Released</Badge>
  )
}
