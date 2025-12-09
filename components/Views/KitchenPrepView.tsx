import React, { useState } from 'react';
import { PrepTask, Ingredient, RecipeIngredient, getConversionFactor, WasteRecord, OperationalForecast } from '../../types';
import { useDataStore } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { ClipboardList, Flame, Snowflake, Search, Plus, Minus, CheckCircle2, UtensilsCrossed, Settings, Factory, ChevronDown, Trash2, X, AlertTriangle, Sparkles, Loader2, ListOrdered, BarChart } from 'lucide-react';

export const KitchenPrepView: React.FC = () => {
  const { 
      prepTasks, setPrepTasks, inventory, setInventory, addAuditLog, setWasteRecords,
      operationalForecast, generateOperationalForecast
  } = useDataStore();
  const { showToast } = useToast();

  const [activeStation, setActiveStation] = useState<string>('همه');
  const [searchQuery, setSearchQuery] = useState('');
  
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  const [isProductionModalOpen, setIsProductionModalOpen] = useState(false);
  const [isAddItemModalOpen, setIsAddItemModalOpen] = useState(false);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  
  const [selectedTask, setSelectedTask] = useState<PrepTask | null>(null);
  const [isForecasting, setIsForecasting] = useState(false);

  const [newItemData, setNewItemData] = useState<Partial<PrepTask>>({
    item: '', station: 'آماده‌سازی', parLevel: 10, unit: 'kg'
  });

  const [currentRecipe, setCurrentRecipe] = useState<RecipeIngredient[]>([]);
  const [batchSize, setBatchSize] = useState(1);
  const [costPerUnit, setCostPerUnit] = useState(0);

  const [productionBatches, setProductionBatches] = useState(1);
  const [wasteAmount, setWasteAmount] = useState(0);
  const [wasteReason, setWasteReason] = useState('');

  const stations = ['همه', 'گریل', 'سرد', 'سرخ کن', 'آماده‌سازی'];

  const filteredTasks = prepTasks.filter(task => {
    const matchesStation = activeStation === 'همه' || task.station === activeStation;
    const matchesSearch = task.item.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesStation && matchesSearch;
  });

  const calculateBatchCost = (recipe: RecipeIngredient[]) => {
      return recipe.reduce((total, r) => {
          const ing = inventory.find(i => i.id === r.ingredientId);
          if (!ing) return total;
          const factor = getConversionFactor(r.unit, ing.unit);
          return total + (ing.costPerUnit * r.amount * factor);
      }, 0);
  };

  const updateOnHand = (id: string, delta: number) => {
    setPrepTasks(prev => prev.map(task => {
        if (task.id === id) {
            return { ...task, onHand: Math.max(0, task.onHand + delta) };
        }
        return task;
    }));
  };
  
  const handleGenerateForecast = async () => {
      setIsForecasting(true);
      try {
          await generateOperationalForecast();
          showToast('برنامه کاری هوشمند با موفقیت تولید شد.');
      } catch (e) {
          showToast('خطا در تولید برنامه کاری.', 'error');
      } finally {
          setIsForecasting(false);
      }
  };

  const openRecipeModal = (task: PrepTask) => {
      setSelectedTask(task);
      setCurrentRecipe(task.recipe || []);
      setBatchSize(task.batchSize || 1);
      const calculatedCost = task.recipe ? calculateBatchCost(task.recipe) / (task.batchSize || 1) : (task.costPerUnit || 0);
      setCostPerUnit(calculatedCost);
      setIsRecipeModalOpen(true);
  };

  const openProductionModal = (task: PrepTask) => {
      setSelectedTask(task);
      setProductionBatches(1);
      setIsProductionModalOpen(true);
  };
  
  const openWasteModal = (task: PrepTask) => {
    setSelectedTask(task);
    setWasteAmount(0);
    setWasteReason('');
    setIsWasteModalOpen(true);
  };

  const openAddItemModal = () => {
    setNewItemData({ item: '', station: 'آماده‌سازی', parLevel: 10, unit: 'kg' });
    setIsAddItemModalOpen(true);
  };

  const handleSaveNewTask = () => {
    if (!newItemData.item || !newItemData.unit || !newItemData.parLevel || newItemData.parLevel <= 0) {
        showToast("لطفا تمام فیلدها را به درستی پر کنید.", 'error');
        return;
    }
    const newTask: PrepTask = {
        id: crypto.randomUUID(),
        item: newItemData.item,
        station: newItemData.station || 'آماده‌سازی',
        parLevel: Number(newItemData.parLevel),
        onHand: 0,
        unit: newItemData.unit,
        recipe: [],
        costPerUnit: 0
    };
    setPrepTasks(prev => [newTask, ...prev]);
    setIsAddItemModalOpen(false);
    showToast('آیتم جدید با موفقیت اضافه شد.');
  };

  const handleSaveRecipe = () => {
      if (!selectedTask) return;
      
      const totalBatchCost = calculateBatchCost(currentRecipe);
      const unitCost = batchSize > 0 ? totalBatchCost / batchSize : 0;

      setPrepTasks(prev => prev.map(t => t.id === selectedTask.id ? {
          ...t,
          recipe: currentRecipe,
          batchSize: batchSize,
          costPerUnit: Math.round(unitCost)
      } : t));

      setIsRecipeModalOpen(false);
      showToast('فرمول تولید با موفقیت ذخیره شد.');
  };

  const handleProduce = () => {
      if (!selectedTask || !selectedTask.recipe || productionBatches <= 0) return;

      const deductionMap = new Map<string, number>();
      selectedTask.recipe.forEach(r => {
          const ing = inventory.find(i => i.id === r.ingredientId);
          if (ing) {
              const factor = getConversionFactor(r.unit, ing.unit);
              const totalAmount = r.amount * factor * productionBatches;
              deductionMap.set(r.ingredientId, totalAmount);
          }
      });
      
      setInventory(prev => prev.map(ing => {
          const deduct = deductionMap.get(ing.id);
          if (deduct) {
              return { ...ing, currentStock: Math.max(0, ing.currentStock - deduct) };
          }
          return ing;
      }));

      const producedAmount = (selectedTask.batchSize || 1) * productionBatches;
      setPrepTasks(prev => prev.map(t => t.id === selectedTask.id ? {
          ...t, 
          onHand: t.onHand + producedAmount
      } : t));

      setIsProductionModalOpen(false);
      showToast('تولید با موفقیت ثبت شد.');
  };

  const handleSavePrepWaste = () => {
    if (!selectedTask || wasteAmount <= 0) return;

    if (wasteAmount > selectedTask.onHand) {
        showToast("مقدار ضایعات نمی‌تواند بیشتر از موجودی باشد.", "error");
        return;
    }
    
    const costLoss = wasteAmount * (selectedTask.costPerUnit || 0);
    const wasteRecord: WasteRecord = {
        id: crypto.randomUUID(),
        itemId: selectedTask.id,
        itemName: selectedTask.item,
        itemSource: 'prep',
        amount: wasteAmount,
        unit: selectedTask.unit,
        costLoss: costLoss,
        reason: wasteReason || 'نامشخص',
        date: Date.now()
    };
    setWasteRecords(prev => [wasteRecord, ...prev]);
    
    setPrepTasks(prev => prev.map(task => 
        task.id === selectedTask.id 
        ? { ...task, onHand: Math.max(0, task.onHand - wasteAmount) }
        : task
    ));

    addAuditLog('WASTE', 'PREP', `Waste recorded for ${selectedTask.item}: ${wasteAmount} ${selectedTask.unit}. Loss: ${costLoss.toLocaleString()}`);
    setIsWasteModalOpen(false);
    showToast('ضایعات با موفقیت ثبت شد.');
  };


  const addIngredientToRecipe = (id: string) => {
      const ing = inventory.find(i => i.id === id);
      if (ing && !currentRecipe.find(r => r.ingredientId === id)) {
          let defaultUnit = ing.unit;
          if (ing.unit === 'kg') defaultUnit = 'gram';
          if (ing.unit === 'liter') defaultUnit = 'ml';
          setCurrentRecipe([...currentRecipe, { ingredientId: id, amount: 0, unit: defaultUnit, source: 'inventory' }]);
      }
  };

  const updateRecipeItem = (id: string, updates: Partial<RecipeIngredient>) => {
      setCurrentRecipe(prev => prev.map(r => r.ingredientId === id ? {...r, ...updates} : r));
  };

  const removeRecipeItem = (id: string) => {
      setCurrentRecipe(prev => prev.filter(r => r.ingredientId !== id));
  };

  const getStationIcon = (station: string) => {
      if (station === 'گریل') return <Flame className="w-4 h-4" />;
      if (station === 'سرد') return <Snowflake className="w-4 h-4" />;
      return <UtensilsCrossed className="w-4 h-4" />;
  };

  const totalTasks = filteredTasks.length;
  const completionRate = totalTasks > 0 ? Math.round((filteredTasks.filter(t => t.onHand >= t.parLevel).length / totalTasks) * 100) : 100;

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 pt-24 pb-32 md:pb-8 md:pt-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight flex items-center gap-2">
               <ClipboardList className="w-8 h-8 text-indigo-600" />
               مدیریت تولید و میزانپلاس
           </h2>
           <p className="text-slate-500 mt-1 font-medium text-sm">برنامه‌ریزی تولید مواد نیمه‌آماده و کنترل پار لول</p>
        </div>
        
        <div className="flex gap-2 w-full md:w-auto">
             <div className="relative flex-1 md:flex-none md:w-72">
                <input 
                    type="text" 
                    placeholder="جستجو..." 
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full bg-white border border-slate-200 rounded-2xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm font-bold"
                />
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400" />
            </div>
            <button
                onClick={openAddItemModal}
                className="bg-indigo-600 text-white h-12 px-5 rounded-2xl flex items-center justify-center gap-2 shadow-lg shadow-indigo-200 hover:scale-105 active:scale-95 transition-all font-bold"
            >
                <Plus className="w-5 h-5" />
                <span className="hidden sm:inline">آیتم جدید</span>
            </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 bg-white p-6 rounded-[24px] border border-slate-100 shadow-sm">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h3 className="font-bold text-slate-800 mb-1 flex items-center gap-2">
                        <ListOrdered className="w-5 h-5 text-indigo-500"/>
                        برنامه کاری هوشمند
                    </h3>
                    <p className="text-sm text-slate-500">لیست آماده‌سازی اولویت‌بندی شده بر اساس پیش‌بینی فروش</p>
                </div>
                <button onClick={handleGenerateForecast} disabled={isForecasting} className="bg-slate-900 text-white px-5 py-3 rounded-full text-xs font-bold flex items-center gap-2 hover:bg-slate-800 active:scale-95 transition-colors disabled:opacity-50 self-end md:self-center">
                    {isForecasting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4" />}
                    {isForecasting ? 'در حال تحلیل...' : 'تولید برنامه کاری'}
                </button>
            </div>
            {operationalForecast && (
                <div className="mt-4 space-y-2 max-h-48 overflow-y-auto custom-scrollbar animate-in fade-in duration-300">
                    <p className="text-xs font-bold text-indigo-700 bg-indigo-50 p-2 rounded-lg border border-indigo-100 mb-2">{operationalForecast.summary}</p>
                    {operationalForecast.tasks.map(task => (
                        <div key={task.prepTaskId} className="p-3 bg-slate-50 border border-slate-100 rounded-xl flex items-center justify-between">
                            <span className="font-bold text-sm text-slate-700">{task.prepTaskName}</span>
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-slate-500 font-bold">تولید: {task.quantityToPrep}</span>
                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                    task.priority === 'high' ? 'bg-rose-100 text-rose-600' :
                                    task.priority === 'medium' ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'
                                }`}>
                                    {task.priority === 'high' ? 'بالا' : task.priority === 'medium' ? 'متوسط' : 'پایین'}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            )}
          </div>

          <div className="bg-slate-900 text-white p-6 rounded-[24px] shadow-xl shadow-slate-900/10 flex flex-col justify-between relative overflow-hidden">
               <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500 rounded-full blur-3xl -mr-16 -mt-16 opacity-30"></div>
               <div>
                   <h3 className="font-bold text-slate-200 mb-1 flex items-center gap-2"><BarChart className="w-4 h-4"/> آمادگی سرویس</h3>
                   <span className="text-4xl font-extrabold">{completionRate}%</span>
               </div>
               <div className="h-2 bg-slate-700 rounded-full overflow-hidden mt-4">
                   <div className="h-full bg-emerald-400 rounded-full transition-all duration-700" style={{ width: `${completionRate}%` }}></div>
               </div>
          </div>
      </div>

      <div className="bg-white p-2 rounded-[24px] border border-slate-100 shadow-sm flex items-center gap-2 overflow-x-auto no-scrollbar">
            {stations.map(station => (
                <button
                key={station}
                onClick={() => setActiveStation(station)}
                className={`px-6 py-4 rounded-2xl text-sm font-bold whitespace-nowrap transition-all flex-1 md:flex-none ${
                    activeStation === station
                    ? 'bg-slate-100 text-slate-900 shadow-inner'
                    : 'text-slate-500 hover:bg-slate-50'
                }`}
                >
                    {station}
                </button>
            ))}
      </div>


      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredTasks.map(task => {
              const progress = Math.min(100, (task.onHand / task.parLevel) * 100);
              const needed = Math.max(0, task.parLevel - task.onHand);
              
              return (
                  <div key={task.id} className="bg-white border border-slate-100 rounded-[24px] p-5 shadow-sm hover:shadow-md transition-all relative group">
                      <div className="flex justify-between items-start mb-4">
                          <div>
                              <div className="flex items-center gap-2 mb-1">
                                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg border bg-slate-100 text-slate-600 border-slate-200 flex items-center gap-1">
                                      {getStationIcon(task.station)}
                                      {task.station}
                                  </span>
                                  {task.recipe && task.recipe.length > 0 && (
                                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-lg bg-indigo-50 text-indigo-600 border border-indigo-100 flex items-center gap-1">
                                          <Factory className="w-3 h-3" />
                                          تولیدی
                                      </span>
                                  )}
                              </div>
                              <h3 className="font-bold text-slate-800 text-lg">{task.item}</h3>
                              <p className="text-xs text-slate-400 font-bold mt-1">
                                  هزینه واحد: {task.costPerUnit ? task.costPerUnit.toLocaleString() : '-'} ت
                              </p>
                          </div>
                          <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${needed === 0 ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                              {needed === 0 ? <CheckCircle2 className="w-5 h-5"/> : task.unit}
                          </div>
                      </div>

                      <div className="space-y-4">
                          <div>
                              <div className="flex justify-between items-end mb-1">
                                  <span className="text-xs font-bold text-slate-400">موجودی / هدف: {task.parLevel}</span>
                                  <span className={`text-sm font-black ${needed > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                                      {task.onHand} <span className="text-slate-400 font-medium">موجود</span>
                                  </span>
                              </div>
                              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden">
                                  <div className={`h-full rounded-full transition-all duration-500 ${needed > 0 ? 'bg-amber-400' : 'bg-emerald-500'}`} style={{ width: `${progress}%` }}></div>
                              </div>
                          </div>

                          <div className="flex items-center gap-2">
                              <div className="flex items-center bg-slate-50 rounded-xl p-1 border border-slate-200">
                                  <button onClick={() => updateOnHand(task.id, -1)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-colors"><Minus className="w-4 h-4" /></button>
                                  <button onClick={() => updateOnHand(task.id, 1)} className="w-8 h-8 flex items-center justify-center hover:bg-white rounded-lg transition-colors"><Plus className="w-4 h-4" /></button>
                              </div>
                              
                              {task.recipe && task.recipe.length > 0 ? (
                                  <button onClick={() => openProductionModal(task)} className="flex-1 bg-indigo-600 text-white h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 hover:bg-indigo-700 transition-colors shadow-lg shadow-indigo-200">
                                      <Factory className="w-4 h-4" />
                                      تولید
                                  </button>
                              ) : (
                                  <button className="flex-1 bg-slate-100 text-slate-400 h-10 rounded-xl text-xs font-bold flex items-center justify-center gap-2 cursor-not-allowed">
                                      <Factory className="w-4 h-4" />
                                      بدون فرمول
                                  </button>
                              )}

                              <button onClick={() => openWasteModal(task)} className="w-10 h-10 bg-rose-50 text-rose-500 border border-rose-200 rounded-xl flex items-center justify-center hover:bg-rose-100 transition-colors">
                                  <AlertTriangle className="w-4 h-4" />
                              </button>

                              <button onClick={() => openRecipeModal(task)} className="w-10 h-10 bg-slate-50 text-slate-500 border border-slate-200 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors">
                                  <Settings className="w-4 h-4" />
                              </button>
                          </div>
                      </div>
                  </div>
              );
          })}
      </div>

      {isAddItemModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800">افزودن آیتم آماده‌سازی</h3>
                    <button onClick={() => setIsAddItemModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">نام آیتم</label>
                        <input 
                            type="text" 
                            value={newItemData.item}
                            onChange={e => setNewItemData({...newItemData, item: e.target.value})}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                            placeholder="مثلا: سس مخصوص"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">واحد شمارش</label>
                            <select 
                                value={newItemData.unit}
                                onChange={e => setNewItemData({...newItemData, unit: e.target.value})}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                            >
                                <option value="kg">کیلوگرم</option>
                                <option value="liter">لیتر</option>
                                <option value="number">عدد</option>
                                <option value="portion">پرس</option>
                            </select>
                        </div>
                         <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">ایستگاه کاری</label>
                            <select 
                                value={newItemData.station}
                                onChange={e => setNewItemData({...newItemData, station: e.target.value})}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                            >
                                {stations.filter(s => s !== 'همه').map(s => <option key={s} value={s}>{s}</option>)}
                            </select>
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">میزان هدف (Par Level)</label>
                        <input 
                            type="number" 
                            value={newItemData.parLevel}
                            onChange={e => setNewItemData({...newItemData, parLevel: Number(e.target.value)})}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                        />
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex gap-4">
                    <button onClick={() => setIsAddItemModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">انصراف</button>
                    <button onClick={handleSaveNewTask} className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all">
                        افزودن آیتم
                    </button>
                </div>
            </div>
        </div>
      )}

      {isRecipeModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                 <h3 className="text-xl font-extrabold text-slate-800">فرمول تولید: {selectedTask.item}</h3>
                 <button onClick={() => setIsRecipeModalOpen(false)} className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400">✕</button>
              </div>
              
              <div className="p-6 overflow-y-auto custom-scrollbar">
                 <div className="mb-6">
                     <label className="block text-sm font-bold text-slate-700 mb-2">اندازه بچ تولید (Batch Size)</label>
                     <div className="flex items-center gap-2">
                         <input 
                            type="number" 
                            value={batchSize} 
                            onChange={e => setBatchSize(Number(e.target.value))} 
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-3 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-500/50" 
                         />
                         <span className="font-bold text-slate-500 whitespace-nowrap">{selectedTask.unit}</span>
                     </div>
                     <p className="text-xs text-slate-400 mt-2">مثال: این فرمول برای تولید ۱۰ عدد برگر تنظیم شده است.</p>
                 </div>

                 <div className="mb-4">
                      <select 
                        onChange={(e) => {
                          if(e.target.value) {
                             addIngredientToRecipe(e.target.value);
                             e.target.value = "";
                          }
                        }}
                        className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm focus:ring-2 focus:ring-indigo-500/50 outline-none font-bold text-slate-600"
                      >
                        <option value="">+ افزودن مواد اولیه خام</option>
                        {inventory.map(ing => (
                          <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                        ))}
                      </select>
                 </div>

                 <div className="space-y-3">
                     {currentRecipe.map((r, idx) => {
                         const ing = inventory.find(i => i.id === r.ingredientId);
                         if (!ing) return null;
                         return (
                             <div key={idx} className="flex items-center gap-2 bg-slate-50 p-2 rounded-xl border border-slate-200">
                                 <span className="text-xs font-bold w-6 h-6 flex items-center justify-center bg-white rounded-lg shadow-sm">{idx + 1}</span>
                                 <div className="flex-1">
                                     <p className="text-sm font-bold text-slate-800">{ing.name}</p>
                                 </div>
                                 <input 
                                     type="number" 
                                     value={r.amount}
                                     onChange={(e) => updateRecipeItem(r.ingredientId, { amount: Number(e.target.value) })}
                                     className="w-20 p-2 rounded-lg text-center text-sm font-bold outline-none border border-slate-200 focus:border-indigo-500"
                                     placeholder="مقدار"
                                 />
                                 <select
                                     value={r.unit}
                                     onChange={(e) => updateRecipeItem(r.ingredientId, { unit: e.target.value })}
                                     className="w-20 p-2 rounded-lg text-xs font-bold outline-none border border-slate-200 bg-white"
                                 >
                                     <option value={ing.unit}>{ing.unit}</option>
                                     {ing.unit === 'kg' && <option value="gram">gram</option>}
                                     {ing.unit === 'liter' && <option value="ml">ml</option>}
                                 </select>
                                 <button onClick={() => removeRecipeItem(r.ingredientId)} className="p-2 text-rose-500 hover:bg-rose-100 rounded-lg"><Trash2 className="w-4 h-4"/></button>
                             </div>
                         )
                     })}
                     {currentRecipe.length === 0 && <p className="text-center text-slate-400 text-sm py-4">هنوز ماده‌ای اضافه نشده است.</p>}
                 </div>

                 {currentRecipe.length > 0 && (
                     <div className="mt-6 bg-indigo-50 p-4 rounded-2xl border border-indigo-100 text-indigo-900">
                         <div className="flex justify-between items-center mb-1">
                             <span className="text-xs font-bold">هزینه کل بچ:</span>
                             <span className="font-extrabold">{Math.round(calculateBatchCost(currentRecipe)).toLocaleString()} ت</span>
                         </div>
                         <div className="flex justify-between items-center">
                             <span className="text-xs font-bold">هزینه هر واحد ({selectedTask.unit}):</span>
                             <span className="font-extrabold text-lg">{Math.round(calculateBatchCost(currentRecipe) / (batchSize || 1)).toLocaleString()} ت</span>
                         </div>
                     </div>
                 )}
              </div>
              <div className="p-6 border-t border-slate-100 flex gap-4">
                 <button onClick={() => setIsRecipeModalOpen(false)} className="flex-1 py-3 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold">لغو</button>
                 <button onClick={handleSaveRecipe} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">ذخیره فرمول</button>
              </div>
           </div>
        </div>
      )}

      {isProductionModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-[32px] w-full max-w-sm shadow-2xl animate-in zoom-in-95 duration-200 border-t-8 border-indigo-600">
              <div className="p-6 bg-indigo-50">
                 <h3 className="text-lg font-extrabold text-indigo-900 flex items-center gap-2">
                    <Factory className="w-5 h-5" />
                    ثبت تولید: {selectedTask.item}
                 </h3>
                 <p className="text-xs text-indigo-600 mt-1">مواد خام کسر و محصول نیمه‌آماده اضافه می‌شود.</p>
              </div>
              
              <div className="p-6 space-y-4">
                 <div className="text-center">
                     <p className="text-sm text-slate-500 font-bold mb-2">تعداد بچ تولیدی (هر بچ {selectedTask.batchSize} {selectedTask.unit})</p>
                     <div className="flex items-center justify-center gap-4">
                         <button onClick={() => setProductionBatches(Math.max(1, productionBatches - 1))} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold hover:bg-slate-200"><Minus className="w-5 h-5"/></button>
                         <span className="text-3xl font-black text-slate-800 w-16 text-center">{productionBatches}</span>
                         <button onClick={() => setProductionBatches(productionBatches + 1)} className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-600 font-bold hover:bg-slate-200"><Plus className="w-5 h-5"/></button>
                     </div>
                 </div>
                 
                 <div className="bg-slate-50 p-4 rounded-2xl border border-slate-100">
                     <div className="flex justify-between text-sm font-bold text-slate-700 mb-2">
                         <span>خروجی نهایی:</span>
                         <span className="text-emerald-600">{(selectedTask.batchSize || 1) * productionBatches} {selectedTask.unit}</span>
                     </div>
                     <div className="space-y-1">
                         <p className="text-xs text-slate-400 font-bold">مواد خام مصرفی:</p>
                         {selectedTask.recipe?.map((r, i) => {
                             const ing = inventory.find(inItem => inItem.id === r.ingredientId);
                             return (
                                 <div key={i} className="flex justify-between text-xs text-slate-500">
                                     <span>{ing?.name}</span>
                                     <span>{r.amount * productionBatches} {r.unit}</span>
                                 </div>
                             )
                         })}
                     </div>
                 </div>
              </div>

              <div className="p-6 border-t border-slate-100 flex gap-4">
                 <button onClick={() => setIsProductionModalOpen(false)} className="flex-1 py-3 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold">انصراف</button>
                 <button onClick={handleProduce} className="flex-1 py-3 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200">تایید تولید</button>
              </div>
           </div>
        </div>
      )}
      
      {isWasteModalOpen && selectedTask && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border-t-8 border-rose-500">
                <div className="p-6 bg-rose-50">
                    <h3 className="text-xl font-black text-rose-900 flex items-center gap-2">
                        <Trash2 className="w-6 h-6" />
                        ثبت ضایعات: {selectedTask.item}
                    </h3>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">مقدار ضایعات ({selectedTask.unit})</label>
                         <input 
                            type="number" 
                            value={wasteAmount}
                            onChange={e => setWasteAmount(Number(e.target.value))}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-200"
                            placeholder="0"
                        />
                        <p className="text-xs text-rose-400 mt-2 font-bold">ارزش مالی از دست رفته: {(wasteAmount * (selectedTask.costPerUnit || 0)).toLocaleString()} تومان</p>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">علت ضایعات</label>
                        <select 
                             value={wasteReason}
                             onChange={e => setWasteReason(e.target.value)}
                             className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-200 cursor-pointer"
                        >
                            <option value="">انتخاب کنید...</option>
                            <option value="فساد و خرابی">فساد و خرابی</option>
                            <option value="خطای تولید">خطای تولید</option>
                            <option value="سایر">سایر</option>
                        </select>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex gap-4">
                    <button onClick={() => setIsWasteModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">انصراف</button>
                    <button onClick={handleSavePrepWaste} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all">
                        ثبت نهایی
                    </button>
                </div>
             </div>
        </div>
      )}

    </div>
  );
};