import { supabase } from '../Supabase';
import { Employee, UserRole } from '../types';

export const getAllEmployees = async (): Promise<Employee[]> => {
  // SECURITY: We intentionally DO NOT select the 'pin' column.
  // This prevents the PIN from being visible in the network tab or browser state.
  const { data, error } = await supabase
    .from('employees')
    .select('id, name, role, active, created_at')
    .order('name');
  
  if (error) throw error;
  return data as Employee[];
};

export const createEmployee = async (employee: Omit<Employee, 'id' | 'created_at'>): Promise<Employee> => {
  // When creating, we must send the PIN
  const { data, error } = await supabase
    .from('employees')
    .insert([employee])
    .select('id, name, role, active, created_at') // Return non-sensitive data
    .single();

  if (error) throw error;
  return data as Employee;
};

export const updateEmployee = async (id: string, updates: Partial<Employee>): Promise<Employee> => {
  const { data, error } = await supabase
    .from('employees')
    .update(updates)
    .eq('id', id)
    .select('id, name, role, active, created_at') // Return non-sensitive data
    .single();

  if (error) throw error;
  return data as Employee;
};

export const deleteEmployee = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('employees')
    .delete()
    .eq('id', id);

  if (error) throw error;
};