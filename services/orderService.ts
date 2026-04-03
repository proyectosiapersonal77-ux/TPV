import { supabase } from '../Supabase';
import { db } from '../db';
import { queueChange } from './syncService';
import { Order, OrderItem, OrderStatus, OrderItemStatus } from '../types';
import { generateSHA256Hash } from './cryptoService';
import { logAction } from './auditService';

// Helper to generate UUID v4 (required for offline ID generation)
function uuidv4() {
  return "10000000-1000-4000-8000-100000000000".replace(/[018]/g, c =>
    (+c ^ crypto.getRandomValues(new Uint8Array(1))[0] & 15 >> +c / 4).toString(16)
  );
}

// Get Active Order for a Table (Robust Merge Strategy)
export const getActiveOrderForTable = async (tableId: string): Promise<Order | null> => {
    let remoteOrder: any = null;

    // Check if this table is a child table
    const table = await db.restaurantTables.get(tableId);
    let targetTableId = tableId;
    if (table && table.parent_id) {
        targetTableId = table.parent_id;
    }

    // 1. Fetch Remote if online
    if (navigator.onLine) {
        const { data } = await supabase
            .from('orders')
            .select(`*, items:order_items(*)`)
            .eq('table_id', targetTableId)
            .eq('status', 'open')
            .maybeSingle();
        remoteOrder = data;
    }

    // 2. Fetch Local Candidate
    const localOrder = await db.orders
        .where('table_id').equals(targetTableId)
        .filter((o: any) => o.status === 'open')
        .last();

    // 3. Merge Logic
    if (remoteOrder) {
        if (localOrder && localOrder.id === remoteOrder.id) {
            if (localOrder.status === 'paid') return null;
            return {
                ...remoteOrder,
                total: localOrder.total ?? remoteOrder.total,
                items: (localOrder.items && localOrder.items.length > 0) ? localOrder.items : remoteOrder.items
            } as Order;
        }
        return remoteOrder as Order;
    }

    if (localOrder) {
        return localOrder as Order;
    }

    return null;
};

// Merge Orders (When joining tables)
// Moves items from sourceOrderId to targetOrderId
export const mergeOrders = async (targetOrderId: string, sourceOrderId: string, sourceTableName: string): Promise<void> => {
    // 1. Get Source Order Items
    let sourceItems: OrderItem[] = [];
    const sourceOrderLocal = await db.orders.get(sourceOrderId);
    
    if (sourceOrderLocal && sourceOrderLocal.items) {
        sourceItems = sourceOrderLocal.items;
    } else if (navigator.onLine) {
        const { data } = await supabase.from('order_items').select('*').eq('order_id', sourceOrderId);
        sourceItems = data || [];
    }

    if (sourceItems.length === 0) return;

    // 2. Get Target Order
    const targetOrderLocal = await db.orders.get(targetOrderId);
    // If target order doesn't exist locally but exists remotely, we should probably fetch it, 
    // but for simplicity in offline-first, we assume we are operating on synced data or local data.
    
    const itemsToMove = sourceItems.map(item => ({
        ...item,
        order_id: targetOrderId,
        original_table_name: item.original_table_name || sourceTableName // Preserve original if exists, else set current
    }));

    // Calculate totals
    const moveTotal = itemsToMove.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const targetTotal = (targetOrderLocal?.total || 0) + moveTotal;

    // 3. Update Local DB
    // Update Target Order
    await db.orders.update(targetOrderId, {
        total: targetTotal,
        items: [...(targetOrderLocal?.items || []), ...itemsToMove]
    });

    // Close/Cancel Source Order locally
    await db.orders.update(sourceOrderId, { status: 'cancelled', total: 0, items: [] });

    // 4. Queue Changes
    // Update items to point to new order
    for (const item of itemsToMove) {
        await queueChange('order_items', 'update', { 
            id: item.id, 
            order_id: targetOrderId,
            original_table_name: item.original_table_name
        });
    }
    
    // Update target order total
    await queueChange('orders', 'update', { id: targetOrderId, total: targetTotal });
    
    // Cancel source order remotely
    await queueChange('orders', 'update', { id: sourceOrderId, status: 'cancelled' });
};

// Move Order to another table
export const moveOrderToTable = async (orderId: string, targetTableId: string, sourceTableName: string): Promise<void> => {
    // Check if target table already has an open order
    const targetOrder = await getActiveOrderForTable(targetTableId);

    if (targetOrder) {
        // Ensure targetOrder is in local DB before merging (in case it was only remote)
        const localTarget = await db.orders.get(targetOrder.id);
        if (!localTarget) {
            await db.orders.put(targetOrder);
        }
        // Merge into existing order
        await mergeOrders(targetOrder.id, orderId, sourceTableName);
    } else {
        // Just update the table_id of the current order
        await db.orders.update(orderId, { table_id: targetTableId });
        await queueChange('orders', 'update', { id: orderId, table_id: targetTableId });
    }
};

// Get All Open Orders (For Table Plan Status)
export const getOpenOrders = async (): Promise<{id: string, table_id: string, total: number}[]> => {
    // 1. Local Orders (Source of truth for recent actions)
    const localOrders = await db.orders.toArray() as any[];
    const localOrdersMap = new Map(localOrders.map((o: any) => [o.id, o]));

    let combinedOrders: any[] = [];

    // 2. Remote Orders
    if (navigator.onLine) {
        const { data } = await supabase.from('orders').select('id, table_id, total, status').eq('status', 'open');
        if (data) {
            // Merge remote with local data immediately
            combinedOrders = data.map(remoteOrder => {
                const local = localOrdersMap.get(remoteOrder.id);
                
                // If local exists, use LOCAL TOTAL (it includes recently added items)
                if (local) {
                    return {
                        ...remoteOrder,
                        total: local.total ?? remoteOrder.total, // Fix: Use local total to avoid 0.00€
                        status: local.status // Respect local paid status
                    };
                }
                return remoteOrder;
            }).filter(o => o.status === 'open'); // Filter out those that are paid locally
        }
    }

    // 3. Add Local-Only Open Orders (Created offline or not yet synced)
    const remoteIds = new Set(combinedOrders.map(o => o.id));
    const localNewOrders = localOrders.filter((l: any) => l.status === 'open' && !remoteIds.has(l.id));
    
    return [...combinedOrders, ...localNewOrders].map((o: any) => ({
        id: o.id,
        table_id: o.table_id,
        total: o.total || 0
    }));
};

// Create a new Order (Offline First)
export const createOrder = async (tableId: string, employeeId: string): Promise<Order> => {
    // Check if table is child, if so, redirect to parent
    const table = await db.restaurantTables.get(tableId);
    const finalTableId = (table && table.parent_id) ? table.parent_id : tableId;

    const newOrderId = uuidv4();
    const newOrder: any = {
        id: newOrderId,
        table_id: finalTableId,
        employee_id: employeeId,
        status: 'open',
        total: 0,
        items: [], // Initialize empty items array
        created_at: new Date().toISOString()
    };

    // 1. Save to Local DB (Vital for Optimistic UI)
    await db.orders.put(newOrder);

    // 2. Queue for Sync
    const { items, ...orderPayload } = newOrder; // Don't send the 'items' array in the 'orders' table insert
    await queueChange('orders', 'create', orderPayload);

    return newOrder as Order;
};

import * as InventoryService from './inventoryService';

// Add Items to Order (Offline First)
export const addItemsToOrder = async (orderId: string, items: Partial<OrderItem>[], employeeId: string): Promise<void> => {
    if (items.length === 0) return;

    // We can try to fetch original table name for traceability if not provided
    // but usually items added in POS are for the current active table (Master).
    // If it's a joined table, items are added to Master order. 
    // We could store "Added via Table X" if we passed that info from POS.

    const itemsPayload = items.map(item => {
        let initialStatus = 'pending';
        if (item.course === 'segundos' || item.course === 'postres') {
            initialStatus = 'held';
        }

        return {
            id: uuidv4(), // Generate ID locally
            order_id: orderId,
            product_id: item.product_id,
            product_name: item.product_name,
            quantity: item.quantity,
            price: item.price,
            variant_name: item.variant_name,
            notes: item.notes,
            course: item.course,
            status: initialStatus,
            created_at: new Date().toISOString()
        };
    });

    // 1. Update Local DB IMMEDIATELY (Optimistic UI for Kitchen & POS)
    const order = await db.orders.get(orderId);
    if (order) {
        const addedTotal = itemsPayload.reduce((acc, i) => acc + ((i.price || 0) * (i.quantity || 1)), 0);
        const newTotal = (order.total || 0) + addedTotal;
        const currentItems = order.items || [];
        
        await db.orders.update(orderId, { 
            total: newTotal,
            items: [...currentItems, ...itemsPayload] 
        });
    }

    // 2. Queue creation of items for Sync and deduct stock
    for (const item of itemsPayload) {
        await queueChange('order_items', 'create', item);
        
        if (item.product_id) {
            await InventoryService.deductProductStock(item.product_id, item.quantity || 1, employeeId, `Venta TPV (Pedido ${orderId.slice(0, 8)})`);
            
            // Also check if notes contain modifiers that require stock deduction
            // We need the original product to parse modifiers
            const product = await db.products.get(item.product_id);
            if (product && item.notes) {
                const modifiers = InventoryService.getProductModifiers(product);
                
                // Parse notes: "Mod1: Opt1, Opt2 | Mod2: Opt3"
                const noteParts = item.notes.split(' | ');
                const selectedOptionsMap = new Map<string, Set<string>>(); // ModName -> Set<OptName>
                
                for (const part of noteParts) {
                    if (part.startsWith('Notas:')) continue;
                    const splitIndex = part.indexOf(': ');
                    if (splitIndex !== -1) {
                        const modName = part.substring(0, splitIndex);
                        const opts = part.substring(splitIndex + 2);
                        if (modName && opts) {
                            const optsSet = new Set(opts.split(', '));
                            selectedOptionsMap.set(modName, optsSet);
                        }
                    }
                }

                for (const mod of modifiers) {
                    const selectedForMod = selectedOptionsMap.get(mod.name);
                    if (selectedForMod) {
                        for (const opt of mod.options) {
                            if (opt.product_id && selectedForMod.has(opt.name)) {
                                await InventoryService.deductProductStock(opt.product_id, item.quantity || 1, employeeId, `Modificador: ${opt.name}`);
                            }
                        }
                    }
                }
            }
        }
    }
};

// Update Item Status (Kitchen workflow)
export const updateOrderItemStatus = async (itemId: string, status: OrderItemStatus): Promise<void> => {
    await queueChange('order_items', 'update', { id: itemId, status });
    
    const allOrders = await db.orders.toArray();
    for (const order of allOrders) {
        if (order.items && order.items.some((i: any) => i.id === itemId)) {
            const updatedItems = order.items.map((i: any) => i.id === itemId ? { ...i, status } : i);
            await db.orders.update(order.id, { items: updatedItems });
            break;
        }
    }
};

// Delete Order Item
export const deleteOrderItem = async (orderId: string, itemId: string, employeeId: string): Promise<void> => {
    const order = await db.orders.get(orderId);
    if (!order || !order.items) return;

    const itemToDelete = order.items.find(i => i.id === itemId);
    if (!itemToDelete) return;

    // Remove from local order items array
    const updatedItems = order.items.filter(i => i.id !== itemId);
    
    // Recalculate total
    const newTotal = updatedItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);

    // Update local DB
    await db.orders.update(orderId, { items: updatedItems, total: newTotal });

    // Queue changes
    await queueChange('order_items', 'delete', { id: itemId });
    await queueChange('orders', 'update', { id: orderId, total: newTotal });

    // Audit log
    await logAction(
        'ITEM_DELETED',
        'order_items',
        itemId,
        employeeId,
        {
            order_id: orderId,
            product_name: itemToDelete.product_name,
            quantity: itemToDelete.quantity,
            price: itemToDelete.price
        }
    );
};

export const fireCourse = async (orderId: string, course: string): Promise<void> => {
    // 1. Queue change for each item that matches the course and is 'held'
    const order = await db.orders.get(orderId);
    if (!order || !order.items) return;

    const itemsToFire = order.items.filter((i: any) => i.course === course && i.status === 'held');
    if (itemsToFire.length === 0) return;

    const now = new Date().toISOString();

    for (const item of itemsToFire) {
        await queueChange('order_items', 'update', { id: item.id, status: 'pending', created_at: now });
    }

    // 2. Update Local DB
    const updatedItems = order.items.map((i: any) => 
        (i.course === course && i.status === 'held') ? { ...i, status: 'pending', created_at: now } : i
    );
    await db.orders.update(orderId, { items: updatedItems });
};

// Close/Pay Order
export const closeOrder = async (orderId: string, paymentMethod: 'cash' | 'card' | 'other' = 'cash', finalTotal?: number, employeeId?: string): Promise<void> => {
    const closedAt = new Date().toISOString();
    
    // --- VERIFACTU / TICKETBAI COMPLIANCE: GENERATE CHAINED HASH ---
    let invoiceNumber = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
    let previousHash = 'GENESIS_HASH';
    
    try {
        // Get the last closed order to chain the hash
        const lastOrder = await db.orders
            .filter(o => o.status === 'paid' || o.status === 'closed')
            .reverse()
            .sortBy('closed_at');
            
        if (lastOrder && lastOrder.length > 0 && lastOrder[0].invoice_hash) {
            previousHash = lastOrder[0].invoice_hash;
        }
    } catch (e) {
        console.warn("Could not fetch previous hash, using GENESIS_HASH");
    }

    // Prepare data for hashing (must be deterministic)
    const orderDataToHash = {
        orderId,
        closedAt,
        paymentMethod,
        total: finalTotal || 0,
        previousHash
    };
    
    const invoiceHash = await generateSHA256Hash(JSON.stringify(orderDataToHash));
    // ---------------------------------------------------------------

    const updateData: any = {
        status: 'paid',
        closed_at: closedAt,
        payment_method: paymentMethod,
        invoice_number: invoiceNumber,
        invoice_hash: invoiceHash,
        previous_invoice_hash: previousHash
    };
    if (finalTotal !== undefined) {
        updateData.total = finalTotal;
    }

    try {
        await db.orders.update(orderId, updateData);
    } catch (e) {
        await db.orders.put({
            id: orderId,
            status: 'paid',
            created_at: closedAt,
            table_id: 'unknown',
            payment_method: paymentMethod,
            invoice_number: invoiceNumber,
            invoice_hash: invoiceHash,
            previous_invoice_hash: previousHash,
            ...(finalTotal !== undefined ? { total: finalTotal } : {})
        });
    }

    // Queue order update
    await queueChange('orders', 'update', { 
        id: orderId, 
        ...updateData
    });

    // --- AUDIT LOG (Unalterable Event Record) ---
    const auditLogId = uuidv4();
    const auditLog = {
        id: auditLogId,
        action: 'ORDER_CLOSED_AND_SIGNED',
        entity_type: 'orders',
        entity_id: orderId,
        employee_id: employeeId || 'system',
        details: JSON.stringify({
            invoice_number: invoiceNumber,
            total: finalTotal,
            payment_method: paymentMethod,
            hash: invoiceHash
        }),
        created_at: closedAt
    };

    try {
        await db.audit_logs.put(auditLog);
        await queueChange('audit_logs', 'create', auditLog);
    } catch (e) {
        console.error("Failed to save audit log", e);
    }
    // --------------------------------------------
};

export const voidOrder = async (orderId: string, employeeId: string, reason: string): Promise<void> => {
    const closedAt = new Date().toISOString();
    
    const updateData: any = {
        status: 'voided',
        closed_at: closedAt,
    };

    try {
        await db.orders.update(orderId, updateData);
    } catch (e) {
        throw new Error('Order not found');
    }

    // Queue order update
    await queueChange('orders', 'update', { 
        id: orderId, 
        ...updateData
    });

    // --- AUDIT LOG ---
    const auditLogId = uuidv4();
    const auditLog = {
        id: auditLogId,
        action: 'ORDER_VOIDED',
        entity_type: 'orders',
        entity_id: orderId,
        employee_id: employeeId || 'system',
        details: JSON.stringify({
            reason: reason
        }),
        created_at: closedAt
    };
    
    await db.audit_logs.put(auditLog);
    await queueChange('audit_logs', 'create', auditLog);
};

// Split order: Moves specific items to a NEW order and updates totals
export const splitOrder = async (originalOrder: Order, itemsToMove: OrderItem[], employeeId: string): Promise<string> => {
    const newOrder = await createOrder(originalOrder.table_id, employeeId);
    const itemIdsToMove = new Set(itemsToMove.map(i => i.id));

    const moveTotal = itemsToMove.reduce((acc, i) => acc + (i.price * i.quantity), 0);
    const newOriginalTotal = Math.max(0, originalOrder.total - moveTotal);

    await db.orders.update(newOrder.id, { 
        total: moveTotal,
        items: itemsToMove.map(i => ({ ...i, order_id: newOrder.id })) 
    });

    const remainingItems = (originalOrder.items || []).filter(i => !itemIdsToMove.has(i.id));
    await db.orders.update(originalOrder.id, { 
        total: newOriginalTotal,
        items: remainingItems
    });

    for (const itemId of itemIdsToMove) {
        await queueChange('order_items', 'update', { id: itemId, order_id: newOrder.id });
    }
    
    await queueChange('orders', 'update', { id: originalOrder.id, total: newOriginalTotal });
    await queueChange('orders', 'update', { id: newOrder.id, total: moveTotal });

    return newOrder.id;
};

export const getKitchenOrders = async (): Promise<any[]> => {
    const localOrders = await db.orders.filter((o: any) => o.status === 'open').toArray() as any[];
    const localOrdersMap = new Map(localOrders.map((o: any) => [o.id, o]));

    let combinedOrders = [...localOrders];

    if (navigator.onLine) {
        const { data: remoteOrders } = await supabase
            .from('orders')
            .select(`
                id,
                table_id,
                status,
                created_at,
                tables (name),
                items:order_items(*)
            `)
            .eq('status', 'open')
            .order('created_at', { ascending: true });
        
        if (remoteOrders) {
            remoteOrders.forEach((remote: any) => {
                const local = localOrdersMap.get(remote.id) as any;
                
                if (local && local.status === 'paid') {
                    return;
                }

                if (local) {
                    const finalItems = (local.items && local.items.length > 0) ? local.items : remote.items;
                    const index = combinedOrders.findIndex(o => o.id === local.id);
                    if (index !== -1) {
                        combinedOrders[index] = { ...remote, items: finalItems };
                    }
                } else {
                    combinedOrders.push(remote);
                }
            });
        }
    }

    return combinedOrders.filter((order: any) => {
        const hasItems = order.items && order.items.length > 0;
        if (!hasItems) return false;
        
        const hasUnservedItems = order.items.some((item: OrderItem) => item.status !== 'served');
        return hasUnservedItems;
    }).sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
};