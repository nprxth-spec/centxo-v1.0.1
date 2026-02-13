/**
 * Role-based access control utilities
 * Roles: OWNER, ADMIN, EMPLOYEE
 */

export type TeamRole = 'OWNER' | 'ADMIN' | 'EMPLOYEE';

/**
 * Check if role can access settings pages
 */
export function canAccessSettings(role: string | null | undefined): boolean {
    if (!role) return false;
    return role === 'OWNER' || role === 'ADMIN';
}

/**
 * Check if role can manage team members
 */
export function canManageTeam(role: string | null | undefined): boolean {
    if (!role) return false;
    return role === 'OWNER' || role === 'ADMIN';
}

/**
 * Get role display configuration
 */
export function getRoleConfig(role: string) {
    switch (role) {
        case 'OWNER':
            return {
                label: 'Owner',
                color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
                bgGradient: 'from-yellow-50 to-amber-50',
            };
        case 'ADMIN':
            return {
                label: 'Admin',
                color: 'bg-blue-100 text-blue-800 border-blue-200',
                bgGradient: 'from-blue-50 to-indigo-50',
            };
        case 'EMPLOYEE':
        default:
            return {
                label: 'Employee',
                color: 'bg-gray-100 text-gray-700 border-gray-200',
                bgGradient: 'from-gray-50 to-slate-50',
            };
    }
}

/**
 * Valid roles that can be assigned to new members
 */
export const ASSIGNABLE_ROLES: TeamRole[] = ['ADMIN', 'EMPLOYEE'];
