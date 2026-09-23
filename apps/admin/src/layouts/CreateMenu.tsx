import { ActionMenu, type ActionMenuItem } from '@mes/ui'
import { ClipboardList, GitCompareArrows, Microscope, PackagePlus, ShoppingCart } from 'lucide-react'
import type { ReactElement } from 'react'
import { useNavigate } from 'react-router'
import { useAuth } from '../auth/auth'
import { useCreate } from '../components/create'

/** The one create menu behind the rail button, the header button and the phone bar. */
export function CreateMenu({
  trigger,
  side,
  align,
}: {
  trigger: ReactElement
  side?: 'top' | 'right' | 'bottom' | 'left'
  align?: 'start' | 'center' | 'end'
}) {
  const create = useCreate()
  const navigate = useNavigate()
  const { can } = useAuth()
  const options: (ActionMenuItem | false)[] = [
    can('order.manage') && {
      key: 'mkt',
      label: 'Marketing order',
      description: 'Customer demand with MTO or MTS lines',
      icon: <ShoppingCart />,
      onSelect: () => create.marketingOrder(),
    },
    can('mo.manage') && {
      key: 'mo',
      label: 'Manufacturing order',
      description: 'Plan production for a product',
      icon: <ClipboardList />,
      onSelect: () => create.manufacturingOrder(),
    },
    can('inventory.manage') && {
      key: 'lot',
      label: 'Material lot receipt',
      description: 'Book a lot into the warehouse',
      icon: <PackagePlus />,
      onSelect: () => navigate('/inventory/floor-stock?receive=1'),
    },
    can('quality.execute') && {
      key: 'ins',
      label: 'Inspection',
      description: 'Request a quality check',
      icon: <Microscope />,
      onSelect: () => navigate('/quality/inspections?new=1'),
    },
    can('plm.manage') && {
      key: 'eco',
      label: 'Engineering change',
      description: 'Propose a new revision',
      icon: <GitCompareArrows />,
      onSelect: () => navigate('/plm/eco?new=1'),
    },
  ]
  const items = options.filter((x): x is ActionMenuItem => !!x)
  if (!items.length) return null
  return <ActionMenu trigger={trigger} items={items} title="Create" side={side} align={align} />
}
