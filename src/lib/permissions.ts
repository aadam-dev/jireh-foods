import { UserRole } from '@prisma/client';

export const ROLE_LABELS: Record<UserRole, string> = {
  OWNER: 'Owner',
  MANAGER: 'Manager',
  ACCOUNTANT: 'Accountant',
  CASHIER: 'Cashier',
  STAFF: 'Staff',
};

export const ROLE_COLORS: Record<UserRole, string> = {
  OWNER: 'text-[#5ecf4f] bg-[#349f2d]/20 border-[#349f2d]/40',
  MANAGER: 'text-blue-400 bg-blue-500/20 border-blue-500/40',
  ACCOUNTANT: 'text-yellow-400 bg-yellow-500/20 border-yellow-500/40',
  CASHIER: 'text-purple-400 bg-purple-500/20 border-purple-500/40',
  STAFF: 'text-[#aba8a4] bg-white/5 border-white/10',
};

export function canAccess(role: UserRole, resource: string): boolean {
  const permissions: Record<string, UserRole[]> = {
    admin: [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT],
    menu: [UserRole.OWNER, UserRole.MANAGER],
    orders: [UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER],
    inventory: [UserRole.OWNER, UserRole.MANAGER],
    expenses: [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT],
    staff: [UserRole.OWNER, UserRole.MANAGER],
    payroll: [UserRole.OWNER, UserRole.ACCOUNTANT],
    reports: [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT],
    settings: [UserRole.OWNER],
    pos: [UserRole.OWNER, UserRole.MANAGER, UserRole.CASHIER, UserRole.STAFF],
  };
  return permissions[resource]?.includes(role) ?? false;
}

const ADMIN_ROLES: UserRole[] = [UserRole.OWNER, UserRole.MANAGER, UserRole.ACCOUNTANT];

export function isAdminRole(role: UserRole): boolean {
  return ADMIN_ROLES.includes(role);
}
