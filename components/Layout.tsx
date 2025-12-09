import React from 'react';
import { LayoutDashboard, ShoppingBasket, ChefHat, Store, Menu as MenuIcon, ClipboardList, Bot, Sparkles, LogOut, Users, User as UserIcon } from 'lucide-react';
import { View, UserRole } from '../types';
import { useAuth } from '../contexts/AuthContext';

interface LayoutProps {
  currentView: View;
  onChangeView: (view: View) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ currentView, onChangeView, children }) => {
  const { currentUser } = useAuth();

  if (!currentUser) return null;
  
  const permissions: Record<UserRole, string[]> = {
      manager: ['dashboard', 'pos', 'menu', 'kitchen-prep', 'inventory', 'ai-assistant', 'reports', 'procurement', 'users', 'profile'],
      cashier: ['pos', 'menu', 'dashboard', 'profile'],
      chef: ['kitchen-prep', 'inventory', 'menu', 'procurement', 'profile']
  };

  const allNavItems = [
    { id: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
    { id: 'pos', label: 'صندوق', icon: Store },
    { id: 'menu', label: 'مدیریت منو', icon: MenuIcon },
    { id: 'kitchen-prep', label: 'میزانپلاس', icon: ClipboardList },
    { id: 'inventory', label: 'انبار', icon: ShoppingBasket },
    { id: 'ai-assistant', label: 'هوش مصنوعی', icon: Bot },
    { id: 'users', label: 'کاربران', icon: Users },
  ];

  const allowedViews = permissions[currentUser.role] || [];
  const navItems = allNavItems.filter(item => allowedViews.includes(item.id));
  const canAccessAI = allowedViews.includes('ai-assistant');

  return (
    <div className="flex h-[100dvh] bg-[#F5F5F7] font-['Vazirmatn'] overflow-hidden selection:bg-indigo-100 selection:text-indigo-900">
      <aside className="w-64 hidden md:flex flex-col z-30 m-6 mr-0">
        <div className="px-6 pb-8 pt-4">
          <div className="flex items-center gap-3">
             <div className="w-10 h-10 bg-slate-900 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-slate-300/50">
                <ChefHat className="w-5 h-5" />
             </div>
             <div>
                <h1 className="text-lg font-black text-slate-800 tracking-tight leading-none">Foodyar 2</h1>
                <span className="text-[10px] font-bold text-slate-400">Restaurant OS</span>
             </div>
          </div>
        </div>

        <div className="px-4 mb-6">
            <button
              onClick={() => onChangeView('profile')}
              className="w-full bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3 hover:shadow-md hover:border-indigo-100 active:scale-95 transition-all text-right"
            >
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg text-white shrink-0 ${
                    currentUser.role === 'manager' ? 'bg-indigo-500' : 
                    currentUser.role === 'chef' ? 'bg-orange-500' : 'bg-emerald-500'
                }`}>
                    {currentUser.name.charAt(0)}
                </div>
                <div className="overflow-hidden">
                    <p className="font-bold text-slate-800 text-sm truncate">{currentUser.name}</p>
                    <p className="text-[10px] text-slate-400 font-bold truncate">
                        {currentUser.role === 'manager' ? 'مدیر رستوران' : currentUser.role === 'chef' ? 'سرآشپز' : 'صندوق‌دار'}
                    </p>
                </div>
            </button>
        </div>

        <nav className="flex-1 space-y-1 px-4 overflow-y-auto custom-scrollbar">
          {navItems.map((item) => {
            const isActive = currentView === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onChangeView(item.id as View)}
                className={`group flex items-center w-full px-4 py-3.5 rounded-2xl transition-all duration-300 active:scale-95 ${
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm font-bold scale-[1.02]'
                    : 'text-slate-500 hover:bg-white/40 hover:text-slate-700 font-medium'
                }`}
              >
                <item.icon 
                  className={`w-5 h-5 ml-4 transition-colors ${
                    isActive ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'
                  }`} 
                  strokeWidth={isActive ? 2.5 : 2}
                />
                <span className="text-sm">
                  {item.label}
                </span>
                {isActive && <div className="mr-auto w-1.5 h-1.5 rounded-full bg-indigo-600"></div>}
              </button>
            );
          })}
        </nav>
      </aside>

      <div className="md:hidden fixed top-0 w-full bg-[#F5F5F7]/80 backdrop-blur-xl z-40 px-5 py-3 flex justify-between items-center border-b border-white/50">
         <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-slate-900 rounded-xl flex items-center justify-center text-white">
                <ChefHat className="w-4 h-4" />
            </div>
            <span className="font-black text-lg text-slate-800">Foodyar 2</span>
         </div>
         <div className="flex items-center gap-3">
             {canAccessAI && (
                <button 
                    onClick={() => onChangeView('ai-assistant')} 
                    title="دستیار هوشمند"
                    className="w-9 h-9 rounded-full bg-indigo-50 text-indigo-500 flex items-center justify-center shadow-sm border border-indigo-100 active:scale-95 transition-transform"
                >
                    <Sparkles className="w-5 h-5" />
                </button>
             )}
             <button onClick={() => onChangeView('profile')} title="پروفایل کاربری" className="w-9 h-9 rounded-full bg-white text-slate-600 flex items-center justify-center shadow-sm border border-slate-100 active:scale-95 transition-transform">
                 <UserIcon className="w-4 h-4" />
             </button>
         </div>
      </div>

      <div className="md:hidden fixed bottom-6 inset-x-6 z-50">
        <nav className="bg-slate-900/90 backdrop-blur-2xl rounded-[24px] shadow-2xl shadow-slate-900/20 p-1.5 flex justify-between items-center">
           {navItems.slice(0, 5).map((item) => {
              const isActive = currentView === item.id;
              return (
                 <button
                   key={item.id}
                   onClick={() => onChangeView(item.id as View)}
                   className={`flex-1 flex items-center justify-center py-3.5 rounded-2xl transition-all duration-300 active:scale-95 ${
                      isActive ? 'bg-white/10 text-white' : 'text-slate-500'
                   }`}
                 >
                    <item.icon className={`w-6 h-6 ${isActive ? 'stroke-[2.5px]' : 'stroke-2'}`} />
                 </button>
              );
           })}
        </nav>
      </div>

      <main className="flex-1 h-full relative overflow-hidden bg-[#F5F5F7] md:bg-[#F5F5F7] md:rounded-l-[40px] md:my-4 md:mr-4 md:shadow-inner md:border md:border-white/50">
        {canAccessAI && (
            <button 
                onClick={() => onChangeView('ai-assistant')}
                title="دستیار هوشمند AssistChef"
                className="hidden md:flex absolute top-6 left-6 w-14 h-14 bg-slate-900 text-white rounded-full items-center justify-center shadow-2xl shadow-slate-900/20 z-40 hover:scale-110 hover:shadow-slate-900/30 active:scale-95 transition-all group"
            >
                <Sparkles className="w-6 h-6 group-hover:rotate-12 transition-transform" />
            </button>
        )}
        {children}
      </main>
    </div>
  );
};