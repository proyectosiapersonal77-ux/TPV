import React, { useState } from 'react';
import { ArrowLeft, Users, Settings, Database, Printer, LayoutGrid, CreditCard, Palette, ChevronsRight, X } from 'lucide-react';
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
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleViewChange = (view: ConfigView) => {
    setActiveView(view);
    setIsMobileMenuOpen(false);
  };

  const activeViewTitle = {
    users: 'Usuarios',
    tables: 'Mesas y Zonas',
    general: 'General',
    printers: 'Impresoras',
    redsys: 'Datáfono (Redsys)',
    whitelabel: 'Marca Blanca'
  }[activeView];

  return (
    <div className="flex flex-col md:flex-row h-[100dvh] w-screen bg-brand-900 text-white overflow-hidden md:items-center p-3 gap-3 relative">
      {/* Background decoration elements (Fixed position to not affect layout) */}
      <div className="fixed top-0 left-0 w-full h-full overflow-hidden -z-10 pointer-events-none">
         <div className="absolute top-[-20%] right-[-10%] w-[600px] h-[600px] rounded-full bg-brand-accent/5 blur-[100px]"></div>
         <div className="absolute bottom-[-10%] left-[-10%] w-[500px] h-[500px] rounded-full bg-blue-900/10 blur-[100px]"></div>
      </div>

      {/* Mobile Top Bar */}
      <div className="md:hidden w-full bg-brand-800 rounded-2xl border border-brand-700 shadow-md p-3 flex items-center justify-between shrink-0 z-30">
        <div className="flex items-center gap-3">
            <button 
                onClick={() => setIsMobileMenuOpen(true)}
                className="p-2 bg-brand-700 rounded-lg text-white hover:bg-brand-600 transition-colors"
            >
                <ChevronsRight size={20} />
            </button>
            <h1 className="font-bold text-lg">{activeViewTitle}</h1>
        </div>
        <div className="flex items-center gap-2">
            <AdminNavigation onNavigate={onNavigate} currentView="config" />
            <button 
                onClick={onBack}
                className="p-2 bg-brand-700 rounded-lg text-gray-300 hover:text-white transition-colors"
            >
                <ArrowLeft size={20} />
            </button>
        </div>
      </div>

      {/* Overlay for mobile sidebar */}
      {isMobileMenuOpen && (
        <div 
            className="md:hidden fixed inset-0 bg-black/60 z-40 backdrop-blur-sm"
            onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar - Now a floating panel matching the content height */}
      <aside className={`
        fixed inset-y-0 left-0 z-50 w-72 bg-brand-800 border-r border-brand-700 shadow-2xl flex flex-col transform transition-transform duration-300 ease-in-out
        md:relative md:w-64 md:rounded-2xl md:border md:border-brand-700 md:h-[88vh] md:translate-x-0 md:shrink-0
        ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="p-6 border-b border-brand-700 flex items-center justify-between">
          <h2 className="text-xl font-bold flex items-center gap-2 text-white">
            <Settings className="text-brand-accent" />
            Config
          </h2>
          <div className="hidden md:block">
            <AdminNavigation onNavigate={onNavigate} currentView="config" />
          </div>
          <button 
            className="md:hidden p-2 text-gray-400 hover:text-white bg-brand-900 rounded-lg"
            onClick={() => setIsMobileMenuOpen(false)}
          >
            <X size={20} />
          </button>
        </div>

        <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
          <button 
            onClick={() => handleViewChange('users')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'users' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <Users size={20} />
            Usuarios
          </button>

          <button 
            onClick={() => handleViewChange('tables')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'tables' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <LayoutGrid size={20} />
            Mesas y Zonas
          </button>

          <button 
            onClick={() => handleViewChange('general')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'general' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <Settings size={20} />
            General
          </button>
          
           <button 
            onClick={() => handleViewChange('printers')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'printers' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <Printer size={20} />
            Impresoras
          </button>
          
          <button 
            onClick={() => handleViewChange('redsys')}
            className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${activeView === 'redsys' ? 'bg-brand-accent text-white shadow-lg shadow-brand-accent/20 font-medium' : 'text-gray-400 hover:bg-brand-700 hover:text-white'}`}
          >
            <CreditCard size={20} />
            Datáfono (Redsys)
          </button>

          <button 
            onClick={() => handleViewChange('whitelabel')}
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
      <main className="flex-1 min-h-0 md:h-[88vh] min-w-0 w-full">
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