import React, { useState, useEffect, useRef } from 'react';
import { Save, Image as ImageIcon, Palette, Trash2, Moon, Sun, Loader2 } from 'lucide-react';
import { uploadProductImage } from '../../services/inventoryService';

const WhiteLabelManagement: React.FC = () => {
    const [primaryColor, setPrimaryColor] = useState('#d97706'); // Default brand-accent
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [themeMode, setThemeMode] = useState<'dark' | 'light'>('dark');
    const [saved, setSaved] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        const storedColor = localStorage.getItem('brandPrimaryColor');
        if (storedColor) {
            setPrimaryColor(storedColor);
        }
        const storedLogo = localStorage.getItem('brandLogo');
        if (storedLogo) {
            setLogoUrl(storedLogo);
        }
        const storedTheme = localStorage.getItem('themeMode') as 'dark' | 'light';
        if (storedTheme) {
            setThemeMode(storedTheme);
        }
    }, []);

    const handleSave = () => {
        localStorage.setItem('brandPrimaryColor', primaryColor);
        localStorage.setItem('themeMode', themeMode);
        if (logoUrl) {
            localStorage.setItem('brandLogo', logoUrl);
        } else {
            localStorage.removeItem('brandLogo');
        }
        
        // Apply color immediately
        document.documentElement.style.setProperty('--brand-accent', primaryColor);
        document.documentElement.style.setProperty('--brand-accentHover', primaryColor);
        
        // Apply theme
        if (themeMode === 'light') {
            document.documentElement.classList.add('light-mode');
        } else {
            document.documentElement.classList.remove('light-mode');
        }
        
        // Dispatch event so other components (like Dashboard header) can update
        window.dispatchEvent(new Event('brandUpdated'));

        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        try {
            setIsUploading(true);
            const url = await uploadProductImage(file);
            setLogoUrl(url);
        } catch (error) {
            console.error('Error al subir el logo:', error);
            alert('Error al subir la imagen. Por favor, inténtelo de nuevo.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleRemoveLogo = () => {
        setLogoUrl(null);
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    return (
        <div className="p-6 h-full flex flex-col">
            <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">Marca Blanca (White-label)</h2>
                <button 
                    onClick={handleSave}
                    className={`px-4 py-2 rounded-xl font-bold flex items-center gap-2 transition-all ${saved ? 'bg-green-500 text-white' : 'bg-brand-accent hover:bg-brand-accentHover text-white'}`}
                >
                    <Save size={20} />
                    {saved ? 'Guardado' : 'Guardar'}
                </button>
            </div>

            <div className="bg-brand-800 border border-brand-700 rounded-2xl p-6 space-y-6">
                
                {/* Theme Selection */}
                <div>
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-brand-700 pb-2 flex items-center gap-2">
                        {themeMode === 'dark' ? <Moon size={20} className="text-brand-accent" /> : <Sun size={20} className="text-brand-accent" />}
                        Modo Visual
                    </h3>
                    <div className="flex gap-4">
                        <button
                            onClick={() => setThemeMode('dark')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${themeMode === 'dark' ? 'border-brand-accent bg-brand-accent/10 text-white' : 'border-brand-700 bg-brand-900/50 text-gray-400 hover:border-brand-600 hover:text-gray-300'}`}
                        >
                            <Moon size={24} />
                            <span className="font-bold">Modo Oscuro</span>
                        </button>
                        <button
                            onClick={() => setThemeMode('light')}
                            className={`flex-1 p-4 rounded-xl border-2 transition-all flex flex-col items-center gap-2 ${themeMode === 'light' ? 'border-brand-accent bg-brand-accent/10 text-white' : 'border-brand-700 bg-brand-900/50 text-gray-400 hover:border-brand-600 hover:text-gray-300'}`}
                        >
                            <Sun size={24} />
                            <span className="font-bold">Modo Claro</span>
                        </button>
                    </div>
                </div>

                {/* Color Selection */}
                <div>
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-brand-700 pb-2 flex items-center gap-2">
                        <Palette size={20} className="text-brand-accent" />
                        Color Corporativo
                    </h3>
                    <div className="flex items-center gap-4 p-4 bg-brand-900/50 rounded-xl border border-brand-700/50">
                        <div className="flex-1">
                            <h4 className="font-bold text-white">Color Principal</h4>
                            <p className="text-sm text-gray-400">Este color se usará en botones, acentos y elementos destacados de la interfaz.</p>
                        </div>
                        <div className="flex items-center gap-3">
                            <input 
                                type="color" 
                                value={primaryColor}
                                onChange={(e) => setPrimaryColor(e.target.value)}
                                className="w-12 h-12 rounded cursor-pointer bg-transparent border-0 p-0"
                            />
                            <span className="text-mono text-gray-300 font-mono bg-brand-900 px-3 py-1 rounded-lg border border-brand-700">
                                {primaryColor.toUpperCase()}
                            </span>
                        </div>
                    </div>
                </div>

                {/* Logo Upload */}
                <div>
                    <h3 className="text-lg font-bold text-white mb-4 border-b border-brand-700 pb-2 flex items-center gap-2">
                        <ImageIcon size={20} className="text-brand-accent" />
                        Logotipo del Restaurante
                    </h3>
                    <div className="flex items-start gap-6 p-4 bg-brand-900/50 rounded-xl border border-brand-700/50">
                        <div className="flex-1">
                            <h4 className="font-bold text-white mb-1">Subir Logo</h4>
                            <p className="text-sm text-gray-400 mb-4">Se recomienda una imagen PNG con fondo transparente. Se mostrará en la pantalla principal y en los tickets.</p>
                            
                            <input 
                                type="file" 
                                accept="image/*" 
                                className="hidden" 
                                ref={fileInputRef}
                                onChange={handleImageUpload}
                            />
                            
                            <div className="flex gap-3">
                                <button 
                                    onClick={() => fileInputRef.current?.click()}
                                    disabled={isUploading}
                                    className="bg-brand-700 hover:bg-brand-600 text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 disabled:opacity-50"
                                >
                                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <ImageIcon size={18} />}
                                    Seleccionar Imagen
                                </button>
                                {logoUrl && (
                                    <button 
                                        onClick={handleRemoveLogo}
                                        className="bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white px-4 py-2 rounded-lg font-medium transition-colors flex items-center gap-2 border border-red-500/20 hover:border-red-500"
                                    >
                                        <Trash2 size={18} />
                                        Eliminar
                                    </button>
                                )}
                            </div>
                        </div>
                        
                        <div className="w-48 h-32 bg-brand-900 rounded-xl border-2 border-dashed border-brand-600 flex items-center justify-center overflow-hidden shrink-0">
                            {logoUrl ? (
                                <img src={logoUrl} alt="Logo Preview" className="max-w-full max-h-full object-contain p-2" />
                            ) : isUploading ? (
                                <div className="text-gray-500 flex flex-col items-center">
                                    <Loader2 size={32} className="mb-2 opacity-50 animate-spin" />
                                    <span className="text-xs font-medium">Subiendo...</span>
                                </div>
                            ) : (
                                <div className="text-gray-500 flex flex-col items-center">
                                    <ImageIcon size={32} className="mb-2 opacity-50" />
                                    <span className="text-xs font-medium">Sin logo</span>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        </div>
    );
};

export default WhiteLabelManagement;
