import type { Role } from '@mes/types'

export type Permission =
  | 'masterdata.manage'
  | 'plm.manage'
  | 'eco.approve'
  | 'order.manage'
  | 'demand.manage'
  | 'mo.manage'
  | 'mo.release'
  | 'wo.dispatch'
  | 'shopfloor.execute'
  | 'inventory.manage'
  | 'quality.execute'
  | 'quality.release'
  | 'planning.manage'
  | 'integration.manage'

const ALL: Permission[] = [
  'masterdata.manage',
  'plm.manage',
  'eco.approve',
  'order.manage',
  'demand.manage',
  'mo.manage',
  'mo.release',
  'wo.dispatch',
  'shopfloor.execute',
  'inventory.manage',
  'quality.execute',
  'quality.release',
  'planning.manage',
  'integration.manage',
]

const BY_ROLE: Record<Role, Permission[]> = {
  admin: ALL,
  production_manager: [
    'order.manage',
    'demand.manage',
    'mo.manage',
    'mo.release',
    'wo.dispatch',
    'planning.manage',
    'eco.approve',
    'quality.release',
  ],
  planner: ['demand.manage', 'mo.manage', 'mo.release', 'wo.dispatch', 'planning.manage'],
  supervisor: ['wo.dispatch', 'shopfloor.execute', 'inventory.manage'],
  operator: ['shopfloor.execute'],
  quality: ['quality.execute', 'quality.release'],
  engineer: ['plm.manage', 'masterdata.manage'],
  marketing: ['order.manage'],
  warehouse: ['inventory.manage'],
}

export const can = (role: Role, permission: Permission): boolean => BY_ROLE[role].includes(permission)
