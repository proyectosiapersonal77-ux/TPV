import { supabase } from '../Supabase';
import { Shift, ShiftBreak } from '../types';

export const registerClockIn = async (employeeId: string): Promise<{ success: boolean; message: string; data?: Shift }> => {
  try {
    // Check if already has an open shift
    const { data: openShift } = await supabase
      .from('shifts')
      .select('*')
      .eq('employee_id', employeeId)
      .is('end_time', null)
      .single();

    if (openShift) {
      return { success: false, message: 'Ya tienes un turno abierto.' };
    }

    const { data, error } = await supabase
      .from('shifts')
      .insert([{ employee_id: employeeId }])
      .select()
      .single();

    if (error) throw error;

    return { success: true, message: 'Entrada registrada correctamente', data: data as Shift };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al fichar entrada' };
  }
};

export const registerClockOut = async (employeeId: string): Promise<{ success: boolean; message: string }> => {
  try {
    // Find open shift
    const { data: openShift, error: findError } = await supabase
      .from('shifts')
      .select('*')
      .eq('employee_id', employeeId)
      .is('end_time', null)
      .single();

    if (findError || !openShift) {
      return { success: false, message: 'No tienes un turno abierto para cerrar.' };
    }

    // Check if there is an open break, close it automatically
    const { data: openBreak } = await supabase
        .from('shift_breaks')
        .select('*')
        .eq('shift_id', openShift.id)
        .is('end_time', null)
        .single();
    
    if (openBreak) {
        await supabase.from('shift_breaks').update({ end_time: new Date().toISOString() }).eq('id', openBreak.id);
    }

    const { error } = await supabase
      .from('shifts')
      .update({ end_time: new Date().toISOString() })
      .eq('id', openShift.id);

    if (error) throw error;

    return { success: true, message: 'Salida registrada. ¡Buen descanso!' };
  } catch (error: any) {
    return { success: false, message: error.message || 'Error al fichar salida' };
  }
};

export const toggleBreak = async (employeeId: string): Promise<{ success: boolean; message: string; status?: 'started' | 'ended' }> => {
    try {
        // 1. Get open shift
        const { data: openShift, error: shiftError } = await supabase
            .from('shifts')
            .select('id')
            .eq('employee_id', employeeId)
            .is('end_time', null)
            .single();

        if (shiftError || !openShift) {
            return { success: false, message: 'Debes iniciar turno antes de pausar.' };
        }

        // 2. Check for open break
        const { data: openBreak } = await supabase
            .from('shift_breaks')
            .select('*')
            .eq('shift_id', openShift.id)
            .is('end_time', null)
            .single();

        if (openBreak) {
            // End Break
            const { error } = await supabase
                .from('shift_breaks')
                .update({ end_time: new Date().toISOString() })
                .eq('id', openBreak.id);
            
            if (error) throw error;
            return { success: true, message: 'Pausa finalizada. ¡A trabajar!', status: 'ended' };
        } else {
            // Start Break
            const { error } = await supabase
                .from('shift_breaks')
                .insert([{ shift_id: openShift.id }]);
            
            if (error) throw error;
            return { success: true, message: 'Pausa iniciada. Disfruta.', status: 'started' };
        }

    } catch (error: any) {
        return { success: false, message: error.message || 'Error al gestionar pausa' };
    }
}
