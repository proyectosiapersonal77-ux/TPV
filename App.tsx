import React, { useState, useEffect, useCallback } from 'react';
import { Layout } from './components/Layout';
import PinPad from './components/PinPad';
import Dashboard from './components/Dashboard';
import ConfigScreen from './components/config/ConfigScreen';
import TablePlan from './components/TablePlan';
import InventoryManagement from './components/config/InventoryManagement';
import POSScreen from './components/POS/POSScreen';
import KitchenDisplay from './components/Kitchen/KitchenDisplay';
import CashRegisterScreen from './components/CashRegister/CashRegisterScreen';
import AnalyticsScreen from './components/Analytics/AnalyticsScreen';
import { SupabaseWarning } from './components/SupabaseWarning';
import { checkSupabaseConnection } from './Supabase';
import { verifyPin } from './services/authService';
import { UserRole, Table, ViewState } from './types';
import { syncDatabase, processSyncQueue } from './services/syncService';
import { useAuthStore } from './stores/useAuthStore';

const App: React.FC = () => {
  const [isConfigured, setIsConfigured] = useState<boolean>(true);
  const [currentView, setCurrentView] = useState<ViewState>('login');
  const [selectedTable, setSelectedTable] = useState<Table | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  
  // Zustand Auth
  const { user, isAuthenticated, login, logout } = useAuthStore();
  
  // Local state for login process feedback (loading/error)
  const [loginLoading, setLoginLoading] = useState(false);
  const [loginError, setLoginError] = useState<string | null>(null);

  useEffect(() => {
    setIsConfigured(checkSupabaseConnection());
    
    // Initial Sync on App Start
    const initSync = async () => {
        setIsSyncing(true);
        await syncDatabase(); // Pull data
        await processSyncQueue(); // Push pending
        setIsSyncing(false);
    };
    initSync();

    // Listener for online status
    window.addEventListener('online', processSyncQueue);
    return () => window.removeEventListener('online', processSyncQueue);
  }, []);

  const handlePinSubmit = useCallback(async (pin: string) => {
    setLoginLoading(true);
    setLoginError(null);
    
    // Verify User
    const { user: verifiedUser, error } = await verifyPin(pin);

    if (verifiedUser && !error) {
      login(verifiedUser); // Update Zustand Store
      setLoginLoading(false);

      // ROUTING LOGIC:
      const role = verifiedUser.role.toLowerCase();
      if (role === UserRole.ADMIN) {
        setCurrentView('dashboard');
      } else if (role === UserRole.KITCHEN) {
        setCurrentView('kitchen');
      } else {
        setCurrentView('tables'); // Waiters go to tables
      }

    } else {
      setLoginLoading(false);
      setLoginError(error || 'PIN Incorrecto');
    }
  }, [login]);

  const handleLogout = () => {
    logout(); // Update Zustand Store
    setCurrentView('login');
    setSelectedTable(null);
  };

  const clearError = useCallback(() => {
    setLoginError(null);
  }, []);
  
  const handleSelectTable = (table: Table) => {
      setSelectedTable(table);
      setCurrentView('pos');
  };

  const handleNavigate = (view: ViewState) => {
      setCurrentView(view);
      if (view !== 'pos') {
          setSelectedTable(null);
      }
  };

  if (!isConfigured) {
    return <SupabaseWarning />;
  }

  // --- FULL SCREEN VIEWS ---

  // Configuration
  if (currentView === 'config' && isAuthenticated && user?.role === 'admin') {
    return <ConfigScreen onBack={() => setCurrentView('dashboard')} onNavigate={handleNavigate} />;
  }
  
  // Kitchen Display System
  if (currentView === 'kitchen' && isAuthenticated) {
      return <KitchenDisplay onBack={() => setCurrentView(user?.role === 'admin' ? 'dashboard' : 'login')} onNavigate={handleNavigate} />;
  }

  // Inventory
  if (currentView === 'inventory' && isAuthenticated && user?.role === 'admin') {
      return (
          <InventoryManagement 
            onBack={() => setCurrentView('dashboard')} 
            onNavigate={handleNavigate}
          />
      );
  }

  // Table Plan
  if (currentView === 'tables' && isAuthenticated && user) {
      return (
          <TablePlan 
            user={user} 
            onLogout={handleLogout}
            onSelectTable={handleSelectTable}
            onBack={() => setCurrentView('dashboard')}
            onNavigate={handleNavigate}
          />
      );
  }

  // Cash Register
  if (currentView === 'cash_register' && isAuthenticated && user?.role === 'admin') {
      return <CashRegisterScreen employeeId={user.id} onNavigate={handleNavigate} />;
  }

  // Analytics
  if (currentView === 'analytics' && isAuthenticated && user?.role === 'admin') {
      return <AnalyticsScreen onNavigate={handleNavigate} />;
  }

  // POS (Point of Sale)
  if (currentView === 'pos' && isAuthenticated && user && selectedTable) {
      return (
          <POSScreen 
            table={selectedTable}
            employeeId={user.id}
            onBack={() => {
                setSelectedTable(null);
                setCurrentView('tables');
            }}
            onNavigate={handleNavigate}
          />
      );
  }

  return (
    <Layout>
      <div className="flex-1 flex items-center justify-center w-full">
        {isAuthenticated && user && currentView === 'dashboard' ? (
          <div className="w-full h-full animate-in zoom-in-95 duration-300">
            <Dashboard 
              onLogout={handleLogout} 
              onNavigate={handleNavigate}
            />
          </div>
        ) : (
          <div className="w-full px-4 animate-in fade-in zoom-in-95 duration-500">
            <PinPad 
              onSuccess={handlePinSubmit} 
              isLoading={loginLoading}
              error={loginError}
              clearError={clearError}
            />
            {isSyncing && (
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 text-brand-accent text-xs animate-pulse">
                    Sincronizando datos...
                </div>
            )}
          </div>
        )}
      </div>
    </Layout>
  );
};

export default App;