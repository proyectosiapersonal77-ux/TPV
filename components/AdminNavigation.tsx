import React, { useState, useRef, useEffect } from 'react';
import { Menu, LayoutGrid, ChefHat, Package, Settings, Home, Banknote, BarChart3 } from 'lucide-react';
import { useAuthStore } from '../stores/useAuthStore';
import { UserRole, ViewState } from '../types';

interface AdminNavigationProps {
    onNavigate: (view: ViewState) => void;
    currentView?: ViewState;
}

const AdminNavigation: React.FC<AdminNavigationProps> = ({ onNavigate, currentView }) => {
    const { user, userRole } = useAuthStore();
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const menuRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setIsMenuOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    if (!userRole?.permissions?.can_manage_settings && user?.role.toLowerCase() !== UserRole.ADMIN) return null;

    const handleNav = (view: ViewState) => {
        setIsMenuOpen(false);
        onNavigate(view);
    };

    return (
        <div className="relative z-50" ref={menuRef}>
            <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className={`bg-brand-700 hover:bg-brand-600 text-gray-200 border border-brand-600 p-2.5 rounded-lg transition-colors group shadow-lg ${isMenuOpen ? 'bg-brand-600 text-white border-brand-500' : ''}`}
                title="Menú Administración"
            >
                <Menu size={20} />
            </button>

            {isMenuOpen && (
                <div className="absolute right-0 mt-2 w-64 bg-brand-800 border border-brand-600 rounded-xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-200 origin-top-right ring-1 ring-black/20">
                    <div className="p-3 border-b border-brand-700 bg-brand-900/50">
                        <p className="text-xs text-brand-accent font-bold uppercase tracking-wider">Navegación Rápida</p>
                    </div>
                    <div className="p-2 space-y-1">
                        <button 
                            onClick={() => handleNav('dashboard')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${currentView === 'dashboard' ? 'bg-brand-accent/20 text-brand-accent' : 'text-gray-300 hover:bg-brand-700 hover:text-white'}`}
                        >
                            <Home size={18} className={currentView === 'dashboard' ? 'text-brand-accent' : 'text-gray-500'} /> 
                            Inicio
                        </button>
                        <button 
                            onClick={() => handleNav('tables')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${currentView === 'tables' ? 'bg-brand-accent/20 text-brand-accent' : 'text-gray-300 hover:bg-brand-700 hover:text-white'}`}
                        >
                            <LayoutGrid size={18} className={currentView === 'tables' ? 'text-brand-accent' : 'text-blue-400'} /> 
                            Mesas y Comandas
                        </button>
                        <button 
                            onClick={() => handleNav('kitchen')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${currentView === 'kitchen' ? 'bg-brand-accent/20 text-brand-accent' : 'text-gray-300 hover:bg-brand-700 hover:text-white'}`}
                        >
                            <ChefHat size={18} className={currentView === 'kitchen' ? 'text-brand-accent' : 'text-orange-400'} /> 
                            Pantalla Cocina
                        </button>
                        <button 
                            onClick={() => handleNav('inventory')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${currentView === 'inventory' ? 'bg-brand-accent/20 text-brand-accent' : 'text-gray-300 hover:bg-brand-700 hover:text-white'}`}
                        >
                            <Package size={18} className={currentView === 'inventory' ? 'text-brand-accent' : 'text-purple-400'} /> 
                            Inventario
                        </button>
                        <button 
                            onClick={() => handleNav('cash_register')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${currentView === 'cash_register' ? 'bg-brand-accent/20 text-brand-accent' : 'text-gray-300 hover:bg-brand-700 hover:text-white'}`}
                        >
                            <Banknote size={18} className={currentView === 'cash_register' ? 'text-brand-accent' : 'text-green-400'} /> 
                            Gestión de Caja
                        </button>
                        <button 
                            onClick={() => handleNav('analytics')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${currentView === 'analytics' ? 'bg-brand-accent/20 text-brand-accent' : 'text-gray-300 hover:bg-brand-700 hover:text-white'}`}
                        >
                            <BarChart3 size={18} className={currentView === 'analytics' ? 'text-brand-accent' : 'text-purple-400'} /> 
                            Finanzas y Analítica
                        </button>
                        <div className="h-px bg-brand-700 my-1 mx-2"></div>
                        <button 
                            onClick={() => handleNav('config')}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg transition-colors text-sm font-medium ${currentView === 'config' ? 'bg-brand-accent/20 text-brand-accent' : 'text-gray-300 hover:bg-brand-700 hover:text-white'}`}
                        >
                            <Settings size={18} className={currentView === 'config' ? 'text-brand-accent' : 'text-gray-400'} /> 
                            Configuración
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};

export default AdminNavigation;