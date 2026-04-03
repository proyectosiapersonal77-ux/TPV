import { supabase } from '../Supabase';
import { Role, RolePermissions } from '../types';

// Fallback roles in case DB table doesn't exist yet or connection fails
const DEFAULT_ROLES: Role[] = [
  { 
    id: '1', 
    name: 'admin', 
    color: '#ef4444', 
    is_system: true,
    permissions: {
      can_discount: true,
      can_open_drawer: true,
      can_void_ticket: true,
      can_manage_inventory: true,
      can_manage_employees: true,
      can_view_reports: true,
      can_manage_settings: true
    }
  },
  { 
    id: '2', 
    name: 'waiter', 
    color: '#22c55e', 
    is_system: true,
    permissions: {
      can_discount: false,
      can_open_drawer: false,
      can_void_ticket: false,
      can_manage_inventory: false,
      can_manage_employees: false,
      can_view_reports: false,
      can_manage_settings: false
    }
  },
  { 
    id: '3', 
    name: 'kitchen', 
    color: '#f97316', 
    is_system: true,
    permissions: {
      can_discount: false,
      can_open_drawer: false,
      can_void_ticket: false,
      can_manage_inventory: false,
      can_manage_employees: false,
      can_view_reports: false,
      can_manage_settings: false
    }
  },
];

export const getAllRoles = async (): Promise<Role[]> => {
  try {
    const { data, error } = await supabase
      .from('roles')
      .select('*')
      .order('name');
    
    if (error) {
      console.warn("Could not fetch roles table, using defaults. Ensure 'roles' table exists.", error);
      return DEFAULT_ROLES;
    }
    return data as Role[];
  } catch (e) {
    return DEFAULT_ROLES;
  }
};

export const createRole = async (name: string, permissions: RolePermissions = {}): Promise<Role> => {
  // Simple color generator based on name length
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];
  const color = colors[name.length % colors.length];

  // Always create as non-system (false) to ensure editability
  const { data, error } = await supabase
    .from('roles')
    .insert([{ name: name.toLowerCase(), color, is_system: false, permissions }])
    .select()
    .single();

  if (error) throw error;
  return data as Role;
};

export const updateRole = async (id: string, updates: Partial<Role>): Promise<Role> => {
  const { data, error } = await supabase
    .from('roles')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return data as Role;
};

export const deleteRole = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('roles')
    .delete()
    .eq('id', id);

  if (error) throw error;
};
