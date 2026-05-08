import React, { useState, useEffect } from 'react';
import { Volume2, VolumeX, Save, Smartphone } from 'lucide-react';
import { updateGlobalSetting, SETTINGS_KEYS } from '../../services/configService';

const GeneralManagement: React.FC = () => {
    const [globalSoundsEnabled, setGlobalSoundsEnabled] = useState(true);
    const [globalHapticsEnabled, setGlobalHapticsEnabled] = useState(true);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        const soundSetting = localStorage.getItem(SETTINGS_KEYS.GLOBAL_SOUNDS_ENABLED);
        if (soundSetting === 'false') {
            setGlobalSoundsEnabled(false);
        }
        
        const hapticSetting = localStorage.getItem(SETTINGS_KEYS.GLOBAL_HAPTICS_ENABLED);
        if (hapticSetting === 'false') {
            setGlobalHapticsEnabled(false);
        }
    }, []);

    const handleSave = async () => {
        await updateGlobalSetting(SETTINGS_KEYS.GLOBAL_SOUNDS_ENABLED, globalSoundsEnabled ? 'true' : 'false');
        await updateGlobalSetting(SETTINGS_KEYS.GLOBAL_HAPTICS_ENABLED, globalHapticsEnabled ? 'true' : 'false');
        
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
                
                <div className="space-y-4">
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-brand-900/50 rounded-xl border border-brand-700/50 gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl shrink-0 ${globalSoundsEnabled ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-400'}`}>
                                {globalSoundsEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Sonidos del Sistema</h4>
                                <p className="text-sm text-gray-400">Activar o desactivar los sonidos de feedback (clicks, errores, éxito) para todos los usuarios en este dispositivo.</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-auto">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={globalSoundsEnabled}
                                onChange={(e) => setGlobalSoundsEnabled(e.target.checked)}
                            />
                            <div className="w-14 h-7 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-accent"></div>
                        </label>
                    </div>

                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between p-4 bg-brand-900/50 rounded-xl border border-brand-700/50 gap-4">
                        <div className="flex items-center gap-4">
                            <div className={`p-3 rounded-xl shrink-0 ${globalHapticsEnabled ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-400'}`}>
                                <Smartphone size={24} />
                            </div>
                            <div>
                                <h4 className="font-bold text-white">Vibración del Sistema (Feedback Háptico)</h4>
                                <p className="text-sm text-gray-400">Permitir que el dispositivo vibre para confirmar acciones (si el dispositivo lo soporta).</p>
                            </div>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer shrink-0 self-end sm:self-auto">
                            <input 
                                type="checkbox" 
                                className="sr-only peer"
                                checked={globalHapticsEnabled}
                                onChange={(e) => setGlobalHapticsEnabled(e.target.checked)}
                            />
                            <div className="w-14 h-7 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-accent"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GeneralManagement;
