

export enum UserRole {
  ADMIN = 'admin',
  WAITER = 'waiter',
  KITCHEN = 'kitchen'
}

export interface RolePermissions {
  can_discount?: boolean;
  can_open_drawer?: boolean;
  can_void_ticket?: boolean;
  can_manage_inventory?: boolean;
  can_manage_employees?: boolean;
  can_view_reports?: boolean;
  can_manage_settings?: boolean;
  [key: string]: boolean | undefined;
}

export interface Role {
  id: string;
  name: string;
  color?: string; // Hex code for badge
  is_system?: boolean; // To prevent deleting core roles if needed
  permissions?: RolePermissions;
  created_at?: string;
}

export interface Employee {
  id: string;
  name: string;
  role: string; // Changed from UserRole enum to string to support dynamic roles
  pin?: string; // Optional for security (never fetched in lists)
  active: boolean;
  created_at?: string;
}

export interface Shift {
  id: string;
  employee_id: string;
  start_time: string;
  end_time: string | null;
  created_at?: string;
}

export interface ShiftBreak {
  id: string;
  shift_id: string;
  start_time: string;
  end_time: string | null;
  created_at?: string;
}

export interface AuthState {
  isAuthenticated: boolean;
  currentUser: Employee | null;
  loading: boolean;
  error: string | null;
}

// TableZone is now just a string to support dynamic DB values
export type TableZone = string;

export interface Zone {
    id: string;
    name: string;
    active: boolean;
    created_at?: string;
}

export interface Table {
  id: string;
  name: string;
  zone: TableZone;
  active: boolean;
  parent_id?: string | null; // For joined tables (if set, this is a child table)
  created_at?: string;
}

// --- INVENTORY TYPES ---

export interface ProductCategory {
  id: string;
  name: string;
  icon?: string;
  active: boolean;
  kds_station?: 'kitchen' | 'bar' | 'none';
  created_at?: string;
}

export interface ProductSubcategory {
  id: string;
  name: string;
  category_id: string;
  active: boolean;
  created_at?: string;
  
  // Joins
  product_categories?: ProductCategory;
}

export interface Supplier {
  id: string;
  name: string;
  contact_name?: string;
  phone?: string;
  email?: string;
  active: boolean;
  created_at?: string;
}

export interface Allergen {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
}

export interface UnitOfMeasure {
  id: string;
  name: string; 
  abbreviation: string; // e.g., 'kg', 'l', 'caja'
  created_at?: string;
}

export interface WasteReason {
  id: string;
  name: string;
  active: boolean;
  created_at?: string;
}

export interface Course {
  id: string;
  name: string;
  active: boolean;
  order_index: number;
  created_at?: string;
}

export interface ProductVariant {
  id?: string; // Optional for new variants before saving
  product_id?: string;
  name: string; // e.g., "Caña", "Pinta", "Jarra"
  cost_price: number;
  selling_price: number;
  stock_current: number;
  active?: boolean;
}

export interface ProductIngredient {
  id?: string;
  parent_product_id?: string;
  child_product_id: string;
  quantity: number; // Amount of child product used
  yield_percentage?: number; // Yield management (e.g., 80 for 80%)
  
  // Joins for UI
  child_product?: Product; 
}

export type StockMovementReason = 'Venta' | 'Compra' | 'Merma' | 'Corrección' | 'Devolución' | 'Inicial';

export interface PurchaseOrder {
  id: string;
  supplier_id: string;
  status: 'pending' | 'sent' | 'received' | 'cancelled';
  total: number;
  expected_date?: string;
  notes?: string;
  created_at?: string;
  
  // Joins
  supplier?: Supplier;
  items?: PurchaseOrderItem[];
}

export interface PurchaseOrderItem {
  id: string;
  purchase_order_id: string;
  product_id: string;
  quantity: number;
  cost_price: number;
  received_quantity: number;
  created_at?: string;
  
  // Joins
  product?: Product;
}

export interface StockMovement {
  id: string;
  product_id: string;
  user_id: string | null;
  quantity_change: number;
  new_stock_level: number;
  reason: StockMovementReason | string;
  notes?: string;
  created_at: string;
  
  // Joins
  employees?: Employee;
}

// Removed fixed StockUnit enum to allow dynamic strings from DB
export type StockUnit = string; 

export interface ProductModifierOption {
  name: string;
  price_adjustment: number;
  product_id?: string; // Optional: deduct stock from another product
}

export interface ProductModifier {
  name: string;
  is_required: boolean;
  multiple_selection: boolean;
  options: ProductModifierOption[];
}

export interface Product {
  id: string;
  name: string;
  category_id: string | null;
  subcategory_id: string | null; // New field
  supplier_id: string | null;
  cost_price: number;
  selling_price: number;
  tax_rate: number;
  stock_current: number;
  stock_min: number;
  stock_unit: StockUnit; // Now a string that matches UnitOfMeasure.abbreviation
  attributes: string[]; // ['Sin Alcohol', 'Barril', etc.]
  active: boolean;
  image_url?: string;
  barcode?: string; // New field for barcode/QR
  is_compound: boolean; // TRUE = Recipe (composed of others), FALSE = Raw Material/Simple
  created_at?: string;
  
  // Joins (optional for UI)
  product_categories?: ProductCategory;
  product_subcategories?: ProductSubcategory;
  suppliers?: Supplier;
  allergens?: Allergen[]; // Many-to-many result
  variants?: ProductVariant[]; // One-to-many result
  ingredients?: ProductIngredient[]; // The recipe details
}

// --- ORDER / POS TYPES ---

export type OrderStatus = 'open' | 'paid' | 'cancelled';
export type OrderItemStatus = 'held' | 'pending' | 'cooking' | 'ready' | 'served';

export interface OrderItem {
    id: string;
    order_id: string;
    product_id: string;
    product_name: string;
    quantity: number;
    price: number;
    status: OrderItemStatus;
    variant_name?: string;
    notes?: string;
    course?: 'entrantes' | 'segundos' | 'postres' | 'bebidas' | 'otros';
    original_table_name?: string; // For traceability when merging tables
    created_at?: string;
}

export interface Order {
    id: string;
    table_id: string;
    employee_id: string;
    status: OrderStatus;
    total: number;
    created_at: string;
    closed_at?: string;
    payment_method?: 'cash' | 'card' | 'other';
    
    // VeriFactu / TicketBAI Compliance Fields
    invoice_number?: string;
    invoice_hash?: string;
    previous_invoice_hash?: string;
    
    // Joins
    items?: OrderItem[];
    tables?: Table;
    employees?: Employee;
}

export interface AuditLog {
    id: string;
    action: string; // e.g., 'ORDER_CLOSED', 'ITEM_DELETED'
    entity_type: string; // e.g., 'Order', 'OrderItem'
    entity_id: string;
    employee_id: string;
    details: string; // JSON stringified details
    created_at: string;
}

export interface CashRegister {
    id: string;
    opened_at: string;
    closed_at?: string;
    opened_by: string;
    closed_by?: string;
    opening_balance: number;
    closing_balance?: number;
    expected_balance?: number;
    status: 'open' | 'closed';
    notes?: string;
}

export interface CashMovement {
    id: string;
    register_id: string;
    type: 'in' | 'out';
    amount: number;
    reason: string;
    employee_id: string;
    created_at: string;
}

export interface Promotion {
  id: string;
  name: string;
  discount_type: 'percentage' | 'fixed_amount';
  discount_value: number;
  start_time: string; // HH:mm
  end_time: string; // HH:mm
  days_of_week: number[]; // 0-6 (0 = Sunday)
  applicable_categories: string[];
  applicable_products?: string[];
  is_active: boolean;
  created_at?: string;
}

// --- APP VIEW STATE ---
export type ViewState = 'login' | 'dashboard' | 'config' | 'tables' | 'inventory' | 'pos' | 'kitchen' | 'cash_register' | 'analytics';
