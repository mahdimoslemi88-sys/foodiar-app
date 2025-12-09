import React, { useState } from 'react';
import { User, UserRole } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { useModal } from '../../contexts/ModalContext';
import { Users, UserPlus, Trash2, ShieldCheck, ChefHat, Store } from 'lucide-react';

export const UserManagementView: React.FC = () => {
  const { users, setUsers, currentUser } = useAuth();
  const { showToast } = useToast();
  const { showModal } = useModal();

  const [formData, setFormData] = useState<Partial<User>>({
    name: '',
    username: '',
    pin: '',
    role: 'cashier'
  });

  const handleAddUser = () => {
    if (!formData.name || !formData.pin || !formData.role) {
        showToast('لطفا تمام فیلدها را پر کنید.', 'error');
        return;
    }
    
    if (users.some(u => u.pin === formData.pin)) {
        showToast('این کد پرسنلی قبلا استفاده شده است.', 'error');
        return;
    }

    const newUser: User = {
        id: crypto.randomUUID(),
        name: formData.name,
        username: formData.name.toLowerCase().replace(/\s/g, ''),
        pin: formData.pin,
        role: formData.role as UserRole
    };

    setUsers(prev => [...prev, newUser]);
    setFormData({ name: '', username: '', pin: '', role: 'cashier' });
    showToast('کاربر جدید با موفقیت اضافه شد.');
  };

  const handleDeleteUser = (id: string) => {
    if (!currentUser) return;
    if (id === currentUser.id) {
        showToast('شما نمی‌توانید حساب خودتان را حذف کنید.', 'warning');
        return;
    }
    if (users.length <= 1) {
        showToast('حداقل یک کاربر باید در سیستم وجود داشته باشد.', 'warning');
        return;
    }

    showModal('حذف کاربر', 'آیا از حذف این کاربر اطمینان دارید؟ این عمل غیرقابل بازگشت است.', () => {
        setUsers(prev => prev.filter(u => u.id !== id));
        showToast('کاربر با موفقیت حذف شد.', 'error');
    });
  };

  const getRoleLabel = (role: UserRole) => {
      switch(role) {
          case 'manager': return 'مدیر رستوران';
          case 'chef': return 'سرآشپز';
          case 'cashier': return 'صندوق‌دار';
          default: return role;
      }
  };

  const getRoleIcon = (role: UserRole) => {
      switch(role) {
          case 'manager': return <ShieldCheck className="w-5 h-5" />;
          case 'chef': return <ChefHat className="w-5 h-5" />;
          case 'cashier': return <Store className="w-5 h-5" />;
      }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-12 pt-24 pb-32 md:pb-12 md:pt-12 max-w-5xl mx-auto space-y-8 animate-in fade-in duration-500">
        
        <div className="flex justify-between items-center">
            <div>
                <h2 className="text-3xl font-black text-slate-900 tracking-tight flex items-center gap-3">
                    <Users className="w-8 h-8 text-indigo-600" />
                    مدیریت کاربران
                </h2>
                <p className="text-slate-400 font-bold text-sm mt-1">تعریف پرسنل و سطح دسترسی</p>
            </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="bg-white rounded-[32px] p-8 shadow-xl shadow-slate-200/50 border border-slate-100 h-fit">
                <h3 className="font-bold text-lg text-slate-800 mb-6 flex items-center gap-2">
                    <UserPlus className="w-5 h-5 text-indigo-500" />
                    افزودن پرسنل جدید
                </h3>
                
                <div className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">نام و نام خانوادگی</label>
                        <input 
                            type="text" 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                            placeholder="مثلا: علی محمدی"
                        />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">نقش (سطح دسترسی)</label>
                        <div className="grid grid-cols-1 gap-2">
                            {['manager', 'cashier', 'chef'].map(role => (
                                <button
                                    key={role}
                                    onClick={() => setFormData({...formData, role: role as UserRole})}
                                    className={`flex items-center gap-3 p-3 rounded-xl border-2 transition-all ${formData.role === role ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-slate-100 bg-white text-slate-500 hover:bg-slate-50'}`}
                                >
                                    <div className={`p-2 rounded-full ${formData.role === role ? 'bg-white' : 'bg-slate-100'}`}>
                                        {getRoleIcon(role as UserRole)}
                                    </div>
                                    <span className="font-bold text-sm">{getRoleLabel(role as UserRole)}</span>
                                </button>
                            ))}
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">کد ورود (PIN)</label>
                        <input 
                            type="number"
                            maxLength={4} 
                            value={formData.pin}
                            onChange={e => setFormData({...formData, pin: e.target.value.slice(0, 4)})}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-black text-center tracking-widest text-lg text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                            placeholder="****"
                        />
                        <p className="text-xs text-slate-400 mt-2 pr-1">یک کد ۴ رقمی برای ورود به سیستم</p>
                    </div>

                    <button 
                        onClick={handleAddUser}
                        className="w-full bg-slate-900 text-white py-4 rounded-2xl font-bold hover:bg-slate-800 shadow-lg shadow-slate-300 transition-all flex items-center justify-center gap-2 mt-4"
                    >
                        <UserPlus className="w-5 h-5" />
                        ثبت کاربر
                    </button>
                </div>
            </div>

            <div className="md:col-span-2 space-y-4">
                {users.map(user => (
                    <div key={user.id} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex items-center justify-between group hover:border-indigo-200 transition-all">
                        <div className="flex items-center gap-4">
                            <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shadow-sm ${
                                user.role === 'manager' ? 'bg-indigo-100 text-indigo-600' :
                                user.role === 'chef' ? 'bg-orange-100 text-orange-600' : 'bg-emerald-100 text-emerald-600'
                            }`}>
                                {getRoleIcon(user.role)}
                            </div>
                            <div>
                                <h4 className="font-black text-lg text-slate-800">{user.name}</h4>
                                <div className="flex items-center gap-2 mt-1">
                                    <span className={`text-xs font-bold px-2 py-0.5 rounded-lg border ${
                                        user.role === 'manager' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                                        user.role === 'chef' ? 'bg-orange-50 text-orange-600 border-orange-100' : 'bg-emerald-50 text-emerald-600 border-emerald-100'
                                    }`}>
                                        {getRoleLabel(user.role)}
                                    </span>
                                    <span className="text-xs text-slate-400 font-mono bg-slate-50 px-2 py-0.5 rounded border border-slate-100">PIN: ****</span>
                                </div>
                            </div>
                        </div>

                        <div className="flex items-center gap-3">
                            {currentUser && user.id === currentUser.id && (
                                <span className="text-xs font-bold text-indigo-500 bg-indigo-50 px-3 py-1.5 rounded-full">شما</span>
                            )}
                            <button 
                                onClick={() => handleDeleteUser(user.id)}
                                disabled={currentUser ? user.id === currentUser.id : false}
                                className="w-10 h-10 flex items-center justify-center rounded-xl bg-slate-50 text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-30 disabled:hover:bg-slate-50 disabled:hover:text-slate-400 transition-all"
                            >
                                <Trash2 className="w-5 h-5" />
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    </div>
  );
};
