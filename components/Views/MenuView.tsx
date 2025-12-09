import React, { useState, useMemo } from 'react';
import { RecipeIngredient, getConversionFactor, MenuItem } from '../../types';
import { useDataStore } from '../../contexts/DataContext';
import { useModal } from '../../contexts/ModalContext';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Trash2, Edit2, ChefHat, TrendingUp, Package, Sparkles, Loader2, LayoutGrid, List } from 'lucide-react';
import { analyzeRecipe } from '../../services/geminiService';
import ReactMarkdown from 'react-markdown';

export const MenuView: React.FC = () => {
  const { menu, setMenu, inventory, prepTasks, addAuditLog } = useDataStore();
  const { showModal } = useModal();
  const { showToast } = useToast();

  const [viewType, setViewType] = useState<'card' | 'table'>('card');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [name, setName] = useState('');
  const [price, setPrice] = useState(0);
  const [category, setCategory] = useState('غذا');
  const [recipe, setRecipe] = useState<RecipeIngredient[]>([]);

  const [analysisResult, setAnalysisResult] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);

  const availableCategories = useMemo(() => [...new Set(menu.map(item => item.category))], [menu]);

  const getCompatibleUnits = (baseUnit: string) => {
      const mass = ['kg', 'gram'];
      const volume = ['liter', 'ml', 'cc'];
      
      if (mass.includes(baseUnit)) return mass;
      if (volume.includes(baseUnit)) return volume;
      return [baseUnit]; 
  };

  const calculateCost = (currentRecipe: RecipeIngredient[]) => {
    return currentRecipe.reduce((total, item) => {
      if (item.source === 'prep') {
          const prepItem = prepTasks.find(p => p.id === item.ingredientId);
          if (prepItem && prepItem.costPerUnit) {
              const factor = getConversionFactor(item.unit, prepItem.unit);
              return total + (prepItem.costPerUnit * item.amount * factor);
          }
          return total;
      } else {
          const ing = inventory.find(i => i.id === item.ingredientId);
          if (!ing) return total;
          const factor = getConversionFactor(item.unit, ing.unit);
          return total + (ing.costPerUnit * item.amount * factor);
      }
    }, 0);
  };

  const currentCost = useMemo(() => calculateCost(recipe), [recipe, inventory, prepTasks]);

  const openModal = (item?: any) => {
    if (item) {
      setEditingId(item.id);
      setName(item.name);
      setPrice(item.price);
      setCategory(item.category);
      setRecipe([...item.recipe]);
    } else {
      setEditingId(null);
      setName('');
      setPrice(0);
      setCategory('غذا');
      setRecipe([]);
    }
    setAnalysisResult(null);
    setIsAnalyzing(false);
    setIsModalOpen(true);
  };

  const handleSave = () => {
    if (!name || !category) return;
    
    const newItem = {
      id: editingId || crypto.randomUUID(),
      name,
      price,
      category,
      recipe
    };

    if (editingId) {
      const oldItem = menu.find(m => m.id === editingId);
      let details = `Updated menu item: ${name}.`;
      if (oldItem?.price !== price) details += ` Price changed from ${oldItem?.price} to ${price}.`;
      addAuditLog('UPDATE', 'MENU', details);
      setMenu(prev => prev.map(m => m.id === editingId ? newItem : m));
      showToast('آیتم منو با موفقیت ویرایش شد.');
    } else {
      addAuditLog('CREATE', 'MENU', `Created new menu item: ${name}`);
      setMenu(prev => [...prev, newItem]);
      showToast('آیتم جدید به منو اضافه شد.');
    }
    setIsModalOpen(false);
  };

  const addIngredientToRecipe = (id: string, source: 'inventory' | 'prep') => {
    if (recipe.some(r => r.ingredientId === id)) return;
    
    if (source === 'inventory') {
        const ing = inventory.find(i => i.id === id);
        if (ing) {
            let defaultUnit = ing.unit;
            if (ing.unit === 'kg') defaultUnit = 'gram';
            if (ing.unit === 'liter') defaultUnit = 'ml';
            setRecipe([...recipe, { ingredientId: id, amount: 0, unit: defaultUnit, source: 'inventory' }]);
        }
    } else {
        const prep = prepTasks.find(p => p.id === id);
        if (prep) {
            setRecipe([...recipe, { ingredientId: id, amount: 1, unit: prep.unit, source: 'prep' }]);
        }
    }
  };

  const updateRecipeItem = (ingId: string, updates: Partial<RecipeIngredient>) => {
    setRecipe(prev => prev.map(r => r.ingredientId === ingId ? { ...r, ...updates } : r));
  };

  const removeIngredientFromRecipe = (ingId: string) => {
    setRecipe(prev => prev.filter(r => r.ingredientId !== ingId));
  };

  const deleteItem = (id: string) => {
    showModal('حذف آیتم', 'آیا از حذف این آیتم از منو اطمینان دارید؟', () => {
      const itemToDelete = menu.find(m => m.id === id);
      if(itemToDelete) addAuditLog('DELETE', 'MENU', `Deleted menu item: ${itemToDelete.name}`);
      setMenu(prev => prev.filter(m => m.id !== id));
      showToast('آیتم با موفقیت حذف شد.', 'error');
    });
  };

  const handleAnalyzeRecipe = async () => {
    if (!editingId) return;
    const currentItem = menu.find(m => m.id === editingId);
    if (!currentItem || !currentItem.recipe || currentItem.recipe.length === 0) {
      showToast("برای تحلیل، آیتم باید دارای فرمولاسیون ذخیره شده باشد.", 'error');
      return;
    }

    setIsAnalyzing(true);
    setAnalysisResult(null);
    try {
      const result = await analyzeRecipe(currentItem, inventory);
      setAnalysisResult(result);
    } catch (error) {
      console.error("Analysis Error:", error);
      setAnalysisResult("خطا در ارتباط با هوش مصنوعی. لطفا اتصال و کلید API را بررسی کنید.");
    } finally {
      setIsAnalyzing(false);
    }
  };

  const toggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) newSet.delete(itemId);
      else newSet.add(itemId);
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === menu.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(menu.map(item => item.id)));
    }
  };

  const handleBulkDelete = () => {
    showModal(
      `حذف ${selectedItems.size} آیتم`,
      'آیا از حذف آیتم‌های انتخاب شده اطمینان دارید؟',
      () => {
        const itemNames = Array.from(selectedItems).map(id => menu.find(i => i.id === id)?.name).join(', ');
        addAuditLog('DELETE', 'MENU', `Bulk deleted ${selectedItems.size} items: ${itemNames}`);
        setMenu(prev => prev.filter(item => !selectedItems.has(item.id)));
        setSelectedItems(new Set());
        showToast(`${selectedItems.size} آیتم با موفقیت حذف شد.`, 'error');
      }
    );
  };


  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 pt-24 pb-32 md:pb-8 md:pt-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-8">
       <div className="flex justify-between items-center">
        <div>
           <h2 className="text-3xl font-extrabold text-slate-800 tracking-tight">مهندسی منو</h2>
           <p className="text-slate-500 mt-1 font-medium">مدیریت قیمت‌گذاری و محاسبه دقیق سودآوری</p>
        </div>
        <div className="flex items-center gap-2">
            <div className="bg-white p-1 rounded-full border border-slate-200 shadow-sm">
                <button onClick={() => setViewType('card')} className={`p-2 rounded-full ${viewType === 'card' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}><LayoutGrid/></button>
                <button onClick={() => setViewType('table')} className={`p-2 rounded-full ${viewType === 'table' ? 'bg-indigo-50 text-indigo-600' : 'text-slate-400'}`}><List/></button>
            </div>
            <button 
            onClick={() => openModal()}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-2xl flex items-center gap-2 transition-all shadow-lg shadow-indigo-200 hover:shadow-indigo-300 active:scale-95"
            >
            <Plus className="w-5 h-5" />
            <span className="font-bold">آیتم جدید</span>
            </button>
        </div>
      </div>
      
      {selectedItems.size > 0 && (
          <div className="bg-slate-800 text-white p-4 rounded-3xl flex justify-between items-center animate-in fade-in slide-in-from-bottom-5 duration-300">
              <span className="font-bold text-sm">{selectedItems.size} آیتم انتخاب شده</span>
              <div className="flex gap-2">
                  <button onClick={handleBulkDelete} className="px-4 py-2 bg-rose-500/20 text-rose-300 hover:text-white hover:bg-rose-500 rounded-xl text-xs font-bold flex items-center gap-1">
                      <Trash2 className="w-3.5 h-3.5" /> حذف
                  </button>
              </div>
          </div>
      )}

      {viewType === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {menu.map((item, index) => {
            const cost = calculateCost(item.recipe);
            const margin = item.price - cost;
            const marginPercent = item.price > 0 ? Math.round((margin / item.price) * 100) : 0;
            
            const isHighProfit = marginPercent >= 50;
            const isMediumProfit = marginPercent >= 30 && marginPercent < 50;
            
            return (
                <div 
                key={item.id} 
                className="bg-white rounded-[24px] shadow-xl shadow-slate-200/50 border border-slate-100 p-6 relative group hover:border-indigo-200 hover:-translate-y-1 transition-all duration-300 opacity-0 animate-in-stagger"
                style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                >
                <div className="absolute top-4 left-4 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                    <button onClick={() => openModal(item)} className="p-2 bg-white border border-slate-200 hover:bg-indigo-50 hover:text-indigo-600 rounded-xl text-slate-400 shadow-sm transition-colors"><Edit2 className="w-4 h-4"/></button>
                    <button onClick={() => deleteItem(item.id)} className="p-2 bg-white border border-slate-200 hover:bg-rose-50 hover:text-rose-600 rounded-xl text-slate-400 shadow-sm transition-colors"><Trash2 className="w-4 h-4"/></button>
                </div>
                
                <div className="flex items-start gap-4 mb-6">
                    <div className={`w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 shadow-lg shadow-indigo-100 bg-gradient-to-br from-white to-slate-50 border border-slate-100`}>
                        <ChefHat className="w-7 h-7 text-indigo-600" />
                    </div>
                    <div className="pt-1">
                        <h3 className="font-bold text-lg text-slate-800 leading-tight mb-1">{item.name}</h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">{item.category}</span>
                    </div>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-slate-400 text-xs font-bold block mb-1">فروش</span>
                            <span className="font-extrabold text-slate-800 text-sm">{item.price.toLocaleString()}</span>
                        </div>
                        <div className="p-3 bg-slate-50 rounded-2xl border border-slate-100">
                            <span className="text-slate-400 text-xs font-bold block mb-1">هزینه</span>
                            <span className="font-bold text-slate-600 text-sm">{Math.round(cost).toLocaleString()}</span>
                        </div>
                    </div>

                    <div className={`flex items-center gap-3 p-1 rounded-2xl border ${
                        isHighProfit ? 'bg-emerald-50 border-emerald-100' : 
                        isMediumProfit ? 'bg-amber-50 border-amber-100' : 
                        'bg-rose-50 border-rose-100'
                    }`}>
                        <div className="flex-1 px-3 py-2">
                            <div className="flex items-center gap-1.5 mb-0.5">
                            <TrendingUp className={`w-3.5 h-3.5 ${
                                isHighProfit ? 'text-emerald-600' : 
                                isMediumProfit ? 'text-amber-600' : 
                                'text-rose-600'
                            }`} />
                            <span className={`text-[10px] font-bold uppercase ${
                                isHighProfit ? 'text-emerald-600' : 
                                isMediumProfit ? 'text-amber-600' : 
                                'text-rose-600'
                            }`}>سود خالص</span>
                            </div>
                            <div className={`font-bold text-base ${
                                isHighProfit ? 'text-emerald-700' : 
                                isMediumProfit ? 'text-amber-700' : 
                                'text-rose-700'
                            }`}>
                            {Math.round(margin).toLocaleString()} <span className="text-[10px] opacity-70">تومان</span>
                            </div>
                        </div>
                        
                        <div className={`w-14 h-14 flex flex-col items-center justify-center rounded-xl shadow-sm ${
                            isHighProfit ? 'bg-emerald-500 text-white shadow-emerald-200' : 
                            isMediumProfit ? 'bg-amber-500 text-white shadow-amber-200' : 
                            'bg-rose-500 text-white shadow-rose-200'
                        }`}>
                            <span className="text-xs font-bold opacity-80">%</span>
                            <span className="text-lg font-extrabold tracking-tighter leading-none">{marginPercent}</span>
                        </div>
                    </div>
                </div>
                </div>
            );
            })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm">
            <table className="w-full text-right">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="p-4 w-10 text-center">
                            <input type="checkbox"
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={selectedItems.size === menu.length && menu.length > 0}
                                onChange={toggleSelectAll}
                            />
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">نام آیتم</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">دسته‌بندی</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">قیمت فروش</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">هزینه تمام شده</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">سود (٪)</th>
                        <th className="p-4"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {menu.map(item => {
                        const isSelected = selectedItems.has(item.id);
                        const cost = calculateCost(item.recipe);
                        const margin = item.price - cost;
                        const marginPercent = item.price > 0 ? Math.round((margin / item.price) * 100) : 0;
                        return (
                            <tr key={item.id} className={`transition-colors ${isSelected ? 'bg-indigo-50' : 'hover:bg-slate-50'}`}>
                                <td className="p-4 text-center">
                                    <input type="checkbox"
                                        className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                        checked={isSelected}
                                        onChange={() => toggleSelection(item.id)}
                                    />
                                </td>
                                <td className="p-4 font-bold text-slate-800 text-sm">{item.name}</td>
                                <td className="p-4 text-xs text-slate-500 font-bold">{item.category}</td>
                                <td className="p-4 text-sm text-slate-600 font-mono font-bold">{item.price.toLocaleString()}</td>
                                <td className="p-4 text-sm text-slate-600 font-mono">{Math.round(cost).toLocaleString()}</td>
                                <td className={`p-4 text-sm font-bold font-mono ${marginPercent > 50 ? 'text-emerald-600' : marginPercent > 30 ? 'text-amber-600' : 'text-rose-600'}`}>{marginPercent}%</td>
                                <td className="p-4 text-center">
                                    <button onClick={() => openModal(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
           <div className="bg-white rounded-[32px] w-full max-w-2xl h-[90vh] md:h-[85vh] flex flex-col shadow-2xl animate-in zoom-in-95 duration-200 overflow-hidden">
              <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-white z-10">
                 <div className="flex items-center gap-4">
                    <div className="w-12 h-12 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm">
                        {editingId ? <Edit2 className="w-6 h-6" /> : <Plus className="w-6 h-6" />}
                    </div>
                    <div>
                        <h3 className="text-xl font-extrabold text-slate-800">{editingId ? 'ویرایش آیتم منو' : 'تعریف آیتم جدید'}</h3>
                        <p className="text-xs text-slate-400 font-bold mt-1">اطلاعات محصول و فرمولاسیون را وارد کنید</p>
                    </div>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 text-slate-400 transition-colors">✕</button>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-8 custom-scrollbar bg-slate-50/50">
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                    <div className="md:col-span-2">
                      <label className="block text-sm font-bold text-slate-700 mb-2">نام آیتم</label>
                      <input 
                        type="text" 
                        value={name} 
                        onChange={e => setName(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-bold text-slate-700 shadow-sm" 
                        placeholder="مثلا: پیتزا پپرونی"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-bold text-slate-700 mb-2">دسته‌بندی</label>
                       <input 
                        type="text"
                        list="categories-datalist"
                        value={category} 
                        onChange={e => setCategory(e.target.value)} 
                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm"
                        placeholder="مثلا: غذای اصلی"
                      />
                      <datalist id="categories-datalist">
                        {availableCategories.map(cat => <option key={cat} value={cat} />)}
                      </datalist>
                    </div>
                    <div className="md:col-span-1">
                      <label className="block text-sm font-bold text-slate-700 mb-2">قیمت فروش (تومان)</label>
                      <input 
                        type="number" 
                        value={price} 
                        onChange={e => setPrice(Number(e.target.value))} 
                        className="w-full bg-white border border-slate-200 rounded-2xl p-4 outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all font-extrabold text-slate-800 shadow-sm" 
                      />
                    </div>
                 </div>

                 <div className="bg-white p-6 rounded-[24px] border border-slate-200 shadow-sm">
                    <div className="flex justify-between items-center mb-6">
                        <h4 className="font-bold text-slate-800 text-lg flex items-center gap-2">
                            <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                            فرمولاسیون (Recipe)
                        </h4>
                        <div className="bg-slate-50 px-5 py-3 rounded-2xl border border-slate-200">
                            <span className="text-xs text-slate-400 block font-bold mb-1">هزینه تمام شده</span>
                            <span className="font-extrabold text-slate-800 text-xl">{Math.round(currentCost).toLocaleString()} <span className="text-xs font-normal text-slate-400">تومان</span></span>
                        </div>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                         <select 
                            onChange={(e) => {
                                if(e.target.value) { addIngredientToRecipe(e.target.value, 'inventory'); e.target.value = ""; }
                            }}
                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 text-sm font-bold text-slate-600 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                        >
                            <option value="">+ مواد اولیه خام (Raw)</option>
                            {inventory.map(ing => (
                                <option key={ing.id} value={ing.id}>{ing.name} ({ing.unit})</option>
                            ))}
                        </select>

                        <select 
                            onChange={(e) => {
                                if(e.target.value) { addIngredientToRecipe(e.target.value, 'prep'); e.target.value = ""; }
                            }}
                            className="w-full bg-indigo-50 border border-indigo-100 rounded-2xl p-4 text-sm font-bold text-indigo-700 outline-none focus:ring-2 focus:ring-indigo-500/50 cursor-pointer"
                        >
                            <option value="">+ مواد نیمه‌آماده (Mise en place)</option>
                            {prepTasks.map(p => (
                                <option key={p.id} value={p.id}>{p.item} (موجودی: {p.onHand} {p.unit})</option>
                            ))}
                        </select>
                    </div>

                    <div className="space-y-3 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                       {recipe.map((r, idx) => {
                          const isPrep = r.source === 'prep';
                          const itemData = isPrep 
                              ? prepTasks.find(p => p.id === r.ingredientId) 
                              : inventory.find(i => i.id === r.ingredientId);
                          
                          if (!itemData) return null;
                          
                          const name = isPrep ? (itemData as any).item : (itemData as any).name;
                          const baseUnit = itemData.unit;
                          const compatibleUnits = getCompatibleUnits(baseUnit);

                          return (
                            <div key={r.ingredientId} className={`flex flex-col sm:flex-row items-start sm:items-center gap-3 p-3 rounded-2xl border shadow-sm group transition-all ${isPrep ? 'bg-indigo-50/50 border-indigo-100' : 'bg-white border-slate-100'}`}>
                               <div className="flex items-center gap-3 w-full sm:w-auto flex-1">
                                   <div className={`w-8 h-8 rounded-xl flex items-center justify-center font-bold text-xs shrink-0 ${isPrep ? 'bg-indigo-200 text-indigo-700' : 'bg-slate-100 text-slate-600'}`}>
                                        {idx + 1}
                                   </div>
                                   <div className="min-w-0">
                                        <div className="font-bold text-slate-800 text-sm truncate">{name}</div>
                                        <div className="text-[10px] text-slate-400 font-bold flex gap-2">
                                            <span>{isPrep ? 'آشپزخانه (Prep)' : 'انبار (Raw)'}</span>
                                        </div>
                                   </div>
                               </div>
                               
                               <div className="flex items-center gap-2 w-full sm:w-auto">
                                   <input 
                                     type="number" 
                                     value={r.amount} 
                                     onChange={e => updateRecipeItem(r.ingredientId, { amount: Number(e.target.value) })}
                                     className="w-20 bg-white border border-slate-200 rounded-xl p-2 text-center text-sm font-bold outline-none focus:border-indigo-500"
                                     placeholder="مقدار"
                                   />
                                   
                                   <div className="relative w-24">
                                       <select
                                            value={r.unit}
                                            onChange={e => updateRecipeItem(r.ingredientId, { unit: e.target.value })}
                                            className="w-full bg-white border border-slate-200 rounded-xl p-2 pr-2 text-xs font-bold appearance-none outline-none focus:border-indigo-500"
                                       >
                                           {compatibleUnits.map(u => (
                                               <option key={u} value={u}>{u}</option>
                                           ))}
                                       </select>
                                   </div>

                                   <button onClick={() => removeIngredientFromRecipe(r.ingredientId)} className="p-2 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-colors"><Trash2 className="w-4 h-4" /></button>
                               </div>
                            </div>
                          )
                       })}
                       {recipe.length === 0 && (
                            <div className="text-center text-slate-400 text-sm py-10 border-2 border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                                <Package className="w-10 h-10 mx-auto mb-3 opacity-20" />
                                مواد تشکیل‌دهنده را از انبار یا میزانپلاس اضافه کنید
                            </div>
                       )}
                    </div>
                 </div>

                <div className="mt-6">
                    <button
                    onClick={handleAnalyzeRecipe}
                    disabled={isAnalyzing || !editingId}
                    className="w-full flex items-center justify-center gap-3 bg-gradient-to-r from-indigo-500 to-purple-500 text-white px-6 py-4 rounded-2xl font-bold shadow-lg shadow-indigo-200/50 hover:shadow-xl hover:shadow-indigo-300/50 transition-all disabled:opacity-50 disabled:cursor-not-allowed active:scale-95"
                    >
                    {isAnalyzing ? (
                        <Loader2 className="w-5 h-5 animate-spin" />
                    ) : (
                        <Sparkles className="w-5 h-5" />
                    )}
                    <span>{isAnalyzing ? 'در حال تحلیل...' : 'تحلیل هوشمند و پیشنهاد بهبود رسپی'}</span>
                    </button>
                    {analysisResult && (
                    <div className="mt-4 p-5 bg-indigo-50/50 border border-indigo-100 rounded-2xl animate-in fade-in duration-500 max-h-64 overflow-y-auto custom-scrollbar">
                        <ReactMarkdown className="prose prose-sm prose-slate max-w-none prose-p:leading-relaxed prose-headings:font-black prose-strong:text-indigo-700 prose-ul:list-disc prose-ul:marker:text-indigo-400 prose-ul:list-inside">
                        {analysisResult}
                        </ReactMarkdown>
                    </div>
                    )}
                </div>

              </div>

              <div className="p-6 border-t border-slate-100 flex gap-4 bg-white z-10">
                 <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-600 hover:bg-slate-100 rounded-2xl font-bold transition-colors">انصراف</button>
                 <button onClick={handleSave} className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition-all">ذخیره تغییرات</button>
              </div>
           </div>
        </div>
      )}
    </div>
  );
};