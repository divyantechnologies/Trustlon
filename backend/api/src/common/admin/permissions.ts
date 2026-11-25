import { UserRole } from '@prisma/client';

/** Admin panel modules and the actions staff can be allowed (spec 5.10 RoleEditor). */
export const ADMIN_MODULES = [
  'dashboard',
  'vendors',
  'catalog',
  'products',
  'orders',
  'customers',
  'marketing',
  'trust',
  'settings',
  'staff',
  'audit',
] as const;
export type AdminModule = (typeof ADMIN_MODULES)[number];

export const ADMIN_ACTIONS = ['view', 'create', 'edit', 'approve', 'export'] as const;
export type AdminAction = (typeof ADMIN_ACTIONS)[number];

export type Permission = `${AdminModule}:${AdminAction}`;

/** Which actions make sense for each module; the role editor shows only these. */
export const MODULE_ACTIONS: Record<AdminModule, AdminAction[]> = {
  dashboard: ['view'],
  vendors: ['view', 'edit', 'approve', 'export'],
  catalog: ['view', 'create', 'edit'],
  products: ['view', 'edit', 'approve', 'export'],
  orders: ['view', 'edit', 'approve', 'export'],
  customers: ['view', 'edit', 'approve', 'export'],
  marketing: ['view', 'create', 'edit'],
  trust: ['view', 'approve'],
  settings: ['view', 'edit'],
  staff: ['view', 'create', 'edit'],
  audit: ['view', 'export'],
};

export const ALL_PERMISSIONS: Permission[] = ADMIN_MODULES.flatMap((module) =>
  MODULE_ACTIONS[module].map((action) => `${module}:${action}` as Permission),
);

/** Roles that work in Trustlon panels (not customers or vendors). */
export const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.MARKETING,
  UserRole.FINANCE,
  UserRole.SUPPORT,
  UserRole.LOGISTICS,
  UserRole.CA,
  UserRole.BRAND_TEAM,
];

/** Panels each role can sign in to (spec 0: one Next.js app per panel). */
export const ROLE_PANELS: Record<UserRole, string[]> = {
  CUSTOMER: ['storefront'],
  VENDOR_OWNER: ['vendor'],
  VENDOR_STAFF: ['vendor'],
  BRAND_TEAM: ['vendor'],
  SUPER_ADMIN: ['admin', 'operations', 'finance'],
  MARKETING: ['admin'],
  SUPPORT: ['operations', 'admin'],
  LOGISTICS: ['operations', 'admin'],
  FINANCE: ['finance', 'admin'],
  CA: ['finance'],
};

const p = (module: AdminModule, ...actions: AdminAction[]) =>
  actions.map((action) => `${module}:${action}` as Permission);

/**
 * Starting permissions. Super Admin edits these in Staff > Roles; Super Admin itself always
 * has everything and can't be edited. SRS: the admin panel is used by Super Admin and
 * Marketing; other teams get the read access their own panels need.
 */
export const DEFAULT_PERMISSIONS: Record<UserRole, Permission[]> = {
  SUPER_ADMIN: ALL_PERMISSIONS,
  MARKETING: [
    ...p('dashboard', 'view'),
    ...p('vendors', 'view'),
    ...p('catalog', 'view', 'create', 'edit'),
    ...p('products', 'view', 'edit', 'approve'),
    ...p('orders', 'view'),
    ...p('customers', 'view'),
    ...p('marketing', 'view', 'create', 'edit'),
    ...p('trust', 'view', 'approve'),
    ...p('settings', 'view', 'edit'),
  ],
  FINANCE: [
    ...p('dashboard', 'view'),
    ...p('vendors', 'view', 'export'),
    ...p('orders', 'view', 'approve', 'export'),
    ...p('customers', 'view', 'export'),
    ...p('settings', 'view'),
    ...p('audit', 'view'),
  ],
  SUPPORT: [...p('orders', 'view', 'edit'), ...p('customers', 'view', 'edit')],
  LOGISTICS: [...p('orders', 'view', 'edit')],
  CA: [],
  BRAND_TEAM: [],
  CUSTOMER: [],
  VENDOR_OWNER: [],
  VENDOR_STAFF: [],
};

/** Settings groups only Super Admin may change (5.9: business rules BR-01 to BR-14; keys). */
export const SUPER_ADMIN_SETTING_GROUPS = ['business-rules', 'payments', 'tax'];
