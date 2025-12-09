import { Ingredient, MenuItem, Sale, Expense, Supplier, WasteRecord, Shift, PrepTask, PurchaseInvoice, AuditLog } from '../types';

const now = Date.now();

export const inventory: Ingredient[] = [
  { id: 'ing1', name: 'گوشت چرخ کرده گوساله', unit: 'kg', currentStock: 25, costPerUnit: 450000, minThreshold: 10, supplierId: 'sup1', purchaseHistory: [{ date: now, quantity: 25, costPerUnit: 450000 }] },
  { id: 'ing2', name: 'نان همبرگر', unit: 'number', currentStock: 100, costPerUnit: 8000, minThreshold: 40, purchaseHistory: [{ date: now, quantity: 100, costPerUnit: 8000 }] },
  { id: 'ing3', name: 'پنیر ورقه‌ای گودا', unit: 'pack', currentStock: 30, costPerUnit: 60000, minThreshold: 10, purchaseHistory: [{ date: now, quantity: 30, costPerUnit: 60000 }] },
  { id: 'ing4', name: 'گوجه فرنگی', unit: 'kg', currentStock: 15, costPerUnit: 25000, minThreshold: 5, supplierId: 'sup2', purchaseHistory: [{ date: now, quantity: 15, costPerUnit: 25000 }] },
  { id: 'ing5', name: 'سیب زمینی', unit: 'kg', currentStock: 50, costPerUnit: 18000, minThreshold: 20, supplierId: 'sup2', purchaseHistory: [{ date: now, quantity: 50, costPerUnit: 18000 }] },
  { id: 'ing6', name: 'دانه قهوه اسپرسو', unit: 'kg', currentStock: 5, costPerUnit: 900000, minThreshold: 2, purchaseHistory: [{ date: now, quantity: 5, costPerUnit: 900000 }] },
  { id: 'ing7', name: 'شیر', unit: 'liter', currentStock: 10, costPerUnit: 28000, minThreshold: 5, purchaseHistory: [{ date: now, quantity: 10, costPerUnit: 28000 }] },
];

export const menu: MenuItem[] = [
  { id: 'menu1', name: 'همبرگر کلاسیک', category: 'غذا', price: 180000, recipe: [
    { ingredientId: 'ing1', amount: 150, unit: 'gram', source: 'inventory' },
    { ingredientId: 'ing2', amount: 1, unit: 'number', source: 'inventory' },
    { ingredientId: 'ing3', amount: 20, unit: 'gram', source: 'inventory' },
    { ingredientId: 'ing4', amount: 30, unit: 'gram', source: 'inventory' },
  ]},
  { id: 'menu2', name: 'سیب زمینی سرخ کرده', category: 'پیش‌غذا', price: 75000, recipe: [
    { ingredientId: 'ing5', amount: 300, unit: 'gram', source: 'inventory' },
  ]},
  { id: 'menu3', name: 'لاته', category: 'نوشیدنی', price: 85000, recipe: [
    { ingredientId: 'ing6', amount: 18, unit: 'gram', source: 'inventory' },
    { ingredientId: 'ing7', amount: 200, unit: 'ml', source: 'inventory' },
  ]},
];

export const sales: Sale[] = [
  { id: 'sale1', timestamp: Date.now() - 86400000, items: [{ menuItemId: 'menu1', quantity: 2, priceAtSale: 180000, costAtSale: 90000 }], totalAmount: 360000, totalCost: 180000, paymentMethod: 'card' },
  { id: 'sale2', timestamp: Date.now() - 43200000, items: [{ menuItemId: 'menu1', quantity: 1, priceAtSale: 180000, costAtSale: 90000 }, { menuItemId: 'menu2', quantity: 1, priceAtSale: 75000, costAtSale: 6000 }], totalAmount: 255000, totalCost: 96000, paymentMethod: 'cash' },
];

export const expenses: Expense[] = [
  { id: 'exp1', title: 'اجاره ماهانه', amount: 20000000, category: 'rent', date: Date.now() - 604800000 },
  { id: 'exp2', title: 'حقوق پرسنل', amount: 15000000, category: 'salary', date: Date.now() - 86400000 },
];

export const suppliers: Supplier[] = [
    { id: 'sup1', name: 'قصابی مرکزی', category: 'گوشت', phoneNumber: '09123456789' },
    { id: 'sup2', name: 'میدان تره بار', category: 'سبزیجات', phoneNumber: '09129876543' },
];

export const waste: WasteRecord[] = [
    // FIX: Replaced 'ingredientId' and 'ingredientName' with 'itemId', 'itemName', and added 'itemSource' to match the WasteRecord type.
    { id: 'waste1', itemId: 'ing4', itemName: 'گوجه فرنگی', itemSource: 'inventory', amount: 1, unit: 'kg', costLoss: 25000, reason: 'خرابی', date: Date.now() - 172800000 }
];

export const shifts: Shift[] = [
    { id: 'shift1', startTime: Date.now() - 86400000, endTime: Date.now() - 57600000, startingCash: 500000, actualCashSales: 1250000, expectedCashSales: 1255000, cardSales: 3400000, onlineSales: 850000, bankDeposit: 1200000, discrepancy: -5000, status: 'closed' }
];

export const prepTasks: PrepTask[] = [
    { id: 'prep1', item: 'پیاز کاراملی', station: 'گریل', parLevel: 2, onHand: 1.5, unit: 'kg' },
    { id: 'prep2', item: 'سس مخصوص', station: 'سرد', parLevel: 5, onHand: 4, unit: 'liter', recipe: [{ ingredientId: 'ing4', amount: 100, unit: 'gram' }], batchSize: 1, costPerUnit: 50000 }
];

export const purchaseInvoices: PurchaseInvoice[] = [];

export const auditLogs: AuditLog[] = [];