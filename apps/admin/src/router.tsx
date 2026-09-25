import type { ComponentType } from 'react'
import { Navigate, createBrowserRouter } from 'react-router'
import { RequireAuth } from './auth/auth'
import { AdminLayout } from './layouts/AdminLayout'
import { LoginPage } from './pages/auth/LoginPage'

/** Loads a page module on first visit, so every feature ships as its own chunk. */
const page =
  <K extends string, M extends Record<K, ComponentType>>(load: () => Promise<M>, name: K) =>
  async () => ({ Component: (await load())[name] })

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <AdminLayout />
      </RequireAuth>
    ),
    HydrateFallback: () => <div className="h-dvh bg-surface" />,
    children: [
      { index: true, lazy: page(() => import('./pages/dashboard/DashboardPage'), 'DashboardPage') },

      { path: 'demand', element: <Navigate to="/demand/orders" replace /> },
      {
        path: 'demand/orders',
        lazy: page(() => import('./pages/demand/MarketingOrdersPage'), 'MarketingOrdersPage'),
      },
      {
        path: 'demand/orders/:id',
        lazy: page(() => import('./pages/demand/MarketingOrderDetailPage'), 'MarketingOrderDetailPage'),
      },
      { path: 'demand/demands', lazy: page(() => import('./pages/demand/DemandPage'), 'DemandPage') },
      {
        path: 'demand/demands/:id',
        lazy: page(() => import('./pages/demand/DemandDetailPage'), 'DemandDetailPage'),
      },
      {
        path: 'demand/fulfillment',
        lazy: page(() => import('./pages/demand/FulfillmentPage'), 'FulfillmentPage'),
      },
      {
        path: 'demand/replenishment',
        lazy: page(() => import('./pages/demand/ReplenishmentPage'), 'ReplenishmentPage'),
      },
      {
        path: 'demand/replenishment/:id',
        lazy: page(() => import('./pages/demand/ReplenishmentDetailPage'), 'ReplenishmentDetailPage'),
      },

      { path: 'plm', element: <Navigate to="/plm/products" replace /> },
      { path: 'plm/products', lazy: page(() => import('./pages/plm/ProductsPage'), 'ProductsPage') },
      {
        path: 'plm/products/:id',
        lazy: page(() => import('./pages/plm/ProductDetailPage'), 'ProductDetailPage'),
      },
      { path: 'plm/bom', lazy: page(() => import('./pages/plm/BomPage'), 'BomPage') },
      { path: 'plm/bom/:id', lazy: page(() => import('./pages/plm/BomDetailPage'), 'BomDetailPage') },
      { path: 'plm/bor', lazy: page(() => import('./pages/plm/BorPage'), 'BorPage') },
      { path: 'plm/bor/:id', lazy: page(() => import('./pages/plm/BorDetailPage'), 'BorDetailPage') },
      { path: 'plm/bop', lazy: page(() => import('./pages/plm/BopPage'), 'BopPage') },
      { path: 'plm/bop/:id', lazy: page(() => import('./pages/plm/BopDetailPage'), 'BopDetailPage') },
      {
        path: 'plm/specifications',
        lazy: page(() => import('./pages/plm/SpecificationsPage'), 'SpecificationsPage'),
      },
      {
        path: 'plm/specifications/:id',
        lazy: page(() => import('./pages/plm/SpecificationDetailPage'), 'SpecificationDetailPage'),
      },
      {
        path: 'plm/work-instructions',
        lazy: page(() => import('./pages/plm/WorkInstructionsPage'), 'WorkInstructionsPage'),
      },
      {
        path: 'plm/work-instructions/:id',
        lazy: page(() => import('./pages/plm/WorkInstructionDetailPage'), 'WorkInstructionDetailPage'),
      },
      { path: 'plm/eco', lazy: page(() => import('./pages/plm/EcoPage'), 'EcoPage') },
      { path: 'plm/eco/:id', lazy: page(() => import('./pages/plm/EcoDetailPage'), 'EcoDetailPage') },
      { path: 'plm/revisions', lazy: page(() => import('./pages/plm/RevisionsPage'), 'RevisionsPage') },

      { path: 'manufacturing', element: <Navigate to="/manufacturing/orders" replace /> },
      {
        path: 'manufacturing/orders',
        lazy: page(() => import('./pages/manufacturing/ManufacturingOrdersPage'), 'ManufacturingOrdersPage'),
      },
      {
        path: 'manufacturing/orders/:id',
        lazy: page(
          () => import('./pages/manufacturing/ManufacturingOrderDetailPage'),
          'ManufacturingOrderDetailPage',
        ),
      },
      {
        path: 'manufacturing/work-orders',
        lazy: page(() => import('./pages/manufacturing/WorkOrdersPage'), 'WorkOrdersPage'),
      },
      {
        path: 'manufacturing/work-orders/:id',
        lazy: page(() => import('./pages/manufacturing/WorkOrderDetailPage'), 'WorkOrderDetailPage'),
      },
      {
        path: 'manufacturing/dispatch',
        lazy: page(() => import('./pages/manufacturing/DispatchPage'), 'DispatchPage'),
      },
      {
        path: 'manufacturing/control',
        lazy: page(() => import('./pages/manufacturing/ProductionControlPage'), 'ProductionControlPage'),
      },

      { path: 'shopfloor', element: <Navigate to="/shopfloor/station" replace /> },
      {
        path: 'shopfloor/station',
        lazy: page(() => import('./pages/shopfloor/OperatorStationPage'), 'OperatorStationPage'),
      },
      {
        path: 'shopfloor/execution',
        lazy: page(() => import('./pages/shopfloor/ProductionExecutionPage'), 'ProductionExecutionPage'),
      },
      {
        path: 'shopfloor/instructions',
        lazy: page(() => import('./pages/shopfloor/ShopfloorInstructionsPage'), 'ShopfloorInstructionsPage'),
      },

      { path: 'inventory', element: <Navigate to="/inventory/requirements" replace /> },
      {
        path: 'inventory/requirements',
        lazy: page(() => import('./pages/inventory/MaterialRequirementPage'), 'MaterialRequirementPage'),
      },
      {
        path: 'inventory/requirements/:id',
        lazy: page(
          () => import('./pages/inventory/MaterialRequirementDetailPage'),
          'MaterialRequirementDetailPage',
        ),
      },
      {
        path: 'inventory/reservations',
        lazy: page(() => import('./pages/inventory/ReservationPage'), 'ReservationPage'),
      },
      {
        path: 'inventory/floor-stock',
        lazy: page(() => import('./pages/inventory/FloorStockPage'), 'FloorStockPage'),
      },
      {
        path: 'inventory/floor-stock/:id',
        lazy: page(() => import('./pages/inventory/LotDetailPage'), 'LotDetailPage'),
      },
      {
        path: 'inventory/issue',
        lazy: page(() => import('./pages/inventory/MaterialIssuePage'), 'MaterialIssuePage'),
      },
      {
        path: 'inventory/consumption',
        lazy: page(() => import('./pages/inventory/ConsumptionPage'), 'ConsumptionPage'),
      },
      { path: 'inventory/wip', lazy: page(() => import('./pages/inventory/WipPage'), 'WipPage') },
      {
        path: 'inventory/wip/:id',
        lazy: page(() => import('./pages/inventory/WipDetailPage'), 'WipDetailPage'),
      },
      { path: 'inventory/scrap', lazy: page(() => import('./pages/inventory/ScrapPage'), 'ScrapPage') },
      { path: 'inventory/rework', lazy: page(() => import('./pages/inventory/ReworkPage'), 'ReworkPage') },
      {
        path: 'inventory/rework/:id',
        lazy: page(() => import('./pages/inventory/ReworkDetailPage'), 'ReworkDetailPage'),
      },
      { path: 'inventory/returns', lazy: page(() => import('./pages/inventory/ReturnPage'), 'ReturnPage') },
      {
        path: 'inventory/finished-goods',
        lazy: page(() => import('./pages/inventory/FinishedGoodsPage'), 'FinishedGoodsPage'),
      },

      { path: 'quality', element: <Navigate to="/quality/inspections" replace /> },
      {
        path: 'quality/inspections',
        lazy: page(() => import('./pages/quality/InspectionsPage'), 'InspectionsPage'),
      },
      {
        path: 'quality/inspections/:id',
        lazy: page(() => import('./pages/quality/InspectionDetailPage'), 'InspectionDetailPage'),
      },
      {
        path: 'quality/checks',
        lazy: page(() => import('./pages/quality/QualityChecksPage'), 'QualityChecksPage'),
      },
      { path: 'quality/defects', lazy: page(() => import('./pages/quality/DefectsPage'), 'DefectsPage') },
      { path: 'quality/holds', lazy: page(() => import('./pages/quality/HoldsPage'), 'HoldsPage') },
      {
        path: 'quality/holds/:id',
        lazy: page(() => import('./pages/quality/HoldDetailPage'), 'HoldDetailPage'),
      },
      { path: 'quality/ncr/:id', lazy: page(() => import('./pages/quality/NcrDetailPage'), 'NcrDetailPage') },
      { path: 'quality/release', lazy: page(() => import('./pages/quality/ReleasePage'), 'ReleasePage') },

      { path: 'traceability', element: <Navigate to="/traceability/lots" replace /> },
      {
        path: 'traceability/lots',
        lazy: page(() => import('./pages/traceability/LotTracePage'), 'LotTracePage'),
      },
      {
        path: 'traceability/serials',
        lazy: page(() => import('./pages/traceability/SerialTracePage'), 'SerialTracePage'),
      },
      {
        path: 'traceability/genealogy',
        lazy: page(() => import('./pages/traceability/GenealogyPage'), 'GenealogyPage'),
      },
      {
        path: 'traceability/history',
        lazy: page(() => import('./pages/traceability/ProductionHistoryPage'), 'ProductionHistoryPage'),
      },

      { path: 'planning', element: <Navigate to="/planning/capacity" replace /> },
      {
        path: 'planning/capacity',
        lazy: page(() => import('./pages/planning/CapacityPage'), 'CapacityPage'),
      },
      {
        path: 'planning/capacity/:workCenterId',
        lazy: page(() => import('./pages/planning/CapacityDetailPage'), 'CapacityDetailPage'),
      },
      {
        path: 'planning/schedule',
        lazy: page(() => import('./pages/planning/SchedulePage'), 'SchedulePage'),
      },
      {
        path: 'planning/schedule/:woId',
        lazy: page(() => import('./pages/planning/ScheduleDetailPage'), 'ScheduleDetailPage'),
      },
      {
        path: 'planning/resource-load',
        lazy: page(() => import('./pages/planning/ResourceLoadPage'), 'ResourceLoadPage'),
      },

      { path: 'analytics', element: <Navigate to="/analytics/production" replace /> },
      { path: 'analytics/production', lazy: page(() => import('./pages/analytics/ProductionAnalyticsPage'), 'ProductionAnalyticsPage') },
      { path: 'analytics/intelligence', lazy: page(() => import('./pages/analytics/IntelligencePage'), 'IntelligencePage') },
      { path: 'analytics/optimization', lazy: page(() => import('./pages/analytics/OptimizationPage'), 'OptimizationPage') },

      { path: 'master-data', element: <Navigate to="/master-data/organization" replace /> },
      {
        path: 'master-data/:domain',
        lazy: page(() => import('./pages/master-data/MasterDataPage'), 'MasterDataPage'),
      },

      { path: 'integration', element: <Navigate to="/integration/device-monitoring" replace /> },
      {
        path: 'integration/device-monitoring',
        lazy: page(() => import('./pages/integration/DeviceMonitoringPage'), 'DeviceMonitoringPage'),
      },
      { path: 'integration/oee', lazy: page(() => import('./pages/integration/OeePage'), 'OeePage') },
      { path: 'integration/cmms', lazy: page(() => import('./pages/integration/CmmsPage'), 'CmmsPage') },
      {
        path: 'integration/external',
        lazy: page(() => import('./pages/integration/ExternalSystemsPage'), 'ExternalSystemsPage'),
      },

      { path: '*', lazy: page(() => import('./pages/NotFoundPage'), 'NotFoundPage') },
    ],
  },
])
