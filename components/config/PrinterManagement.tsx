import React, { useState, useEffect } from 'react';
import { Printer, Bluetooth, CheckCircle2, XCircle, Loader2 } from 'lucide-react';
import { bluetoothPrinter } from '../../services/BluetoothPrinterService';

const PrinterManagement: React.FC = () => {
    const [isConnected, setIsConnected] = useState(false);
    const [isConnecting, setIsConnecting] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        setIsConnected(bluetoothPrinter.isConnected());
        
        bluetoothPrinter.setDisconnectCallback(() => {
            setIsConnected(false);
        });
        
        return () => {
            bluetoothPrinter.setDisconnectCallback(() => {});
        };
    }, []);

    const handleConnect = async () => {
        setIsConnecting(true);
        setError(null);
        try {
            await bluetoothPrinter.connect();
            setIsConnected(true);
        } catch (err: any) {
            setError(err.message || 'Error al conectar con la impresora');
            setIsConnected(false);
        } finally {
            setIsConnecting(false);
        }
    };

    const handleDisconnect = () => {
        bluetoothPrinter.disconnect();
        setIsConnected(false);
    };

    const handleTestPrint = async () => {
        try {
            await bluetoothPrinter.printReceipt("PRUEBA DE IMPRESION\n\nSi puedes leer esto,\nla impresora esta\nconfigurada correctamente.\n");
        } catch (err: any) {
            setError(err.message || 'Error al imprimir');
        }
    };

    return (
        <div className="h-full bg-brand-800 rounded-2xl border border-brand-700 shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 border-b border-brand-700 bg-brand-900/50 shrink-0">
                <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                    <Printer className="text-brand-accent" size={28} />
                    Configuración de Impresoras
                </h2>
                <p className="text-gray-400 mt-2">
                    Conecta una impresora térmica Bluetooth para imprimir tickets directamente desde el navegador.
                </p>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
                <div className="bg-brand-900 rounded-xl p-6 border border-brand-700 max-w-2xl mx-auto">
                    <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center gap-3">
                            <div className={`p-3 rounded-full ${isConnected ? 'bg-green-500/20 text-green-400' : 'bg-gray-700 text-gray-400'}`}>
                                <Bluetooth size={24} />
                            </div>
                            <div>
                                <h3 className="text-lg font-bold text-white">Impresora Bluetooth</h3>
                                <p className="text-sm text-gray-400">
                                    Estado: {isConnected ? <span className="text-green-400 font-medium">Conectada</span> : <span className="text-gray-500">Desconectada</span>}
                                </p>
                            </div>
                        </div>
                        
                        {isConnected ? (
                            <button 
                                onClick={handleDisconnect}
                                className="px-4 py-2 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 border border-red-500/20 transition-colors font-medium flex items-center gap-2"
                            >
                                <XCircle size={18} />
                                Desconectar
                            </button>
                        ) : (
                            <button 
                                onClick={handleConnect}
                                disabled={isConnecting}
                                className="px-4 py-2 rounded-lg bg-brand-accent hover:bg-brand-accentHover text-white transition-colors font-medium flex items-center gap-2 disabled:opacity-50"
                            >
                                {isConnecting ? <Loader2 size={18} className="animate-spin" /> : <Bluetooth size={18} />}
                                {isConnecting ? 'Conectando...' : 'Conectar Impresora'}
                            </button>
                        )}
                    </div>

                    {error && (
                        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    <div className="border-t border-brand-700 pt-6">
                        <h4 className="text-white font-medium mb-4">Acciones</h4>
                        <button 
                            onClick={handleTestPrint}
                            disabled={!isConnected}
                            className="w-full py-3 rounded-xl border border-brand-600 text-gray-300 hover:bg-brand-700 hover:text-white transition-colors font-medium flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            <Printer size={18} />
                            Imprimir Ticket de Prueba
                        </button>
                    </div>
                </div>
                
                <div className="mt-8 max-w-2xl mx-auto bg-blue-500/10 border border-blue-500/20 rounded-xl p-6">
                    <h4 className="text-blue-400 font-bold mb-2 flex items-center gap-2">
                        <CheckCircle2 size={18} />
                        Requisitos y Notas
                    </h4>
                    <ul className="list-disc list-inside text-sm text-gray-300 space-y-2">
                        <li>Tu navegador debe soportar la API Web Bluetooth (Chrome, Edge, Opera).</li>
                        <li>La impresora debe estar encendida y en modo emparejamiento.</li>
                        <li>Si usas Windows, asegúrate de que la impresora esté emparejada previamente en la configuración de Bluetooth de Windows.</li>
                        <li>El formato de impresión es básico (ESC/POS).</li>
                    </ul>
                </div>
            </div>
        </div>
    );
};

export default PrinterManagement;
