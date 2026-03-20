import React, { useState, useEffect } from 'react';
import { CreditCard, Save, CheckCircle2, AlertCircle } from 'lucide-react';
import { redsysService, RedsysConfig } from '../../services/RedsysService';

const RedsysManagement: React.FC = () => {
    const [config, setConfig] = useState<RedsysConfig>({
        enabled: false,
        ipAddress: '192.168.1.100',
        port: 8888
    });
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        setConfig(redsysService.getConfig());
    }, []);

    const handleSave = () => {
        redsysService.saveConfig(config);
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
    };

    return (
        <div className="bg-brand-800 rounded-2xl border border-brand-700 shadow-xl h-full flex flex-col overflow-hidden">
            <div className="p-6 border-b border-brand-700 flex justify-between items-center bg-brand-800/50">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                        <CreditCard className="text-brand-accent" />
                        Integración Redsys (Datáfono)
                    </h2>
                    <p className="text-gray-400 text-sm mt-1">
                        Configura la conexión con el terminal de pago para enviar importes automáticamente.
                    </p>
                </div>
            </div>

            <div className="p-6 flex-1 overflow-y-auto">
                <div className="max-w-xl space-y-6">
                    <div className="bg-brand-900/50 p-6 rounded-xl border border-brand-700">
                        <div className="flex items-center justify-between mb-6">
                            <div>
                                <h3 className="text-lg font-medium text-white">Habilitar Integración</h3>
                                <p className="text-sm text-gray-400">Activa el envío automático al datáfono al cobrar con tarjeta.</p>
                            </div>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input 
                                    type="checkbox" 
                                    className="sr-only peer" 
                                    checked={config.enabled}
                                    onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                                />
                                <div className="w-14 h-7 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-accent"></div>
                            </label>
                        </div>

                        {config.enabled && (
                            <div className="space-y-4 animate-in fade-in slide-in-from-top-2">
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Dirección IP del Datáfono</label>
                                    <input 
                                        type="text" 
                                        value={config.ipAddress}
                                        onChange={(e) => setConfig({ ...config, ipAddress: e.target.value })}
                                        className="w-full bg-brand-800 border border-brand-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-brand-accent"
                                        placeholder="Ej: 192.168.1.100"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-1">Puerto</label>
                                    <input 
                                        type="number" 
                                        value={config.port}
                                        onChange={(e) => setConfig({ ...config, port: parseInt(e.target.value) || 8888 })}
                                        className="w-full bg-brand-800 border border-brand-600 text-white rounded-lg px-4 py-2 focus:outline-none focus:border-brand-accent"
                                        placeholder="Ej: 8888"
                                    />
                                </div>
                                
                                <div className="mt-4 p-4 bg-blue-900/20 border border-blue-800/50 rounded-lg flex gap-3 text-blue-200 text-sm">
                                    <AlertCircle className="shrink-0 mt-0.5" size={18} />
                                    <p>
                                        Asegúrate de que el TPV bancario esté configurado en modo "Integración PC" o "Caja" y conectado a la misma red local que este dispositivo.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button 
                            onClick={handleSave}
                            className="bg-brand-accent hover:bg-brand-accentHover text-white px-6 py-3 rounded-xl font-medium flex items-center gap-2 transition-colors"
                        >
                            {saved ? <CheckCircle2 size={20} /> : <Save size={20} />}
                            {saved ? 'Guardado' : 'Guardar Configuración'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default RedsysManagement;
