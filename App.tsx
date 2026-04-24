import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { Layout } from './components/Layout';
import PinPad from './components/PinPad';
import { SupabaseWarning } from './components/SupabaseWarning';
import { checkSupabaseConnection } from './Supabase';
import { verifyPin } from './services/authService';
import { UserRole, Table, ViewState } from './types';
import { syncDatabase, processSyncQueue } from './services/syncService';
import { useAuthStore } from './stores/useAuthStore';

// Lazy loaded components
const Dashboard = React.lazy(() => import('./components/Dashboard'));
const ConfigScreen = React.lazy(() => import('./components/config/ConfigScreen'));
const TablePlan = React.lazy(() => import('./components/TablePlan'));
const InventoryManagement = React.lazy(() => import('./components/config/InventoryManagement'));
const POSScreen = React.lazy(() => import('./components/POS/POSScreen'));
const KitchenDisplay = React.lazy(() => import('./components/Kitchen/KitchenDisplay'));
const CashRegisterScreen = React.lazy(() => import('./components/CashRegister/CashRegisterScreen'));
const AnalyticsScreen = React.lazy(() => import('./components/Analytics/AnalyticsScreen'));
const MenuEngineeringScreen = React.lazy(() => import('./components/MenuEngineering/MenuEngineeringScreen').then(module => ({ default: module.MenuEngineeringScreen })));
const CFDScreen = React.lazy(() => import('./components/CFD/CFDScreen'));

const LoadingFallback = () => (
  <div className="flex-1 flex items-center justify-center h-[100dvh] bg-[#1A1A1A] text-white">
    <div className="flex flex-col items-center space-y-4">
      <div className="w-12 h-12 border-4 border-[#F27D26] border-t-transparent rounded-full animate-spin"></div>
      <p className="text-gray-400 animate-pulse">Cargando módulo...</p>
    </div>
  </div>
);

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
    
    // Check URL parameters for direct routing (e.g., CFD)
    const params = new URLSearchParams(window.location.search);
    const viewParam = params.get('view') as ViewState;
    if (viewParam === 'cfd') {
        setCurrentView('cfd');
        // We might need to bypass auth for CFD if it's meant to be a standalone display,
        // but for now we'll let it render if we adjust the auth check below.
    }

    // Load White-label settings
    const storedColor = localStorage.getItem('brandPrimaryColor');
    if (storedColor) {
        document.documentElement.style.setProperty('--brand-accent', storedColor);
        document.documentElement.style.setProperty('--brand-accentHover', storedColor);
    }
    const storedTheme = localStorage.getItem('themeMode');
    if (storedTheme === 'light') {
        document.documentElement.classList.add('light-mode');
    } else {
        document.documentElement.classList.remove('light-mode');
    }
    
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
    const { user: verifiedUser, role: verifiedRole, error } = await verifyPin(pin);

    if (verifiedUser && !error) {
      login(verifiedUser, verifiedRole); // Update Zustand Store
      setLoginLoading(false);

      // ROUTING LOGIC:
      const roleName = verifiedUser.role.toLowerCase();
      
      // Use permissions if available, otherwise fallback to role name
      if (verifiedRole?.permissions?.can_manage_settings || roleName === 'admin' || roleName === 'tour') {
        setCurrentView('dashboard');
      } else if (roleName === 'kitchen') {
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
  if (currentView === 'config' && isAuthenticated && (user?.role === 'admin' || user?.role === 'tour')) {
    return (
      <Suspense fallback={<LoadingFallback />}>
        <ConfigScreen onBack={() => setCurrentView('dashboard')} onNavigate={handleNavigate} />
      </Suspense>
    );
  }
  
  // Kitchen Display System
  if (currentView === 'kitchen' && isAuthenticated) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <KitchenDisplay onBack={() => setCurrentView((user?.role === 'admin' || user?.role === 'tour') ? 'dashboard' : 'login')} onNavigate={handleNavigate} />
        </Suspense>
      );
  }

  // Inventory
  if (currentView === 'inventory' && isAuthenticated && (user?.role === 'admin' || user?.role === 'tour')) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <InventoryManagement 
            onBack={() => setCurrentView('dashboard')} 
            onNavigate={handleNavigate}
          />
        </Suspense>
      );
  }

  // Table Plan
  if (currentView === 'tables' && isAuthenticated && user) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <TablePlan 
            user={user} 
            onLogout={handleLogout}
            onSelectTable={handleSelectTable}
            onBack={() => setCurrentView('dashboard')}
            onNavigate={handleNavigate}
          />
        </Suspense>
      );
  }

  // Cash Register
  if (currentView === 'cash_register' && isAuthenticated && (user?.role === 'admin' || user?.role === 'tour')) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <CashRegisterScreen employeeId={user.id} onNavigate={handleNavigate} />
        </Suspense>
      );
  }

  // Analytics
  if (currentView === 'analytics' && isAuthenticated && (user?.role === 'admin' || user?.role === 'tour')) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <AnalyticsScreen onNavigate={handleNavigate} />
        </Suspense>
      );
  }

  // Menu Engineering
  if (currentView === 'menu_engineering' && isAuthenticated && (user?.role === 'admin' || user?.role === 'tour')) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <Layout>
            <MenuEngineeringScreen onNavigate={handleNavigate} />
          </Layout>
        </Suspense>
      );
  }

  // CFD
  if (currentView === 'cfd') {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <CFDScreen onNavigate={handleNavigate} />
        </Suspense>
      );
  }

  // POS (Point of Sale)
  if (currentView === 'pos' && isAuthenticated && user && selectedTable) {
      return (
        <Suspense fallback={<LoadingFallback />}>
          <POSScreen 
            table={selectedTable}
            employeeId={user.id}
            onBack={() => {
                setSelectedTable(null);
                setCurrentView('tables');
            }}
            onNavigate={handleNavigate}
          />
        </Suspense>
      );
  }

  return (
    <Layout>
      <div className="flex-1 w-full min-h-0 flex flex-col">
        {isAuthenticated && user && currentView === 'dashboard' ? (
          <div className="flex-1 w-full animate-in zoom-in-95 duration-300 flex flex-col min-h-0">
            <Suspense fallback={<LoadingFallback />}>
              <Dashboard 
                onLogout={handleLogout} 
                onNavigate={handleNavigate}
              />
            </Suspense>
          </div>
        ) : (
          <div className="w-full px-4 flex-1 flex flex-col justify-center items-center animate-in fade-in zoom-in-95 duration-500">
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