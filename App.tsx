import React, { useEffect } from 'react';
import { Layout } from './components/Layout';
import { AuthView } from './components/Views/AuthView';
import { UserManagementView } from './components/Views/UserManagementView';
import { DashboardView } from './components/Views/DashboardView';
import { InventoryView } from './components/Views/InventoryView';
import { MenuView } from './components/Views/MenuView';
import { POSView } from './components/Views/POSView';
import { AIView } from './components/Views/AIView';
import { ReportsView } from './components/Views/ReportsView';
import { ProcurementView } from './components/Views/ProcurementView';
import { KitchenPrepView } from './components/Views/KitchenPrepView'; 
import { ProfileView } from './components/Views/ProfileView';
import { View, User } from './types';
import { Loader2 } from 'lucide-react';

import { AuthProvider, useAuth } from './contexts/AuthContext';
import { useDataStore } from './contexts/DataContext';
import { ModalProvider } from './contexts/ModalContext';
import { ToastProvider } from './contexts/ToastContext';

const AppLogic: React.FC = () => {
  const { currentUser, login } = useAuth();
  const { shifts, isLoading, initializeApp } = useDataStore(state => ({
    shifts: state.shifts,
    isLoading: state.isLoading,
    initializeApp: state.initializeApp,
  }));
  
  const [currentView, setCurrentView] = React.useState<View>('dashboard');

  useEffect(() => {
    // This function will run once on app startup to fetch all data from Supabase
    initializeApp();
  }, [initializeApp]);

  useEffect(() => {
    if (currentUser) {
       handleLogin(currentUser, true);
    }
  }, [currentUser]);

  const handleLogin = (user: User, isAutoLogin = false) => {
    if(!isAutoLogin) login(user);
    if (user.role === 'cashier') setCurrentView('pos');
    else if (user.role === 'chef') setCurrentView('kitchen-prep');
    else setCurrentView('dashboard');
  };

  const currentShift = shifts.find(s => s.status === 'open');

  const renderView = () => {
    if (!currentUser) return null;

    const permissions: Record<string, string[]> = {
        manager: ['dashboard', 'pos', 'menu', 'kitchen-prep', 'inventory', 'ai-assistant', 'reports', 'procurement', 'users', 'profile'],
        cashier: ['pos', 'menu', 'dashboard', 'profile'], 
        chef: ['kitchen-prep', 'inventory', 'menu', 'procurement', 'profile']
    };

    const allowedViews = permissions[currentUser.role] || [];
    
    if (!allowedViews.includes(currentView)) {
        const fallbackView = allowedViews.includes('dashboard') ? 'dashboard'
                           : allowedViews.includes('pos') ? 'pos'
                           : allowedViews.includes('kitchen-prep') ? 'kitchen-prep'
                           : 'profile';
        setCurrentView(fallbackView as View);
        return null;
    }

    switch (currentView) {
      case 'dashboard':
        return <DashboardView onNavigate={setCurrentView} />;
      case 'inventory':
        return <InventoryView onNavigate={setCurrentView} />;
      case 'menu':
        return <MenuView />;
      case 'pos':
        return <POSView currentShift={currentShift} />;
      case 'ai-assistant':
        return <AIView />;
      case 'reports':
        return <ReportsView currentShift={currentShift} />;
      case 'procurement':
        return <ProcurementView />;
      case 'kitchen-prep':
        return <KitchenPrepView />;
      case 'users':
        return currentUser.role === 'manager' ? <UserManagementView /> : null;
      case 'profile':
        return <ProfileView />;
      default:
        return <DashboardView onNavigate={setCurrentView} />;
    }
  };

  if (isLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-slate-100 text-slate-800">
        <div className="flex flex-col items-center gap-4 text-center">
           <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
           <p className="font-bold text-lg">در حال بارگذاری اطلاعات از سرور...</p>
           <p className="text-sm text-slate-400">این فرآیند فقط در اولین اجرا کمی طول می‌کشد</p>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView onLogin={handleLogin} />;
  }

  return (
    <Layout currentView={currentView} onChangeView={setCurrentView}>
      {renderView()}
    </Layout>
  );
};


const App: React.FC = () => (
  <AuthProvider>
    <ToastProvider>
      <ModalProvider>
        <AppLogic />
      </ModalProvider>
    </ToastProvider>
  </AuthProvider>
);

export default App;
