import React, { useState } from 'react';
import { Expense, Shift } from '../../types';
import { useDataStore } from '../../contexts/DataContext';
import { useModal } from '../../contexts/ModalContext';
import { useToast } from '../../contexts/ToastContext';
import { Calendar, Plus, TrendingDown, DollarSign, Wallet, ArrowDownRight, Trash2, Lock, Unlock, AlertOctagon, Banknote, CreditCard, Globe } from 'lucide-react';

interface ReportsProps {
  currentShift?: Shift;
}

export const ReportsView: React.FC<ReportsProps> = ({ currentShift }) => {
  const { sales, expenses, setExpenses, shifts, setShifts, wasteRecords, addAuditLog } = useDataStore();
  const { showModal } = useModal();
  const { showToast } = useToast();
  
  const [viewMode, setViewMode] = useState<'financial' | 'expenses' | 'shifts'>('financial');
  
  const [expTitle, setExpTitle] = useState('');
  const [expAmount, setExpAmount] = useState<number>(0);
  const [expCategory, setExpCategory] = useState<Expense['category']>('other');

  const [startCash, setStartCash] = useState(0);
  const [endCash, setEndCash] = useState(0);
  const [bankDeposit, setBankDeposit] = useState(0);

  const totalRevenue = sales.filter(s => s.shiftId ? s.paymentMethod !== 'void' : true).reduce((acc, sale) => acc + sale.totalAmount, 0);
  const totalCOGS = sales.reduce((acc, sale) => acc + sale.totalCost, 0);
  const totalWasteLoss = wasteRecords.reduce((acc, w) => acc + w.costLoss, 0);
  
  const grossProfit = totalRevenue - totalCOGS;
  const totalOpEx = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  
  const netProfit = grossProfit - totalOpEx - totalWasteLoss;

  const handleAddExpense = () => {
    if (!expTitle || expAmount <= 0) return;
    
    const newExpense: Expense = {
      id: crypto.randomUUID(),
      title: expTitle,
      amount: expAmount,
      category: expCategory,
      date: Date.now()
    };
    
    setExpenses(prev => [newExpense, ...prev]);
    addAuditLog('CREATE', 'EXPENSE', `Created expense: ${newExpense.title} for ${newExpense.amount}`);
    setExpTitle('');
    setExpAmount(0);
    setExpCategory('other');
    showToast('هزینه با موفقیت ثبت شد.');
  };

  const handleDeleteExpense = (id: string) => {
    showModal('حذف هزینه', 'آیا از حذف این هزینه اطمینان دارید؟', () => {
        const expenseToDelete = expenses.find(e => e.id === id);
        if(expenseToDelete) addAuditLog('DELETE', 'EXPENSE', `Deleted expense: ${expenseToDelete.title}`);
        setExpenses(prev => prev.filter(e => e.id !== id));
        showToast('هزینه با موفقیت حذف شد.', 'error');
    });
  };

  const handleStartShift = () => {
      const newShift: Shift = {
          id: crypto.randomUUID(),
          startTime: Date.now(),
          startingCash: startCash,
          status: 'open'
      };
      setShifts(prev => [newShift, ...prev]);
      setStartCash(0);
      showToast('شیفت جدید با موفقیت باز شد.');
  };

  const handleCloseShift = () => {
      if(!currentShift) return;

      const shiftSales = sales.filter(s => s.shiftId === currentShift.id);
      const cashSales = shiftSales.filter(s => s.paymentMethod === 'cash').reduce((sum, s) => sum + s.totalAmount, 0);
      const cardSales = shiftSales.filter(s => s.paymentMethod === 'card').reduce((sum, s) => sum + s.totalAmount, 0);
      const onlineSales = shiftSales.filter(s => s.paymentMethod === 'online').reduce((sum, s) => sum + s.totalAmount, 0);
      
      const expectedCashInDrawer = currentShift.startingCash + cashSales;
      const discrepancy = endCash - expectedCashInDrawer;

      const closedShift: Shift = {
          ...currentShift,
          endTime: Date.now(),
          actualCashSales: endCash,
          expectedCashSales: expectedCashInDrawer,
          cardSales: cardSales,
          onlineSales: onlineSales,
          bankDeposit: bankDeposit,
          discrepancy: discrepancy,
          status: 'closed'
      };

      setShifts(prev => prev.map(s => s.id === currentShift.id ? closedShift : s));
      addAuditLog('SHIFT_CLOSE', 'SHIFT', `Shift ${currentShift.id} closed. Discrepancy: ${discrepancy}`);
      setEndCash(0);
      setBankDeposit(0);
      showToast('شیفت با موفقیت بسته شد.');
  };

  const getCategoryLabel = (cat: string) => {
     const map: any = { rent: 'اجاره', salary: 'حقوق', utilities: 'قبوض', marketing: 'تبلیغات', maintenance: 'تعمیرات', other: 'سایر' };
     return map[cat] || cat;
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 pt-24 pb-32 md:pb-8 md:pt-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-extrabold text-slate-800">هاب مالی و حسابداری</h2>
           <p className="text-slate-500 text-sm mt-1">کنترل داخلی، بستن حساب‌ها و گزارشات دقیق (P&L)</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm">
           <button 
              onClick={() => setViewMode('financial')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'financial' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
           >
              صورت سود و زیان
           </button>
           <button 
              onClick={() => setViewMode('shifts')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'shifts' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
           >
              مدیریت شیفت (Z-Report)
           </button>
           <button 
              onClick={() => setViewMode('expenses')}
              className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${viewMode === 'expenses' ? 'bg-slate-900 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}
           >
              ثبت هزینه
           </button>
        </div>
      </div>

      {viewMode === 'financial' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
           <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 overflow-hidden relative">
              <div className="bg-slate-900 p-6 text-white">
                 <h3 className="font-bold text-lg flex items-center gap-2">
                    <Wallet className="w-5 h-5" />
                    صورت سود و زیان (P&L)
                 </h3>
                 <p className="text-slate-400 text-xs mt-1">خلاصه عملکرد مالی با کسر ضایعات و هزینه‌ها</p>
              </div>
              <div className="p-8 space-y-4">
                 <div className="flex justify-between items-end border-b border-dashed border-slate-100 pb-2">
                    <div>
                        <p className="text-slate-400 text-xs font-bold mb-1">درآمد کل فروش (Gross Revenue)</p>
                        <p className="text-2xl font-extrabold text-slate-800">{totalRevenue.toLocaleString()}</p>
                    </div>
                    <div className="bg-indigo-50 text-indigo-600 px-3 py-1 rounded-lg text-xs font-bold">+</div>
                 </div>

                 <div className="flex justify-between items-end border-b border-dashed border-slate-100 pb-2">
                    <div>
                        <p className="text-slate-400 text-xs font-bold mb-1">بهای تمام شده کالای فروش رفته (COGS)</p>
                        <p className="text-xl font-extrabold text-rose-500">{totalCOGS.toLocaleString()}</p>
                    </div>
                    <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-xs font-bold">-</div>
                 </div>

                 <div className="flex justify-between items-end bg-slate-50 p-3 rounded-2xl">
                    <div>
                        <p className="text-slate-500 text-xs font-bold mb-1">سود ناخالص (Gross Profit)</p>
                        <p className="text-lg font-bold text-slate-700">{grossProfit.toLocaleString()}</p>
                    </div>
                    <div className="text-xs font-bold text-slate-400">Revenue - COGS</div>
                 </div>

                 <div className="flex justify-between items-end border-b border-dashed border-slate-100 pb-2">
                    <div>
                        <p className="text-slate-400 text-xs font-bold mb-1">هزینه ضایعات (Cost of Waste)</p>
                        <p className="text-xl font-extrabold text-rose-600">{totalWasteLoss.toLocaleString()}</p>
                    </div>
                    <div className="bg-rose-50 text-rose-600 px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1">
                        <Trash2 className="w-3 h-3" /> -
                    </div>
                 </div>

                 <div className="flex justify-between items-end border-b border-dashed border-slate-100 pb-2">
                    <div>
                        <p className="text-slate-400 text-xs font-bold mb-1">هزینه‌های عملیاتی (OpEx)</p>
                        <p className="text-xl font-extrabold text-orange-500">{totalOpEx.toLocaleString()}</p>
                    </div>
                    <div className="bg-orange-50 text-orange-600 px-3 py-1 rounded-lg text-xs font-bold">-</div>
                 </div>

                 <div className={`flex justify-between items-center p-6 rounded-2xl mt-4 ${netProfit >= 0 ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-200' : 'bg-rose-600 text-white shadow-lg shadow-rose-200'}`}>
                    <div>
                        <p className="text-white/80 text-sm font-bold mb-1">سود خالص واقعی (True Net Profit)</p>
                        <p className="text-3xl font-black tracking-tight">{netProfit.toLocaleString()} <span className="text-base font-normal opacity-80">تومان</span></p>
                    </div>
                    <div className="bg-white/20 p-3 rounded-xl">
                       <DollarSign className="w-8 h-8" />
                    </div>
                 </div>
              </div>
           </div>

           <div className="bg-white rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 flex flex-col max-h-[500px]">
              <div className="p-6 border-b border-slate-100 bg-rose-50 rounded-t-[32px]">
                 <h3 className="font-bold text-lg text-rose-900 flex items-center gap-2">
                    <Trash2 className="w-5 h-5" />
                    گزارش ضایعات (Financial Losses)
                 </h3>
              </div>
              <div className="flex-1 overflow-y-auto custom-scrollbar p-2">
                 {wasteRecords.length === 0 ? (
                     <div className="text-center p-10 text-slate-400">هیچ ضایعاتی ثبت نشده است.</div>
                 ) : (
                     <table className="w-full text-right border-collapse">
                        <thead className="text-xs text-slate-400 font-bold sticky top-0 bg-white">
                           <tr>
                              <th className="p-3">کالا</th>
                              <th className="p-3">مقدار</th>
                              <th className="p-3">ارزش ریالی (ضرر)</th>
                              <th className="p-3">دلیل</th>
                           </tr>
                        </thead>
                        <tbody className="text-sm">
                           {wasteRecords.slice().reverse().map(rec => (
                              <tr key={rec.id} className="border-b border-slate-50 hover:bg-rose-50/30 transition-colors">
                                 <td className="p-3 font-bold text-slate-700">{rec.itemName}</td>
                                 <td className="p-3 text-slate-500">{rec.amount} {rec.unit}</td>
                                 <td className="p-3 font-mono text-rose-600">{rec.costLoss.toLocaleString()}</td>
                                 <td className="p-3 text-slate-500">{rec.reason}</td>
                              </tr>
                           ))}
                        </tbody>
                     </table>
                 )}
              </div>
           </div>
        </div>
      )}

      {viewMode === 'expenses' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-1 bg-white p-6 rounded-[32px] shadow-xl shadow-slate-200/50 border border-slate-100 h-fit">
                <h3 className="font-bold text-lg text-slate-800 mb-4">ثبت هزینه جدید</h3>
                <div className="space-y-4">
                    <input type="text" placeholder="عنوان هزینه (مثلا: خرید دستمال)" value={expTitle} onChange={e=>setExpTitle(e.target.value)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-bold" />
                    <input type="number" placeholder="مبلغ (تومان)" value={expAmount || ''} onChange={e=>setExpAmount(Number(e.target.value))} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-bold" />
                    <select value={expCategory} onChange={e=>setExpCategory(e.target.value as any)} className="w-full p-4 bg-slate-50 rounded-xl outline-none focus:ring-2 focus:ring-indigo-200 text-sm font-bold">
                        {Object.entries({ rent: 'اجاره', salary: 'حقوق', utilities: 'قبوض', marketing: 'تبلیغات', maintenance: 'تعمیرات', other: 'سایر' }).map(([key, label]) => (
                            <option key={key} value={key}>{label}</option>
                        ))}
                    </select>
                    <button onClick={handleAddExpense} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold flex items-center justify-center gap-2">
                        <Plus className="w-4 h-4" />
                        ثبت
                    </button>
                </div>
            </div>
            <div className="lg:col-span-2 bg-white rounded-[32px] shadow-sm border border-slate-50 max-h-[500px] overflow-y-auto custom-scrollbar">
               <table className="w-full text-right border-collapse">
                  <thead className="text-xs text-slate-400 font-bold sticky top-0 bg-white shadow-sm">
                     <tr>
                        <th className="p-4">تاریخ</th>
                        <th className="p-4">عنوان</th>
                        <th className="p-4">دسته‌بندی</th>
                        <th className="p-4">مبلغ</th>
                        <th className="p-4"></th>
                     </tr>
                  </thead>
                  <tbody className="text-sm">
                     {expenses.slice().reverse().map(exp => (
                        <tr key={exp.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                           <td className="p-4 text-slate-500">{new Date(exp.date).toLocaleDateString('fa-IR')}</td>
                           <td className="p-4 font-bold text-slate-700">{exp.title}</td>
                           <td className="p-4 text-slate-500">{getCategoryLabel(exp.category)}</td>
                           <td className="p-4 font-mono font-bold text-orange-600">{exp.amount.toLocaleString()}</td>
                           <td className="p-4 text-center">
                              <button onClick={() => handleDeleteExpense(exp.id)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-lg">
                                 <Trash2 className="w-4 h-4" />
                              </button>
                           </td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
        </div>
      )}

      {viewMode === 'shifts' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className={`p-6 rounded-[32px] shadow-xl border ${currentShift ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
                 <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                     {currentShift ? <Unlock className="w-5 h-5 text-emerald-600" /> : <Lock className="w-5 h-5 text-rose-600" />}
                     وضعیت شیفت فعلی: {currentShift ? 'باز' : 'بسته'}
                 </h3>

                 {currentShift ? (
                    <div className="space-y-4">
                        <p className="text-sm text-emerald-800">شیفت در تاریخ {new Date(currentShift.startTime).toLocaleString('fa-IR')} باز شده است.</p>
                        <div>
                            <label className="block text-sm font-bold mb-2">موجودی نهایی صندوق (شمارش شده)</label>
                            <input type="number" placeholder="مبلغ نقد شمارش شده" value={endCash || ''} onChange={e=>setEndCash(Number(e.target.value))} className="w-full p-3 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-300 font-bold" />
                        </div>
                         <div>
                            <label className="block text-sm font-bold mb-2">مبلغ واریزی به بانک</label>
                            <input type="number" placeholder="مبلغ واریز شده به حساب" value={bankDeposit || ''} onChange={e=>setBankDeposit(Number(e.target.value))} className="w-full p-3 bg-white rounded-xl outline-none focus:ring-2 focus:ring-emerald-300 font-bold" />
                        </div>
                        <button onClick={handleCloseShift} className="w-full py-3 bg-rose-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-rose-200 hover:bg-rose-700">
                            <Lock className="w-4 h-4"/> بستن شیفت و تهیه گزارش Z
                        </button>
                    </div>
                 ) : (
                    <div className="space-y-4">
                        <p className="text-sm text-rose-800">برای ثبت فروش، ابتدا باید شیفت را باز کنید.</p>
                        <div>
                           <label className="block text-sm font-bold mb-2">مبلغ تنخواه اولیه</label>
                           <input type="number" placeholder="مبلغ نقد اولیه در صندوق" value={startCash || ''} onChange={e=>setStartCash(Number(e.target.value))} className="w-full p-3 bg-white rounded-xl outline-none focus:ring-2 focus:ring-rose-300 font-bold" />
                        </div>
                        <button onClick={handleStartShift} className="w-full py-3 bg-emerald-600 text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-emerald-200 hover:bg-emerald-700">
                           <Unlock className="w-4 h-4" /> باز کردن شیفت جدید
                        </button>
                    </div>
                 )}
              </div>

              <div className="bg-white rounded-[32px] shadow-sm border border-slate-100 max-h-[500px] overflow-y-auto custom-scrollbar">
                  <h3 className="p-6 font-bold text-lg border-b border-slate-100 sticky top-0 bg-white/80 backdrop-blur-md">تاریخچه شیفت‌ها</h3>
                  <div className="space-y-4 p-6">
                      {shifts.filter(s=>s.status==='closed').map(s => (
                          <div key={s.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                              <div className="flex justify-between items-center mb-4">
                                  <span className="font-bold text-slate-700">شیفت #{s.id.slice(0,5)}</span>
                                  <span className="text-xs text-slate-400">{new Date(s.endTime!).toLocaleString('fa-IR')}</span>
                              </div>
                              <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                                  <div className="flex justify-between items-center text-emerald-700"><span className="flex items-center gap-1"><CreditCard className="w-3 h-3" /> کارتخوان:</span><span className="font-bold">{s.cardSales?.toLocaleString()}</span></div>
                                  <div className="flex justify-between items-center text-blue-700"><span className="flex items-center gap-1"><Globe className="w-3 h-3"/> آنلاین:</span><span className="font-bold">{s.onlineSales?.toLocaleString()}</span></div>
                                  <div className="flex justify-between items-center text-green-700"><span className="flex items-center gap-1"><Banknote className="w-3 h-3"/> فروش نقد:</span><span className="font-bold">{s.expectedCashSales! - s.startingCash}</span></div>
                                  <div className={`flex justify-between items-center ${s.discrepancy === 0 ? 'text-slate-500' : 'text-rose-600'}`}>
                                      <span className="flex items-center gap-1"><AlertOctagon className="w-3 h-3" /> مغایرت:</span>
                                      <span className="font-bold">{s.discrepancy?.toLocaleString()}</span>
                                  </div>
                              </div>
                          </div>
                      ))}
                  </div>
              </div>
          </div>
      )}
    </div>
  );
};