import React, { useState, useEffect } from 'react';
import { UserRole, ViewState } from '../types';
import { LogOut, ChefHat, Utensils, ShieldAlert, User, LayoutGrid, Package, Wifi, WifiOff, RefreshCw, Settings, Banknote, BarChart3, Volume2, VolumeX, X, Save, Monitor } from 'lucide-react';
import { syncDatabase, processSyncQueue } from '../services/syncService';
import { useAuthStore } from '../stores/useAuthStore';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '../Supabase';

interface DashboardProps {
  onLogout: () => void;
  onNavigate: (view: ViewState) => void;
}

const Dashboard: React.FC<DashboardProps> = ({ onLogout, onNavigate }) => {
  const { user, userRole, updateUser } = useAuthStore();
  const queryClient = useQueryClient();
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [syncing, setSyncing] = useState(false);
  const [showPreferencesModal, setShowPreferencesModal] = useState(false);
  const [soundsEnabled, setSoundsEnabled] = useState(user?.preferences?.soundsEnabled !== false);
  const [savingPrefs, setSavingPrefs] = useState(false);
  const [logoBase64, setLogoBase64] = useState<string | null>(null);

  useEffect(() => {
      const handleStatusChange = () => setIsOnline(navigator.onLine);
      window.addEventListener('online', handleStatusChange);
      window.addEventListener('offline', handleStatusChange);
      
      // Load logo
      const loadLogo = () => {
          const storedLogo = localStorage.getItem('brandLogo');
          setLogoBase64(storedLogo);
      };
      loadLogo();
      window.addEventListener('brandUpdated', loadLogo);
      
      return () => {
          window.removeEventListener('online', handleStatusChange);
          window.removeEventListener('offline', handleStatusChange);
          window.removeEventListener('brandUpdated', loadLogo);
      };
  }, []);

  const handleManualSync = async () => {
      if(!isOnline) return;
      setSyncing(true);
      await processSyncQueue();
      await syncDatabase();
      queryClient.invalidateQueries(); 
      setSyncing(false);
  };
  
  const getRoleIcon = (role: string) => {
    const r = role.toLowerCase();
    
    if (r === UserRole.KITCHEN || r.includes('cocina')) return <ChefHat className="w-12 h-12 mb-2 text-brand-accent" />;
    if (r === UserRole.WAITER || r.includes('sala') || r.includes('camarer')) return <Utensils className="w-12 h-12 mb-2 text-green-400" />;
    if (r === UserRole.ADMIN || r.includes('admin') || r.includes('encargad') || userRole?.permissions?.can_manage_settings) return <ShieldAlert className="w-12 h-12 mb-2 text-red-400" />;
    
    return <User className="w-12 h-12 mb-2 text-blue-400" />;
  };

  const handleSavePreferences = async () => {
      if (!user) return;
      setSavingPrefs(true);
      try {
          const newPreferences = { ...user.preferences, soundsEnabled };
          const updatedUser = { ...user, preferences: newPreferences };
          
          // Update local DB first for immediate effect and offline support
          const { db } = await import('../db');
          await db.employees.update(user.id, { preferences: newPreferences });
          
          // Try to update Supabase if online
          if (navigator.onLine) {
              const { error } = await supabase
                  .from('employees')
                  .update({ preferences: newPreferences })
                  .eq('id', user.id);
                  
              if (error) {
                  console.error("Error syncing preferences to Supabase", error);
                  // Don't throw, we already saved locally
              }
          }
          
          updateUser(updatedUser);
          setShowPreferencesModal(false);
      } catch (err) {
          console.error("Error saving preferences", err);
          alert("Error al guardar preferencias");
      } finally {
          setSavingPrefs(false);
      }
  };

  if (!user) return null;

  return (
    <div className="flex flex-col h-screen p-6">
      {/* Top Bar */}
      <header className="flex justify-between items-center bg-brand-800 p-4 rounded-xl shadow-lg border border-brand-700 mb-6 relative z-50">
        <div className="flex items-center gap-4">
          {logoBase64 ? (
              <img src={logoBase64} alt="Logo" className="h-10 w-auto object-contain" />
          ) : (
              <h1 className="text-xl font-bold text-white">GastroPOS</h1>
          )}
          <div className="flex items-center gap-2 mt-1">
             {isOnline ? (
                 <div className="flex items-center gap-1 text-green-400">
                     <Wifi size={14} /> <span className="text-xs">Online</span>
                 </div>
             ) : (
                 <div className="flex items-center gap-1 text-red-400">
                     <WifiOff size={14} /> <span className="text-xs">Offline (Modo Local)</span>
                 </div>
             )}
          </div>
        </div>
        <div className="flex items-center gap-3">
           <button 
             onClick={handleManualSync}
             disabled={!isOnline || syncing}
             className={`p-2 rounded-lg border border-brand-600 transition-all ${syncing ? 'animate-spin text-brand-accent' : 'text-gray-400 hover:text-white'}`}
             title="Sincronizar ahora"
           >
               <RefreshCw size={20} />
           </button>

           <div className="text-right hidden sm:block mr-2 border-l border-brand-700 pl-3">
              <p className="font-medium text-white">{user.name}</p>
              <p className="text-xs text-brand-accent font-bold uppercase">{user.role}</p>
           </div>
           
           <button 
             onClick={() => setShowPreferencesModal(true)}
             className="bg-brand-700 hover:bg-brand-600 text-gray-200 border border-brand-600 p-2.5 rounded-lg transition-colors shadow-lg active:scale-95"
             title="Preferencias"
           >
               <User size={20} />
           </button>
           
           {/* Direct Config Button for Admins instead of Navigation Menu */}
           {(userRole?.permissions?.can_manage_settings || user.role.toLowerCase() === UserRole.ADMIN) && (
               <button 
                 onClick={() => onNavigate('config')}
                 className="bg-brand-700 hover:bg-brand-600 text-gray-200 border border-brand-600 p-2.5 rounded-lg transition-colors shadow-lg active:scale-95"
                 title="Configuración"
               >
                   <Settings size={20} />
               </button>
           )}

           <button 
             onClick={onLogout}
             className="bg-red-500/20 hover:bg-red-500/30 text-red-400 border border-red-500/50 p-2.5 rounded-lg transition-colors active:scale-95"
             title="Cerrar Sesión"
           >
             <LogOut size={20} />
           </button>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 overflow-y-auto pb-6">
        <div className="flex flex-col items-center justify-center min-h-full">
          <div className="bg-brand-800 border border-brand-700 p-6 sm:p-12 rounded-3xl text-center max-w-4xl shadow-2xl w-full">
            <div className="flex justify-center">
               {getRoleIcon(user.role)}
            </div>
            <h2 className="text-3xl font-bold text-white mb-2">Hola, {user.name.split(' ')[0]}</h2>
            <p className="text-gray-400 mb-8">Has iniciado sesión correctamente.</p>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
               <button 
                  onClick={() => onNavigate('tables')}
                  className="w-full bg-brand-accent hover:bg-brand-accentHover text-white p-6 rounded-2xl font-bold text-lg shadow-lg shadow-brand-accent/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
               >
                  <LayoutGrid size={32} />
                  Plano de Mesas
                  <span className="text-xs font-normal opacity-80">TPV / Comandas</span>
               </button>

               <button 
                  onClick={() => onNavigate('kitchen')}
                  className="w-full bg-orange-700 hover:bg-orange-600 text-white p-6 rounded-2xl font-bold text-lg shadow-lg shadow-orange-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
               >
                  <ChefHat size={32} />
                  Cocina
                  <span className="text-xs font-normal opacity-80">Ver Comandas (KDS)</span>
               </button>
               
               <button 
                  onClick={() => onNavigate('cfd')}
                  className="w-full bg-teal-700 hover:bg-teal-600 text-white p-6 rounded-2xl font-bold text-lg shadow-lg shadow-teal-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
               >
                  <Monitor size={32} />
                  Visor de Cliente
                  <span className="text-xs font-normal opacity-80">Pantalla CFD</span>
               </button>
               
               {user.role === UserRole.ADMIN && (
                  <>
                      <button 
                          onClick={() => onNavigate('inventory')}
                          className="w-full bg-blue-600 hover:bg-blue-700 text-white p-6 rounded-2xl font-bold text-lg shadow-lg shadow-blue-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
                      >
                          <Package size={32} />
                          Inventario y Carta
                          <span className="text-xs font-normal opacity-80">Gestión de Stock / Productos</span>
                      </button>
                      <button 
                          onClick={() => onNavigate('cash_register')}
                          className="w-full bg-green-600 hover:bg-green-700 text-white p-6 rounded-2xl font-bold text-lg shadow-lg shadow-green-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
                      >
                          <Banknote size={32} />
                          Gestión de Caja
                          <span className="text-xs font-normal opacity-80">Apertura, Cierre y Movimientos</span>
                      </button>
                      <button 
                          onClick={() => onNavigate('analytics')}
                          className="w-full bg-purple-600 hover:bg-purple-700 text-white p-6 rounded-2xl font-bold text-lg shadow-lg shadow-purple-600/20 transition-all active:scale-95 flex flex-col items-center justify-center gap-2"
                      >
                          <BarChart3 size={32} />
                          Finanzas y Analítica
                          <span className="text-xs font-normal opacity-80">Cierre Z, Impuestos y Resumen</span>
                      </button>
                  </>
               )}
            </div>
          </div>
        </div>
      </div>
      
      {/* Footer info */}
      <div className="text-center text-brand-700 text-xs mt-6">
         ID de Sesión: {user.id}
      </div>
      
      {showPreferencesModal && (
          <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 animate-in fade-in">
              <div className="bg-brand-800 border border-brand-600 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden flex flex-col">
                  <div className="p-4 border-b border-brand-700 flex justify-between items-center bg-brand-900/50">
                      <h3 className="font-bold text-white text-lg flex items-center gap-2">
                          <User size={20} className="text-brand-accent" />
                          Mis Preferencias
                      </h3>
                      <button onClick={() => setShowPreferencesModal(false)} className="text-gray-400 hover:text-white transition-colors">
                          <X size={24} />
                      </button>
                  </div>
                  <div className="p-6 space-y-6">
                      <div className="flex items-center justify-between p-4 bg-brand-900/50 rounded-xl border border-brand-700/50">
                          <div className="flex items-center gap-4">
                              <div className={`p-3 rounded-xl ${soundsEnabled ? 'bg-brand-accent/20 text-brand-accent' : 'bg-gray-700 text-gray-400'}`}>
                                  {soundsEnabled ? <Volume2 size={24} /> : <VolumeX size={24} />}
                              </div>
                              <div>
                                  <h4 className="font-bold text-white">Sonidos</h4>
                                  <p className="text-sm text-gray-400">Activar feedback auditivo</p>
                              </div>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                              <input 
                                  type="checkbox" 
                                  className="sr-only peer"
                                  checked={soundsEnabled}
                                  onChange={(e) => setSoundsEnabled(e.target.checked)}
                              />
                              <div className="w-14 h-7 bg-brand-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-6 after:w-6 after:transition-all peer-checked:bg-brand-accent"></div>
                          </label>
                      </div>
                  </div>
                  <div className="p-4 border-t border-brand-700 bg-brand-900/50 flex justify-end gap-3">
                      <button 
                          onClick={() => setShowPreferencesModal(false)}
                          className="px-4 py-2 rounded-xl border border-brand-600 text-gray-300 hover:bg-brand-700 transition-colors"
                      >
                          Cancelar
                      </button>
                      <button 
                          onClick={handleSavePreferences}
                          disabled={savingPrefs}
                          className="px-4 py-2 rounded-xl bg-brand-accent hover:bg-brand-accentHover text-white font-bold flex items-center gap-2 transition-colors disabled:opacity-50"
                      >
                          <Save size={18} />
                          {savingPrefs ? 'Guardando...' : 'Guardar'}
                      </button>
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};

export default Dashboard;