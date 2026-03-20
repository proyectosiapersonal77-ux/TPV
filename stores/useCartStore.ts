import { create } from 'zustand';
import { Product, ProductVariant } from '../types';

export interface CartItem {
    tempId: string;
    product: Product;
    quantity: number;
    price: number;
    variant?: ProductVariant;
    notes?: string;
    course?: 'entrantes' | 'segundos' | 'postres' | 'bebidas' | 'otros';
}

interface CartState {
    items: CartItem[];
    activeTableId: string | null;
    
    addItem: (product: Product, variant?: ProductVariant, quantity?: number, notes?: string, extraPrice?: number, course?: 'entrantes' | 'segundos' | 'postres' | 'bebidas' | 'otros') => void;
    removeItem: (index: number) => void;
    updateQuantity: (index: number, delta: number) => void;
    clearCart: () => void;
    setActiveTable: (tableId: string | null) => void;
    total: () => number;
}

export const useCartStore = create<CartState>((set, get) => ({
    items: [],
    activeTableId: null,

    addItem: (product, variant, quantity = 1, notes = '', extraPrice = 0, course = 'otros') => {
        const basePrice = variant ? Number(variant.selling_price) : Number(product.selling_price);
        const price = basePrice + extraPrice;
        const variantName = variant ? variant.name : undefined;
        const currentItems = get().items;

        // Only group items if they have the exact same variant AND notes AND course
        const existingItemIndex = currentItems.findIndex(item => 
            item.product.id === product.id && 
            item.variant?.name === variantName &&
            item.notes === notes &&
            item.course === course
        );

        if (existingItemIndex >= 0) {
            const newItems = [...currentItems];
            newItems[existingItemIndex].quantity += quantity;
            set({ items: newItems });
        } else {
            set({
                items: [...currentItems, {
                    tempId: Math.random().toString(36).substr(2, 9),
                    product,
                    quantity,
                    price,
                    variant,
                    notes,
                    course
                }]
            });
        }
    },

    removeItem: (index) => {
        const newItems = [...get().items];
        newItems.splice(index, 1);
        set({ items: newItems });
    },

    updateQuantity: (index, delta) => {
        const newItems = [...get().items];
        const newQty = newItems[index].quantity + delta;
        if (newQty <= 0) {
            newItems.splice(index, 1);
        } else {
            newItems[index].quantity = newQty;
        }
        set({ items: newItems });
    },

    clearCart: () => set({ items: [] }),
    
    setActiveTable: (tableId) => set({ activeTableId: tableId }),

    total: () => {
        return get().items.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    }
}));