import React, { useState, useMemo, useEffect, useRef } from 'react';
import { Ingredient, WasteRecord, View, ProcessedInvoiceItem, PurchaseInvoice } from '../../types';
import { useDataStore } from '../../contexts/DataContext';
import { useModal } from '../../contexts/ModalContext';
import { useToast } from '../../contexts/ToastContext';
import { Plus, Search, MoreHorizontal, X, Trash2, Edit2, AlertTriangle, Loader2, Camera, FileUp, CheckCircle, PackagePlus, Repeat, LayoutGrid, List } from 'lucide-react';
import { processInvoiceImage } from '../../services/geminiService';

interface InventoryProps {
  onNavigate: (view: View) => void;
}

export const InventoryView: React.FC<InventoryProps> = ({ onNavigate }) => {
  const { inventory, setInventory, suppliers, setWasteRecords, setPurchaseInvoices, addAuditLog } = useDataStore();
  const { showModal } = useModal();
  const { showToast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [viewType, setViewType] = useState<'card' | 'table'>('card');
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isWasteModalOpen, setIsWasteModalOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<Ingredient | null>(null);
  const [openMenuId, setOpenMenuId] = useState<string | null>(null);

  const [formData, setFormData] = useState<Partial<Ingredient>>({
    name: '', unit: 'kg', currentStock: 0, costPerUnit: 0, minThreshold: 0, supplierId: '', purchaseHistory: []
  });

  const [wasteAmount, setWasteAmount] = useState<number>(0);
  const [wasteReason, setWasteReason] = useState('');

  const [isProcessingInvoice, setIsProcessingInvoice] = useState(false);
  const [invoiceConfirmationData, setInvoiceConfirmationData] = useState<{ date: string | null; items: ProcessedInvoiceItem[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const handleClickOutside = () => setOpenMenuId(null);
    if (openMenuId) window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, [openMenuId]);

  const totalItems = inventory.length;
  const totalValue = inventory.reduce((acc, i) => acc + (i.currentStock * i.costPerUnit), 0);

  const filteredInventory = useMemo(() => {
    return inventory.filter(item => item.name.toLowerCase().includes(searchQuery.toLowerCase()));
  }, [inventory, searchQuery]);

  const handleOpenModal = (item?: Ingredient) => {
    if (item) {
      setEditingItem(item);
      setFormData({ ...item });
    } else {
      setEditingItem(null);
      setFormData({ name: '', unit: 'kg', currentStock: 0, costPerUnit: 0, minThreshold: 0, supplierId: '', purchaseHistory: [] });
    }
    setIsModalOpen(true);
    setOpenMenuId(null);
  };

  const handleSaveItem = () => {
    if (!formData.name) return;

    if (editingItem) {
        const updatedItem = { ...editingItem, ...formData };
        setInventory(prev => prev.map(i => i.id === updatedItem.id ? updatedItem : i));
        addAuditLog('UPDATE', 'INVENTORY', `Updated item: ${updatedItem.name}`);
        showToast('کالا با موفقیت ویرایش شد.');
    } else {
        const cost = Number(formData.costPerUnit) || 0;
        const stock = Number(formData.currentStock) || 0;
        const newItem: Ingredient = {
            id: crypto.randomUUID(),
            name: formData.name!,
            unit: formData.unit || 'kg',
            currentStock: stock,
            costPerUnit: cost,
            minThreshold: Number(formData.minThreshold),
            supplierId: formData.supplierId,
            purchaseHistory: [{ date: Date.now(), quantity: stock, costPerUnit: cost }]
        };
        setInventory(prev => [...prev, newItem]);
        addAuditLog('CREATE', 'INVENTORY', `Created new item: ${newItem.name}`);
        showToast('کالای جدید با موفقیت اضافه شد.');
    }
    setIsModalOpen(false);
  };

  const handleDeleteItem = (id: string) => {
    showModal('حذف کالا', 'آیا از حذف این کالا از انبار اطمینان دارید؟ این عمل غیرقابل بازگشت است.', () => {
        const itemToDelete = inventory.find(i => i.id === id);
        if(itemToDelete) addAuditLog('DELETE', 'INVENTORY', `Deleted item: ${itemToDelete.name}`);
        setInventory(prev => prev.filter(i => i.id !== id));
        showToast('کالا با موفقیت حذف شد.', 'error');
    });
    setOpenMenuId(null);
  };

  const handleOpenWaste = (item: Ingredient) => {
    setEditingItem(item);
    setWasteAmount(0);
    setWasteReason('');
    setIsWasteModalOpen(true);
    setOpenMenuId(null);
  };

  const handleSaveWaste = () => {
    if (!editingItem || wasteAmount <= 0) return;

    const costLoss = wasteAmount * editingItem.costPerUnit;
    const wasteRecord: WasteRecord = {
        id: crypto.randomUUID(),
        itemId: editingItem.id,
        itemName: editingItem.name,
        itemSource: 'inventory',
        amount: wasteAmount,
        unit: editingItem.unit,
        costLoss: costLoss,
        reason: wasteReason || 'نامشخص',
        date: Date.now()
    };

    setWasteRecords(prev => [wasteRecord, ...prev]);
    
    const newStock = Math.max(0, editingItem.currentStock - wasteAmount);
    const updatedItem = { ...editingItem, currentStock: newStock };
    setInventory(prev => prev.map(i => i.id === editingItem.id ? updatedItem : i));

    addAuditLog('WASTE', 'INVENTORY', `Waste recorded for ${editingItem.name}: ${wasteAmount} ${editingItem.unit}. Loss: ${costLoss.toLocaleString()}`);
    setIsWasteModalOpen(false);
    showToast('ضایعات با موفقیت ثبت شد.');
  };

  const toBase64 = (file: File): Promise<string> => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = error => reject(error);
  });

  const handleImageSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setIsProcessingInvoice(true);
    setInvoiceConfirmationData(null);
    try {
        const base64String = await toBase64(file);
        const mimeType = file.type;
        
        const { invoiceDate, items } = await processInvoiceImage(base64String, mimeType, inventory);
        
        if (items.length === 0) {
            showToast("هیچ آیتمی در فاکتور شناسایی نشد. لطفا از تصویر واضح‌تری استفاده کنید.", 'error');
        } else {
            setInvoiceConfirmationData({ date: invoiceDate, items: items });
        }
    } catch (error) {
        console.error(error);
        showToast("خطا در پردازش تصویر فاکتور.", 'error');
    } finally {
        setIsProcessingInvoice(false);
        if (event.target) event.target.value = "";
    }
  };

  const handleConfirmInvoice = () => {
    if (!invoiceConfirmationData) return;

    let inventoryCopy = [...inventory];
    const invoiceDate = invoiceConfirmationData.date ? new Date(invoiceConfirmationData.date).getTime() : Date.now();
    
    invoiceConfirmationData.items.forEach(item => {
        if (item.isNew) {
            const newIngredient: Ingredient = {
                id: crypto.randomUUID(),
                name: item.name,
                unit: item.unit,
                currentStock: item.quantity,
                costPerUnit: item.costPerUnit,
                minThreshold: 0, 
                purchaseHistory: [{ date: invoiceDate, quantity: item.quantity, costPerUnit: item.costPerUnit }]
            };
            inventoryCopy.push(newIngredient);
        } else {
            inventoryCopy = inventoryCopy.map(invItem => {
                if (invItem.id === item.matchedId) {
                    const currentVal = invItem.currentStock * invItem.costPerUnit;
                    const purchaseVal = item.quantity * item.costPerUnit;
                    const newTotalStock = invItem.currentStock + item.quantity;
                    const newAvgCost = newTotalStock > 0 ? (currentVal + purchaseVal) / newTotalStock : item.costPerUnit;

                    return {
                        ...invItem,
                        currentStock: newTotalStock,
                        costPerUnit: Math.round(newAvgCost),
                        purchaseHistory: [...(invItem.purchaseHistory || []), { date: invoiceDate, quantity: item.quantity, costPerUnit: item.costPerUnit }]
                    };
                }
                return invItem;
            });
        }
    });
    
    setInventory(inventoryCopy);

    const newInvoice: PurchaseInvoice = {
      id: crypto.randomUUID(),
      invoiceDate: invoiceDate,
      totalAmount: invoiceConfirmationData.items.reduce((sum, i) => sum + (i.quantity * i.costPerUnit), 0),
      status: 'unpaid',
      items: invoiceConfirmationData.items.map(i => ({ name: i.name, quantity: i.quantity, unit: i.unit, costPerUnit: i.costPerUnit }))
    };
    setPurchaseInvoices(prev => [newInvoice, ...prev]);

    addAuditLog('INVOICE_ADD', 'INVENTORY', `Added invoice with ${newInvoice.items.length} items. Total: ${newInvoice.totalAmount.toLocaleString()}`);

    setInvoiceConfirmationData(null);
    showToast('فاکتور با موفقیت در انبار ثبت شد.');
  };

  const toggleSelection = (itemId: string) => {
    setSelectedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const toggleSelectAll = () => {
    if (selectedItems.size === filteredInventory.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(filteredInventory.map(item => item.id)));
    }
  };

  const handleBulkDelete = () => {
    showModal(
      `حذف ${selectedItems.size} کالا`,
      'آیا از حذف کالاهای انتخاب شده اطمینان دارید؟ این عمل غیرقابل بازگشت است.',
      () => {
        const itemNames = Array.from(selectedItems).map(id => inventory.find(i => i.id === id)?.name).join(', ');
        addAuditLog('DELETE', 'INVENTORY', `Bulk deleted ${selectedItems.size} items: ${itemNames}`);
        setInventory(prev => prev.filter(item => !selectedItems.has(item.id)));
        setSelectedItems(new Set());
        showToast(`${selectedItems.size} کالا با موفقیت حذف شد.`, 'error');
      }
    );
  };


  return (
    <div className="h-full overflow-y-auto custom-scrollbar p-6 md:p-12 pt-24 pb-32 md:pb-12 md:pt-12 max-w-7xl mx-auto space-y-10 animate-in fade-in duration-700">
      <input type="file" ref={fileInputRef} onChange={handleImageSelect} accept="image/*" style={{ display: 'none' }} />
      <input type="file" ref={cameraInputRef} onChange={handleImageSelect} accept="image/*" capture="environment" style={{ display: 'none' }} />
      
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div>
           <h2 className="text-4xl font-black text-slate-900 tracking-tighter mb-1">Inventory</h2>
           <p className="text-slate-400 font-bold text-sm">
             {totalItems} کالا • ارزش کل: {(totalValue/1000000).toFixed(1)}M تومان
           </p>
        </div>
        
        <div className="flex gap-3 w-full md:w-auto">
             <div className="flex items-center bg-white rounded-full shadow-sm border border-slate-100 p-1.5">
                 <button onClick={() => setViewType('card')} className={`px-4 py-2.5 rounded-full flex items-center gap-2 transition-colors ${viewType === 'card' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}><LayoutGrid className="w-4 h-4" /></button>
                 <button onClick={() => setViewType('table')} className={`px-4 py-2.5 rounded-full flex items-center gap-2 transition-colors ${viewType === 'table' ? 'text-indigo-600 bg-indigo-50' : 'text-slate-500'}`}><List className="w-4 h-4" /></button>
                 <button onClick={() => cameraInputRef.current?.click()} disabled={isProcessingInvoice} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-full flex items-center gap-2 transition-colors disabled:opacity-50 active:scale-95">
                    <Camera className="w-4 h-4" />
                </button>
                <button onClick={() => fileInputRef.current?.click()} disabled={isProcessingInvoice} className="px-4 py-2.5 text-sm font-bold text-slate-600 hover:bg-slate-100 rounded-full flex items-center gap-2 transition-colors disabled:opacity-50 active:scale-95">
                    <FileUp className="w-4 h-4" />
                </button>
                <button onClick={() => handleOpenModal()} title="افزودن دستی" className="w-11 h-11 bg-slate-900 text-white rounded-full flex items-center justify-center hover:scale-110 active:scale-95 transition-transform">
                    <Plus className="w-5 h-5" />
                </button>
            </div>
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

      {/* Search */}
      <div className="relative group">
         <Search className="absolute right-5 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-slate-800 transition-colors" />
         <input 
            type="text" 
            placeholder="جستجوی کالا..."
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            className="w-full bg-white border-none py-5 pr-14 pl-6 rounded-3xl shadow-sm text-sm font-bold text-slate-800 placeholder:text-slate-300 focus:ring-2 focus:ring-indigo-100 transition-all"
         />
      </div>

      {viewType === 'card' ? (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 pb-20">
            {filteredInventory.map((item, index) => {
                const isLow = item.currentStock <= item.minThreshold;
                const isMenuOpen = openMenuId === item.id;

                return (
                    <div 
                        key={item.id} 
                        className="relative bg-white p-4 rounded-[28px] flex flex-col justify-between group hover:shadow-lg hover:shadow-slate-100/50 transition-all duration-300 border border-transparent hover:border-slate-50 cursor-default opacity-0 animate-in-stagger"
                        style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'forwards' }}
                    >
                        <div className="flex items-start justify-between">
                            <div className="flex items-center gap-4">
                                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-lg font-black ${isLow ? 'bg-rose-50 text-rose-500' : 'bg-slate-50 text-slate-400 group-hover:bg-indigo-50 group-hover:text-indigo-600'} transition-colors`}>
                                    {item.name.charAt(0)}
                                </div>
                                <div>
                                    <h3 className="font-bold text-slate-800 text-base mb-1 flex items-center gap-2">
                                    {item.name}
                                    {isLow && <div className="w-2.5 h-2.5 bg-rose-500 rounded-full animate-pulse" title="موجودی کم"></div>}
                                    </h3>
                                    <span className="text-xs font-bold text-slate-400 bg-slate-50 px-2 py-0.5 rounded-md">{item.unit}</span>
                                </div>
                            </div>
                            <div className="relative">
                                <button 
                                    onClick={(e) => { e.stopPropagation(); setOpenMenuId(isMenuOpen ? null : item.id); }}
                                    className={`w-10 h-10 rounded-full flex items-center justify-center transition-colors ${isMenuOpen ? 'bg-slate-900 text-white' : 'hover:bg-slate-100 text-slate-300 hover:text-slate-600'}`}
                                > <MoreHorizontal className="w-5 h-5" /> </button>
                                {isMenuOpen && (
                                <div className="absolute left-0 top-12 w-48 bg-white rounded-2xl shadow-xl border border-slate-100 overflow-hidden z-20 animate-in fade-in zoom-in-95 duration-200">
                                    <button onClick={() => handleOpenModal(item)} className="w-full text-right px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><Edit2 className="w-4 h-4" /> ویرایش</button>
                                    <button onClick={() => handleOpenWaste(item)} className="w-full text-right px-4 py-3 text-sm font-bold text-slate-600 hover:bg-slate-50 flex items-center gap-2"><AlertTriangle className="w-4 h-4" /> ثبت ضایعات</button>
                                    <button onClick={() => handleDeleteItem(item.id)} className="w-full text-right px-4 py-3 text-sm font-bold text-rose-500 hover:bg-rose-50 flex items-center gap-2 border-t border-slate-50"><Trash2 className="w-4 h-4" /> حذف کالا</button>
                                </div>
                                )}
                            </div>
                        </div>
                        <div className="mt-4">
                            <div className="flex justify-between items-end">
                                <span className="text-xs font-bold text-slate-400">موجودی</span>
                                <span className="font-black text-slate-800 text-lg">{item.currentStock}</span>
                            </div>
                            <div className="h-2 w-full bg-slate-100 rounded-full overflow-hidden mt-1">
                                <div className={`h-full rounded-full ${isLow ? 'bg-rose-500' : 'bg-slate-900'}`} style={{ width: `${Math.min(100, (item.minThreshold > 0 ? (item.currentStock / item.minThreshold) * 50 : 100))}%` }}></div>
                            </div>
                        </div>
                    </div>
                )
            })}
        </div>
      ) : (
        <div className="bg-white rounded-3xl overflow-hidden border border-slate-100 shadow-sm pb-20">
            <table className="w-full text-right">
                <thead className="bg-slate-50">
                    <tr>
                        <th className="p-4 w-10 text-center">
                            <input type="checkbox"
                                className="rounded border-slate-300 text-indigo-600 focus:ring-indigo-500"
                                checked={selectedItems.size === filteredInventory.length && filteredInventory.length > 0}
                                onChange={toggleSelectAll}
                            />
                        </th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">نام کالا</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">موجودی</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">واحد</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">قیمت واحد</th>
                        <th className="p-4 text-xs font-bold text-slate-500 uppercase tracking-wider">ارزش کل</th>
                        <th className="p-4"></th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                    {filteredInventory.map(item => {
                        const isSelected = selectedItems.has(item.id);
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
                                <td className={`p-4 font-bold text-sm ${item.currentStock <= item.minThreshold ? 'text-rose-500' : 'text-slate-600'}`}>{item.currentStock}</td>
                                <td className="p-4 text-xs text-slate-500 font-bold">{item.unit}</td>
                                <td className="p-4 text-sm text-slate-600 font-mono">{item.costPerUnit.toLocaleString()}</td>
                                <td className="p-4 text-sm text-slate-600 font-mono font-bold">{(item.currentStock * item.costPerUnit).toLocaleString()}</td>
                                <td className="p-4 text-center">
                                    <button onClick={() => handleOpenModal(item)} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg"><Edit2 className="w-4 h-4" /></button>
                                    <button onClick={() => handleDeleteItem(item.id)} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg"><Trash2 className="w-4 h-4" /></button>
                                </td>
                            </tr>
                        )
                    })}
                </tbody>
            </table>
        </div>
      )}

      {isProcessingInvoice && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white p-8 rounded-3xl flex flex-col items-center gap-4 shadow-2xl">
                <Loader2 className="w-12 h-12 animate-spin text-indigo-600" />
                <h3 className="font-bold text-slate-700">هوش مصنوعی در حال تحلیل فاکتور است...</h3>
                <p className="text-sm text-slate-400">لطفا کمی صبر کنید</p>
            </div>
        </div>
      )}

      {invoiceConfirmationData && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[32px] w-full max-w-2xl shadow-2xl animate-in zoom-in-95 duration-200 flex flex-col max-h-[90vh]">
                <div className="p-6 border-b border-slate-100">
                    <h3 className="text-xl font-black text-slate-800">تایید اطلاعات فاکتور</h3>
                    <p className="text-sm text-slate-400 font-bold mt-1">
                        اطلاعات زیر از تصویر استخراج شد. پس از تایید، به انبار اضافه خواهد شد. 
                        {invoiceConfirmationData.date && ` (تاریخ فاکتور: ${new Date(invoiceConfirmationData.date).toLocaleDateString('fa-IR')})`}
                    </p>
                </div>
                <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar">
                    {invoiceConfirmationData.items.some(i => !i.isNew) && (
                        <div>
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                                <Repeat className="w-5 h-5 text-indigo-500"/> به‌روزرسانی کالاهای موجود
                            </h4>
                            <div className="space-y-2">
                                {invoiceConfirmationData.items.filter(i => !i.isNew).map((item, idx) => {
                                    const currentItem = inventory.find(i => i.id === item.matchedId);
                                    return (
                                        <div key={idx} className="bg-indigo-50 border border-indigo-100 rounded-2xl p-3 grid grid-cols-3 gap-2 text-sm">
                                            <span className="font-bold text-indigo-900">{item.name}</span>
                                            <span className="text-slate-600">موجودی: {currentItem?.currentStock} → <span className="font-bold text-indigo-800">{currentItem?.currentStock! + item.quantity}</span></span>
                                            <span className="text-slate-600">قیمت جدید: {item.costPerUnit.toLocaleString()} ت</span>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    )}
                    {invoiceConfirmationData.items.some(i => i.isNew) && (
                        <div>
                            <h4 className="font-bold text-slate-800 mb-3 flex items-center gap-2">
                               <PackagePlus className="w-5 h-5 text-emerald-500" /> افزودن کالاهای جدید
                            </h4>
                            <div className="space-y-2">
                                {invoiceConfirmationData.items.filter(i => i.isNew).map((item, idx) => (
                                    <div key={idx} className="bg-emerald-50 border border-emerald-100 rounded-2xl p-3 grid grid-cols-3 gap-2 text-sm">
                                        <span className="font-bold text-emerald-900">{item.name}</span>
                                        <span className="text-slate-600">مقدار: <span className="font-bold text-emerald-800">{item.quantity} {item.unit}</span></span>
                                        <span className="text-slate-600">قیمت: {item.costPerUnit.toLocaleString()} ت</span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
                <div className="p-6 border-t border-slate-100 flex gap-4">
                    <button onClick={() => setInvoiceConfirmationData(null)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">انصراف</button>
                    <button onClick={handleConfirmInvoice} className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        تایید و افزودن به انبار
                    </button>
                </div>
            </div>
        </div>
      )}

      {isModalOpen && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl animate-in zoom-in-95 duration-200">
                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h3 className="text-xl font-black text-slate-800">{editingItem ? 'ویرایش کالا' : 'تعریف کالای جدید'}</h3>
                    <button onClick={() => setIsModalOpen(false)} className="w-10 h-10 rounded-full hover:bg-slate-100 flex items-center justify-center text-slate-400">
                        <X className="w-5 h-5" />
                    </button>
                </div>
                <div className="p-6 space-y-4 max-h-[70vh] overflow-y-auto custom-scrollbar">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">نام کالا</label>
                        <input 
                            type="text" 
                            value={formData.name}
                            onChange={e => setFormData({...formData, name: e.target.value})}
                            className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                            placeholder="مثلا: گوشت گوساله"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">واحد شمارش</label>
                            <select 
                                value={formData.unit}
                                onChange={e => setFormData({...formData, unit: e.target.value})}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                            >
                                <option value="kg">کیلوگرم</option>
                                <option value="gram">گرم</option>
                                <option value="liter">لیتر</option>
                                <option value="ml">میلی‌لیتر</option>
                                <option value="number">عدد</option>
                                <option value="pack">بسته</option>
                                <option value="can">قوطی</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">موجودی فعلی</label>
                            <input 
                                type="number" 
                                value={formData.currentStock}
                                onChange={e => setFormData({...formData, currentStock: Number(e.target.value)})}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                         <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">قیمت خرید (واحد)</label>
                            <input 
                                type="number" 
                                value={formData.costPerUnit}
                                onChange={e => setFormData({...formData, costPerUnit: Number(e.target.value)})}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-bold text-slate-700 mb-2">حداقل موجودی (هشدار)</label>
                            <input 
                                type="number" 
                                value={formData.minThreshold}
                                onChange={e => setFormData({...formData, minThreshold: Number(e.target.value)})}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">تامین کننده پیش‌فرض</label>
                        <select 
                             value={formData.supplierId}
                             onChange={e => setFormData({...formData, supplierId: e.target.value})}
                             className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-indigo-100 cursor-pointer"
                        >
                            <option value="">انتخاب کنید...</option>
                            {suppliers.map(s => (
                                <option key={s.id} value={s.id}>{s.name} ({s.category})</option>
                            ))}
                        </select>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex gap-4">
                    <button onClick={() => setIsModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">انصراف</button>
                    <button onClick={handleSaveItem} className="flex-1 py-4 bg-slate-900 text-white font-bold rounded-2xl hover:bg-slate-800 shadow-lg shadow-slate-200 transition-all flex items-center justify-center gap-2">
                        {editingItem ? 'ذخیره تغییرات' : 'افزودن کالا'}
                    </button>
                </div>
            </div>
        </div>
      )}

      {isWasteModalOpen && editingItem && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center z-50 p-4">
             <div className="bg-white rounded-[32px] w-full max-w-md shadow-2xl animate-in zoom-in-95 duration-200 border-t-8 border-rose-500">
                <div className="p-6 bg-rose-50">
                    <h3 className="text-xl font-black text-rose-900 flex items-center gap-2">
                        <Trash2 className="w-6 h-6" />
                        ثبت ضایعات
                    </h3>
                    <p className="text-rose-600 text-sm mt-1">ثبت دورریز برای کالای: <span className="font-bold">{editingItem.name}</span></p>
                </div>
                <div className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-2">مقدار ضایعات ({editingItem.unit})</label>
                        <div className="flex items-center gap-2">
                            <input 
                                type="number" 
                                value={wasteAmount}
                                onChange={e => setWasteAmount(Number(e.target.value))}
                                className="w-full bg-slate-50 border-none rounded-2xl p-4 font-bold text-slate-800 outline-none focus:ring-2 focus:ring-rose-200"
                                placeholder="0"
                            />
                        </div>
                        <p className="text-xs text-rose-400 mt-2 font-bold">ارزش مالی از دست رفته: {(wasteAmount * editingItem.costPerUnit).toLocaleString()} تومان</p>
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
                            <option value="تاریخ انقضا">تاریخ انقضا</option>
                            <option value="آسیب فیزیکی">آسیب فیزیکی</option>
                            <option value="اشتباه پرسنل">اشتباه پرسنل</option>
                            <option value="سایر">سایر</option>
                        </select>
                    </div>
                </div>
                <div className="p-6 border-t border-slate-100 flex gap-4">
                    <button onClick={() => setIsWasteModalOpen(false)} className="flex-1 py-4 text-slate-500 font-bold hover:bg-slate-50 rounded-2xl transition-colors">انصراف</button>
                    <button onClick={handleSaveWaste} className="flex-1 py-4 bg-rose-600 text-white font-bold rounded-2xl hover:bg-rose-700 shadow-lg shadow-rose-200 transition-all flex items-center justify-center gap-2">
                        ثبت نهایی
                    </button>
                </div>
             </div>
        </div>
      )}

    </div>
  );
};