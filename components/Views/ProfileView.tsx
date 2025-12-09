import React from 'react';
import { User } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { LogOut, User as UserIcon, ShieldCheck, ChefHat, Store } from 'lucide-react';

export const ProfileView: React.FC = () => {
    const { currentUser, logout } = useAuth();

    if (!currentUser) return null;

    const getRoleDetails = (role: User['role']) => {
        switch(role) {
            case 'manager': return { label: 'مدیر رستوران', icon: <ShieldCheck className="w-6 h-6" />, colorClass: 'bg-indigo-100 text-indigo-600' };
            case 'chef': return { label: 'سرآشپز', icon: <ChefHat className="w-6 h-6" />, colorClass: 'bg-orange-100 text-orange-600' };
            case 'cashier': return { label: 'صندوق‌دار', icon: <Store className="w-6 h-6" />, colorClass: 'bg-emerald-100 text-emerald-600' };
            default: return { label: 'کاربر', icon: <UserIcon className="w-6 h-6" />, colorClass: 'bg-slate-100 text-slate-600' };
        }
    };

    const roleDetails = getRoleDetails(currentUser.role);
    
    return (
        <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-12 pt-24 pb-32 md:pb-12 md:pt-12 max-w-2xl mx-auto space-y-10 animate-in fade-in duration-700">
            <div className="flex flex-col items-center text-center">
                <div className={`w-32 h-32 rounded-full flex items-center justify-center font-black text-6xl text-white mb-6 shadow-xl ${
                    currentUser.role === 'manager' ? 'bg-indigo-500 shadow-indigo-200' : 
                    currentUser.role === 'chef' ? 'bg-orange-500 shadow-orange-200' : 'bg-emerald-500 shadow-emerald-200'
                }`}>
                    {currentUser.name.charAt(0)}
                </div>
                <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-2">{currentUser.name}</h2>
                <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold ${roleDetails.colorClass}`}>
                    {roleDetails.icon}
                    <span>{roleDetails.label}</span>
                </div>
            </div>

            <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/50 border border-slate-100">
                <h3 className="text-lg font-bold text-slate-800 mb-6">تنظیمات حساب کاربری</h3>
                <div className="space-y-4">
                    <div className="flex justify-between items-center p-4 bg-slate-50 rounded-2xl">
                        <span className="font-bold text-slate-600">کد ورود (PIN)</span>
                        <span className="font-mono font-black text-lg text-slate-800 tracking-widest">****</span>
                    </div>
                    <button className="w-full text-center p-4 bg-slate-100 text-slate-400 rounded-2xl font-bold cursor-not-allowed">
                        تغییر کد ورود (بزودی)
                    </button>
                    <button 
                        onClick={logout}
                        className="w-full flex items-center justify-center gap-3 px-4 py-4 text-rose-500 bg-rose-50 hover:bg-rose-100 rounded-2xl transition-colors font-bold text-base mt-8"
                    >
                        <LogOut className="w-5 h-5" />
                        خروج از حساب
                    </button>
                </div>
            </div>
        </div>
    );
};
