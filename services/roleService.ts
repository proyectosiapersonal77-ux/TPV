import { supabase } from '../Supabase';
import { Role } from '../types';

// Fallback roles in case DB table doesn't exist yet or connection fails
const DEFAULT_ROLES: Role[] = [
  { id: '1', name: 'admin', color: '#ef4444', is_system: true },
  { id: '2', name: 'waiter', color: '#22c55e', is_system: true },
  { id: '3', name: 'kitchen', color: '#f97316', is_system: true },
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

export const createRole = async (name: string): Promise<Role> => {
  // Simple color generator based on name length
  const colors = ['#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6', '#f59e0b'];
  const color = colors[name.length % colors.length];

  // Always create as non-system (false) to ensure editability
  const { data, error } = await supabase
    .from('roles')
    .insert([{ name: name.toLowerCase(), color, is_system: false }])
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
