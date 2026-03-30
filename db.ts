import Dexie, { Table } from 'dexie';
import { 
    Product, ProductCategory, ProductSubcategory, Supplier, Allergen, 
    Table as RestaurantTable, Zone, Employee, Role, UnitOfMeasure, WasteReason,
    CashRegister, CashMovement, Course, Promotion
} from './types';

// Define the Offline Mutation Queue Item
export interface SyncJob {
    id?: number;
    table_name: string; // 'orders', 'order_items', 'products', etc.
    action: 'create' | 'update' | 'delete';
    payload: any; // The data to send
    created_at: number;
    retry_count: number;
}

export class GastroDB extends Dexie {
    // Inventory
    products!: Table<Product>;
    categories!: Table<ProductCategory>;
    subcategories!: Table<ProductSubcategory>;
    suppliers!: Table<Supplier>;
    allergens!: Table<Allergen>;
    units!: Table<UnitOfMeasure>;
    waste_reasons!: Table<WasteReason>;
    courses!: Table<Course>;
    
    // Configuration
    restaurantTables!: Table<RestaurantTable>; // Renamed from tables to avoid conflict
    zones!: Table<Zone>;
    employees!: Table<Employee>;
    roles!: Table<Role>;
    promotions!: Table<Promotion>;

    // Transactions / POS (Offline Capable)
    orders!: Table<any>; // Storing denormalized orders for offline view
    syncQueue!: Table<SyncJob>;
    audit_logs!: Table<any>;
    
    // Cash Management
    cash_registers!: Table<CashRegister>;
    cash_movements!: Table<CashMovement>;

    // Purchase Orders
    purchase_orders!: Table<any>;
    purchase_order_items!: Table<any>;

    constructor() {
        super('GastroPOS_DB');
        
        // Bumped to version 8 for audit logs
        (this as any).version(8).stores({
            // Core Inventory
            products: 'id, name, category_id, subcategory_id, supplier_id',
            categories: 'id, name',
            subcategories: 'id, name, category_id',
            suppliers: 'id, name', // Critical for filter
            allergens: 'id, name', // Critical for filter
            units: 'id, abbreviation',
            waste_reasons: 'id',
            courses: 'id, name, order_index',

            // Config
            restaurantTables: 'id, name, zone, parent_id', // Added parent_id
            zones: 'id, name',
            employees: 'id, name, pin',
            roles: 'id, name',
            promotions: 'id, name, is_active',

            // POS & Sync
            orders: 'id, table_id, status, created_at', 
            syncQueue: '++id, table_name, action, created_at',
            audit_logs: 'id, action, entity_type, entity_id, created_at',
            
            // Cash Management
            cash_registers: 'id, status, opened_at, closed_at',
            cash_movements: 'id, register_id, type, created_at',

            // Purchase Orders
            purchase_orders: 'id, supplier_id, status, created_at',
            purchase_order_items: 'id, purchase_order_id, product_id'
        });
    }
}

export const db = new GastroDB();