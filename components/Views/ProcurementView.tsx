import React, { useState } from 'react';
import { Supplier, ForecastItem } from '../../types';
import { useDataStore } from '../../contexts/DataContext';
import { useModal } from '../../contexts/ModalContext';
import { useToast } from '../../contexts/ToastContext';
import { ShoppingBag, Send, AlertTriangle, CalendarClock, Phone, Trash2, Truck, FileText, Check, Circle, Sparkles, Loader2 } from 'lucide-react';

export const ProcurementView: React.FC = () => {
  const { 
    suppliers, setSuppliers, 
    purchaseInvoices, setPurchaseInvoices,
    procurementForecast, generateProcurementForecast 
  } = useDataStore();
  const { showModal } = useModal();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'order' | 'invoices' | 'suppliers'>('order');
  const [isForecasting, setIsForecasting] = useState(false);
  
  const handleGenerateForecast = async () => {
      setIsForecasting(true);
      try {
          await generateProcurementForecast();
          showToast('لیست خرید هوشمند با موفقیت تولید شد.');
      } catch (e) {
          showToast('خطا در تولید لیست خرید.', 'error');
      } finally {
          setIsForecasting(false);
      }
  };

  const handleSendOrder = (supplierName: string, phoneNumber: string, items: ForecastItem[]) => {
      const itemList = items.map(i => `- ${i.itemName}: ${i.quantityToOrder} ${i.unit}`).join('\n');
      const message = `سلام ${supplierName} عزیز،\nلطفا اقلام زیر را برای رستوران فودیار ارسال کنید:\n\n${itemList}\n\nباتشکر`;
      const encodedMsg = encodeURIComponent(message);
      window.open(`sms:${phoneNumber}?body=${encodedMsg}`, '_blank');
  };

  const [supName, setSupName] = useState('');
  const [supPhone, setSupPhone] = useState('');
  const [supCat, setSupCat] = useState('');

  const addSupplier = () => {
      if(!supName || !supPhone) return;
      setSuppliers(prev => [...prev, { id: crypto.randomUUID(), name: supName, phoneNumber: supPhone, category: supCat || 'General' }]);
      setSupName(''); setSupPhone(''); setSupCat('');
      showToast('تامین کننده جدید اضافه شد.');
  };

  const handleDeleteSupplier = (id: string) => {
    showModal('حذف تامین کننده', 'آیا از حذف این تامین‌کننده اطمینان دارید؟', () => {
        setSuppliers(prev => prev.filter(s => s.id !== id));
        showToast('تامین کننده با موفقیت حذف شد.', 'error');
    });
  };
  
  const toggleInvoiceStatus = (id: string) => {
      setPurchaseInvoices(prev => prev.map(inv => 
         inv.id === id ? { ...inv, status: inv.status === 'paid' ? 'unpaid' : 'paid' } : inv
      ));
      showToast('وضعیت فاکتور تغییر کرد.');
  };

  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-4 md:p-8 pt-24 pb-32 md:pb-8 md:pt-8 max-w-[1600px] mx-auto animate-in fade-in duration-500 space-y-6">
      
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
           <h2 className="text-2xl font-extrabold text-slate-800">تدارکات هوشمند</h2>
           <p className="text-slate-500 text-sm mt-1">پیش‌بینی مصرف و مدیریت سفارشات تامین‌کنندگان</p>
        </div>
        <div className="flex bg-white p-1 rounded-2xl border border-slate-200 shadow-sm overflow-x-auto">
           <button onClick={() => setActiveTab('order')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'order' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}>لیست خرید هوشمند</button>
           <button onClick={() => setActiveTab('invoices')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'invoices' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}>فاکتورهای خرید</button>
           <button onClick={() => setActiveTab('suppliers')} className={`px-4 py-2 rounded-xl text-sm font-bold transition-all whitespace-nowrap ${activeTab === 'suppliers' ? 'bg-indigo-600 text-white shadow-md' : 'text-slate-500 hover:text-slate-900'}`}>تامین‌کنندگان</button>
        </div>
      </div>

      {activeTab === 'order' && (
          <div className="space-y-6">
              <div className="bg-white p-6 rounded-[24px] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                  <div>
                      <h3 className="text-lg font-bold text-slate-800 flex items-center gap-2">
                          <Sparkles className="w-5 h-5 text-indigo-500"/>
                          پیش‌نویس لیست خرید
                      </h3>
                      <p className="text-sm text-slate-500 mt-1">هوش مصنوعی با تحلیل الگوی فروش، لیست خرید بهینه را برای شما آماده می‌کند.</p>
                  </div>
                  <button onClick={handleGenerateForecast} disabled={isForecasting} className="bg-slate-900 text-white px-6 py-3 rounded-full font-bold text-sm flex items-center gap-2 whitespace-nowrap self-end md:self-center hover:bg-slate-800 active:scale-95 transition-colors disabled:opacity-50">
                      {isForecasting ? <Loader2 className="w-4 h-4 animate-spin"/> : <Sparkles className="w-4 h-4" />}
                      {isForecasting ? 'در حال تحلیل...' : 'تولید لیست خرید هوشمند'}
                  </button>
              </div>

              {!procurementForecast && !isForecasting && (
                  <div className="text-center py-20 bg-white rounded-[32px] border-2 border-dashed border-slate-200">
                      <ShoppingBag className="w-16 h-16 mx-auto text-slate-300 mb-4" />
                      <h3 className="text-lg font-bold text-slate-600">آماده تولید لیست خرید</h3>
                      <p className="text-slate-400">برای شروع، روی دکمه "تولید لیست خرید هوشمند" کلیک کنید.</p>
                  </div>
              )}

              {procurementForecast && (
                  <>
                  {procurementForecast.orders.map(({supplierId, supplierName, items}) => {
                      const supplier = suppliers.find(s => s.id === supplierId);
                      return (
                      <div key={supplierId} className="bg-white rounded-[24px] p-6 shadow-xl shadow-slate-200/50 border border-slate-100">
                          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6 border-b border-slate-100 pb-4">
                              <div className="flex items-center gap-4">
                                  <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center shadow-sm">
                                      <Truck className="w-6 h-6" />
                                  </div>
                                  <div>
                                      <h3 className="text-lg font-extrabold text-slate-800">{supplierName}</h3>
                                      <span className="text-xs text-slate-400 mr-2">{supplier?.phoneNumber}</span>
                                  </div>
                              </div>
                              <button 
                                onClick={() => handleSendOrder(supplierName, supplier!.phoneNumber, items)}
                                className="flex items-center gap-2 bg-emerald-600 text-white px-5 py-3 rounded-2xl font-bold shadow-lg shadow-emerald-200 hover:bg-emerald-700 transition-all active:scale-95"
                              >
                                  <Send className="w-4 h-4" />
                                  ارسال سفارش (SMS)
                              </button>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                              {items.map(item => (
                                  <div key={item.itemId} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                                      <span className="font-bold text-slate-700 text-sm">{item.itemName}</span>
                                      <div className="flex items-center gap-2">
                                          <span className="text-xs text-rose-500 font-bold">موجودی: {item.currentStock}</span>
                                          <span className="text-xs text-slate-400">→</span>
                                          <span className="text-xs text-emerald-600 font-bold">سفارش: {item.quantityToOrder} {item.unit}</span>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )})}

                  {procurementForecast.noSupplierItems.length > 0 && (
                      <div className="bg-white rounded-[24px] p-6 shadow-sm border border-rose-100">
                          <div className="flex items-center gap-3 mb-4 text-rose-600">
                              <AlertTriangle className="w-6 h-6" />
                              <h3 className="font-bold">اقلام نیازمند خرید (بدون تامین‌کننده مشخص)</h3>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                             {procurementForecast.noSupplierItems.map(item => (
                                 <div key={item.itemId} className="p-3 bg-rose-50 rounded-xl border border-rose-100 flex justify-between">
                                     <span className="font-bold text-rose-900 text-sm">{item.itemName}</span>
                                     <span className="text-xs font-bold text-rose-700">{item.currentStock} {item.unit}</span>
                                 </div>
                             ))}
                          </div>
                          <p className="text-xs text-slate-400 mt-4">برای استفاده از سفارش خودکار، لطفا در بخش انبار برای این کالاها تامین‌کننده انتخاب کنید.</p>
                      </div>
                  )}
                  </>
              )}
          </div>
      )}

      {activeTab === 'invoices' && (
          <div className="bg-white p-6 rounded-[32px] shadow-sm border border-slate-100">
              <h3 className="font-bold text-lg mb-4 text-slate-800">حساب‌های پرداختنی (A/P)</h3>
              <div className="space-y-3">
                  {purchaseInvoices.slice().reverse().map(inv => (
                      <div key={inv.id} className={`p-4 rounded-2xl border flex items-center justify-between ${inv.status === 'paid' ? 'bg-emerald-50 border-emerald-100' : 'bg-white border-slate-100'}`}>
                          <div className="flex items-center gap-4">
                              <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${inv.status === 'paid' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                                  <FileText className="w-5 h-5" />
                              </div>
                              <div>
                                  <p className="font-bold text-slate-800">فاکتور {new Date(inv.invoiceDate).toLocaleDateString('fa-IR')}</p>
                                  <p className="text-xs text-slate-400 font-bold">{inv.items.length} قلم کالا</p>
                              </div>
                          </div>
                          <div className="flex items-center gap-4">
                              <span className="font-mono font-bold text-indigo-700">{inv.totalAmount.toLocaleString()} تومان</span>
                              <button 
                                onClick={() => toggleInvoiceStatus(inv.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-colors ${
                                    inv.status === 'paid' 
                                    ? 'bg-emerald-200 text-emerald-800 hover:bg-emerald-300' 
                                    : 'bg-slate-200 text-slate-800 hover:bg-slate-300'
                                }`}
                              >
                                  {inv.status === 'paid' ? <Check className="w-4 h-4" /> : <Circle className="w-4 h-4" />}
                                  {inv.status === 'paid' ? 'پرداخت شده' : 'پرداخت نشده'}
                              </button>
                          </div>
                      </div>
                  ))}
                  {purchaseInvoices.length === 0 && <p className="text-center py-10 text-slate-400">فاکتور خریدی ثبت نشده است.</p>}
              </div>
          </div>
      )}

      {activeTab === 'suppliers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              <div className="bg-white p-6 rounded-[32px] shadow-lg border border-slate-100 h-fit">
                  <h3 className="font-bold text-lg mb-4 text-slate-800">افزودن تامین‌کننده</h3>
                  <div className="space-y-3">
                      <input type="text" placeholder="نام (مثلا: قصابی نمونه)" value={supName} onChange={e=>setSupName(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" />
                      <input type="text" placeholder="شماره موبایل" value={supPhone} onChange={e=>setSupPhone(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" />
                      <input type="text" placeholder="دسته‌بندی (مثلا: گوشت)" value={supCat} onChange={e=>setSupCat(e.target.value)} className="w-full p-3 bg-slate-50 rounded-xl text-sm font-bold outline-none focus:ring-2 focus:ring-indigo-200" />
                      <button onClick={addSupplier} className="w-full py-3 bg-slate-900 text-white rounded-xl font-bold mt-2">ذخیره</button>
                  </div>
              </div>
              <div className="lg:col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {suppliers.map(sup => (
                      <div key={sup.id} className="bg-white p-5 rounded-[24px] border border-slate-100 shadow-sm flex flex-col justify-between group hover:border-indigo-100 transition-all">
                          <div className="flex justify-between items-start">
                              <div>
                                  <h4 className="font-bold text-slate-800">{sup.name}</h4>
                                  <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded mt-1 inline-block">{sup.category}</span>
                              </div>
                              <div className="flex gap-2">
                                  <button 
                                    onClick={() => handleDeleteSupplier(sup.id)}
                                    className="w-10 h-10 bg-slate-50 text-slate-400 hover:text-rose-500 hover:bg-rose-50 rounded-full flex items-center justify-center transition-colors"
                                    title="حذف تامین‌کننده"
                                  >
                                      <Trash2 className="w-5 h-5" />
                                  </button>
                                  <div className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-full flex items-center justify-center">
                                      <Truck className="w-5 h-5" />
                                  </div>
                              </div>
                          </div>
                          <div className="mt-4 pt-4 border-t border-slate-50 flex items-center gap-2 text-slate-500">
                              <Phone className="w-4 h-4" />
                              <span className="text-sm font-mono font-bold">{sup.phoneNumber}</span>
                          </div>
                      </div>
                  ))}
              </div>
          </div>
      )}

    </div>
  );
};