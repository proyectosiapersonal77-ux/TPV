import { supabase } from '../Supabase';
import { Employee, Role } from '../types';
import { getAllRoles } from './roleService';

export const verifyPin = async (pin: string): Promise<{ user: Employee | null; role: Role | null; error: string | null }> => {
  try {
    // SECURITY: We filter by PIN in the database, but we select only safe columns to return.
    // The 'pin' column is excluded from the result set.
    const { data, error } = await supabase
      .from('employees')
      .select('id, name, role, active, created_at')
      .eq('pin', pin)
      .eq('active', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return { user: null, role: null, error: 'PIN incorrecto' };
      }
      return { user: null, role: null, error: error.message };
    }

    const employee = data as Employee;
    
    // Fetch role permissions
    const { data: roleData, error: roleError } = await supabase
      .from('roles')
      .select('*')
      .eq('name', employee.role)
      .single();

    let finalRole: Role | null = roleData as Role;

    if (roleError || !roleData) {
      // Fallback to default roles if table doesn't exist or role not found
      const defaultRoles = await getAllRoles();
      finalRole = defaultRoles.find(r => r.name.toLowerCase() === employee.role.toLowerCase()) || null;
    }

    return { user: employee, role: finalRole, error: null };
  } catch (err: any) {
    return { user: null, role: null, error: err.message || 'Error de conexión' };
  }
};

export const getEmployees = async (): Promise<Employee[]> => {
    const { data, error } = await supabase
        .from('employees')
        .select('id, name, role, active, created_at')
        .eq('active', true)
        .order('name');
    
    if (error) throw error;
    return data || [];
};