import React, { useState } from 'react';
import { ArrowLeft, Users, Settings, Database, Printer, LayoutGrid, CreditCard, Palette } from 'lucide-react';
import UserManagement from './UserManagement';
import TableManagement from './TableManagement';
import PrinterManagement from './PrinterManagement';
import RedsysManagement from './RedsysManagement';
import GeneralManagement from './GeneralManagement';
import WhiteLabelManagement from './WhiteLabelManagement';
import AdminNavigation from '../AdminNavigation';
import { ViewState } from '../../types';

interface ConfigScreenProps {
  onBack: () => void;
  onNavigate: (view: ViewState) => void;
}

type ConfigView = 'users' | 'tables' | 'general' | 'printers' | 'redsys' | 'whitelabel';

const ConfigScreen: React.FC<ConfigScreenProps> = ({ onBack, onNavigate }) => {
  const [activeView, setActiveView] = useState<ConfigView>('users');

  return (
    <div className="flex h-[100dvh] w-screen bg-brand-900 text-white overflow-hidden items-center p-3 gap-3">
      {/* Background decoration elements (Fixed position to not affect layout) */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
         <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-brand-accent/5 blur-[100px]"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-900/10 blur-[100px]"></div>
      </div>

      {/* Sidebar - Now a floating panel matching the content height */}
      <aside className="w-64 bg-brand-800 rounded-2xl border border-brand-700 shadow-xl flex flex-col z-20 h-[88vh] shrink-0">
        <div className="p-6 border-b border-brand-700 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Settings className="text-brand-accent" />
            Config
          </h2>
          <AdminNavigation onNavigate={onNavigate} currentView="config" />
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => setActiveView('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'users' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <Users size={20} />
            Usuarios
          </button>

          <button 
            onClick={() => setActiveView('tables')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'tables' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <LayoutGrid size={20} />
            Mesas y Zonas
          </button>

          <button 
            onClick={() => setActiveView('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'general' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <Settings size={20} />
            General
          </button>
          
           <button 
            onClick={() => setActiveView('printers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'printers' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <Printer size={20} />
            Impresoras
          </button>
          
          <button 
            onClick={() => setActiveView('redsys')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'redsys' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <CreditCard size={20} />
            Datáfono (Redsys)
          </button>

          <button 
            onClick={() => setActiveView('whitelabel')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'whitelabel' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <Palette size={20} />
            Marca Blanca
          </button>
        </nav>

        <div className="p-4 border-t border-brand-700 mt-auto">
          <button 
            onClick={onBack}
            className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl border border-brand-600 text-gray-300 hover:bg-brand-700 hover:text-white transition-colors font-medium active:scale-95"
          >
            <ArrowLeft size={18} />
            Volver al TPV
          </button>
        </div>
      </aside>

      {/* Main Content - Takes remaining space and full height */}
      <main className="flex-1 h-[88vh] min-w-0">
        <div className="h-full w-full animate-in slide-in-from-right-4 duration-500">
          {activeView === 'users' && <UserManagement />}
          {activeView === 'tables' && <TableManagement />}
          {activeView === 'printers' && <PrinterManagement />}
          {activeView === 'redsys' && <RedsysManagement />}
          {activeView === 'general' && <GeneralManagement />}
          {activeView === 'whitelabel' && <WhiteLabelManagement />}
          
          {(activeView !== 'users' && activeView !== 'tables' && activeView !== 'printers' && activeView !== 'redsys' && activeView !== 'general' && activeView !== 'whitelabel') && (
            <div className="bg-brand-800 rounded-2xl border border-brand-700 shadow-xl h-full w-full flex flex-col items-center justify-center text-gray-500">
              <div className="border-2 border-dashed border-brand-600 rounded-3xl p-12 flex flex-col items-center">
                  <Settings size={48} className="mb-4 opacity-50" />
                  <p className="text-xl font-medium">Módulo en construcción</p>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

export default ConfigScreen;