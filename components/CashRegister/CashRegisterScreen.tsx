import React, { useState, useEffect } from 'react';
import { 
    Banknote, CreditCard, ArrowDownCircle, ArrowUpCircle, 
    Lock, Unlock, History, Loader2, AlertCircle, ChevronLeft, ArrowRightLeft, Printer
} from 'lucide-react';
import { CashRegister, CashMovement, ViewState } from '../../types';
import * as CashService from '../../services/cashService';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '../../stores/useAuthStore';
import { bluetoothPrinter } from '../../services/BluetoothPrinterService';

interface CashRegisterScreenProps {
    employeeId: string;
    onNavigate: (view: ViewState) => void;
}

export default function CashRegisterScreen({ employeeId, onNavigate }: CashRegisterScreenProps) {
    const queryClient = useQueryClient();
    const { userRole, user } = useAuthStore();
    const [amount, setAmount] = useState('');
    const [reason, setReason] = useState('');
    const [processing, setProcessing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showConfirmClose, setShowConfirmClose] = useState(false);
    const [confirmDiff, setConfirmDiff] = useState(0);

    const { data: currentRegister, isLoading: loadingRegister } = useQuery({
        queryKey: ['currentRegister'],
        queryFn: CashService.getCurrentRegister
    });

    const { data: expectedBalance = 0 } = useQuery({
        queryKey: ['expectedBalance', currentRegister?.id],
        queryFn: () => currentRegister ? CashService.getExpectedBalance(currentRegister.id) : Promise.resolve(0),
        enabled: !!currentRegister
    });

    const { data: cashSales = 0 } = useQuery({
        queryKey: ['cashSales', currentRegister?.id],
        queryFn: () => currentRegister ? CashService.getCashSales(currentRegister.id) : Promise.resolve(0),
        enabled: !!currentRegister
    });

    const { data: movements = [] } = useQuery({
        queryKey: ['movements', currentRegister?.id],
        queryFn: () => currentRegister ? CashService.getRegisterMovements(currentRegister.id) : Promise.resolve([]),
        enabled: !!currentRegister
    });

    const handleOpenRegister = async () => {
        const val = parseFloat(amount);
        if (isNaN(val) || val < 0) {
            setError("Importe inicial inválido");
            return;
        }
        setProcessing(true);
        setError(null);
        try {
            await CashService.openRegister(val, employeeId);
            queryClient.invalidateQueries({ queryKey: ['currentRegister'] });
            setAmount('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleCloseRegister = async (force: boolean = false) => {
        if (!currentRegister) return;
        const val = parseFloat(amount);
        if (isNaN(val) || val < 0) {
            setError("Importe final inválido");
            return;
        }
        
        const diff = val - expectedBalance;
        if (Math.abs(diff) > 0 && !force) {
            setConfirmDiff(diff);
            setShowConfirmClose(true);
            return;
        }

        setShowConfirmClose(false);
        setProcessing(true);
        setError(null);
        try {
            await CashService.closeRegister(currentRegister.id, val, employeeId, reason);
            queryClient.invalidateQueries({ queryKey: ['currentRegister'] });
            setAmount('');
            setReason('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessing(false);
        }
    };

    const handleMovement = async (type: 'in' | 'out') => {
        if (!currentRegister) return;
        const val = parseFloat(amount);
        if (isNaN(val) || val <= 0) {
            setError("Importe inválido");
            return;
        }
        if (!reason.trim()) {
            setError("Debes indicar un motivo para el movimiento");
            return;
        }

        setProcessing(true);
        setError(null);
        try {
            await CashService.addCashMovement(currentRegister.id, type, val, reason, employeeId);
            queryClient.invalidateQueries({ queryKey: ['expectedBalance'] });
            queryClient.invalidateQueries({ queryKey: ['movements'] });
            setAmount('');
            setReason('');
        } catch (err: any) {
            setError(err.message);
        } finally {
            setProcessing(false);
        }
    };

    if (loadingRegister) {
        return <div className="flex justify-center items-center h-full"><Loader2 className="animate-spin text-brand-accent w-12 h-12" /></div>;
    }

    return (
        <div className="flex flex-col h-[100dvh] bg-brand-900 text-white animate-in fade-in">
            {/* Header */}
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
                            <Banknote className="text-brand-accent" />
                            Gestión de Caja
                        </h1>
                        <p className="text-gray-400 text-sm">Control de efectivo y arqueo</p>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    {(userRole?.permissions?.can_open_drawer || user?.role.toLowerCase() === 'admin') && (
                        <button 
                            onClick={() => bluetoothPrinter.openDrawer()}
                            className="px-4 py-2 bg-brand-700 hover:bg-brand-600 text-white rounded-lg font-bold flex items-center gap-2 transition-colors border border-brand-600"
                        >
                            <Printer size={18} />
                            Abrir Cajón
                        </button>
                    )}
                    <div className={`px-4 py-2 rounded-lg font-bold flex items-center gap-2 ${currentRegister ? 'bg-green-500/20 text-green-400 border border-green-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'}`}>
                        {currentRegister ? <Unlock size={18} /> : <Lock size={18} />}
                        {currentRegister ? 'CAJA ABIERTA' : 'CAJA CERRADA'}
                    </div>
                </div>
            </header>

            <div className="flex-1 overflow-y-auto p-6">
                <div className="max-w-5xl mx-auto grid grid-cols-1 lg:grid-cols-3 gap-6">
                    
                    {/* Left Column: Actions */}
                    <div className="lg:col-span-1 space-y-6">
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/50 text-red-400 p-4 rounded-xl flex items-start gap-3">
                                <AlertCircle className="shrink-0 mt-0.5" size={18} />
                                <p className="text-sm">{error}</p>
                            </div>
                        )}

                        {!currentRegister ? (
                            <div className="bg-brand-800 rounded-2xl p-6 border border-brand-700 shadow-xl">
                                <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                    <Unlock className="text-brand-accent" />
                                    Abrir Caja
                                </h2>
                                <div className="space-y-4">
                                    <div>
                                        <label className="block text-sm text-gray-400 mb-2">Fondo de caja inicial (€)</label>
                                        <input 
                                            type="number" 
                                            step="0.01"
                                            value={amount}
                                            onChange={(e) => setAmount(e.target.value)}
                                            className="w-full bg-brand-900 border border-brand-600 rounded-xl p-4 text-2xl font-bold text-center text-white focus:border-brand-accent outline-none font-mono"
                                            placeholder="0.00"
                                        />
                                    </div>
                                    <button 
                                        onClick={handleOpenRegister}
                                        disabled={processing || !amount}
                                        className="w-full py-4 rounded-xl bg-green-600 hover:bg-green-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                                    >
                                        {processing ? <Loader2 className="animate-spin" /> : <Unlock size={20} />}
                                        ABRIR CAJA
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <>
                                <div className="bg-brand-800 rounded-2xl p-6 border border-brand-700 shadow-xl">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
                                        <ArrowRightLeft className="text-brand-accent" />
                                        Movimientos Manuales
                                    </h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">Importe (€)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full bg-brand-900 border border-brand-600 rounded-xl p-3 text-xl font-bold text-center text-white focus:border-brand-accent outline-none font-mono"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">Motivo / Concepto</label>
                                            <input 
                                                type="text" 
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                className="w-full bg-brand-900 border border-brand-600 rounded-xl p-3 text-white focus:border-brand-accent outline-none"
                                                placeholder="Ej: Pago a proveedor, Cambio..."
                                            />
                                        </div>
                                        <div className="grid grid-cols-2 gap-3 pt-2">
                                            <button 
                                                onClick={() => handleMovement('in')}
                                                disabled={processing || !amount || !reason}
                                                className="py-3 rounded-xl bg-green-600/20 text-green-400 border border-green-600/50 hover:bg-green-600/30 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                <ArrowDownCircle size={18} />
                                                ENTRADA
                                            </button>
                                            <button 
                                                onClick={() => handleMovement('out')}
                                                disabled={processing || !amount || !reason}
                                                className="py-3 rounded-xl bg-red-600/20 text-red-400 border border-red-600/50 hover:bg-red-600/30 font-bold flex items-center justify-center gap-2 disabled:opacity-50"
                                            >
                                                <ArrowUpCircle size={18} />
                                                SALIDA
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div className="bg-brand-800 rounded-2xl p-6 border border-brand-700 shadow-xl">
                                    <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-red-400">
                                        <Lock />
                                        Cerrar Caja (Arqueo)
                                    </h2>
                                    <div className="space-y-4">
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">Efectivo real en cajón (€)</label>
                                            <input 
                                                type="number" 
                                                step="0.01"
                                                value={amount}
                                                onChange={(e) => setAmount(e.target.value)}
                                                className="w-full bg-brand-900 border border-brand-600 rounded-xl p-4 text-2xl font-bold text-center text-white focus:border-red-500 outline-none font-mono"
                                                placeholder="0.00"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm text-gray-400 mb-2">Notas de cierre (Opcional)</label>
                                            <input 
                                                type="text" 
                                                value={reason}
                                                onChange={(e) => setReason(e.target.value)}
                                                className="w-full bg-brand-900 border border-brand-600 rounded-xl p-3 text-white focus:border-red-500 outline-none"
                                                placeholder="Observaciones..."
                                            />
                                        </div>
                                        <button 
                                            onClick={() => handleCloseRegister(false)}
                                            disabled={processing || !amount}
                                            className="w-full py-4 rounded-xl bg-red-600 hover:bg-red-500 text-white font-bold flex items-center justify-center gap-2 shadow-lg disabled:opacity-50"
                                        >
                                            {processing ? <Loader2 className="animate-spin" /> : <Lock size={20} />}
                                            CERRAR CAJA
                                        </button>
                                    </div>
                                </div>
                            </>
                        )}
                    </div>

                    {/* Right Column: Summary & History */}
                    <div className="lg:col-span-2 space-y-6">
                        {currentRegister && (
                            <>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                    <div className="bg-brand-800 p-4 rounded-xl border border-brand-700">
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Fondo Inicial</p>
                                        <p className="text-xl font-mono font-bold text-white">{currentRegister.opening_balance.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-brand-800 p-4 rounded-xl border border-brand-700">
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Ventas Efectivo</p>
                                        <p className="text-xl font-mono font-bold text-green-400">+{cashSales.toFixed(2)}€</p>
                                    </div>
                                    <div className="bg-brand-800 p-4 rounded-xl border border-brand-700">
                                        <p className="text-xs text-gray-400 uppercase font-bold mb-1">Movimientos</p>
                                        <p className={`text-xl font-mono font-bold ${expectedBalance - currentRegister.opening_balance - cashSales >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                            {(expectedBalance - currentRegister.opening_balance - cashSales).toFixed(2)}€
                                        </p>
                                    </div>
                                    <div className="bg-brand-800 p-4 rounded-xl border border-brand-accent/50 shadow-[0_0_15px_rgba(242,125,38,0.15)] relative overflow-hidden">
                                        <div className="absolute top-0 right-0 w-16 h-16 bg-brand-accent/10 rounded-bl-full -mr-8 -mt-8"></div>
                                        <p className="text-xs text-brand-accent uppercase font-bold mb-1">Total Esperado</p>
                                        <p className="text-2xl font-mono font-bold text-brand-accent">{expectedBalance.toFixed(2)}€</p>
                                    </div>
                                </div>

                                <div className="bg-brand-800 rounded-2xl border border-brand-700 shadow-xl overflow-hidden flex flex-col h-[500px]">
                                    <div className="p-4 border-b border-brand-700 bg-brand-900/50 flex items-center gap-2">
                                        <History className="text-brand-accent" size={20} />
                                        <h3 className="font-bold text-white">Historial de Movimientos</h3>
                                    </div>
                                    <div className="flex-1 overflow-y-auto p-4 space-y-3">
                                        {movements.length === 0 ? (
                                            <div className="h-full flex flex-col items-center justify-center text-gray-500">
                                                <Banknote size={48} className="mb-4 opacity-20" />
                                                <p>No hay movimientos manuales registrados</p>
                                            </div>
                                        ) : (
                                            movements.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(mov => (
                                                <div key={mov.id} className="flex items-center justify-between p-4 rounded-xl bg-brand-900 border border-brand-700">
                                                    <div className="flex items-center gap-4">
                                                        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${mov.type === 'in' ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'}`}>
                                                            {mov.type === 'in' ? <ArrowDownCircle size={20} /> : <ArrowUpCircle size={20} />}
                                                        </div>
                                                        <div>
                                                            <p className="font-bold text-white">{mov.reason}</p>
                                                            <p className="text-xs text-gray-400">{new Date(mov.created_at).toLocaleTimeString()}</p>
                                                        </div>
                                                    </div>
                                                    <div className={`font-mono font-bold text-lg ${mov.type === 'in' ? 'text-green-400' : 'text-red-400'}`}>
                                                        {mov.type === 'in' ? '+' : '-'}{mov.amount.toFixed(2)}€
                                                    </div>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>

            {/* Confirm Close Modal */}
            {showConfirmClose && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4 animate-in fade-in">
                    <div className="bg-brand-900 border border-brand-700 rounded-2xl p-6 w-full max-w-md shadow-2xl animate-in zoom-in-95">
                        <div className="flex items-center gap-3 text-red-400 mb-4">
                            <AlertCircle size={28} />
                            <h2 className="text-xl font-bold">Descuadre de Caja</h2>
                        </div>
                        <p className="text-gray-300 mb-6">
                            Hay un descuadre de <span className={`font-bold font-mono ${confirmDiff > 0 ? 'text-green-400' : 'text-red-400'}`}>{confirmDiff > 0 ? '+' : ''}{confirmDiff.toFixed(2)}€</span>. 
                            <br/><br/>
                            ¿Estás seguro de que deseas cerrar la caja con este descuadre?
                        </p>
                        <div className="flex gap-3">
                            <button 
                                onClick={() => setShowConfirmClose(false)}
                                className="flex-1 py-3 rounded-xl bg-brand-800 text-white font-bold hover:bg-brand-700 transition-colors"
                            >
                                Cancelar
                            </button>
                            <button 
                                onClick={() => handleCloseRegister(true)}
                                className="flex-1 py-3 rounded-xl bg-red-600 text-white font-bold hover:bg-red-500 transition-colors flex items-center justify-center gap-2"
                            >
                                <Lock size={18} />
                                Cerrar Caja
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
