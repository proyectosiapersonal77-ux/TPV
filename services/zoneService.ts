import { supabase } from '../Supabase';
import { db } from '../db';
import { Zone } from '../types';

export const getAllZones = async (): Promise<Zone[]> => {
  // Offline first: Read from local DB
  return await db.zones.orderBy('name').toArray();
};

export const createZone = async (name: string): Promise<Zone> => {
  const { data, error } = await supabase
    .from('zones')
    .insert([{ name: name.toLowerCase(), active: true }])
    .select()
    .single();

  if (error) throw error;
  
  // Sync local
  await db.zones.put(data as Zone);
  
  return data as Zone;
};

export const deleteZone = async (id: string): Promise<void> => {
  // Prevent deleting fallback zones
  if (['1', '2', '3'].includes(id)) {
      throw new Error("No se pueden eliminar las zonas de ejemplo del sistema (IDs 1, 2, 3). Asegúrate de crear la tabla 'zones' en Supabase.");
  }

  const { error } = await supabase
    .from('zones')
    .delete()
    .eq('id', id);

  if (error) throw error;
  
  // Sync local
  await db.zones.delete(id);
};