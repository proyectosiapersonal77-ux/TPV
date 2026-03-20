import { supabase } from '../Supabase';
import { db, SyncJob } from '../db';
import * as InventoryService from './inventoryService'; // To access raw Supabase fetchers if needed, or define here

// --- PULL: Download data from Supabase to Local DB ---

export const syncDatabase = async () => {
    try {
        console.log("🔄 Iniciando sincronización completa...");

        // 1. Fetch all data in parallel (Relational data is fetched fully expanded)
        const [
            products, categories, subcategories, suppliers, allergens,
            units, wasteReasons, tables, zones, employees, roles, courses
        ] = await Promise.all([
            fetchFromSupabase('products', `
                *,
                product_categories (name),
                product_subcategories (name),
                suppliers (name),
                product_allergens (allergens (id, name, active)),
                product_variants (*),
                product_ingredients!product_ingredients_parent_product_id_fkey (id, child_product_id, quantity, yield_percentage)
            `),
            fetchFromSupabase('product_categories'),
            fetchFromSupabase('product_subcategories', `*, product_categories (name)`),
            fetchFromSupabase('suppliers'),
            fetchFromSupabase('allergens'),
            fetchFromSupabase('units_of_measure'),
            fetchFromSupabase('waste_reasons'),
            fetchFromSupabase('tables'),
            fetchFromSupabase('zones'),
            fetchFromSupabase('employees'), // Does not select PIN for security usually, but for offline login we might need a strategy. Assuming basic auth loaded.
            fetchFromSupabase('roles'),
            fetchFromSupabase('courses')
        ]);

        // 2. Format Data for Dexie (Flattening nested relations for easier UI usage)
        const formattedProducts = products.map((p: any) => ({
            ...p,
            allergens: p.product_allergens?.map((pa: any) => pa.allergens) || [],
            variants: p.product_variants || [],
            ingredients: p.product_ingredients || []
        }));

        // 3. Clear and Bulk Put to Dexie (Transaction for safety)
        // Using (db as any) to bypass TypeScript error where 'transaction' is not found on GastroDB type
        await (db as any).transaction('rw', 
            db.products, db.categories, db.subcategories, db.suppliers, 
            db.allergens, db.units, db.waste_reasons, db.restaurantTables, db.zones, 
            db.employees, db.roles, db.courses,
            async () => {
                await db.products.clear(); await db.products.bulkPut(formattedProducts as any);
                await db.categories.clear(); await db.categories.bulkPut(categories as any);
                await db.subcategories.clear(); await db.subcategories.bulkPut(subcategories as any);
                await db.suppliers.clear(); await db.suppliers.bulkPut(suppliers as any);
                await db.allergens.clear(); await db.allergens.bulkPut(allergens as any);
                await db.units.clear(); await db.units.bulkPut(units as any);
                await db.waste_reasons.clear(); await db.waste_reasons.bulkPut(wasteReasons as any);
                await db.restaurantTables.clear(); await db.restaurantTables.bulkPut(tables as any);
                await db.zones.clear(); await db.zones.bulkPut(zones as any);
                await db.employees.clear(); await db.employees.bulkPut(employees as any);
                await db.roles.clear(); await db.roles.bulkPut(roles as any);
                await db.courses.clear(); await db.courses.bulkPut(courses as any);
            }
        );

        console.log("✅ Sincronización completada.");
        return true;
    } catch (error) {
        console.error("❌ Error en sincronización:", error);
        return false;
    }
};

const fetchFromSupabase = async (table: string, select: string = '*') => {
    const { data, error } = await supabase.from(table).select(select);
    if (error) throw error;
    return data || [];
};

// --- PUSH: Upload Offline Changes ---

let isProcessingQueue = false;

export const processSyncQueue = async () => {
    if (isProcessingQueue) return;
    isProcessingQueue = true;

    try {
        const jobs = await db.syncQueue.toArray();
        if (jobs.length === 0) return;

        console.log(`📡 Procesando cola de sincronización: ${jobs.length} tareas...`);

        for (const job of jobs) {
            try {
                await executeSyncJob(job);
                await db.syncQueue.delete(job.id!); // Remove from queue on success
            } catch (error: any) {
                // Handle Duplicate Key Error (Code 23505) gracefully
                if (error.code === '23505' || (error.message && error.message.includes('duplicate key'))) {
                    console.warn(`⚠️ Saltando tarea duplicada (ID: ${job.id}, Tabla: ${job.table_name}):`, error.message);
                    await db.syncQueue.delete(job.id!); // Treat as success/done to unblock queue
                } else {
                    console.error(`❌ Fallo al sincronizar job ${job.id}:`, error);
                    // Stop processing to maintain order integrity for dependent items
                    break; 
                }
            }
        }
    } finally {
        isProcessingQueue = false;
    }
};

const executeSyncJob = async (job: SyncJob) => {
    const { table_name, action, payload } = job;

    if (action === 'create') {
        const { error } = await supabase.from(table_name).insert(payload);
        if (error) throw error;
    } else if (action === 'update') {
        const { id, ...updates } = payload;
        const { error } = await supabase.from(table_name).update(updates).eq('id', id);
        if (error) throw error;
    } else if (action === 'delete') {
        const { id } = payload;
        const { error } = await supabase.from(table_name).delete().eq('id', id);
        if (error) throw error;
    }
};

// --- Helper to Queue Changes ---
export const queueChange = async (table_name: string, action: 'create' | 'update' | 'delete', payload: any) => {
    await db.syncQueue.add({
        table_name,
        action,
        payload,
        created_at: Date.now(),
        retry_count: 0
    });
    // Try to process immediately if online
    if (navigator.onLine) {
        processSyncQueue();
    }
};