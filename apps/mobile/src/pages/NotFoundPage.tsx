import { Button, Card, EmptyState } from '@mes/ui'
import { Link } from 'react-router'
import { paths } from '../lib/paths'

export function NotFoundPage() {
  return (
    <Card className="mt-6">
      <EmptyState
        title="Nothing here"
        description="The link points at a screen this app does not have."
        action={
          <Button asChild variant="outline" className="h-11">
            <Link to={paths.home}>Go home</Link>
          </Button>
        }
      />
    </Card>
  )
}
