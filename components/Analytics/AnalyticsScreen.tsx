import React, { useState, useMemo } from 'react';
import { ChevronLeft, BarChart3, Calendar, Download, Printer, FileText, Banknote, CreditCard, Receipt, LayoutDashboard, PieChart as PieChartIcon, Star, HelpCircle, TrendingDown, TrendingUp } from 'lucide-react';
import { ViewState } from '../../types';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../db';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, LineChart, Line } from 'recharts';
import TaxesReport from './TaxesReport';

const COLORS = ['#3b82f6', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#14b8a6', '#f97316', '#6366f1'];

interface AnalyticsScreenProps {
    onNavigate: (view: ViewState) => void;
}

export default function AnalyticsScreen({ onNavigate }: AnalyticsScreenProps) {
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [activeTab, setActiveTab] = useState<'z-report' | 'dashboard' | 'taxes'>('dashboard');

    const { data: reportData, isLoading } = useQuery({
        queryKey: ['z-report', date],
        queryFn: async () => {
            // Get all orders for the selected date
            const startOfDay = new Date(date);
            startOfDay.setHours(0, 0, 0, 0);
            
            const endOfDay = new Date(date);
            endOfDay.setHours(23, 59, 59, 999);

            const orders = await db.orders
                .filter(o => {
                    const orderDate = new Date(o.closed_at || o.created_at);
                    return orderDate >= startOfDay && orderDate <= endOfDay && o.status === 'paid';
                })
                .toArray();

            // Get all order items for these orders
            const orderItems = orders.flatMap(o => o.items || []);

            // Get products to calculate taxes
            const productIds = [...new Set(orderItems.map(item => item.product_id))].filter(Boolean) as string[];
            const products = await db.products
                .where('id')
                .anyOf(productIds)
                .toArray();
            
            const productMap = new Map(products.map(p => [p.id, p]));

            // Fetch extra data for dashboard
            const employees = await db.employees.toArray();
            const employeeMap = new Map(employees.map(e => [e.id, e.name]));

            const tables = await db.restaurantTables.toArray();
            const tableMap = new Map(tables.map(t => [t.id, t]));

            const categories = await db.categories.toArray();
            const categoryMap = new Map(categories.map(c => [c.id, c.name]));

            // Calculate metrics
            let totalSales = 0;
            let netSales = 0;
            let totalCost = 0;
            let cashSales = 0;
            let cardSales = 0;
            let otherSales = 0;
            const taxes: Record<number, { base: number, tax: number, total: number }> = {};

            const salesByHourArray = Array.from({ length: 24 }, (_, i) => ({
                hour: `${i.toString().padStart(2, '0')}:00`,
                sales: 0,
                orders: 0
            }));

            const salesByWaiterMap = new Map<string, number>();
            const salesByZoneMap = new Map<string, number>();
            const salesByCategoryMap = new Map<string, number>();
            
            // For BCG Matrix
            const productPerformanceMap = new Map<string, { id: string, name: string, quantity: number, netRevenue: number, totalCost: number }>();

            orders.forEach(order => {
                totalSales += order.total;
                if (order.payment_method === 'cash') cashSales += order.total;
                else if (order.payment_method === 'card') cardSales += order.total;
                else otherSales += order.total;

                // Hour
                const orderDate = new Date(order.closed_at || order.created_at);
                const hour = orderDate.getHours();
                salesByHourArray[hour].sales += order.total;
                salesByHourArray[hour].orders += 1;

                // Waiter
                const waiterName = employeeMap.get(order.employee_id) || 'Desconocido';
                salesByWaiterMap.set(waiterName, (salesByWaiterMap.get(waiterName) || 0) + order.total);

                // Zone
                const table = tableMap.get(order.table_id);
                const zoneName = table?.zone || 'Barra/Sin Zona';
                salesByZoneMap.set(zoneName, (salesByZoneMap.get(zoneName) || 0) + order.total);
            });

            orderItems.forEach(item => {
                const product = productMap.get(item.product_id);
                const taxRate = product?.tax_rate || 21; // Default to 21% if not found
                
                const itemTotal = item.price * item.quantity;
                // Assuming price includes tax. Base = Total / (1 + TaxRate/100)
                const base = itemTotal / (1 + taxRate / 100);
                const taxAmount = itemTotal - base;

                netSales += base;

                // Calculate cost
                let itemCost = 0;
                if (product) {
                    if (item.variant_name && product.variants) {
                        const variant = product.variants.find(v => v.name === item.variant_name);
                        itemCost = (variant?.cost_price || product.cost_price || 0) * item.quantity;
                    } else {
                        itemCost = (product.cost_price || 0) * item.quantity;
                    }
                }
                totalCost += itemCost;

                if (!taxes[taxRate]) {
                    taxes[taxRate] = { base: 0, tax: 0, total: 0 };
                }
                taxes[taxRate].base += base;
                taxes[taxRate].tax += taxAmount;
                taxes[taxRate].total += itemTotal;

                // Category
                const categoryName = product?.category_id ? (categoryMap.get(product.category_id) || 'Sin Categoría') : 'Sin Categoría';
                salesByCategoryMap.set(categoryName, (salesByCategoryMap.get(categoryName) || 0) + itemTotal);

                // BCG Matrix Data
                const productName = product?.name || 'Producto Desconocido';
                const productId = item.product_id;
                if (!productPerformanceMap.has(productId)) {
                    productPerformanceMap.set(productId, { id: productId, name: productName, quantity: 0, netRevenue: 0, totalCost: 0 });
                }
                const perf = productPerformanceMap.get(productId)!;
                perf.quantity += item.quantity;
                perf.netRevenue += base;
                perf.totalCost += itemCost;
            });

            // Calculate BCG Matrix
            const productPerformance = Array.from(productPerformanceMap.values()).map(p => {
                const margin = p.netRevenue - p.totalCost;
                const unitMargin = p.quantity > 0 ? margin / p.quantity : 0;
                return { ...p, margin, unitMargin };
            });

            const totalQuantitySold = productPerformance.reduce((sum, p) => sum + p.quantity, 0);
            const totalMargin = productPerformance.reduce((sum, p) => sum + p.margin, 0);
            const uniqueProductsCount = productPerformance.length;

            const avgQuantity = uniqueProductsCount > 0 ? totalQuantitySold / uniqueProductsCount : 0;
            const avgMargin = uniqueProductsCount > 0 ? totalMargin / uniqueProductsCount : 0;

            const bcgMatrix = productPerformance.map(p => {
                let category = 'Perro'; // Low Pop, Low Prof
                if (p.quantity >= avgQuantity && p.unitMargin >= avgMargin) {
                    category = 'Estrella'; // High Pop, High Prof
                } else if (p.quantity >= avgQuantity && p.unitMargin < avgMargin) {
                    category = 'Vaca'; // High Pop, Low Prof
                } else if (p.quantity < avgQuantity && p.unitMargin >= avgMargin) {
                    category = 'Interrogante'; // Low Pop, High Prof
                }
                return { ...p, category };
            }).sort((a, b) => b.margin - a.margin); // Sort by total margin descending

            const salesByWaiter = Array.from(salesByWaiterMap.entries()).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales);
            const salesByZone = Array.from(salesByZoneMap.entries()).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales);
            const salesByCategory = Array.from(salesByCategoryMap.entries()).map(([name, sales]) => ({ name, sales })).sort((a, b) => b.sales - a.sales);

            // Get Cash Register movements for the day
            const registers = await db.cash_registers
                .filter(r => {
                    const openedAt = new Date(r.opened_at);
                    return openedAt >= startOfDay && openedAt <= endOfDay;
                })
                .toArray();

            let totalIn = 0;
            let totalOut = 0;
            let expectedCash = 0;
            let actualCash = 0;
            let openingBalance = 0;

            if (registers.length > 0) {
                const registerIds = registers.map(r => r.id);
                const movements = await db.cash_movements
                    .where('register_id')
                    .anyOf(registerIds)
                    .toArray();

                movements.forEach(m => {
                    if (m.type === 'in') totalIn += m.amount;
                    if (m.type === 'out') totalOut += m.amount;
                });

                registers.forEach(r => {
                    openingBalance += r.opening_balance;
                    if (r.status === 'closed') {
                        actualCash += (r.closing_balance || 0);
                    }
                });
                
                expectedCash = openingBalance + totalIn - totalOut + cashSales;
            }

            return {
                totalSales,
                netSales,
                totalCost,
                grossProfit: netSales - totalCost,
                grossMargin: netSales > 0 ? ((netSales - totalCost) / netSales) * 100 : 0,
                cashSales,
                cardSales,
                otherSales,
                taxes,
                cashRegister: {
                    openingBalance,
                    totalIn,
                    totalOut,
                    expectedCash,
                    actualCash,
                    difference: actualCash - expectedCash,
                    hasClosedRegister: registers.some(r => r.status === 'closed')
                },
                orderCount: orders.length,
                salesByHour: salesByHourArray,
                salesByWaiter,
                salesByZone,
                salesByCategory,
                bcgMatrix
            };
        }
    });

    const handlePrint = () => {
        window.print();
    };

    return (
        <div className="flex flex-col h-full bg-brand-900 text-white animate-in fade-in">
            <header className="bg-brand-800 p-4 flex items-center justify-between border-b border-brand-700 shrink-0 print:hidden">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => onNavigate('dashboard')}
                        className="w-12 h-12 bg-brand-700 rounded-xl flex items-center justify-center text-white hover:bg-brand-600 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <BarChart3 className="text-brand-accent" />
                            Finanzas y Analítica
                        </h1>
                        <div className="flex gap-4 mt-2">
                            <button 
                                onClick={() => setActiveTab('dashboard')}
                                className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'dashboard' ? 'border-brand-accent text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                            >
                                Dashboard
                            </button>
                            <button 
                                onClick={() => setActiveTab('z-report')}
                                className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'z-report' ? 'border-brand-accent text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                            >
                                Cierre Z
                            </button>
                            <button 
                                onClick={() => setActiveTab('taxes')}
                                className={`text-sm font-bold pb-1 border-b-2 transition-colors ${activeTab === 'taxes' ? 'border-brand-accent text-white' : 'border-transparent text-gray-400 hover:text-gray-200'}`}
                            >
                                Impuestos
                            </button>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-brand-900 border border-brand-600 rounded-lg p-2">
                        <Calendar size={18} className="text-gray-400" />
                        <input 
                            type="date" 
                            value={date}
                            onChange={(e) => setDate(e.target.value)}
                            className="bg-transparent text-white outline-none border-none text-sm font-bold disabled:opacity-50"
                            disabled={activeTab === 'taxes'}
                        />
                    </div>
                    {activeTab === 'z-report' && (
                        <button onClick={handlePrint} className="bg-brand-accent hover:bg-brand-accentHover text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors">
                            <Printer size={18} /> Imprimir Z
                        </button>
                    )}
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6 print:p-0 print:bg-white print:text-black">
                {isLoading ? (
                    <div className="flex justify-center items-center h-full">
                        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div>
                    </div>
                ) : reportData ? (
                    <div className="max-w-6xl mx-auto space-y-6" id="z-report-content">
                        
                        {activeTab === 'dashboard' && (
                            <div className="space-y-6">
                                {/* KPIs */}
                                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <p className="text-sm text-gray-400 font-bold uppercase mb-1">Ventas Totales</p>
                                        <p className="text-3xl font-mono font-bold text-white">{reportData.totalSales.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <p className="text-sm text-gray-400 font-bold uppercase mb-1">Tickets</p>
                                        <p className="text-3xl font-mono font-bold text-white">{reportData.orderCount}</p>
                                    </div>
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <p className="text-sm text-gray-400 font-bold uppercase mb-1">Ticket Medio</p>
                                        <p className="text-3xl font-mono font-bold text-white">
                                            {reportData.orderCount > 0 ? (reportData.totalSales / reportData.orderCount).toFixed(2) : '0.00'}€
                                        </p>
                                    </div>
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <p className="text-sm text-gray-400 font-bold uppercase mb-1">Efectivo / Tarjeta</p>
                                        <div className="flex gap-4">
                                            <p className="text-xl font-mono font-bold text-green-400">{reportData.cashSales.toFixed(2)}€</p>
                                            <p className="text-xl font-mono font-bold text-blue-400">{reportData.cardSales.toFixed(2)}€</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Profitability KPIs */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <p className="text-sm text-gray-400 font-bold uppercase mb-1">Coste Total (Inventario)</p>
                                        <p className="text-3xl font-mono font-bold text-red-400">{reportData.totalCost.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <p className="text-sm text-gray-400 font-bold uppercase mb-1">Beneficio Bruto</p>
                                        <p className="text-3xl font-mono font-bold text-green-400">{reportData.grossProfit.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <p className="text-sm text-gray-400 font-bold uppercase mb-1">Margen Bruto</p>
                                        <p className="text-3xl font-mono font-bold text-brand-accent">{reportData.grossMargin.toFixed(2)}%</p>
                                    </div>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                                    {/* Ventas por Hora */}
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <BarChart3 className="text-brand-accent" size={20} />
                                            Ventas por Hora
                                        </h3>
                                        <div className="w-full">
                                            {reportData.totalSales > 0 ? (
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <BarChart data={reportData.salesByHour}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" vertical={false} />
                                                        <XAxis dataKey="hour" stroke="#9ca3af" fontSize={12} tickMargin={10} />
                                                        <YAxis stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `${value}€`} />
                                                        <Tooltip 
                                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                                            itemStyle={{ color: '#fff' }}
                                                            formatter={(value: number) => [`${value.toFixed(2)}€`, 'Ventas']}
                                                        />
                                                        <Bar dataKey="sales" fill="#3b82f6" radius={[4, 4, 0, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-gray-500 text-sm">No hay datos para mostrar</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ventas por Categoría */}
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <PieChartIcon className="text-brand-accent" size={20} />
                                            Ventas por Categoría
                                        </h3>
                                        <div className="flex items-center w-full">
                                            {reportData.totalSales > 0 ? (
                                                <>
                                                    <div className="w-1/2">
                                                        <ResponsiveContainer width="100%" height={250}>
                                                            <PieChart>
                                                                <Pie
                                                                    data={reportData.salesByCategory}
                                                                    cx="50%"
                                                                    cy="50%"
                                                                    innerRadius={60}
                                                                    outerRadius={80}
                                                                    paddingAngle={5}
                                                                    dataKey="sales"
                                                                >
                                                                    {reportData.salesByCategory.map((entry, index) => (
                                                                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                                                                    ))}
                                                                </Pie>
                                                                <Tooltip 
                                                                    contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                                                    formatter={(value: number) => [`${value.toFixed(2)}€`, 'Ventas']}
                                                                />
                                                            </PieChart>
                                                        </ResponsiveContainer>
                                                    </div>
                                                    <div className="w-1/2 pl-4 max-h-full overflow-y-auto">
                                                        {reportData.salesByCategory.map((cat, idx) => (
                                                            <div key={idx} className="flex items-center justify-between mb-2 text-sm">
                                                                <div className="flex items-center gap-2">
                                                                    <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }}></div>
                                                                    <span className="truncate max-w-[100px]" title={cat.name}>{cat.name}</span>
                                                                </div>
                                                                <span className="font-mono font-bold">{cat.sales.toFixed(2)}€</span>
                                                            </div>
                                                        ))}
                                                    </div>
                                                </>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">No hay datos para mostrar</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ventas por Camarero */}
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <BarChart3 className="text-brand-accent" size={20} />
                                            Ventas por Camarero
                                        </h3>
                                        <div className="w-full">
                                            {reportData.totalSales > 0 ? (
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <BarChart data={reportData.salesByWaiter} layout="vertical" margin={{ left: 40 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                                                        <XAxis type="number" stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `${value}€`} />
                                                        <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
                                                        <Tooltip 
                                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                                            formatter={(value: number) => [`${value.toFixed(2)}€`, 'Ventas']}
                                                        />
                                                        <Bar dataKey="sales" fill="#10b981" radius={[0, 4, 4, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-gray-500 text-sm">No hay datos para mostrar</div>
                                            )}
                                        </div>
                                    </div>

                                    {/* Ventas por Zona */}
                                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                            <LayoutDashboard className="text-brand-accent" size={20} />
                                            Ventas por Zona
                                        </h3>
                                        <div className="w-full">
                                            {reportData.totalSales > 0 ? (
                                                <ResponsiveContainer width="100%" height={250}>
                                                    <BarChart data={reportData.salesByZone} layout="vertical" margin={{ left: 40 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" horizontal={false} />
                                                        <XAxis type="number" stroke="#9ca3af" fontSize={12} tickFormatter={(value) => `${value}€`} />
                                                        <YAxis dataKey="name" type="category" stroke="#9ca3af" fontSize={12} width={80} />
                                                        <Tooltip 
                                                            contentStyle={{ backgroundColor: '#1f2937', borderColor: '#374151', color: '#fff' }}
                                                            formatter={(value: number) => [`${value.toFixed(2)}€`, 'Ventas']}
                                                        />
                                                        <Bar dataKey="sales" fill="#f59e0b" radius={[0, 4, 4, 0]} />
                                                    </BarChart>
                                                </ResponsiveContainer>
                                            ) : (
                                                <div className="h-full flex items-center justify-center text-gray-500 text-sm">No hay datos para mostrar</div>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                {/* Ingeniería de Menú (Matriz BCG) */}
                                <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2">
                                        <Star className="text-brand-accent" size={20} />
                                        Ingeniería de Menú (Matriz BCG)
                                    </h3>
                                    <p className="text-sm text-gray-400 mb-6">
                                        Análisis de popularidad (cantidad vendida) vs. rentabilidad (margen de beneficio por unidad).
                                    </p>
                                    
                                    {reportData.totalSales > 0 && reportData.bcgMatrix && reportData.bcgMatrix.length > 0 ? (
                                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                            {/* Estrellas */}
                                            <div className="bg-brand-900 p-4 rounded-xl border border-yellow-500/30">
                                                <div className="flex items-center gap-2 mb-3 text-yellow-500">
                                                    <Star size={18} className="fill-current" />
                                                    <h4 className="font-bold">Estrellas</h4>
                                                </div>
                                                <p className="text-xs text-gray-400 mb-3">Alta Popularidad, Alta Rentabilidad. ¡Promociónalos!</p>
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                    {reportData.bcgMatrix.filter(p => p.category === 'Estrella').map(p => (
                                                        <div key={p.id} className="bg-brand-800 p-2 rounded text-sm flex justify-between items-center">
                                                            <span className="truncate max-w-[120px]" title={p.name}>{p.name}</span>
                                                            <span className="font-mono text-green-400">{p.margin.toFixed(2)}€</span>
                                                        </div>
                                                    ))}
                                                    {reportData.bcgMatrix.filter(p => p.category === 'Estrella').length === 0 && (
                                                        <p className="text-xs text-gray-500 italic">No hay productos estrella</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Vacas */}
                                            <div className="bg-brand-900 p-4 rounded-xl border border-blue-500/30">
                                                <div className="flex items-center gap-2 mb-3 text-blue-400">
                                                    <Banknote size={18} />
                                                    <h4 className="font-bold">Vacas</h4>
                                                </div>
                                                <p className="text-xs text-gray-400 mb-3">Alta Popularidad, Baja Rentabilidad. Mantén calidad, intenta reducir costes.</p>
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                    {reportData.bcgMatrix.filter(p => p.category === 'Vaca').map(p => (
                                                        <div key={p.id} className="bg-brand-800 p-2 rounded text-sm flex justify-between items-center">
                                                            <span className="truncate max-w-[120px]" title={p.name}>{p.name}</span>
                                                            <span className="font-mono text-green-400">{p.margin.toFixed(2)}€</span>
                                                        </div>
                                                    ))}
                                                    {reportData.bcgMatrix.filter(p => p.category === 'Vaca').length === 0 && (
                                                        <p className="text-xs text-gray-500 italic">No hay productos vaca</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Interrogantes */}
                                            <div className="bg-brand-900 p-4 rounded-xl border border-purple-500/30">
                                                <div className="flex items-center gap-2 mb-3 text-purple-400">
                                                    <HelpCircle size={18} />
                                                    <h4 className="font-bold">Interrogantes</h4>
                                                </div>
                                                <p className="text-xs text-gray-400 mb-3">Baja Popularidad, Alta Rentabilidad. Necesitan más visibilidad o promoción.</p>
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                    {reportData.bcgMatrix.filter(p => p.category === 'Interrogante').map(p => (
                                                        <div key={p.id} className="bg-brand-800 p-2 rounded text-sm flex justify-between items-center">
                                                            <span className="truncate max-w-[120px]" title={p.name}>{p.name}</span>
                                                            <span className="font-mono text-green-400">{p.margin.toFixed(2)}€</span>
                                                        </div>
                                                    ))}
                                                    {reportData.bcgMatrix.filter(p => p.category === 'Interrogante').length === 0 && (
                                                        <p className="text-xs text-gray-500 italic">No hay productos interrogante</p>
                                                    )}
                                                </div>
                                            </div>

                                            {/* Perros */}
                                            <div className="bg-brand-900 p-4 rounded-xl border border-red-500/30">
                                                <div className="flex items-center gap-2 mb-3 text-red-400">
                                                    <TrendingDown size={18} />
                                                    <h4 className="font-bold">Perros</h4>
                                                </div>
                                                <p className="text-xs text-gray-400 mb-3">Baja Popularidad, Baja Rentabilidad. Considera eliminarlos del menú.</p>
                                                <div className="space-y-2 max-h-48 overflow-y-auto pr-2">
                                                    {reportData.bcgMatrix.filter(p => p.category === 'Perro').map(p => (
                                                        <div key={p.id} className="bg-brand-800 p-2 rounded text-sm flex justify-between items-center">
                                                            <span className="truncate max-w-[120px]" title={p.name}>{p.name}</span>
                                                            <span className="font-mono text-green-400">{p.margin.toFixed(2)}€</span>
                                                        </div>
                                                    ))}
                                                    {reportData.bcgMatrix.filter(p => p.category === 'Perro').length === 0 && (
                                                        <p className="text-xs text-gray-500 italic">No hay productos perro</p>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ) : (
                                        <div className="h-32 flex items-center justify-center text-gray-500 text-sm">No hay datos suficientes para calcular la matriz BCG</div>
                                    )}
                                </div>
                            </div>
                        )}

                        {activeTab === 'taxes' && (
                            <TaxesReport />
                        )}

                        {activeTab === 'z-report' && (
                            <>
                                <div className="hidden print:block text-center mb-8 border-b-2 border-black pb-4">
                            <h1 className="text-3xl font-bold uppercase tracking-widest">Cierre de Caja (Z)</h1>
                            <p className="text-lg mt-2 font-mono">Fecha: {new Date(date).toLocaleDateString()}</p>
                        </div>

                        {/* Resumen de Ventas */}
                        <div className="bg-brand-800 print:bg-white rounded-2xl p-6 border border-brand-700 print:border-gray-300 shadow-xl print:shadow-none">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 print:text-black">
                                <Receipt className="text-brand-accent print:text-black" />
                                Resumen de Ventas
                            </h2>
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                                <div className="bg-brand-900 print:bg-gray-50 p-4 rounded-xl border border-brand-600 print:border-gray-200">
                                    <p className="text-xs text-gray-400 print:text-gray-600 uppercase font-bold mb-1">Total Ventas</p>
                                    <p className="text-2xl font-mono font-bold text-white print:text-black">{reportData.totalSales.toFixed(2)}€</p>
                                </div>
                                <div className="bg-brand-900 print:bg-gray-50 p-4 rounded-xl border border-brand-600 print:border-gray-200">
                                    <p className="text-xs text-gray-400 print:text-gray-600 uppercase font-bold mb-1">Efectivo</p>
                                    <p className="text-xl font-mono font-bold text-green-400 print:text-black">{reportData.cashSales.toFixed(2)}€</p>
                                </div>
                                <div className="bg-brand-900 print:bg-gray-50 p-4 rounded-xl border border-brand-600 print:border-gray-200">
                                    <p className="text-xs text-gray-400 print:text-gray-600 uppercase font-bold mb-1">Tarjeta</p>
                                    <p className="text-xl font-mono font-bold text-blue-400 print:text-black">{reportData.cardSales.toFixed(2)}€</p>
                                </div>
                                <div className="bg-brand-900 print:bg-gray-50 p-4 rounded-xl border border-brand-600 print:border-gray-200">
                                    <p className="text-xs text-gray-400 print:text-gray-600 uppercase font-bold mb-1">Tickets</p>
                                    <p className="text-xl font-mono font-bold text-white print:text-black">{reportData.orderCount}</p>
                                </div>
                            </div>

                            {/* Desglose de Impuestos */}
                            <div className="mt-8">
                                <h3 className="text-sm font-bold text-gray-400 print:text-gray-600 uppercase mb-4 border-b border-brand-700 print:border-gray-300 pb-2">Desglose de Impuestos (IVA)</h3>
                                <div className="overflow-x-auto">
                                    <table className="w-full text-left text-sm">
                                        <thead>
                                            <tr className="text-gray-400 print:text-gray-600 border-b border-brand-700 print:border-gray-300">
                                                <th className="py-2 font-medium">Tipo de IVA</th>
                                                <th className="py-2 font-medium text-right">Base Imponible</th>
                                                <th className="py-2 font-medium text-right">Cuota IVA</th>
                                                <th className="py-2 font-medium text-right">Total</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {Object.entries(reportData.taxes).map(([rate, data]) => (
                                                <tr key={rate} className="border-b border-brand-800/50 print:border-gray-100">
                                                    <td className="py-3 font-bold">{rate}%</td>
                                                    <td className="py-3 text-right font-mono">{data.base.toFixed(2)}€</td>
                                                    <td className="py-3 text-right font-mono">{data.tax.toFixed(2)}€</td>
                                                    <td className="py-3 text-right font-mono font-bold">{data.total.toFixed(2)}€</td>
                                                </tr>
                                            ))}
                                            {Object.keys(reportData.taxes).length === 0 && (
                                                <tr>
                                                    <td colSpan={4} className="py-4 text-center text-gray-500 italic">No hay ventas registradas</td>
                                                </tr>
                                            )}
                                        </tbody>
                                    </table>
                                </div>
                            </div>
                        </div>

                        {/* Cuadre de Caja */}
                        <div className="bg-brand-800 print:bg-white rounded-2xl p-6 border border-brand-700 print:border-gray-300 shadow-xl print:shadow-none">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2 print:text-black">
                                <Banknote className="text-brand-accent print:text-black" />
                                Cuadre de Efectivo
                            </h2>
                            
                            <div className="space-y-3 font-mono text-sm">
                                <div className="flex justify-between py-2 border-b border-brand-700/50 print:border-gray-200">
                                    <span className="text-gray-300 print:text-gray-700">Fondo Inicial de Caja</span>
                                    <span className="font-bold">{reportData.cashRegister.openingBalance.toFixed(2)}€</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-brand-700/50 print:border-gray-200">
                                    <span className="text-gray-300 print:text-gray-700">Ventas en Efectivo</span>
                                    <span className="font-bold text-green-400 print:text-black">+{reportData.cashSales.toFixed(2)}€</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-brand-700/50 print:border-gray-200">
                                    <span className="text-gray-300 print:text-gray-700">Entradas Manuales</span>
                                    <span className="font-bold text-green-400 print:text-black">+{reportData.cashRegister.totalIn.toFixed(2)}€</span>
                                </div>
                                <div className="flex justify-between py-2 border-b border-brand-700/50 print:border-gray-200">
                                    <span className="text-gray-300 print:text-gray-700">Salidas Manuales</span>
                                    <span className="font-bold text-red-400 print:text-black">-{reportData.cashRegister.totalOut.toFixed(2)}€</span>
                                </div>
                                
                                <div className="flex justify-between py-4 mt-4 bg-brand-900/50 print:bg-gray-100 px-4 rounded-lg border border-brand-600 print:border-gray-300">
                                    <span className="font-bold uppercase text-brand-accent print:text-black">Total Efectivo Esperado</span>
                                    <span className="font-bold text-lg text-brand-accent print:text-black">{reportData.cashRegister.expectedCash.toFixed(2)}€</span>
                                </div>

                                {reportData.cashRegister.hasClosedRegister && (
                                    <>
                                        <div className="flex justify-between py-2 mt-4 border-b border-brand-700/50 print:border-gray-200">
                                            <span className="text-gray-300 print:text-gray-700">Efectivo Real (Arqueo)</span>
                                            <span className="font-bold">{reportData.cashRegister.actualCash.toFixed(2)}€</span>
                                        </div>
                                        <div className={`flex justify-between py-3 px-4 mt-2 rounded-lg font-bold ${
                                            reportData.cashRegister.difference === 0 
                                                ? 'bg-green-500/20 text-green-400 print:bg-white print:text-black print:border print:border-gray-300' 
                                                : 'bg-red-500/20 text-red-400 print:bg-white print:text-black print:border print:border-gray-300'
                                        }`}>
                                            <span className="uppercase">Descuadre</span>
                                            <span>
                                                {reportData.cashRegister.difference > 0 ? '+' : ''}
                                                {reportData.cashRegister.difference.toFixed(2)}€
                                            </span>
                                        </div>
                                    </>
                                )}
                                {!reportData.cashRegister.hasClosedRegister && (
                                    <div className="text-center py-4 text-yellow-500 bg-yellow-500/10 rounded-lg mt-4 print:hidden">
                                        La caja aún no ha sido cerrada hoy.
                                    </div>
                                )}
                            </div>
                        </div>
                        </>
                        )}

                    </div>
                ) : null}
            </div>
            
            {/* Print Styles */}
            <style dangerouslySetInnerHTML={{__html: `
                @media print {
                    body * {
                        visibility: hidden;
                    }
                    #z-report-content, #z-report-content * {
                        visibility: visible;
                    }
                    #z-report-content {
                        position: absolute;
                        left: 0;
                        top: 0;
                        width: 100%;
                    }
                }
            `}} />
        </div>
    );
}
