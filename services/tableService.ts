import { supabase } from '../Supabase';
import { db } from '../db';
import { Table } from '../types';
import { createOrder, getActiveOrderForTable, mergeOrders } from './orderService';
import { queueChange } from './syncService';

export const getAllTables = async (): Promise<Table[]> => {
  // Offline first: Read from local DB
  return await db.restaurantTables.orderBy('name').toArray();
};

export const createTable = async (table: Omit<Table, 'id' | 'created_at'>): Promise<Table> => {
  const { data, error } = await supabase
    .from('tables')
    .insert([table])
    .select()
    .single();

  if (error) throw error;
  
  // Sync local
  await db.restaurantTables.put(data as Table);
  
  return data as Table;
};

export const updateTable = async (id: string, updates: Partial<Table>): Promise<Table> => {
  const { data, error } = await supabase
    .from('tables')
    .update(updates)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  
  // Sync local
  await db.restaurantTables.put(data as Table);
  
  return data as Table;
};

export const deleteTable = async (id: string): Promise<void> => {
  const { error } = await supabase
    .from('tables')
    .delete()
    .eq('id', id);

  if (error) throw error;
  
  // Sync local
  await db.restaurantTables.delete(id);
};

// --- JOINING LOGIC ---

export const joinTables = async (parentTableId: string, childTableIds: string[], employeeId: string): Promise<void> => {
    // 1. Identify active orders
    const parentOrder = await getActiveOrderForTable(parentTableId);
    let masterOrderId = parentOrder?.id;

    // If parent has no order, create one immediately
    if (!masterOrderId) {
        const newOrder = await createOrder(parentTableId, employeeId);
        masterOrderId = newOrder.id;
    }

    // 2. Loop through children to merge orders and link tables
    for (const childId of childTableIds) {
        const childOrder = await getActiveOrderForTable(childId);
        const childTable = await db.restaurantTables.get(childId);
        
        if (childOrder) {
            // Merge orders with traceability
            await mergeOrders(masterOrderId!, childOrder.id, childTable?.name || 'Unknown');
        }

        // Link Table in DB
        await db.restaurantTables.update(childId, { parent_id: parentTableId });
        await queueChange('tables', 'update', { id: childId, parent_id: parentTableId });
    }
};

export const unjoinTable = async (tableId: string): Promise<void> => {
    // Unlink in DB (Set parent_id to null)
    await db.restaurantTables.update(tableId, { parent_id: null });
    await queueChange('tables', 'update', { id: tableId, parent_id: null });
    
    // Note: Items remain on the Master Order. The table simply becomes free/separated.
    // If the user wants to split the bill, they use the "Split" feature in POS.
};