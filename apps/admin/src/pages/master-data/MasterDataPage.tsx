import { Card, EmptyState, PageHeader, PillTabs } from '@mes/ui'
import { useNavigate, useParams } from 'react-router'
import { CommercialPanel } from './CommercialPanel'
import { EngineeringPanel } from './EngineeringPanel'
import { InventoryPanel } from './InventoryPanel'
import { DOMAINS, isDomain } from './lib'
import { OrganizationPanel } from './OrganizationPanel'
import { PeoplePanel } from './PeoplePanel'
import { PlanningPanel } from './PlanningPanel'
import { ProductMaterialPanel } from './ProductMaterialPanel'
import { QualityPanel } from './QualityPanel'
import { ResourcesPanel } from './ResourcesPanel'
import { SystemPanel } from './SystemPanel'

const PANELS = {
  organization: OrganizationPanel,
  commercial: CommercialPanel,
  'product-material': ProductMaterialPanel,
  engineering: EngineeringPanel,
  resources: ResourcesPanel,
  people: PeoplePanel,
  planning: PlanningPanel,
  inventory: InventoryPanel,
  quality: QualityPanel,
  system: SystemPanel,
} as const

export function MasterDataPage() {
  const { domain } = useParams()
  const navigate = useNavigate()
  const current = isDomain(domain) ? DOMAINS.find((d) => d.key === domain)! : null
  const Panel = current ? PANELS[current.key] : null

  return (
    <>
      <PageHeader
        title="Master data"
        description={
          current?.description ??
          'One consistent source for every manufacturing definition the other modules rely on.'
        }
      />
      <div className="space-y-4">
        <PillTabs
          value={current?.key ?? ''}
          onValueChange={(v) => navigate(`/master-data/${v}`)}
          items={DOMAINS.map((d) => ({ value: d.key, label: d.label }))}
        />
        {Panel ? (
          <Panel key={current!.key} />
        ) : (
          <Card>
            <EmptyState title="Unknown domain" description="Pick one of the master data domains above." />
          </Card>
        )}
      </div>
    </>
  )
}
