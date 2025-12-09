import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { ChefHat, Lock, ArrowLeft, Users, ShieldCheck, Store } from 'lucide-react';

interface AuthViewProps {
  onLogin: (user: User) => void;
}

const getRoleDetails = (role: UserRole) => {
    switch(role) {
        case 'manager': return { label: 'مدیر', icon: <ShieldCheck className="w-5 h-5" />, colorClass: 'bg-indigo-500', colorHex: '#6366f1' };
        case 'chef': return { label: 'سرآشپز', icon: <ChefHat className="w-5 h-5" />, colorClass: 'bg-orange-500', colorHex: '#f97316' };
        case 'cashier': return { label: 'صندوق‌دار', icon: <Store className="w-5 h-5" />, colorClass: 'bg-emerald-500', colorHex: '#10b981' };
        default: return { label: 'کاربر', icon: <Users className="w-5 h-5" />, colorClass: 'bg-slate-500', colorHex: '#64748b' };
    }
};

export const AuthView: React.FC<AuthViewProps> = ({ onLogin }) => {
  const { users } = useAuth();
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedUser) return;

    if (selectedUser.pin === pin) {
      onLogin(selectedUser);
    } else {
      setError('کد ورود نامعتبر است');
      setPin('');
    }
  };

  const handleNumPad = (num: string) => {
    if (pin.length < 6) {
      setPin(prev => prev + num);
      setError('');
    }
  };

  const handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError('');
  };
  
  const handleUserSelect = (user: User) => {
      setSelectedUser(user);
      setPin('');
      setError('');
  };
  
  const handleSwitchUser = () => {
      setSelectedUser(null);
      setPin('');
      setError('');
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4 selection:bg-indigo-100 selection:text-indigo-900">
        <div className="bg-white rounded-[40px] shadow-2xl w-full max-w-lg overflow-hidden relative transition-all duration-500">
           
           <div className="p-8 text-center relative overflow-hidden bg-slate-900">
             <div className="absolute top-0 left-0 w-full h-full bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-[0.02]"></div>
             <div className="relative z-10">
                <div className="w-16 h-16 bg-white/10 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-4 border border-white/20">
                  <ChefHat className="w-8 h-8 text-white" />
                </div>
                <h1 className="text-2xl font-black text-white tracking-tight">Foodyar 2</h1>
                <p className="text-slate-400 font-bold text-sm">سیستم مدیریت هوشمند رستوران</p>
             </div>
           </div>

           <div className="relative min-h-[450px]">
               {/* User Selection View */}
               <div className={`p-8 transition-all duration-300 ${selectedUser ? 'opacity-0 -translate-x-full absolute w-full' : 'opacity-100 translate-x-0'}`}>
                    <div className="text-center mb-8">
                       <h2 className="text-xl font-extrabold text-slate-800">انتخاب کاربر</h2>
                       <p className="text-slate-400 text-sm mt-1">کدام پرسنل از سیستم استفاده می‌کند؟</p>
                    </div>
                    <div className="space-y-3 max-h-[50vh] overflow-y-auto custom-scrollbar p-1">
                        {users.map(user => {
                            const roleDetails = getRoleDetails(user.role);
                            return (
                                <button
                                  key={user.id}
                                  onClick={() => handleUserSelect(user)}
                                  className="w-full flex items-center gap-4 p-4 rounded-2xl bg-slate-50 hover:bg-white hover:shadow-lg hover:shadow-slate-100 border border-slate-100 hover:border-indigo-200 transition-all text-right"
                                >
                                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center font-bold text-lg text-white shrink-0 ${roleDetails.colorClass}`}>
                                        {user.name.charAt(0)}
                                    </div>
                                    <div className="overflow-hidden">
                                        <p className="font-bold text-slate-800 text-base truncate">{user.name}</p>
                                        <p className="text-[10px] text-slate-400 font-bold truncate">{roleDetails.label}</p>
                                    </div>
                                </button>
                            )
                        })}
                    </div>
               </div>

               {/* PIN Entry View */}
               <div className={`p-8 transition-all duration-300 ${selectedUser ? 'opacity-100 translate-x-0' : 'opacity-0 translate-x-full absolute w-full top-0'}`}>
                   {selectedUser && (
                       <>
                           <div className="text-center mb-6 relative">
                               <button onClick={handleSwitchUser} className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-slate-100 rounded-full flex items-center justify-center text-slate-500 hover:bg-slate-200">
                                   <ArrowLeft className="w-5 h-5" />
                               </button>
                               <div className="w-16 h-16 rounded-full flex items-center justify-center font-bold text-2xl text-white mx-auto mb-3"
                                    style={{ backgroundColor: getRoleDetails(selectedUser.role).colorHex }}
                               >
                                   {selectedUser.name.charAt(0)}
                               </div>
                               <h2 className="text-xl font-extrabold text-slate-800">{selectedUser.name}</h2>
                               <p className="text-slate-400 text-sm mt-1">کد پرسنلی خود را وارد کنید</p>
                           </div>
                           
                           <div className="mb-6 h-4 flex justify-center items-center gap-3">
                              {[...Array(4)].map((_, i) => (
                                 <div key={i} className={`w-3 h-3 rounded-full transition-all duration-200 ${i < pin.length ? 'bg-indigo-600 scale-110' : 'bg-slate-200'}`}></div>
                              ))}
                           </div>

                           {error && (
                             <div className="bg-rose-50 text-rose-600 text-center text-sm font-bold py-2.5 rounded-xl mb-4 animate-in shake">
                                {error}
                             </div>
                           )}

                           <div className="grid grid-cols-3 gap-3 mb-4">
                                {[...[1, 2, 3, 4, 5, 6, 7, 8, 9].map(String), 'empty', '0', 'backspace'].map(key => {
                                    if (key === 'empty') return <div key={key}></div>;
                                    if (key === 'backspace') return (
                                        <button key={key} onClick={handleBackspace} className="h-14 rounded-2xl bg-slate-50 text-slate-500 hover:bg-rose-50 hover:text-rose-600 transition-all flex items-center justify-center active:scale-95"><ArrowLeft className="w-5 h-5" /></button>
                                    );
                                    return (
                                        <button key={key} onClick={() => handleNumPad(key)} className="h-14 rounded-2xl bg-slate-50 hover:bg-slate-100 text-2xl font-bold text-slate-700 transition-all active:scale-95">{key}</button>
                                    );
                                })}
                           </div>

                           <button onClick={handleLogin} className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold text-lg hover:bg-slate-800 shadow-xl shadow-slate-300 transition-all active:scale-[0.98]">
                              ورود
                           </button>
                       </>
                   )}
               </div>
           </div>
        </div>
    </div>
  );
};
