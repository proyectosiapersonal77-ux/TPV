import { UserRole } from '../types';

export const MODULES = [
    { id: 'module_pos', label: 'TPV / Comandas' },
    { id: 'module_tables', label: 'Planos de Mesas' },
    { id: 'module_kitchen', label: 'Cocina' },
    { id: 'module_cfd', label: 'Visor de Cliente' },
    { id: 'module_inventory', label: 'Inventario y Carta' },
    { id: 'module_menu_engineering', label: 'Ingeniería de Menú' },
    { id: 'module_cash_register', label: 'Gestión de Caja' },
    { id: 'module_analytics', label: 'Finanzas y Analítica' },
    { id: 'module_config', label: 'Configuración de App' }
];

export const hasModuleAccess = (
    moduleId: string, 
    userRoleString: string, 
    userModuleOverrides?: Record<string, boolean>
): boolean => {
    // 1. Check explicit user override first.
    if (userModuleOverrides && userModuleOverrides[moduleId] !== undefined) {
        return userModuleOverrides[moduleId];
    }

    // 2. Fallback to Role defaults.
    const roleStr = (userRoleString || '').toLowerCase();
    
    // Tour role can view everything
    if (roleStr === UserRole.TOUR || roleStr === 'tour') return true;

    const isAdmin = roleStr === UserRole.ADMIN || roleStr.includes('admin');

    // Admins have access to everything by default.
    if (isAdmin) return true;

    // Kitchen staff (Cocina)
    if (roleStr === UserRole.KITCHEN || roleStr.includes('cocina')) {
        return ['module_kitchen', 'module_cfd'].includes(moduleId);
    }

    // Waiters (Camareros)
    if (roleStr === UserRole.WAITER || roleStr.includes('sala') || roleStr.includes('camarer')) {
        return ['module_pos', 'module_tables', 'module_cfd'].includes(moduleId);
    }

    // Any other generic/unknown role defaults to very minimal 
    return ['module_pos', 'module_cfd'].includes(moduleId);
};
