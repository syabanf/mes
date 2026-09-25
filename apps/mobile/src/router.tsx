import { createBrowserRouter } from 'react-router'
import { RequireAuth } from './auth/auth'
import { MobileLayout } from './layouts/MobileLayout'
import { AlertsPage } from './pages/alerts/AlertsPage'
import { LoginPage } from './pages/auth/LoginPage'
import { HomePage } from './pages/home/HomePage'
import { InstructionsPage } from './pages/instructions/InstructionsPage'
import { MorePage } from './pages/more/MorePage'
import { NotFoundPage } from './pages/NotFoundPage'
import { InspectionPage } from './pages/quality/InspectionPage'
import { QualityPage } from './pages/quality/QualityPage'
import { WorkListPage } from './pages/work/WorkListPage'
import { WorkOrderPage } from './pages/work/WorkOrderPage'
import { MobileScopeProvider } from './state/scope'

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  {
    path: '/',
    element: (
      <RequireAuth>
        <MobileScopeProvider>
          <MobileLayout />
        </MobileScopeProvider>
      </RequireAuth>
    ),
    children: [
      { index: true, element: <HomePage /> },
      { path: 'work', element: <WorkListPage /> },
      { path: 'wo/:id', element: <WorkOrderPage /> },
      { path: 'instructions', element: <InstructionsPage /> },
      { path: 'quality', element: <QualityPage /> },
      { path: 'quality/:id', element: <InspectionPage /> },
      { path: 'alerts', element: <AlertsPage /> },
      { path: 'more', element: <MorePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
