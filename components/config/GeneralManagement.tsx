import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Save } from 'lucide-react';

const GeneralManagement: React.FC = () => {
    const [globalSoundsEnabled, setGlobalSoundsEnabled] = useState(true);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const setting = localStorage.getItem('globalSoundsEnabled');
        if (setting === 'false') {
            setGlobalSoundsEnabled(false);
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('globalSoundsEnabled', globalSoundsEnabled ? 'true' : 'false');
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Configuración General</h2>
                <button 
                    onClick={handleSave}
                    className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${saved ? 'bg-green-500 text-white' : 'bg-brand-accent hover:bg-brand-accentHover text-white'}`}
                >
                    <Save size={20} />
                    {saved ? 'Guardado' : 'Guardar'}
                </button>
            </div>

            <div className="bg-brand-800 border border-brand-700 rounded-2xl p-6">
                <h3 className="text-lg font-bold text-white mb-4 border-b border-brand-700 pb-2">Preferencias del Sistema</h3>
                
                <div className="flex items-center justify-between p-4 bg-brand-900/50 rounded-xl border border-brand-700/50">
                    <div className="flex items-center gap-4">
                        <div className={`p-3 rounded-xl ${globalSoundsEnabled ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-400'}`}>
                            {globalSoundsEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                        </div>
                        <div>
                            <h4 className="font-bold text-white">Sonidos del Sistema</h4>
                            <p className="text-sm text-gray-400">Activar o desactivar los sonidos de feedback (clicks, errores, éxito) para todos los usuarios en este dispositivo.</p>
                        </div>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                            type="checkbox" 
                            className="sr-only peer"
                            checked={globalSoundsEnabled}
                            onChange={(e) => setGlobalSoundsEnabled(e.target.checked)}
                        />
                        <div className="w-14 h-7 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-accent"></div>
                    </label>
                </div>
            </div>
        </div>
    );
};

export default GeneralManagement;
