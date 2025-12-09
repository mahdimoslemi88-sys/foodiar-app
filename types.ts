

export interface PurchaseHistory {
  date: number;
  quantity: number;
  costPerUnit: number;
}

export interface Ingredient {
  id: string;
  name: string;
  unit: string; // e.g., kg, gram, liter, number
  currentStock: number;
  costPerUnit: number; // NOW represents the WEIGHED AVERAGE COST
  minThreshold: number; // Low stock alert level
  supplierId?: string; // Link to specific supplier
  purchaseHistory: PurchaseHistory[]; // For calculating weighed average cost
}

export interface Supplier {
  id: string;
  name: string;
  category: string; // e.g. Butcher, Grocery
  phoneNumber: string;
}

export type Unit = 'kg' | 'gram' | 'liter' | 'ml' | 'cc' | 'number' | 'pack' | 'can' | 'portion';

export const getConversionFactor = (fromUnit: string, toUnit: string): number => {
    if (fromUnit === toUnit) return 1;
    const conversions: Record<string, Record<string, number>> = {
      'kg': { 'gram': 1000 },
      'gram': { 'kg': 0.001 },
      'liter': { 'ml': 1000, 'cc': 1000 },
      'ml': { 'liter': 0.001 },
      'cc': { 'liter': 0.001 },
    };
    return conversions[fromUnit]?.[toUnit] || 1; // Default to 1 if no conversion found
};


export interface RecipeIngredient {
  ingredientId: string;
  amount: number;
  unit: string; 
  source?: 'inventory' | 'prep';
}

export interface MenuItem {
  id: string;
  name: string;
  category: string;
  price: number; // Selling price
  recipe: RecipeIngredient[];
  imageUrl?: string;
}

export interface SaleItem {
  menuItemId: string;
  quantity: number;
  priceAtSale: number;
  costAtSale: number; // Calculated COGS at moment of sale
}

export type PaymentMethod = 'cash' | 'card' | 'online' | 'void';

export interface Sale {
  id: string;
  timestamp: number;
  items: SaleItem[];
  totalAmount: number;
  totalCost: number; // Total COGS
  tax?: number;      
  discount?: number; 
  paymentMethod?: PaymentMethod; 
  shiftId?: string;
  tableNumber?: string;
  status?: 'pending' | 'preparing' | 'ready' | 'delivered';
}

export interface Expense {
  id: string;
  title: string;
  amount: number;
  category: 'rent' | 'salary' | 'utilities' | 'marketing' | 'maintenance' | 'other';
  date: number;
  description?: string;
}

export interface WasteRecord {
  id: string;
  itemId: string; // Can be ingredientId or prepTaskId
  itemName: string;
  itemSource: 'inventory' | 'prep';
  amount: number;
  unit: string;
  costLoss: number;
  reason: string;
  date: number;
}

export interface Shift {
  id: string;
  startTime: number;
  endTime?: number;
  startingCash: number;
  expectedCashSales?: number;
  actualCashSales?: number;
  cardSales?: number;
  onlineSales?: number;
  bankDeposit?: number;
  discrepancy?: number;
  status: 'open' | 'closed';
  operatorName?: string;
}

export interface AIReport {
  type: 'financial' | 'inventory' | 'waste' | 'recipe';
  content: string;
  timestamp: number;
}

export interface GeneratedRecipe {
  name: string;
  description: string;
  category: string;
  suggestedPrice: number;
  ingredients: {
    ingredientId: string;
    amount: number;
    unit: string;
    name: string;
  }[];
  reasoning: string;
}

export interface PrepTask {
  id: string;
  item: string;
  station: string;
  parLevel: number;
  onHand: number;
  unit: string;
  recipe?: RecipeIngredient[];
  batchSize?: number;
  costPerUnit?: number;
}

export interface PurchaseInvoice {
  id: string;
  supplierId?: string;
  invoiceNumber?: string;
  invoiceDate: number;
  totalAmount: number;
  status: 'paid' | 'unpaid';
  items: {
    name: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
  }[];
}

export interface ProcessedInvoiceItem {
    name: string;
    quantity: number;
    unit: string;
    costPerUnit: number;
    isNew: boolean;
    matchedId?: string;
}


export interface AuditLog {
  id: string;
  timestamp: number;
  userId: string;
  userName: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'WASTE' | 'SHIFT_CLOSE' | 'INVOICE_ADD';
  entity: 'MENU' | 'INVENTORY' | 'EXPENSE' | 'SHIFT' | 'USER' | 'INVOICE' | 'PREP';
  details: string;
}

// For AI-driven Menu Engineering
export interface MenuAnalysisItem {
  name: string;
  category: 'star' | 'puzzle' | 'plowhorse' | 'dog' | 'other'; // BCG Matrix categories
  suggestion: string;
  reasoning: string;
}
export interface MenuAnalysisResult {
  analysisDate: number;
  items: MenuAnalysisItem[];
  summary: string;
}

// For AI-driven Procurement
export interface ForecastItem {
  itemName: string;
  itemId: string;
  quantityToOrder: number;
  currentStock: number;
  unit: string;
}
export interface ProcurementForecast {
  forecastDate: number;
  orders: {
    supplierId: string;
    supplierName: string;
    items: ForecastItem[];
  }[];
  noSupplierItems: ForecastItem[];
}

// For AI-driven Operations
export interface PrepPriorityItem {
  prepTaskId: string;
  prepTaskName: string;
  quantityToPrep: number;
  priority: 'high' | 'medium' | 'low';
  reasoning: string;
}
export interface OperationalForecast {
  forecastDate: number;
  tasks: PrepPriorityItem[];
  summary: string;
}

export type UserRole = 'manager' | 'cashier' | 'chef';

export type View = 'dashboard' | 'inventory' | 'menu' | 'pos' | 'ai-assistant' | 'reports' | 'procurement' | 'kitchen-prep' | 'users' | 'profile';

export interface User {
  id: string;
  username: string;
  pin: string;
  name: string;
  role: UserRole;
  avatar?: string;
}