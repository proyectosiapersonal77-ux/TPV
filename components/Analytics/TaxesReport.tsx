import React, { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { db } from '../../db';
import { supabase } from '../../Supabase';
import { Download, FileText, Calculator } from 'lucide-react';

export default function TaxesReport() {
    const currentYear = new Date().getFullYear();
    const [year, setYear] = useState(currentYear);
    const [period, setPeriod] = useState<'Q1' | 'Q2' | 'Q3' | 'Q4' | 'YEAR'>('Q1');

    const { data: taxData, isLoading } = useQuery({
        queryKey: ['taxes', year, period],
        queryFn: async () => {
            let startDate: Date;
            let endDate: Date;

            if (period === 'YEAR') {
                startDate = new Date(year, 0, 1);
                endDate = new Date(year, 11, 31, 23, 59, 59);
            } else {
                const quarter = parseInt(period.replace('Q', ''));
                startDate = new Date(year, (quarter - 1) * 3, 1);
                endDate = new Date(year, quarter * 3, 0, 23, 59, 59);
            }

            // 1. IVA Repercutido (Sales)
            const orders = await db.orders
                .filter(o => {
                    const d = new Date(o.closed_at || o.created_at);
                    return d >= startDate && d <= endDate && o.status === 'paid';
                })
                .toArray();

            const orderItems = orders.flatMap(o => o.items || []);

            const products = await db.products.toArray();
            const productMap = new Map(products.map(p => [p.id, p]));

            let totalSales = 0;
            const outputTaxes: Record<number, { base: number, tax: number, total: number }> = {};

            orderItems.forEach(item => {
                const product = productMap.get(item.product_id);
                const taxRate = product?.tax_rate || 21;
                const itemTotal = item.price * item.quantity;
                const base = itemTotal / (1 + taxRate / 100);
                const taxAmount = itemTotal - base;

                totalSales += itemTotal;

                if (!outputTaxes[taxRate]) {
                    outputTaxes[taxRate] = { base: 0, tax: 0, total: 0 };
                }
                outputTaxes[taxRate].base += base;
                outputTaxes[taxRate].tax += taxAmount;
                outputTaxes[taxRate].total += itemTotal;
            });

            // 2. IVA Soportado (Purchases)
            const { data: purchaseOrdersData, error: poError } = await supabase
                .from('purchase_orders')
                .select(`
                    id,
                    supplier_id,
                    status,
                    created_at,
                    purchase_order_items (
                        id,
                        product_id,
                        quantity,
                        cost_price
                    )
                `)
                .gte('created_at', startDate.toISOString())
                .lte('created_at', endDate.toISOString())
                .in('status', ['received', 'paid', 'pending']);

            if (poError) {
                console.error("Error fetching purchase orders:", poError);
            }

            const purchaseOrders = purchaseOrdersData || [];
            
            const suppliers = await db.suppliers.toArray();
            const supplierMap = new Map(suppliers.map(s => [s.id, s]));

            let totalPurchases = 0;
            const inputTaxes: Record<number, { base: number, tax: number, total: number }> = {};
            
            // Modelo 347 (Operations > 3005.06€)
            const supplierTotals = new Map<string, { name: string, total: number }>();

            purchaseOrders.forEach(po => {
                const poItems = po.purchase_order_items || [];
                poItems.forEach((item: any) => {
                    const product = productMap.get(item.product_id);
                    const taxRate = product?.tax_rate || 21; // Assuming same tax rate for purchase as sale, or default to 21%
                    
                    // Assuming cost_price is BASE (without VAT)
                    const base = item.cost_price * item.quantity;
                    const taxAmount = base * (taxRate / 100);
                    const itemTotal = base + taxAmount;

                    totalPurchases += itemTotal;

                    if (!inputTaxes[taxRate]) {
                        inputTaxes[taxRate] = { base: 0, tax: 0, total: 0 };
                    }
                    inputTaxes[taxRate].base += base;
                    inputTaxes[taxRate].tax += taxAmount;
                    inputTaxes[taxRate].total += itemTotal;

                    // For Modelo 347
                    if (po.supplier_id) {
                        const supplier = supplierMap.get(po.supplier_id);
                        const supplierName = supplier?.name || 'Proveedor Desconocido';
                        
                        if (!supplierTotals.has(po.supplier_id)) {
                            supplierTotals.set(po.supplier_id, { name: supplierName, total: 0 });
                        }
                        supplierTotals.get(po.supplier_id)!.total += itemTotal;
                    }
                });
            });

            const modelo347 = Array.from(supplierTotals.values())
                .filter(s => s.total > 3005.06)
                .sort((a, b) => b.total - a.total);

            return {
                outputTaxes,
                inputTaxes,
                totalSales,
                totalPurchases,
                modelo347
            };
        }
    });

    const exportToCSV = () => {
        if (!taxData) return;

        let csvContent = "\uFEFF"; // BOM for Excel UTF-8
        
        // Header
        csvContent += `Informe de Impuestos - ${period} ${year}\n\n`;

        // IVA Repercutido
        csvContent += "IVA REPERCUTIDO (VENTAS)\n";
        csvContent += "Tipo IVA,Base Imponible,Cuota IVA,Total Facturado\n";
        Object.entries(taxData.outputTaxes).forEach(([rate, data]) => {
            csvContent += `${rate}%,${data.base.toFixed(2)},${data.tax.toFixed(2)},${data.total.toFixed(2)}\n`;
        });
        csvContent += "\n";

        // IVA Soportado
        csvContent += "IVA SOPORTADO (COMPRAS)\n";
        csvContent += "Tipo IVA,Base Imponible,Cuota IVA,Total Facturado\n";
        Object.entries(taxData.inputTaxes).forEach(([rate, data]) => {
            csvContent += `${rate}%,${data.base.toFixed(2)},${data.tax.toFixed(2)},${data.total.toFixed(2)}\n`;
        });
        csvContent += "\n";

        // Modelo 347
        csvContent += "MODELO 347 (OPERACIONES > 3005.06€)\n";
        csvContent += "Proveedor,Total Operaciones (IVA incl.)\n";
        if (taxData.modelo347.length > 0) {
            taxData.modelo347.forEach(s => {
                csvContent += `${s.name},${s.total.toFixed(2)}\n`;
            });
        } else {
            csvContent += "No hay operaciones que superen los 3005.06€ en este periodo.\n";
        }

        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.setAttribute("href", url);
        link.setAttribute("download", `impuestos_${period}_${year}.csv`);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    if (isLoading) {
        return <div className="flex justify-center items-center h-64"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-brand-accent"></div></div>;
    }

    return (
        <div className="space-y-6">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-brand-800 p-4 rounded-2xl border border-brand-700 shadow-lg">
                <div className="flex items-center gap-4">
                    <div className="bg-brand-900 p-2 rounded-lg border border-brand-700 flex items-center gap-2">
                        <select 
                            value={year} 
                            onChange={(e) => setYear(parseInt(e.target.value))}
                            className="bg-transparent text-white outline-none border-none text-sm font-bold"
                        >
                            {[currentYear, currentYear - 1, currentYear - 2].map(y => (
                                <option key={y} value={y} className="bg-brand-900">{y}</option>
                            ))}
                        </select>
                    </div>
                    <div className="bg-brand-900 p-2 rounded-lg border border-brand-700 flex items-center gap-2">
                        <select 
                            value={period} 
                            onChange={(e) => setPeriod(e.target.value as any)}
                            className="bg-transparent text-white outline-none border-none text-sm font-bold"
                        >
                            <option value="Q1" className="bg-brand-900">T1 (Ene-Mar)</option>
                            <option value="Q2" className="bg-brand-900">T2 (Abr-Jun)</option>
                            <option value="Q3" className="bg-brand-900">T3 (Jul-Sep)</option>
                            <option value="Q4" className="bg-brand-900">T4 (Oct-Dic)</option>
                            <option value="YEAR" className="bg-brand-900">Anual</option>
                        </select>
                    </div>
                </div>
                
                <button 
                    onClick={exportToCSV}
                    className="bg-brand-accent hover:bg-brand-accentHover text-white px-4 py-2 rounded-lg font-bold flex items-center gap-2 transition-colors"
                >
                    <Download size={18} /> Exportar CSV para Gestor
                </button>
            </div>

            {taxData && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* IVA Repercutido */}
                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-green-400">
                            <Calculator size={20} />
                            IVA Repercutido (Ventas)
                        </h3>
                        {Object.keys(taxData.outputTaxes).length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-brand-700 text-sm text-gray-400">
                                            <th className="pb-2">Tipo IVA</th>
                                            <th className="pb-2 text-right">Base Imponible</th>
                                            <th className="pb-2 text-right">Cuota IVA</th>
                                            <th className="pb-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-700/50">
                                        {Object.entries(taxData.outputTaxes).map(([rate, data]) => (
                                            <tr key={rate} className="text-sm">
                                                <td className="py-3 font-bold">{rate}%</td>
                                                <td className="py-3 text-right font-mono">{data.base.toFixed(2)}€</td>
                                                <td className="py-3 text-right font-mono text-brand-accent">{data.tax.toFixed(2)}€</td>
                                                <td className="py-3 text-right font-mono">{data.total.toFixed(2)}€</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-brand-700 font-bold">
                                            <td className="pt-3">TOTAL</td>
                                            <td className="pt-3 text-right font-mono">{Object.values(taxData.outputTaxes).reduce((sum, d) => sum + d.base, 0).toFixed(2)}€</td>
                                            <td className="pt-3 text-right font-mono text-brand-accent">{Object.values(taxData.outputTaxes).reduce((sum, d) => sum + d.tax, 0).toFixed(2)}€</td>
                                            <td className="pt-3 text-right font-mono">{Object.values(taxData.outputTaxes).reduce((sum, d) => sum + d.total, 0).toFixed(2)}€</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm text-center py-8">No hay ventas registradas en este periodo.</p>
                        )}
                    </div>

                    {/* IVA Soportado */}
                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg">
                        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-red-400">
                            <FileText size={20} />
                            IVA Soportado (Compras)
                        </h3>
                        {Object.keys(taxData.inputTaxes).length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-brand-700 text-sm text-gray-400">
                                            <th className="pb-2">Tipo IVA</th>
                                            <th className="pb-2 text-right">Base Imponible</th>
                                            <th className="pb-2 text-right">Cuota IVA</th>
                                            <th className="pb-2 text-right">Total</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-700/50">
                                        {Object.entries(taxData.inputTaxes).map(([rate, data]) => (
                                            <tr key={rate} className="text-sm">
                                                <td className="py-3 font-bold">{rate}%</td>
                                                <td className="py-3 text-right font-mono">{data.base.toFixed(2)}€</td>
                                                <td className="py-3 text-right font-mono text-red-400">{data.tax.toFixed(2)}€</td>
                                                <td className="py-3 text-right font-mono">{data.total.toFixed(2)}€</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                    <tfoot>
                                        <tr className="border-t-2 border-brand-700 font-bold">
                                            <td className="pt-3">TOTAL</td>
                                            <td className="pt-3 text-right font-mono">{Object.values(taxData.inputTaxes).reduce((sum, d) => sum + d.base, 0).toFixed(2)}€</td>
                                            <td className="pt-3 text-right font-mono text-red-400">{Object.values(taxData.inputTaxes).reduce((sum, d) => sum + d.tax, 0).toFixed(2)}€</td>
                                            <td className="pt-3 text-right font-mono">{Object.values(taxData.inputTaxes).reduce((sum, d) => sum + d.total, 0).toFixed(2)}€</td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        ) : (
                            <p className="text-gray-500 text-sm text-center py-8">No hay compras registradas en este periodo.</p>
                        )}
                    </div>

                    {/* Modelo 347 */}
                    <div className="bg-brand-800 p-6 rounded-2xl border border-brand-700 shadow-lg lg:col-span-2">
                        <h3 className="text-lg font-bold mb-2 flex items-center gap-2 text-blue-400">
                            <FileText size={20} />
                            Modelo 347 (Operaciones con Terceros)
                        </h3>
                        <p className="text-sm text-gray-400 mb-6">
                            Proveedores con los que las operaciones superan los 3.005,06 € (IVA incluido) en el periodo seleccionado.
                            {period !== 'YEAR' && <span className="text-yellow-500 ml-2">Nota: El Modelo 347 se presenta anualmente. Selecciona "Anual" para el informe oficial.</span>}
                        </p>
                        
                        {taxData.modelo347.length > 0 ? (
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="border-b border-brand-700 text-sm text-gray-400">
                                            <th className="pb-2">Proveedor</th>
                                            <th className="pb-2 text-right">Total Operaciones (IVA incl.)</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-brand-700/50">
                                        {taxData.modelo347.map((supplier, idx) => (
                                            <tr key={idx} className="text-sm">
                                                <td className="py-3 font-bold">{supplier.name}</td>
                                                <td className="py-3 text-right font-mono text-blue-400">{supplier.total.toFixed(2)}€</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        ) : (
                            <div className="bg-brand-900/50 rounded-xl p-8 text-center border border-brand-700/50">
                                <p className="text-gray-400">No hay proveedores que superen el límite de 3.005,06 € en este periodo.</p>
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
