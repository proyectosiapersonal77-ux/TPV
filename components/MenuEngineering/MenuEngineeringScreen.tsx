import React, { useState, useMemo } from 'react';
import { Lightbulb, Calculator, TrendingUp, AlertTriangle, RefreshCw, ChevronRight, Sparkles, ChevronLeft, X, CheckCircle, ChevronUp, ChevronDown } from 'lucide-react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { getAllProducts, getAllCategories, updateProduct } from '../../services/inventoryService';
import { generateMenuEngineeringStrategy } from '../../services/aiService';
import { Product, ProductCategory, ViewState } from '../../types';
import { formatCurrency } from '../../utils/formatters';
import Markdown from 'react-markdown';

interface Props {
    onNavigate: (view: ViewState) => void;
}

export const MenuEngineeringScreen: React.FC<Props> = ({ onNavigate }) => {
    const queryClient = useQueryClient();
    const [selectedCategory, setSelectedCategory] = useState<string>('all');
    const [targetMargin, setTargetMargin] = useState<number>(70);
    const [isCalculating, setIsCalculating] = useState(false);
    const [isGeneratingAI, setIsGeneratingAI] = useState(false);
    const [aiReport, setAiReport] = useState<string | null>(null);
    const [isConfirmingMassPrice, setIsConfirmingMassPrice] = useState(false);
    const [notification, setNotification] = useState<{title: string, message: string, type: 'success' | 'error'} | null>(null);

    const { data: products = [] } = useQuery({
        queryKey: ['products'],
        queryFn: getAllProducts
    });

    const { data: categories = [] } = useQuery({
        queryKey: ['categories'],
        queryFn: getAllCategories
    });

    const updateProductMutation = useMutation({
        mutationFn: ({ id, data }: { id: string, data: Partial<Product> }) => updateProduct(id, data),
        onSuccess: () => {
            queryClient.invalidateQueries({ queryKey: ['products'] });
        }
    });

    // Calculate actual costs for compound products
    const productsWithCalculatedCosts = useMemo(() => {
        return products.map(product => {
            if (product.is_compound && product.product_ingredients) {
                const calculatedCost = product.product_ingredients.reduce((acc, ing) => {
                    const child = products.find(p => p.id === ing.child_product_id);
                    const cost = child ? child.cost_price : 0;
                    const yieldPct = ing.yield_percentage || 100;
                    return acc + ((cost * ing.quantity) / (yieldPct / 100));
                }, 0);
                return { ...product, calculated_cost: calculatedCost };
            }
            return { ...product, calculated_cost: product.cost_price };
        });
    }, [products]);

    const filteredProducts = useMemo(() => {
        if (selectedCategory === 'all') return productsWithCalculatedCosts;
        return productsWithCalculatedCosts.filter(p => p.category_id === selectedCategory);
    }, [productsWithCalculatedCosts, selectedCategory]);

    const handleApplyMassPricing = () => {
        setIsConfirmingMassPrice(true);
    };

    const executeMassPricing = async () => {
        setIsConfirmingMassPrice(false);
        setIsCalculating(true);
        try {
            let updatedCount = 0;
            for (const product of filteredProducts) {
                const cost = product.calculated_cost || 0;
                if (cost > 0) {
                    // Margin = (PVP - Cost) / PVP  => PVP = Cost / (1 - Margin)
                    const newPvp = cost / (1 - (targetMargin / 100));
                    // Round to nearest 0.05 or 0.10 for cleaner prices
                    const roundedPvp = Math.ceil(newPvp * 10) / 10; 
                    
                    if (Math.abs(roundedPvp - product.selling_price) > 0.01) {
                        await updateProductMutation.mutateAsync({
                            id: product.id,
                            data: { selling_price: roundedPvp }
                        });
                        updatedCount++;
                    }
                }
            }
            setNotification({
                title: "Éxito",
                message: `Se han actualizado los precios de ${updatedCount} productos correctamente para alcanzar el ${targetMargin}% de margen.`,
                type: 'success'
            });
        } catch (error) {
            console.error("Error updating prices:", error);
            setNotification({
                title: "Error",
                message: "Hubo un error al actualizar los precios.",
                type: 'error'
            });
        } finally {
            setIsCalculating(false);
        }
    };

    const handleGenerateAI = async () => {
        setIsGeneratingAI(true);
        try {
            const dataToAnalyze = filteredProducts.filter(p => p.is_compound).map(p => {
                const cost = p.calculated_cost || 0;
                const pvp = p.selling_price || 0;
                return {
                    nombre: p.name,
                    coste_materia_prima: cost,
                    precio_venta: pvp,
                    margen_bruto_porcentaje: pvp > 0 ? ((pvp - cost) / pvp) * 100 : 0,
                    food_cost_porcentaje: pvp > 0 ? (cost / pvp) * 100 : 0
                };
            });
            
            if (dataToAnalyze.length === 0) {
                setNotification({
                    title: "Información",
                    message: "No hay productos compuestos (recetas) para analizar en esta categoría.",
                    type: 'error'
                });
                setIsGeneratingAI(false);
                return;
            }

            const report = await generateMenuEngineeringStrategy(dataToAnalyze);
            setAiReport(report);
        } catch (error: any) {
            setNotification({
                title: "Error IA",
                message: error.message || "Error al generar el informe.",
                type: 'error'
            });
        } finally {
            setIsGeneratingAI(false);
        }
    };

    return (
        <div className="flex flex-col h-full bg-brand-900 text-white animate-in fade-in">
            <header className="bg-brand-800 p-4 flex items-center justify-between border-b border-brand-700 shrink-0">
                <div className="flex items-center gap-4">
                    <button 
                        onClick={() => onNavigate('dashboard')}
                        className="w-12 h-12 bg-brand-700 rounded-xl flex items-center justify-center text-white hover:bg-brand-600 transition-colors"
                    >
                        <ChevronLeft size={24} />
                    </button>
                    <div>
                        <h1 className="text-2xl font-bold flex items-center gap-2">
                            <Lightbulb className="text-yellow-400" />
                            Ingeniería de Menú
                        </h1>
                        <p className="text-gray-400 text-sm mt-1">Optimiza tus precios, analiza costes y recibe consejos estratégicos con IA.</p>
                    </div>
                </div>
            </header>

            <div className="flex-1 p-6 overflow-y-auto">
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
                {/* Mass Pricing Tool */}
                <div className="bg-brand-800 rounded-2xl border border-brand-700 p-6 shadow-lg lg:col-span-2">
                    <div className="flex items-center gap-2 mb-6">
                        <Calculator className="text-brand-accent" size={24} />
                        <h2 className="text-xl font-bold">Cálculo Automático de PVP</h2>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-6">
                        <div>
                            <label className="block text-sm font-bold text-gray-400 uppercase mb-2">Categoría a actualizar</label>
                            <select 
                                className="w-full bg-brand-900 border border-brand-600 rounded-lg p-3 text-white outline-none focus:border-brand-accent"
                                value={selectedCategory}
                                onChange={(e) => setSelectedCategory(e.target.value)}
                            >
                                <option value="all">Todas las categorías</option>
                                {categories.map(c => (
                                    <option key={c.id} value={c.id}>{c.name}</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-gray-400 uppercase mb-2">Margen Objetivo (%)</label>
                            <div className="flex items-center gap-3 h-[52px]">
                                <div className="flex items-center justify-between w-auto min-w-[80px] shrink-0 h-full bg-brand-900 border border-brand-600 rounded-lg px-2 focus-within:border-brand-accent transition-colors">
                                    <div className="flex items-center flex-1 justify-center relative">
                                        <input 
                                            type="number" 
                                            min="1" 
                                            max="100"
                                            style={{ width: `${Math.max(1, String(targetMargin).length)}ch` }}
                                            className="bg-transparent text-white outline-none text-lg font-bold text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                                            value={targetMargin || ''}
                                            onChange={(e) => setTargetMargin(Number(e.target.value))}
                                            onBlur={(e) => {
                                                let val = Number(e.target.value);
                                                if (val < 1) val = 1;
                                                if (val > 100) val = 100;
                                                setTargetMargin(val);
                                            }}
                                        />
                                        <span className="text-gray-400 font-bold ml-0.5">%</span>
                                    </div>
                                    <div className="flex flex-col border-l border-brand-700 ml-2 pl-2">
                                        <button 
                                            onClick={() => setTargetMargin(m => Math.min(100, m + 1))}
                                            className="text-gray-500 hover:text-white transition-colors py-0.5"
                                        >
                                            <ChevronUp size={16} strokeWidth={3} />
                                        </button>
                                        <button 
                                            onClick={() => setTargetMargin(m => Math.max(1, m - 1))}
                                            className="text-gray-500 hover:text-white transition-colors py-0.5"
                                        >
                                            <ChevronDown size={16} strokeWidth={3} />
                                        </button>
                                    </div>
                                </div>
                                <button 
                                    onClick={handleApplyMassPricing}
                                    disabled={isCalculating || filteredProducts.length === 0}
                                    className="flex-1 h-full bg-brand-accent hover:bg-brand-accentHover text-white px-3 py-3 rounded-lg font-bold transition-colors disabled:opacity-50 flex items-center justify-center gap-2 whitespace-nowrap text-[13px] sm:text-sm md:text-base"
                                >
                                    {isCalculating ? <RefreshCw className="animate-spin" size={18} /> : <TrendingUp size={18} />}
                                    <span>Aplicar a {filteredProducts.length} prod.</span>
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div className="bg-brand-900/50 p-4 rounded-xl border border-brand-700">
                        <p className="text-sm text-gray-300">
                            <strong className="text-brand-accent">¿Cómo funciona?</strong> El sistema tomará el coste actual de la materia prima de cada producto (o el coste calculado de la receta) y ajustará el PVP para garantizar que obtengas exactamente el margen de beneficio indicado.
                        </p>
                    </div>
                </div>

                {/* AI Strategy Teaser */}
                <div className="bg-gradient-to-br from-brand-800 to-brand-900 rounded-2xl border border-yellow-500/30 p-6 shadow-lg relative overflow-hidden">
                    <div className="absolute top-0 right-0 p-4 opacity-10">
                        <Sparkles size={100} />
                    </div>
                    <div className="relative z-10">
                        <div className="flex items-center gap-2 mb-4">
                            <Sparkles className="text-yellow-400" size={24} />
                            <h2 className="text-xl font-bold text-yellow-400">Asesor IA</h2>
                        </div>
                        <p className="text-gray-300 text-sm mb-6 leading-relaxed">
                            Analizamos tu Matriz BCG (Estrellas, Vacas, Perros, Interrogantes) cruzando popularidad con rentabilidad para darte estrategias claras.
                        </p>
                        <button 
                            onClick={handleGenerateAI}
                            disabled={isGeneratingAI}
                            className="w-full bg-yellow-500/20 hover:bg-yellow-500/30 text-yellow-400 border border-yellow-500/50 py-3 rounded-lg font-bold transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                            {isGeneratingAI ? <RefreshCw className="animate-spin" size={20} /> : <Sparkles size={20} />}
                            {isGeneratingAI ? 'Generando...' : 'Generar Informe Estratégico'}
                        </button>
                    </div>
                </div>
            </div>

            {/* Food Cost Analysis Table */}
            <div className="bg-brand-800 rounded-2xl border border-brand-700 shadow-lg flex-1 flex flex-col overflow-hidden">
                <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-800/50">
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <AlertTriangle className="text-orange-400" size={20} />
                        Análisis de Food Cost (Recetas)
                    </h2>
                </div>
                <div className="flex-1 overflow-auto">
                    <table className="w-full text-left border-collapse">
                        <thead className="bg-brand-900/80 sticky top-0 z-10">
                            <tr>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-brand-700">Producto (Receta)</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-brand-700 text-right">Coste Materia Prima</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-brand-700 text-right">PVP Actual</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-brand-700 text-right">Margen Bruto</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-brand-700 text-right">Food Cost</th>
                                <th className="p-4 text-xs font-bold text-gray-400 uppercase tracking-wider border-b border-brand-700 text-center">Estado</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-brand-700/50">
                            {filteredProducts.filter(p => p.is_compound).map(product => {
                                const cost = product.calculated_cost || 0;
                                const pvp = product.selling_price || 0;
                                const margin = pvp > 0 ? ((pvp - cost) / pvp) * 100 : 0;
                                const foodCost = pvp > 0 ? (cost / pvp) * 100 : 0;
                                
                                let statusColor = "text-green-400";
                                let statusText = "Óptimo";
                                let statusTooltip = "Rentabilidad ideal. Coste de materia prima bajo control (< 28%).";
                                if (foodCost > 35) {
                                    statusColor = "text-red-400";
                                    statusText = "Peligro";
                                    statusTooltip = "Baja rentabilidad. Urge ajustar el escandallo o subir el PVP (> 35%).";
                                } else if (foodCost > 28) {
                                    statusColor = "text-yellow-400";
                                    statusText = "Revisar";
                                    statusTooltip = "Margen ajustado. Considera revisar porciones o precio (28% - 35%).";
                                }

                                return (
                                    <tr key={product.id} className="hover:bg-brand-700/20 transition-colors">
                                        <td className="p-4 font-medium">{product.name}</td>
                                        <td className="p-4 text-right font-mono text-gray-300">{formatCurrency(cost)}</td>
                                        <td className="p-4 text-right font-mono font-bold">{formatCurrency(pvp)}</td>
                                        <td className="p-4 text-right font-mono text-brand-accent">{margin.toFixed(2).replace('.', ',')}%</td>
                                        <td className={`p-4 text-right font-mono font-bold ${statusColor}`}>{foodCost.toFixed(2).replace('.', ',')}%</td>
                                        <td className="p-4 text-center">
                                            <span 
                                                title={statusTooltip}
                                                className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border cursor-help ${
                                                foodCost > 35 ? 'bg-red-400/10 text-red-400 border-red-400/20' : 
                                                foodCost > 28 ? 'bg-yellow-400/10 text-yellow-400 border-yellow-400/20' : 
                                                'bg-green-400/10 text-green-400 border-green-400/20'
                                            }`}>
                                                {statusText}
                                            </span>
                                        </td>
                                    </tr>
                                );
                            })}
                            {filteredProducts.filter(p => p.is_compound).length === 0 && (
                                <tr>
                                    <td colSpan={6} className="p-8 text-center text-gray-500">
                                        No hay productos compuestos (recetas) en esta categoría.
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
            </div>
            {/* AI Report Modal */}
            {aiReport && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-brand-900 border border-brand-700 rounded-2xl w-full max-w-4xl max-h-[90vh] flex flex-col shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-800/50 rounded-t-2xl">
                            <h2 className="text-2xl font-bold flex items-center gap-2 text-yellow-400">
                                <Sparkles size={24} />
                                Informe Estratégico (IA)
                            </h2>
                            <button 
                                onClick={() => setAiReport(null)}
                                className="text-gray-400 hover:text-white transition-colors bg-brand-800 p-2 rounded-lg"
                            >
                                <X size={24} />
                            </button>
                        </div>
                        <div className="p-8 overflow-y-auto flex-1 prose prose-invert prose-yellow max-w-none">
                            <Markdown>{aiReport}</Markdown>
                        </div>
                    </div>
                </div>
            )}

            {/* Confirm Mass Pricing Modal */}
            {isConfirmingMassPrice && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-brand-900 border border-brand-700 rounded-2xl w-full max-w-md flex flex-col shadow-2xl animate-in zoom-in-95">
                        <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-800/50 rounded-t-2xl">
                            <h2 className="text-xl font-bold flex items-center gap-2 text-white">
                                <AlertTriangle className="text-yellow-400" size={24} />
                                Confirmar Cambio
                            </h2>
                        </div>
                        <div className="p-6 text-gray-300">
                            ¿Estás seguro de que quieres actualizar el PVP de <strong className="text-white">{filteredProducts.length} productos</strong> para alcanzar un margen objetivo del <strong className="text-white">{targetMargin}%</strong>?
                            <br/><br/>
                            <span className="text-sm text-gray-400">Esta acción recalculará todos los precios basándose en el coste de materia prima.</span>
                        </div>
                        <div className="p-4 border-t border-brand-700 flex justify-end gap-3 bg-brand-800/30 rounded-b-2xl">
                            <button 
                                onClick={() => setIsConfirmingMassPrice(false)}
                                className="px-4 py-2 bg-brand-800 hover:bg-brand-700 text-white rounded-lg transition-colors border border-brand-600 font-medium"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={executeMassPricing}
                                className="px-4 py-2 bg-brand-accent hover:bg-brand-accentHover text-white rounded-lg transition-colors font-bold"
                            >
                                Sí, Actualizar Precios
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Notification Toast/Modal */}
            {notification && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-brand-900 border border-brand-700 rounded-2xl w-full max-w-sm flex flex-col shadow-2xl animate-in zoom-in-95 overflow-hidden">
                        <div className={`p-4 border-b flex justify-between items-center ${notification.type === 'success' ? 'bg-green-500/10 border-green-500/20' : 'bg-red-500/10 border-red-500/20'}`}>
                            <h2 className={`text-lg font-bold flex items-center gap-2 ${notification.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                                {notification.type === 'success' ? <CheckCircle size={20} /> : <AlertTriangle size={20} />}
                                {notification.title}
                            </h2>
                            <button 
                                onClick={() => setNotification(null)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <div className="p-6 text-gray-300 text-center">
                            {notification.message}
                        </div>
                        <div className="p-4 bg-brand-800/50">
                            <button 
                                onClick={() => setNotification(null)}
                                className="px-4 py-2 bg-brand-800 hover:bg-brand-700 text-white rounded-lg transition-colors border border-brand-600 w-full font-bold"
                            >
                                Aceptar
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
