import { supabase } from '../Supabase';
import { Employee } from '../types';

export const verifyPin = async (pin: string): Promise<{ user: Employee | null; error: string | null }> => {
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
        return { user: null, error: 'PIN incorrecto' };
      }
      return { user: null, error: error.message };
    }

    return { user: data as Employee, error: null };
  } catch (err: any) {
    return { user: null, error: err.message || 'Error de conexión' };
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