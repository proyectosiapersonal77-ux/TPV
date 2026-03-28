import React, { useState, useMemo } from 'react';
import { Clock, CheckCircle, AlertTriangle, RefreshCw, ChefHat, ArrowLeft, Loader2, Beer, Utensils } from 'lucide-react';
import * as OrderService from '../../services/orderService';
import * as InventoryService from '../../services/inventoryService';
import { OrderItem, ViewState, Product, ProductCategory } from '../../types';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { getAllTables } from '../../services/tableService';
import AdminNavigation from '../AdminNavigation';

import { useAuthStore } from '../../stores/useAuthStore';

interface KitchenDisplayProps {
    onBack: () => void;
    onNavigate: (view: ViewState) => void;
}

const KitchenDisplay: React.FC<KitchenDisplayProps> = ({ onBack, onNavigate }) => {
    const queryClient = useQueryClient();
    const { user } = useAuthStore();
    const [stationFilter, setStationFilter] = useState<'all' | 'kitchen' | 'bar'>('all');

    // Fetch products and categories to map items to stations
    const { data: products = [] } = useQuery({ queryKey: ['products'], queryFn: InventoryService.getAllProducts });
    const { data: categories = [] } = useQuery({ queryKey: ['categories'], queryFn: InventoryService.getAllCategories });

    // Fetch orders with polling (every 3 seconds) to ensure quick syncing
    const { data: orders = [], isLoading, refetch } = useQuery({
        queryKey: ['kitchenOrders'],
        queryFn: async () => {
            const orders = await OrderService.getKitchenOrders();
            // Enrich with table names if missing (local offline orders)
            const tables = await getAllTables();
            return orders.map(o => {
                if (!o.tables && o.table_id) {
                    const t = tables.find(t => t.id === o.table_id);
                    if (t) return { ...o, tables: { name: t.name } };
                }
                return o;
            });
        },
        refetchInterval: 3000, // Poll every 3 seconds
    });

    const getItemStation = (productId: string): 'kitchen' | 'bar' | 'none' => {
        const product = products.find(p => p.id === productId);
        if (!product) return 'none';
        const category = categories.find(c => c.id === product.category_id);
        return category?.kds_station || 'none';
    };

    const handleItemAction = async (item: OrderItem) => {
        if (user?.role === 'waiter') {
            return; // Waiters have read-only access to kitchen display
        }

        let nextStatus: any = 'ready';
        if (item.status === 'pending') nextStatus = 'ready'; 
        if (item.status === 'ready') nextStatus = 'served';

        try {
            await OrderService.updateOrderItemStatus(item.id, nextStatus);
            // Invalidate immediately to show change
            queryClient.invalidateQueries({ queryKey: ['kitchenOrders'] });
        } catch (err) {
            console.error(err);
        }
    };

    const getElapsedTime = (dateString: string) => {
        const diff = new Date().getTime() - new Date(dateString).getTime();
        const minutes = Math.floor(diff / 60000);
        return minutes;
    };

    return (
        <div className="h-screen bg-gray-900 text-white flex flex-col">
            <header className="bg-gray-800 p-4 shadow-md flex justify-between items-center border-b border-gray-700 shrink-0">
                <div className="flex items-center gap-4">
                     <button onClick={onBack} className="p-2 bg-gray-700 rounded-lg hover:bg-gray-600"><ArrowLeft size={20}/></button>
                     <h1 className="text-xl font-bold flex items-center gap-2">
                        {stationFilter === 'bar' ? <Beer className="text-blue-400" /> : <ChefHat className="text-orange-500" />}
                        KDS: {stationFilter === 'all' ? 'General' : stationFilter === 'kitchen' ? 'Cocina' : 'Barra'}
                     </h1>
                     
                     <div className="flex bg-gray-900 rounded-lg p-1 border border-gray-700 ml-4">
                        <button 
                            onClick={() => setStationFilter('all')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors ${stationFilter === 'all' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            TODO
                        </button>
                        <button 
                            onClick={() => setStationFilter('kitchen')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${stationFilter === 'kitchen' ? 'bg-orange-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Utensils size={12} /> COCINA
                        </button>
                        <button 
                            onClick={() => setStationFilter('bar')}
                            className={`px-3 py-1 text-xs font-bold rounded-md transition-colors flex items-center gap-1 ${stationFilter === 'bar' ? 'bg-blue-600 text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            <Beer size={12} /> BARRA
                        </button>
                     </div>
                </div>
                
                <div className="flex items-center gap-4 text-sm text-gray-400">
                     <AdminNavigation onNavigate={onNavigate} currentView="kitchen" />
                     <div className="hidden md:flex items-center gap-4">
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-green-500 rounded-full"></div> En tiempo</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-yellow-500 rounded-full"></div> +15 min</div>
                        <div className="flex items-center gap-1"><div className="w-3 h-3 bg-red-500 rounded-full"></div> +30 min</div>
                     </div>
                     <button onClick={() => refetch()} className="p-2 bg-gray-700 rounded-full hover:bg-white hover:text-gray-900 transition-colors"><RefreshCw size={18} /></button>
                </div>
            </header>

            <div className="flex-1 overflow-x-auto overflow-y-hidden p-4">
                {isLoading ? (
                    <div className="flex items-center justify-center h-full">
                        <Loader2 className="animate-spin w-12 h-12 text-orange-500" />
                    </div>
                ) : (
                    <div className="flex gap-4 h-full">
                        {orders.length === 0 && (
                            <div className="w-full flex items-center justify-center text-gray-500 text-2xl font-bold opacity-30">
                                NO HAY COMANDAS PENDIENTES
                            </div>
                        )}

                        {orders.map((order: any) => {
                            // Filter items based on station
                            const activeItems = order.items.filter((i: OrderItem) => {
                                if (i.status === 'served' || i.status === 'held') return false;
                                
                                if (stationFilter === 'all') return true;
                                
                                const station = getItemStation(i.product_id);
                                if (stationFilter === 'kitchen') return station === 'kitchen' || station === 'none'; // Default to kitchen if none
                                if (stationFilter === 'bar') return station === 'bar';
                                
                                return true;
                            });

                            if (activeItems.length === 0) return null;

                            // Find the oldest created_at among active items to calculate waiting time accurately for fired courses
                            const oldestItemTime = activeItems.reduce((oldest: string, item: OrderItem) => {
                                if (!item.created_at) return oldest;
                                return new Date(item.created_at) < new Date(oldest) ? item.created_at : oldest;
                            }, activeItems[0]?.created_at || order.created_at);

                            const waitingMins = getElapsedTime(oldestItemTime);
                            let headerColor = "bg-green-600";
                            if (waitingMins > 15) headerColor = "bg-yellow-600";
                            if (waitingMins > 30) headerColor = "bg-red-600 animate-pulse";

                            return (
                                <div key={order.id} className="min-w-[300px] w-[300px] bg-gray-800 rounded-xl overflow-hidden flex flex-col shadow-xl border border-gray-700 animate-in slide-in-from-right-4 duration-300">
                                    <div className={`${headerColor} p-3 flex justify-between items-center text-white font-bold`}>
                                        <span className="text-lg">{order.tables?.name || 'Mesa ?'}</span>
                                        <div className="flex items-center gap-1 bg-black/20 px-2 py-1 rounded text-sm">
                                            <Clock size={14} /> {waitingMins}m
                                        </div>
                                    </div>
                                    
                                    <div className="flex-1 overflow-y-auto p-2 space-y-2">
                                        {activeItems.map((item: OrderItem) => (
                                            <div 
                                                key={item.id} 
                                                className={`p-3 rounded-lg border-l-4 transition-all ${user?.role === 'waiter' ? 'cursor-default' : 'cursor-pointer hover:bg-gray-700'} ${item.status === 'ready' ? 'bg-green-900/20 border-green-500' : 'bg-gray-900 border-gray-600'}`}
                                                onClick={() => handleItemAction(item)}
                                            >
                                                <div className="flex justify-between items-start">
                                                    <span className="font-bold text-lg text-white leading-tight">{item.quantity}x {item.product_name}</span>
                                                    {item.status === 'ready' && <CheckCircle size={18} className="text-green-500 shrink-0 ml-2" />}
                                                </div>
                                                {item.course && item.course !== 'otros' && (
                                                    <div className="text-[10px] text-orange-400 uppercase font-bold mt-1">
                                                        {item.course}
                                                    </div>
                                                )}
                                                {item.variant_name && <div className="text-sm text-orange-400 font-medium">Format: {item.variant_name}</div>}
                                                {item.notes && <div className="mt-1 text-sm bg-red-900/30 text-red-200 p-1 rounded border border-red-900/50 flex items-start gap-1"><AlertTriangle size={12} className="mt-0.5 shrink-0"/> {item.notes}</div>}
                                            </div>
                                        ))}
                                    </div>

                                    <div className="p-2 bg-gray-900 text-center text-xs text-gray-500 uppercase font-mono border-t border-gray-700">
                                        #{order.id.slice(0,8)}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>
        </div>
    );
};

export default KitchenDisplay;