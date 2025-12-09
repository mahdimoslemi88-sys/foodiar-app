import React, { useState, useMemo, useRef } from 'react';
import { MenuItem, Sale, SaleItem, PaymentMethod, Shift, getConversionFactor } from '../../types';
import { useDataStore } from '../../contexts/DataContext';
import { useToast } from '../../contexts/ToastContext';
import { processSalesFile, ProcessedSalesData } from '../../services/geminiService';
import * as XLSX from 'xlsx';
import { 
  ShoppingCart, Minus, Plus, X, Search, 
  Coffee, Pizza, Utensils, Receipt, CheckCircle, 
  Trash2, CreditCard, Percent, DollarSign, Banknote, Lock, ChevronUp, Loader2, FileUp, Globe
} from 'lucide-react';

interface POSProps {
  currentShift?: Shift;
}

export const POSView: React.FC<POSProps> = ({ currentShift }) => {
  const { menu, setMenu, inventory, setInventory, setSales, prepTasks, setPrepTasks } = useDataStore();
  const { showToast } = useToast();

  const [cart, setCart] = useState<{item: MenuItem, quantity: number}[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('همه');
  const [searchQuery, setSearchQuery] = useState('');
  const [isMobileCartOpen, setIsMobileCartOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [animatedItemId, setAnimatedItemId] = useState<string | null>(null);
  
  const [isImporting, setIsImporting] = useState(false);
  const [isConfirmationModalOpen, setIsConfirmationModalOpen] = useState(false);
  const [pendingSalesData, setPendingSalesData] = useState<ProcessedSalesData | null>(null);
  const [currencyUnit, setCurrencyUnit] = useState<'toman' | 'rial'>('toman');
  
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [includeTax, setIncludeTax] = useState(false);
  const [discount, setDiscount] = useState<number>(0);
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('amount');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');

  const categories = ['همه', ...Array.from(new Set(menu.map(m => m.category)))];

  const filteredMenu = useMemo(() => {
    let result = menu;
    if (selectedCategory !== 'همه') {
      result = result.filter(m => m.category === selectedCategory);
    }
    if (searchQuery) {
      result = result.filter(m => m.name.toLowerCase().includes(searchQuery.toLowerCase()));
    }
    return result;
  }, [menu, selectedCategory, searchQuery]);

  const addToCart = (item: MenuItem) => {
    setAnimatedItemId(item.id);
    setTimeout(() => setAnimatedItemId(null), 300);

    setCart(prev => {
      const existing = prev.find(c => c.item.id === item.id);
      if (existing) {
        return prev.map(c => c.item.id === item.id ? { ...c, quantity: c.quantity + 1 } : c);
      }
      return [...prev, { item, quantity: 1 }];
    });
  };

  const removeFromCart = (itemId: string) => {
    setCart(prev => prev.filter(c => c.item.id !== itemId));
  };

  const updateQuantity = (itemId: string, delta: number) => {
    setCart(prev => prev.map(c => {
      if (c.item.id === itemId) {
        return { ...c, quantity: Math.max(1, c.quantity + delta) };
      }
      return c;
    }));
  };

  const calculateSubtotal = () => {
    return cart.reduce((sum, c) => sum + (c.item.price * c.quantity), 0);
  };

  const calculateDiscountAmount = (subtotal: number) => {
    if (discountType === 'percent') {
        const percent = Math.min(Math.max(discount, 0), 100);
        return Math.round(subtotal * (percent / 100));
    }
    return Math.min(discount, subtotal);
  };

  const calculateTotal = () => {
    const subtotal = calculateSubtotal();
    const discountAmt = calculateDiscountAmount(subtotal);
    const afterDiscount = Math.max(0, subtotal - discountAmt);
    const tax = includeTax ? Math.round(afterDiscount * 0.09) : 0;
    return afterDiscount + tax;
  };

  const handleCheckout = async () => {
    if (cart.length === 0) return;
    setLoading(true);

    try {
        let totalCost = 0;
        
        const saleItems: SaleItem[] = cart.map(c => {
        const itemCost = c.item.recipe.reduce((sum, r) => {
            if (r.source === 'prep') {
                const prepItem = prepTasks.find(p => p.id === r.ingredientId);
                if (prepItem && prepItem.costPerUnit) {
                    const factor = getConversionFactor(r.unit, prepItem.unit);
                    return sum + (prepItem.costPerUnit * r.amount * factor);
                }
            } else {
                const ing = inventory.find(i => i.id === r.ingredientId);
                if (ing) {
                    const factor = getConversionFactor(r.unit, ing.unit);
                    return sum + (ing.costPerUnit * r.amount * factor);
                }
            }
            return sum;
        }, 0);
        
        totalCost += itemCost * c.quantity;

        return {
            menuItemId: c.item.id,
            quantity: c.quantity,
            priceAtSale: c.item.price,
            costAtSale: itemCost
        };
        });

        const subtotal = calculateSubtotal();
        const discountAmt = calculateDiscountAmount(subtotal);
        const afterDiscount = Math.max(0, subtotal - discountAmt);
        const taxAmount = includeTax ? Math.round(afterDiscount * 0.09) : 0;
        const finalTotal = afterDiscount + taxAmount;

        const newSale: Sale = {
            id: crypto.randomUUID(),
            timestamp: Date.now(),
            items: saleItems,
            totalAmount: finalTotal,
            totalCost: Math.round(totalCost),
            tax: taxAmount,
            discount: discountAmt,
            paymentMethod: paymentMethod,
            shiftId: currentShift ? currentShift.id : undefined,
            status: 'pending'
        };

        setSales(prev => [newSale, ...prev]);

        const inventoryUpdates = new Map<string, number>();
        const prepUpdates = new Map<string, number>();

        cart.forEach(c => {
            c.item.recipe.forEach(r => {
                if (r.source === 'prep') {
                    const prepItem = prepTasks.find(p => p.id === r.ingredientId);
                    if (prepItem) {
                        const factor = getConversionFactor(r.unit, prepItem.unit);
                        const amountToDeduct = r.amount * factor * c.quantity;
                        const current = prepUpdates.get(r.ingredientId) || 0;
                        prepUpdates.set(r.ingredientId, current + amountToDeduct);
                    }
                } else {
                    const ing = inventory.find(i => i.id === r.ingredientId);
                    if (ing) {
                        const factor = getConversionFactor(r.unit, ing.unit);
                        const amountToDeduct = r.amount * factor * c.quantity;
                        const current = inventoryUpdates.get(r.ingredientId) || 0;
                        inventoryUpdates.set(r.ingredientId, current + amountToDeduct);
                    }
                }
            });
        });

        setInventory(prev => prev.map(ing => {
            const deduct = inventoryUpdates.get(ing.id);
            if (deduct) {
                return { ...ing, currentStock: Math.max(0, ing.currentStock - deduct) };
            }
            return ing;
        }));

        setPrepTasks(prev => prev.map(task => {
            const deduct = prepUpdates.get(task.id);
            if (deduct) {
                return { ...task, onHand: Math.max(0, task.onHand - deduct) };
            }
            return task;
        }));

        setCart([]);
        setDiscount(0);
        setIncludeTax(false);
        setPaymentMethod('card');
        setIsMobileCartOpen(false);
        showToast('فاکتور با موفقیت ثبت شد');

    } catch (e) {
        showToast('خطا در ثبت سفارش.', 'error');
        console.error(e);
    } finally {
        setLoading(false);
    }
  };

  const handleFileImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (e) => {
        setIsImporting(true);
        try {
            const data = e.target?.result;
            const workbook = XLSX.read(data, { type: 'array' });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const csvContent = XLSX.utils.sheet_to_csv(worksheet);

            const result = await processSalesFile(csvContent, menu);
            
            setPendingSalesData(result);
            setCurrencyUnit('toman');
            setIsConfirmationModalOpen(true);

        } catch (error) {
            console.error(error);
            showToast("خطا در پردازش فایل. لطفا فایل را بررسی کرده و مجددا تلاش کنید.", 'error');
            setIsImporting(false);
        } finally {
            if(fileInputRef.current) fileInputRef.current.value = "";
        }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingSalesData) return;
    
    setIsConfirmationModalOpen(false);

    try {
        const conversionFactor = currencyUnit === 'rial' ? 0.1 : 1;

        const convertedData: ProcessedSalesData = {
            newItemsFound: pendingSalesData.newItemsFound.map(item => ({
                ...item,
                price: Math.round(item.price * conversionFactor)
            })),
            processedSales: pendingSalesData.processedSales.map(sale => ({
                ...sale,
                pricePerItem: Math.round(sale.pricePerItem * conversionFactor)
            }))
        };
        
        let updatedMenu = [...menu];
        if(convertedData.newItemsFound.length > 0) {
            const newMenuItems: MenuItem[] = convertedData.newItemsFound.map(item => ({
                id: crypto.randomUUID(),
                name: item.name,
                category: item.category,
                price: item.price,
                recipe: []
            }));
            updatedMenu = [...menu, ...newMenuItems];
            setMenu(updatedMenu);
        }

        const saleItems: SaleItem[] = [];
        let totalCost = 0;

        convertedData.processedSales.forEach(ps => {
            const menuItem = updatedMenu.find(m => m.name === ps.itemName);
            if (menuItem) {
                const itemCost = menuItem.recipe.reduce((sum, r) => {
                    const ing = inventory.find(i => i.id === r.ingredientId);
                    if (ing) {
                        const factor = getConversionFactor(r.unit, inventory.find(i => i.id === r.ingredientId)?.unit || r.unit);
                        return sum + (ing.costPerUnit * r.amount * factor);
                    }
                    return sum;
                }, 0);
                
                totalCost += itemCost * ps.quantity;
                saleItems.push({
                    menuItemId: menuItem.id,
                    quantity: ps.quantity,
                    priceAtSale: ps.pricePerItem,
                    costAtSale: itemCost
                });
            }
        });

        if(saleItems.length > 0) {
            const totalAmount = saleItems.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
            const newSale: Sale = {
                id: crypto.randomUUID(),
                timestamp: Date.now(),
                items: saleItems,
                totalAmount,
                totalCost,
                paymentMethod: 'card',
                shiftId: currentShift?.id,
                status: 'delivered'
            };
            setSales(prev => [newSale, ...prev]);

            const inventoryUpdates = new Map<string, number>();
            saleItems.forEach(si => {
                const menuItem = updatedMenu.find(m => m.id === si.menuItemId);
                menuItem?.recipe.forEach(r => {
                    const factor = getConversionFactor(r.unit, inventory.find(i => i.id === r.ingredientId)?.unit || r.unit);
                    const amountToDeduct = r.amount * factor * si.quantity;
                    const current = inventoryUpdates.get(r.ingredientId) || 0;
                    inventoryUpdates.set(r.ingredientId, current + amountToDeduct);
                });
            });

            setInventory(prev => prev.map(ing => {
                const deduct = inventoryUpdates.get(ing.id);
                if(deduct) return {...ing, currentStock: Math.max(0, ing.currentStock - deduct)};
                return ing;
            }));
        }
        
        showToast(`${convertedData.processedSales.length} ردیف فروش با موفقیت وارد شد.`);

    } catch (error) {
        console.error("Error confirming import:", error);
        showToast("خطا در ثبت نهایی اطلاعات فایل.", 'error');
    } finally {
        setIsImporting(false);
        setPendingSalesData(null);
    }
  };

  const getItemIcon = (cat: string) => {
    if (cat.includes('نوشیدنی') || cat.includes('قهوه')) return <Coffee className="w-6 h-6" />;
    if (cat.includes('پیتزا') || cat.includes('فست')) return <Pizza className="w-6 h-6" />;
    return <Utensils className="w-6 h-6" />;
  };

  return (
    <div className="flex h-full w-full bg-[#F3F4F6] overflow-hidden relative">
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileImport}
        accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
        style={{ display: 'none' }}
      />
      <div className="flex-1 flex flex-col h-full min-w-0 overflow-hidden">
        <div className="pt-20 px-4 pb-2 md:pt-6 md:px-6 bg-[#F3F4F6] z-20 shrink-0">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
            <div className="flex-1">
              <h2 className="text-2xl font-extrabold text-slate-800 tracking-tight">نقطه فروش (POS)</h2>
              <div className="flex items-center gap-2 mt-1">
                 <p className="text-slate-500 text-sm">مدیریت سفارشات مشتریان</p>
                 {currentShift ? (
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">شیفت باز</span>
                 ) : (
                    <span className="bg-rose-100 text-rose-700 text-[10px] font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        شیفت بسته
                    </span>
                 )}
              </div>
            </div>
            
            <div className="flex gap-2 w-full md:w-auto">
                 <button 
                   onClick={() => fileInputRef.current?.click()}
                   disabled={isImporting}
                   className="flex items-center justify-center gap-2 bg-white text-slate-600 px-4 py-3 rounded-2xl font-bold text-sm border border-slate-200 hover:bg-slate-50 transition-all disabled:opacity-50"
                 >
                    {isImporting ? <Loader2 className="w-4 h-4 animate-spin"/> : <FileUp className="w-4 h-4" />}
                    <span>{isImporting ? 'پردازش...' : 'بارگذاری فایل'}</span>
                 </button>
                 <div className="relative w-full md:w-64 group">
                   <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-indigo-500 transition-colors" />
                   <input 
                     type="text" 
                     placeholder="جستجو..." 
                     value={searchQuery}
                     onChange={(e) => setSearchQuery(e.target.value)}
                     className="w-full bg-white border border-slate-200 rounded-2xl py-3 pr-10 pl-4 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/50 transition-all shadow-sm"
                   />
                 </div>
            </div>
          </div>

          <div className="flex gap-2 overflow-x-auto pb-2 no-scrollbar scroll-smooth mask-gradient-right">
            {categories.map(cat => (
              <button
                key={cat}
                onClick={() => setSelectedCategory(cat)}
                className={`px-5 py-2.5 rounded-xl text-sm font-bold whitespace-nowrap transition-all border ${
                  selectedCategory === cat 
                  ? 'bg-slate-800 text-white border-slate-800 shadow-md transform scale-105' 
                  : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-4 md:px-6 pb-48 md:pb-6 custom-scrollbar">
          {filteredMenu.length === 0 ? (
            <div className="h-64 flex flex-col items-center justify-center text-slate-400">
               <Search className="w-12 h-12 mb-2 opacity-20" />
               <p>آیتمی یافت نشد</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredMenu.map((item, idx) => (
                <button 
                  key={item.id}
                  onClick={() => addToCart(item)}
                  className={`group flex flex-col bg-white border border-slate-100 rounded-3xl p-4 hover:border-indigo-200 hover:shadow-lg hover:shadow-indigo-100/50 transition-all duration-300 relative overflow-hidden text-right active:scale-[0.98] ${
                    animatedItemId === item.id ? 'animate-pop' : ''
                  }`}
                >
                   <div className="absolute top-0 left-0 w-full h-24 bg-gradient-to-b from-slate-50 to-transparent opacity-50 group-hover:from-indigo-50/50 transition-colors"></div>
                   
                   <div className="relative z-10 flex justify-between items-start mb-4">
                      <div className={`w-12 h-12 rounded-2xl flex items-center justify-center shadow-sm ${idx % 3 === 0 ? 'bg-indigo-100 text-indigo-600' : idx % 3 === 1 ? 'bg-amber-100 text-amber-600' : 'bg-emerald-100 text-emerald-600'}`}>
                         {item.imageUrl ? (
                           <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover rounded-2xl" />
                         ) : (
                           getItemIcon(item.category)
                         )}
                      </div>
                      <div className="w-8 h-8 rounded-full bg-white border border-slate-100 flex items-center justify-center text-slate-400 group-hover:bg-indigo-600 group-hover:text-white group-hover:border-indigo-600 transition-all shadow-sm">
                         <Plus className="w-4 h-4" />
                      </div>
                   </div>

                   <div className="relative z-10 mt-auto">
                      <h3 className="font-bold text-slate-800 text-sm mb-1 line-clamp-1">{item.name}</h3>
                      <p className="text-xs text-slate-400 mb-3">{item.category}</p>
                      <div className="flex items-center gap-1">
                         <span className="font-extrabold text-slate-900 text-lg">{item.price.toLocaleString()}</span>
                         <span className="text-[10px] text-slate-500 font-medium">تومان</span>
                      </div>
                   </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="hidden lg:flex w-[400px] flex-col bg-white border-r border-slate-200 h-full shadow-2xl z-30">
         <CartContent 
            cart={cart} 
            updateQuantity={updateQuantity} 
            removeFromCart={removeFromCart} 
            calculateTotal={calculateTotal} 
            handleCheckout={handleCheckout} 
            setCart={setCart}
            isMobile={false}
            includeTax={includeTax}
            setIncludeTax={setIncludeTax}
            discount={discount}
            setDiscount={setDiscount}
            discountType={discountType}
            setDiscountType={setDiscountType}
            calculateSubtotal={calculateSubtotal}
            calculateDiscountAmount={calculateDiscountAmount}
            paymentMethod={paymentMethod}
            setPaymentMethod={setPaymentMethod}
            currentShift={currentShift}
            loading={loading}
         />
      </div>

      <div className="lg:hidden fixed bottom-28 left-4 right-4 z-30">
          <button 
            onClick={() => setIsMobileCartOpen(true)}
            className="w-full bg-slate-900 text-white rounded-2xl p-4 shadow-lg shadow-slate-900/20 flex items-center justify-between active:scale-95 transition-transform"
          >
             <div className="flex items-center gap-3">
                <div className="bg-white/20 p-2 rounded-lg">
                   <ShoppingCart className="w-5 h-5" />
                </div>
                <div className="text-right">
                   <p className="text-xs text-slate-300">سبد خرید</p>
                   <p className="font-bold">{cart.length} آیتم</p>
                </div>
             </div>
             <div className="flex items-center gap-2">
                <span className="font-bold text-lg">{calculateTotal().toLocaleString()}</span>
                <span className="text-xs text-slate-400">تومان</span>
                <ChevronUp className="w-5 h-5 ml-2" />
             </div>
          </button>
      </div>

      {isMobileCartOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex flex-col justify-end bg-slate-900/50 backdrop-blur-sm">
           <div 
             className="bg-white rounded-t-[32px] w-full h-[85vh] flex flex-col shadow-2xl animate-in slide-in-from-bottom-full duration-300"
             onClick={(e) => e.stopPropagation()} 
           >
              <div className="flex justify-center p-3" onClick={() => setIsMobileCartOpen(false)}>
                 <div className="w-12 h-1.5 bg-slate-200 rounded-full cursor-pointer"></div>
              </div>
              <CartContent 
                 cart={cart} 
                 updateQuantity={updateQuantity} 
                 removeFromCart={removeFromCart} 
                 calculateTotal={calculateTotal} 
                 handleCheckout={handleCheckout} 
                 setCart={setCart}
                 isMobile={true}
                 closeMobileCart={() => setIsMobileCartOpen(false)}
                 includeTax={includeTax}
                 setIncludeTax={setIncludeTax}
                 discount={discount}
                 setDiscount={setDiscount}
                 discountType={discountType}
                 setDiscountType={setDiscountType}
                 calculateSubtotal={calculateSubtotal}
                 calculateDiscountAmount={calculateDiscountAmount}
                 paymentMethod={paymentMethod}
                 setPaymentMethod={setPaymentMethod}
                 currentShift={currentShift}
                 loading={loading}
              />
           </div>
        </div>
      )}

      {isConfirmationModalOpen && pendingSalesData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800">تایید بارگذاری فروش</h3>
                    <button onClick={() => { setIsConfirmationModalOpen(false); setIsImporting(false); }} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    {pendingSalesData.newItemsFound.length > 0 && (
                        <div className="bg-indigo-50 border border-indigo-100 p-4 rounded-2xl">
                            <h4 className="font-bold text-indigo-800 text-sm mb-2">
                                {pendingSalesData.newItemsFound.length} آیتم جدید برای افزودن به منو شناسایی شد:
                            </h4>
                            <ul className="list-disc list-inside text-indigo-700 text-sm space-y-1">
                                {pendingSalesData.newItemsFound.map(item => (
                                    <li key={item.name}>
                                        <span className="font-bold">{item.name}</span> - قیمت: {item.price.toLocaleString()}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                    {pendingSalesData.newItemsFound.length === 0 && (
                        <div className="bg-slate-50 border border-slate-100 p-4 rounded-2xl text-center">
                            <p className="text-sm font-bold text-slate-600">آیتم جدیدی در فایل یافت نشد. تمام فروش‌ها برای آیتم‌های موجود ثبت می‌شود.</p>
                        </div>
                    )}

                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl">
                        <label className="block text-sm font-bold text-amber-900 mb-2">واحد پولی قیمت‌ها در فایل اکسل چیست؟</label>
                        <div className="flex gap-4">
                            <label className="flex items-center gap-2 p-3 flex-1 rounded-xl cursor-pointer" onClick={() => setCurrencyUnit('toman')}>
                                <input type="radio" name="currency" value="toman" checked={currencyUnit === 'toman'} onChange={() => {}} className="form-radio text-indigo-600 focus:ring-indigo-500" />
                                <span className="font-bold text-slate-700">تومان</span>
                            </label>
                            <label className="flex items-center gap-2 p-3 flex-1 rounded-xl cursor-pointer" onClick={() => setCurrencyUnit('rial')}>
                                <input type="radio" name="currency" value="rial" checked={currencyUnit === 'rial'} onChange={() => {}} className="form-radio text-indigo-600 focus:ring-indigo-500" />
                                <span className="font-bold text-slate-700">ریال (قیمت‌ها تقسیم بر ۱۰ خواهد شد)</span>
                            </label>
                        </div>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex gap-4">
                    <button onClick={() => { setIsConfirmationModalOpen(false); setPendingSalesData(null); setIsImporting(false); }} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">انصراف</button>
                    <button onClick={handleConfirmImport} className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2">
                        تایید و ثبت نهایی
                    </button>
                </div>
            </div>
        </div>
      )}

    </div>
  );
};

const CartContent = ({ 
    cart, updateQuantity, removeFromCart, calculateTotal, 
    handleCheckout, setCart, isMobile, closeMobileCart,
    includeTax, setIncludeTax, discount, setDiscount, 
    discountType, setDiscountType,
    calculateSubtotal, calculateDiscountAmount,
    paymentMethod, setPaymentMethod, currentShift, loading
}: any) => {
   
   const subtotal = calculateSubtotal ? calculateSubtotal() : 0;
   const discountAmt = calculateDiscountAmount ? calculateDiscountAmount(subtotal) : 0;
   const total = calculateTotal ? calculateTotal() : 0;
   const taxAmount = includeTax ? Math.round(Math.max(0, subtotal - discountAmt) * 0.09) : 0;

   return (
      <div className="flex flex-col h-full">
         <div className="p-6 border-b border-slate-100 bg-white">
            <div className="flex justify-between items-center mb-1">
               <h3 className="font-extrabold text-xl text-slate-800 flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-indigo-600" />
                  فاکتور فروش
               </h3>
               {isMobile && <button onClick={closeMobileCart} className="p-2 bg-slate-100 rounded-full"><X className="w-5 h-5"/></button>}
            </div>
            <div className="flex justify-between items-center text-sm mt-4">
               <span className="text-slate-500">سفارش #{Math.floor(Date.now()/1000).toString().slice(-4)}</span>
               {cart.length > 0 && (
                  <button onClick={() => setCart([])} className="text-rose-500 text-xs font-bold hover:bg-rose-50 px-2 py-1 rounded-lg transition-colors">
                     حذف همه
                  </button>
               )}
            </div>
         </div>

         <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar bg-slate-50">
            {cart.length === 0 ? (
               <div className="h-full flex flex-col items-center justify-center text-slate-400 opacity-60">
                  <ShoppingCart className="w-16 h-16 mb-4 text-slate-300" />
                  <p className="font-bold text-lg">سبد خالی است</p>
                  <p className="text-sm">آیتم‌ها را از منو انتخاب کنید</p>
               </div>
            ) : (
               cart.map((c: any) => (
                  <div key={c.item.id} className="bg-white p-3 rounded-2xl border border-slate-100 shadow-sm flex items-center gap-3">
                     <div className="flex-1">
                        <h4 className="font-bold text-slate-800 text-sm line-clamp-1">{c.item.name}</h4>
                        <div className="text-xs text-indigo-600 font-bold mt-1">
                           {(c.item.price * c.quantity).toLocaleString()} تومان
                        </div>
                     </div>
                     <div className="flex items-center bg-slate-100 rounded-xl p-1">
                        <button 
                           onClick={() => updateQuantity(c.item.id, 1)} 
                           className="w-8 h-8 flex items-center justify-center bg-white rounded-lg shadow-sm text-green-600 hover:text-green-700 active:scale-90 transition-all"
                        >
                           <Plus className="w-4 h-4"/>
                        </button>
                        <span className="w-8 text-center font-bold text-slate-700 text-sm">{c.quantity}</span>
                        <button 
                           onClick={() => c.quantity === 1 ? removeFromCart(c.item.id) : updateQuantity(c.item.id, -1)} 
                           className="w-8 h-8 flex items-center justify-center text-slate-400 hover:text-rose-500 hover:bg-white hover:shadow-sm rounded-lg active:scale-90 transition-all"
                        >
                           {c.quantity === 1 ? <Trash2 className="w-4 h-4" /> : <Minus className="w-4 h-4"/>}
                        </button>
                     </div>
                  </div>
               ))
            )}
         </div>

         <div className="p-6 bg-white border-t border-slate-200 shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)] z-10 space-y-4">
            
            {cart.length > 0 && (
               <div className="space-y-3 pb-3 border-b border-slate-100 border-dashed">
                  <div className="flex items-center justify-between gap-2">
                     <span className="text-sm text-slate-500 font-bold">تخفیف:</span>
                     <div className="flex items-center gap-1 bg-slate-50 rounded-xl p-1 border border-slate-200">
                        <input 
                           type="number" 
                           value={discount || ''} 
                           onChange={(e) => {
                              const val = Number(e.target.value);
                              if (discountType === 'percent' && val > 100) return;
                              setDiscount(val);
                           }}
                           placeholder={discountType === 'percent' ? '%' : 'تومان'}
                           className="w-20 bg-transparent px-2 py-1 text-sm font-bold text-center focus:outline-none placeholder:text-slate-300"
                        />
                        <div className="flex bg-white rounded-lg shadow-sm p-0.5">
                            <button 
                                onClick={() => setDiscountType('percent')}
                                className={`w-8 h-7 flex items-center justify-center rounded-md text-[10px] font-bold transition-all ${discountType === 'percent' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <Percent className="w-3.5 h-3.5" />
                            </button>
                            <button 
                                onClick={() => setDiscountType('amount')}
                                className={`w-8 h-7 flex items-center justify-center rounded-md text-[10px] font-bold transition-all ${discountType === 'amount' ? 'bg-indigo-100 text-indigo-700 shadow-sm' : 'text-slate-400 hover:text-slate-600'}`}
                            >
                                <DollarSign className="w-3.5 h-3.5" />
                            </button>
                        </div>
                     </div>
                  </div>

                  <label className="flex items-center justify-between cursor-pointer group">
                     <span className="text-sm text-slate-500 font-bold group-hover:text-slate-700 transition-colors">افزودن ۹٪ مالیات</span>
                     <div className="relative inline-flex items-center cursor-pointer">
                        <input 
                           type="checkbox" 
                           className="sr-only peer" 
                           checked={includeTax}
                           onChange={(e) => setIncludeTax(e.target.checked)}
                        />
                        <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                     </div>
                  </label>

                  <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-xl border border-slate-200">
                     <button
                        onClick={() => setPaymentMethod('card')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${paymentMethod === 'card' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                        <CreditCard className="w-4 h-4" />
                        کارتخوان
                     </button>
                     <button
                        onClick={() => setPaymentMethod('cash')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${paymentMethod === 'cash' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                        <Banknote className="w-4 h-4" />
                        نقد
                     </button>
                      <button
                        onClick={() => setPaymentMethod('online')}
                        className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all ${paymentMethod === 'online' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
                     >
                        <Globe className="w-4 h-4" />
                        آنلاین
                     </button>
                  </div>
               </div>
            )}

            <div className="space-y-2">
               <div className="flex justify-between text-slate-400 text-xs font-medium">
                  <span>جمع کل اقلام</span>
                  <span>{subtotal.toLocaleString()}</span>
               </div>
               {discountAmt > 0 && (
                  <div className="flex justify-between text-rose-500 text-xs font-medium">
                     <span>کسر تخفیف {discountType === 'percent' && `(${discount}%)`}</span>
                     <span>{discountAmt.toLocaleString()}-</span>
                  </div>
               )}
               {includeTax && (
                  <div className="flex justify-between text-slate-500 text-xs font-medium">
                     <span>مالیات بر ارزش افزوده</span>
                     <span>{taxAmount.toLocaleString()}+</span>
                  </div>
               )}
               <div className="flex justify-between items-center pt-2">
                  <span className="font-bold text-slate-800">مبلغ قابل پرداخت</span>
                  <span className="font-extrabold text-2xl text-indigo-600">{total.toLocaleString()} <span className="text-sm text-slate-400 font-normal">تومان</span></span>
               </div>
            </div>
            
            <button 
               onClick={handleCheckout}
               disabled={cart.length === 0 || loading}
               className="w-full bg-slate-900 hover:bg-slate-800 disabled:bg-slate-200 disabled:text-slate-400 disabled:cursor-not-allowed text-white py-4 rounded-xl font-bold text-lg shadow-xl shadow-slate-200 transition-all active:scale-[0.98] flex items-center justify-center gap-3 relative overflow-hidden"
            >
               {loading ? <Loader2 className="w-5 h-5 animate-spin relative z-10"/> : <CreditCard className="w-5 h-5 relative z-10" />}
               <span className="relative z-10">{loading ? 'در حال ثبت...' : 'تایید و پرداخت'}</span>
               {!currentShift && (
                   <div className="absolute inset-0 bg-white/50 z-20 flex items-center justify-center text-rose-600 font-bold text-xs backdrop-blur-sm">
                       ابتدا شیفت را باز کنید
                   </div>
               )}
            </button>
         </div>
      </div>
   );
};