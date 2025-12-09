import React, { useState } from 'react';
import { View, MenuAnalysisItem } from '../../types';
import { useDataStore } from '../../contexts/DataContext';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { ArrowUpRight, BarChart3, TrendingUp, ChevronLeft, AlertTriangle, ClipboardList, ArrowDownRight, Sparkles, Loader2, Star, Puzzle, Tractor, Trash2, RefreshCw } from 'lucide-react';

interface DashboardProps {
  onNavigate: (view: View) => void;
}

const getAnalysisIcon = (category: MenuAnalysisItem['category']) => {
    switch(category) {
        case 'star': return <Star className="w-5 h-5 text-amber-500" />;
        case 'puzzle': return <Puzzle className="w-5 h-5 text-indigo-500" />;
        case 'plowhorse': return <Tractor className="w-5 h-5 text-orange-500" />;
        case 'dog': return <Trash2 className="w-5 h-5 text-rose-500" />;
        default: return <Sparkles className="w-5 h-5 text-slate-500" />;
    }
};

const getAnalysisCategoryText = (category: MenuAnalysisItem['category']) => {
    const map = { star: 'ستاره', puzzle: 'معما', plowhorse: 'سودآور اما غیرم محبوب', dog: 'حذف شدنی', other: 'نامشخص' };
    return map[category] || 'نامشخص';
};


export const DashboardView: React.FC<DashboardProps> = ({ onNavigate }) => {
  const { sales, menu, expenses, wasteRecords, menuAnalysis, generateMenuAnalysis, clearMenuAnalysis } = useDataStore(state => ({
      sales: state.sales,
      menu: state.menu,
      expenses: state.expenses,
      wasteRecords: state.wasteRecords,
      menuAnalysis: state.menuAnalysis,
      generateMenuAnalysis: state.generateMenuAnalysis,
      clearMenuAnalysis: state.clearMenuAnalysis,
  }));
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const totalRevenue = sales.reduce((acc, sale) => acc + sale.totalAmount, 0);
  const totalCostOfGoods = sales.reduce((acc, sale) => acc + sale.totalCost, 0);
  const totalOperatingExpenses = expenses.reduce((acc, exp) => acc + exp.amount, 0);
  const totalWasteLoss = wasteRecords.reduce((acc, w) => acc + w.costLoss, 0);
  
  const netProfit = totalRevenue - totalCostOfGoods - totalOperatingExpenses - totalWasteLoss;
  const marginPercentage = totalRevenue > 0 ? ((netProfit / totalRevenue) * 100).toFixed(1) : 0;
  
  const chartData = sales.slice(-20).map((sale) => ({
    amt: sale.totalAmount,
    profit: sale.totalAmount - sale.totalCost
  }));

  const itemPopularity = sales.reduce((acc, sale) => {
    sale.items.forEach(item => {
       acc[item.menuItemId] = (acc[item.menuItemId] || 0) + item.quantity;
    });
    return acc;
  }, {} as Record<string, number>);

  const topItems = (Object.entries(itemPopularity) as [string, number][])
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([id, count]) => {
      const menuItem = menu.find(m => m.id === id);
      return { ...menuItem, count };
    });

  const itemsNeedingRecipe = menu.filter(item => !item.recipe || item.recipe.length === 0);

  const handleRunAnalysis = async () => {
      setIsAnalyzing(true);
      try {
          await generateMenuAnalysis();
      } catch (e) {
          console.error("Failed to run analysis", e);
      } finally {
          setIsAnalyzing(false);
      }
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-12 pt-24 pb-32 md:pb-12 md:pt-12 max-w-7xl mx-auto space-y-12 animate-in fade-in duration-700">
      
      <div className="flex justify-between items-end">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">Overview</h2>
          <p className="text-slate-400 font-bold text-sm">خلاصه وضعیت رستوران</p>
        </div>
        <button 
           onClick={() => onNavigate('reports')}
           className="group flex items-center gap-2 px-5 py-2.5 bg-white rounded-full shadow-sm hover:shadow-md transition-all border border-slate-100 active:scale-95"
        >
           <span className="text-sm font-bold text-slate-600 group-hover:text-slate-900">گزارشات مالی</span>
           <div className="w-6 h-6 bg-slate-100 rounded-full flex items-center justify-center group-hover:bg-slate-900 group-hover:text-white transition-colors">
              <ChevronLeft className="w-3 h-3" />
           </div>
        </button>
      </div>

      {itemsNeedingRecipe.length > 0 && (
          <div className="bg-amber-50 border-2 border-dashed border-amber-200 rounded-3xl p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-2xl flex items-center justify-center shrink-0">
                      <AlertTriangle className="w-6 h-6" />
                  </div>
                  <div>
                      <h3 className="font-extrabold text-amber-900 text-lg">نیازمند اقدام مدیر</h3>
                      <p className="text-amber-700 text-sm mt-1 max-w-lg">
                          <span className="font-bold">{itemsNeedingRecipe.length} آیتم جدید</span> به منو اضافه شده که فاقد دستور تهیه (Recipe) است. برای محاسبه بهای تمام شده و مدیریت انبار، لطفا فرمولاسیون آن‌ها را تکمیل کنید.
                      </p>
                  </div>
              </div>
              <button 
                onClick={() => onNavigate('menu')}
                className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 whitespace-nowrap self-end md:self-center hover:bg-slate-800 active:scale-95 transition-colors"
              >
                  <ClipboardList className="w-4 h-4" />
                  تکمیل فرمولاسیون
              </button>
          </div>
      )}
      
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-10">
        <div className="space-y-2">
           <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">فروش کل (Revenue)</p>
           <div className="flex items-baseline gap-2">
             <p className="text-3xl md:text-5xl font-black text-slate-900 tracking-tighter tabular-nums">
                {(totalRevenue / 1000000).toFixed(1)}<span className="text-xl text-slate-300 ml-1 font-medium tracking-normal">M</span>
             </p>
             <div className="flex items-center text-emerald-500 gap-0.5">
                <ArrowUpRight className="w-3 h-3" />
                <span className="text-xs font-bold">۵.۲٪</span>
             </div>
           </div>
        </div>
        <div className="space-y-2">
           <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">سود خالص (Net Profit)</p>
           <div className="flex items-baseline gap-2">
             <p className={`text-3xl md:text-5xl font-black tracking-tighter tabular-nums ${netProfit >= 0 ? 'text-slate-900' : 'text-rose-500'}`}>
                {(netProfit / 1000000).toFixed(1)}<span className="text-xl text-slate-300 ml-1 font-medium tracking-normal">M</span>
             </p>
             <div className={`flex items-center gap-0.5 ${netProfit >= 0 ? 'text-emerald-500' : 'text-rose-500'}`}>
                {netProfit >= 0 ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
                <span className="text-xs font-bold">{marginPercentage}%</span>
             </div>
           </div>
        </div>
        <div className="space-y-2">
           <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">هزینه‌ها (OpEx)</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl md:text-4xl font-black text-slate-400 tracking-tighter tabular-nums">
                 {(totalOperatingExpenses / 1000000).toFixed(1)}<span className="text-base text-slate-300 ml-1 font-medium tracking-normal">M</span>
              </p>
            </div>
        </div>
        <div className="space-y-2">
           <p className="text-slate-400 text-[10px] font-bold uppercase tracking-widest">ضایعات (Waste)</p>
            <div className="flex items-baseline gap-2">
              <p className="text-2xl md:text-4xl font-black text-slate-400 tracking-tighter tabular-nums">
                 {(totalWasteLoss / 1000000).toFixed(1)}<span className="text-base text-slate-300 ml-1 font-medium tracking-normal">M</span>
              </p>
            </div>
        </div>
      </div>

      {/* AI Advisor Card */}
      <div className="bg-gradient-to-br from-indigo-600 to-purple-700 rounded-[32px] p-8 text-white shadow-2xl shadow-indigo-200">
          <div className="flex flex-col md:flex-row justify-between items-start gap-6">
              <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-white/20 backdrop-blur-sm rounded-2xl flex items-center justify-center">
                      <Sparkles className="w-6 h-6"/>
                  </div>
                  <div>
                      <h3 className="font-extrabold text-xl">مشاور هوشمند</h3>
                      <p className="text-indigo-200 text-sm mt-1 max-w-lg">
                          هوش مصنوعی منو و فروش شما را تحلیل کرده و پیشنهاداتی برای افزایش سودآوری ارائه می‌دهد.
                      </p>
                  </div>
              </div>
              <button 
                onClick={handleRunAnalysis}
                disabled={isAnalyzing}
                className="bg-white text-indigo-700 px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 whitespace-nowrap self-end md:self-center hover:bg-indigo-50 active:scale-95 transition-all disabled:opacity-50"
              >
                  {isAnalyzing ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4" />}
                  {isAnalyzing ? 'در حال تحلیل...' : 'شروع تحلیل هوشمند'}
              </button>
          </div>
          {menuAnalysis && (
              <div className="mt-6 bg-black/10 backdrop-blur-xl p-6 rounded-2xl animate-in fade-in duration-500">
                  <p className="text-sm font-bold text-indigo-100 leading-relaxed mb-4">{menuAnalysis.summary}</p>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-64 overflow-y-auto custom-scrollbar">
                      {menuAnalysis.items.map((item, i) => (
                          <div key={i} className="bg-white/10 p-4 rounded-xl flex items-start gap-3">
                              <div className="w-8 h-8 flex items-center justify-center bg-white/20 rounded-lg shrink-0">
                                  {getAnalysisIcon(item.category)}
                              </div>
                              <div>
                                 <p className="font-bold text-white text-sm">{item.name} <span className="text-xs text-indigo-300 font-medium">({getAnalysisCategoryText(item.category)})</span></p>
                                 <p className="text-xs text-indigo-200 mt-1">{item.suggestion}</p>
                              </div>
                          </div>
                      ))}
                  </div>
                   <button onClick={clearMenuAnalysis} className="text-xs text-indigo-300 hover:text-white font-bold mt-4 flex items-center gap-1"><RefreshCw className="w-3 h-3"/> تحلیل مجدد</button>
              </div>
          )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
         <div className="lg:col-span-2 bg-white rounded-[40px] p-8 shadow-sm border border-slate-50 flex flex-col h-[350px]">
            <div className="flex justify-between items-center mb-6">
                <h3 className="font-bold text-slate-800 text-lg">روند فروش</h3>
                <TrendingUp className="w-5 h-5 text-indigo-500" />
            </div>
            <div className="flex-1 w-full -ml-4" dir="ltr">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorAmt" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#6366f1" stopOpacity={0.05}/>
                        <stop offset="95%" stopColor="#6366f1" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <Tooltip 
                        contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 10px 30px -10px rgba(0,0,0,0.1)', fontFamily: 'Vazirmatn' }}
                        cursor={{ stroke: '#cbd5e1', strokeWidth: 1, strokeDasharray: '4 4' }}
                    />
                    <Area type="monotone" dataKey="amt" stroke="#6366f1" strokeWidth={4} fillOpacity={1} fill="url(#colorAmt)" />
                  </AreaChart>
                </ResponsiveContainer>
            </div>
         </div>

         <div className="bg-white rounded-[40px] p-8 shadow-sm border border-slate-50">
             <h3 className="font-bold text-slate-800 text-lg mb-8">محبوب‌ترین‌ها</h3>
             <div className="space-y-6">
                 {topItems.map((item, i) => (
                     <div key={i} className="flex items-center justify-between group">
                         <div className="flex items-center gap-4">
                             <span className="font-black text-slate-200 text-xl group-hover:text-indigo-500 transition-colors">0{i+1}</span>
                             <div>
                                 <p className="font-bold text-slate-800 text-sm">{item?.name}</p>
                                 <p className="text-[10px] text-slate-400 font-bold mt-0.5">{item?.category}</p>
                             </div>
                         </div>
                         <span className="font-bold text-slate-900 bg-slate-50 px-3 py-1 rounded-full text-xs group-hover:bg-indigo-50 group-hover:text-indigo-700 transition-colors">{item.count}</span>
                     </div>
                 ))}
                 {topItems.length === 0 && <p className="text-sm text-slate-300 font-bold">بدون داده</p>}
             </div>
         </div>
      </div>
    </div>
  );
};