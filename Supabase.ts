import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://lwyxjcbwhtkksxxnsyrv.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable__Cd7FAGAbI7ptVBKd9O5fQ_u9afWIEO';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const checkSupabaseConnection = () => {
  if (SUPABASE_URL.includes('tu-proyecto')) {
    return false;
  }
  return true;
};

/*
  -- =====================================================================================
  -- INSTRUCCIONES SQL ACTUALIZADAS v13 (Mermas de Producción y Pedidos de Compra)
  -- Copia y pega todo este bloque en el Editor SQL de Supabase.
  -- =====================================================================================

  -- 1. MODIFICACIÓN DE TABLAS (Nuevos campos para Mermas y Unir Mesas)
  
  alter table tables add column if not exists parent_id uuid references tables(id) on delete set null;
  alter table order_items add column if not exists original_table_name text;
  alter table product_ingredients add column if not exists yield_percentage numeric default 100;
  alter table products add column if not exists barcode text unique;

  -- 2. CAMPOS PARA RESOLUCIÓN DE CONFLICTOS (CRDTs / Last-Write-Wins)
  alter table orders add column if not exists updated_at timestamptz default now();
  alter table order_items add column if not exists updated_at timestamptz default now();
  alter table tables add column if not exists updated_at timestamptz default now();

  -- 3. Asegurar que las tablas base existen (si es instalación limpia)
  
  create table if not exists units_of_measure (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    abbreviation text not null,
    created_at timestamptz default now()
  );

  create table if not exists waste_reasons (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    active boolean default true,
    created_at timestamptz default now()
  );

  create table if not exists orders (
    id uuid default gen_random_uuid() primary key,
    table_id uuid references tables(id) on delete set null,
    employee_id uuid references employees(id) on delete set null,
    status text default 'open', 
    total numeric default 0,
    created_at timestamptz default now(),
    closed_at timestamptz
  );

  create table if not exists order_items (
    id uuid default gen_random_uuid() primary key,
    order_id uuid references orders(id) on delete cascade,
    product_id uuid references products(id) on delete restrict,
    product_name text not null,
    quantity numeric default 1,
    price numeric not null,
    status text default 'pending',
    variant_name text,
    notes text,
    original_table_name text, -- Nuevo campo
    created_at timestamptz default now()
  );

  create table if not exists courses (
    id uuid default gen_random_uuid() primary key,
    name text not null,
    active boolean default true,
    order_index integer default 0,
    created_at timestamptz default now()
  );

  create table if not exists purchase_orders (
    id uuid default gen_random_uuid() primary key,
    supplier_id uuid references suppliers(id) on delete restrict,
    status text default 'pending', -- pending, sent, received, cancelled
    total numeric default 0,
    created_at timestamptz default now(),
    expected_date timestamptz,
    notes text
  );

  create table if not exists purchase_order_items (
    id uuid default gen_random_uuid() primary key,
    purchase_order_id uuid references purchase_orders(id) on delete cascade,
    product_id uuid references products(id) on delete restrict,
    quantity numeric default 1,
    cost_price numeric not null,
    received_quantity numeric default 0,
    created_at timestamptz default now()
  );

  -- Deshabilitar RLS para permitir operaciones sin autenticación (o crear políticas si se requiere)
  alter table courses disable row level security;
  alter table purchase_orders disable row level security;
  alter table purchase_order_items disable row level security;

*/