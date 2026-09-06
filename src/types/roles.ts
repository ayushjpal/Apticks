export type AppRole = 'user' | 'moderator' | 'admin'

export interface RolePermissions {
  canAccessModeratorPanel: boolean
  canAccessAdminPanel: boolean
  canManageQuestions: boolean
  canManageContests: boolean
  canManageUsers: boolean
}

export const ROLE_PERMISSIONS: Record<AppRole, RolePermissions> = {
  user: {
    canAccessModeratorPanel: false,
    canAccessAdminPanel: false,
    canManageQuestions: false,
    canManageContests: false,
    canManageUsers: false,
  },
  moderator: {
    canAccessModeratorPanel: true,
    canAccessAdminPanel: false,
    canManageQuestions: true,
    canManageContests: true,
    canManageUsers: false,
  },
  admin: {
    canAccessModeratorPanel: true,
    canAccessAdminPanel: true,
    canManageQuestions: true,
    canManageContests: true,
    canManageUsers: true,
  },
}

export function hasPermission(role: AppRole | null | undefined, permission: keyof RolePermissions): boolean {
  if (!role) return false
  const perms = ROLE_PERMISSIONS[role]
  return perms ? perms[permission] : false
}

export function isStaffRole(role: AppRole | null | undefined): boolean {
  return role === 'moderator' || role === 'admin'
}

export function isAdminRole(role: AppRole | null | undefined): boolean {
  return role === 'admin'
}
