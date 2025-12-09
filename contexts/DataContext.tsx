import { create } from 'zustand';
import { supabase } from '../services/supabaseClient';
import {
  Ingredient, MenuItem, Sale, Expense, Supplier, WasteRecord, Shift, PrepTask,
  PurchaseInvoice, AuditLog, MenuAnalysisResult, ProcurementForecast, OperationalForecast,
} from '../types';
import * as gemini from '../services/geminiService';

type StateUpdater<T> = T | ((prev: T) => T);

interface DataState {
  inventory: Ingredient[];
  menu: MenuItem[];
  sales: Sale[];
  expenses: Expense[];
  suppliers: Supplier[];
  wasteRecords: WasteRecord[];
  shifts: Shift[];
  prepTasks: PrepTask[];
  purchaseInvoices: PurchaseInvoice[];
  auditLogs: AuditLog[];
  isLoading: boolean;
  
  initializeApp: () => Promise<void>;
  
  // CRUD Actions
  addIngredient: (item: Partial<Ingredient>) => Promise<void>;
  updateIngredient: (item: Partial<Ingredient>) => Promise<void>;
  deleteIngredient: (id: string) => Promise<void>;
  
  addMenuItem: (item: Partial<MenuItem>) => Promise<void>;
  updateMenuItem: (item: Partial<MenuItem>) => Promise<void>;
  deleteMenuItem: (id: string) => Promise<void>;

  addSale: (item: Partial<Sale>) => Promise<void>;

  addExpense: (item: Partial<Expense>) => Promise<void>;
  deleteExpense: (id: string) => Promise<void>;

  addSupplier: (item: Partial<Supplier>) => Promise<void>;
  deleteSupplier: (id: string) => Promise<void>;
  
  addWasteRecord: (item: Partial<WasteRecord>) => Promise<void>;

  addShift: (item: Partial<Shift>) => Promise<void>;
  updateShift: (item: Partial<Shift>) => Promise<void>;

  addPrepTask: (item: Partial<PrepTask>) => Promise<void>;
  updatePrepTask: (item: Partial<PrepTask>) => Promise<void>;
  
  addPurchaseInvoice: (item: Partial<PurchaseInvoice>) => Promise<void>;
  updatePurchaseInvoice: (item: Partial<PurchaseInvoice>) => Promise<void>;

  addAuditLog: (action: AuditLog['action'], entity: AuditLog['entity'], details: string) => Promise<void>;

  // Generic Setters for complex local updates
  setInventory: (updater: StateUpdater<Ingredient[]>) => void;
  setPrepTasks: (updater: StateUpdater<PrepTask[]>) => void;

  // AI State
  menuAnalysis: MenuAnalysisResult | null;
  procurementForecast: ProcurementForecast | null;
  operationalForecast: OperationalForecast | null;
  generateMenuAnalysis: () => Promise<void>;
  generateProcurementForecast: () => Promise<void>;
  generateOperationalForecast: () => Promise<void>;
  clearMenuAnalysis: () => void;
}

// Helper to handle both value and function updaters
const createSetter = <T,>(set: Function, key: keyof DataState) => (updater: StateUpdater<T>) => {
  set((state: DataState) => ({
    [key]: typeof updater === 'function' ? (updater as (prev: T) => T)((state as any)[key]) : updater,
  }));
};

export const useDataStore = create<DataState>((set, get) => ({
  // --- STATE ---
  inventory: [], menu: [], sales: [], expenses: [], suppliers: [],
  wasteRecords: [], shifts: [], prepTasks: [], purchaseInvoices: [],
  auditLogs: [], isLoading: true,
  
  menuAnalysis: null, procurementForecast: null, operationalForecast: null,

  // --- ACTIONS ---
  initializeApp: async () => {
    set({ isLoading: true });
    try {
      const results = await Promise.all([
        supabase.from('ingredients').select('*'),
        supabase.from('menu_items').select('*'),
        supabase.from('sales').select('*').order('timestamp', { ascending: false }).limit(100),
        supabase.from('expenses').select('*'),
        supabase.from('suppliers').select('*'),
        supabase.from('waste_records').select('*'),
        supabase.from('shifts').select('*'),
        supabase.from('prep_tasks').select('*'),
        supabase.from('purchase_invoices').select('*'),
        supabase.from('audit_logs').select('*'),
      ]);

      const [
        { data: inventory }, { data: menu }, { data: sales }, { data: expenses },
        { data: suppliers }, { data: wasteRecords }, { data: shifts },
        { data: prepTasks }, { data: purchaseInvoices }, { data: auditLogs },
      ] = results;

      // Check for errors
      results.forEach(res => { if (res.error) throw res.error; });

      set({
        inventory: inventory as Ingredient[] || [],
        menu: menu as MenuItem[] || [],
        sales: sales as Sale[] || [],
        expenses: expenses as Expense[] || [],
        suppliers: suppliers as Supplier[] || [],
        wasteRecords: wasteRecords as WasteRecord[] || [],
        shifts: shifts as Shift[] || [],
        prepTasks: prepTasks as PrepTask[] || [],
        purchaseInvoices: purchaseInvoices as PurchaseInvoice[] || [],
        auditLogs: auditLogs as AuditLog[] || [],
        isLoading: false,
      });
    } catch (error) {
      console.error("Error initializing app data:", error);
      set({ isLoading: false });
    }
  },

  // --- CRUD Actions ---
  addIngredient: async (item) => {
    const { data, error } = await supabase.from('ingredients').insert(item).select().single();
    if (error) throw error;
    set(state => ({ inventory: [...state.inventory, data as Ingredient] }));
  },
  updateIngredient: async (item) => {
    const { data, error } = await supabase.from('ingredients').update(item).eq('id', item.id!).select().single();
    if (error) throw error;
    set(state => ({ inventory: state.inventory.map(i => i.id === data.id ? data as Ingredient : i) }));
  },
  deleteIngredient: async (id) => {
    const { error } = await supabase.from('ingredients').delete().eq('id', id);
    if (error) throw error;
    set(state => ({ inventory: state.inventory.filter(i => i.id !== id) }));
  },

  addMenuItem: async (item) => {
    const { data, error } = await supabase.from('menu_items').insert(item).select().single();
    if (error) throw error;
    set(state => ({ menu: [...state.menu, data as MenuItem] }));
  },
  updateMenuItem: async (item) => {
    const { data, error } = await supabase.from('menu_items').update(item).eq('id', item.id!).select().single();
    if (error) throw error;
    set(state => ({ menu: state.menu.map(i => i.id === data.id ? data as MenuItem : i) }));
  },
  deleteMenuItem: async (id) => {
    const { error } = await supabase.from('menu_items').delete().eq('id', id);
    if (error) throw error;
    set(state => ({ menu: state.menu.filter(i => i.id !== id) }));
  },

  addSale: async (item) => {
    const { data, error } = await supabase.from('sales').insert(item).select().single();
    if (error) throw error;
    set(state => ({ sales: [data as Sale, ...state.sales] }));
  },
  
  addExpense: async (item) => {
    const { data, error } = await supabase.from('expenses').insert(item).select().single();
    if (error) throw error;
    set(state => ({ expenses: [data as Expense, ...state.expenses] }));
  },
  deleteExpense: async (id) => {
    const { error } = await supabase.from('expenses').delete().eq('id', id);
    if (error) throw error;
    set(state => ({ expenses: state.expenses.filter(i => i.id !== id) }));
  },

  addSupplier: async (item) => {
    const { data, error } = await supabase.from('suppliers').insert(item).select().single();
    if (error) throw error;
    set(state => ({ suppliers: [...state.suppliers, data as Supplier] }));
  },
  deleteSupplier: async (id) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
    set(state => ({ suppliers: state.suppliers.filter(i => i.id !== id) }));
  },

  addWasteRecord: async (item) => {
    const { data, error } = await supabase.from('waste_records').insert(item).select().single();
    if (error) throw error;
    set(state => ({ wasteRecords: [data as WasteRecord, ...state.wasteRecords] }));
  },

  addShift: async (item) => {
    const { data, error } = await supabase.from('shifts').insert(item).select().single();
    if (error) throw error;
    set(state => ({ shifts: [data as Shift, ...state.shifts] }));
  },
  updateShift: async (item) => {
    const { data, error } = await supabase.from('shifts').update(item).eq('id', item.id!).select().single();
    if (error) throw error;
    set(state => ({ shifts: state.shifts.map(i => i.id === data.id ? data as Shift : i) }));
  },
  
  addPrepTask: async (item) => {
    const { data, error } = await supabase.from('prep_tasks').insert(item).select().single();
    if (error) throw error;
    set(state => ({ prepTasks: [...state.prepTasks, data as PrepTask] }));
  },
  updatePrepTask: async (item) => {
    const { data, error } = await supabase.from('prep_tasks').update(item).eq('id', item.id!).select().single();
    if (error) throw error;
    set(state => ({ prepTasks: state.prepTasks.map(i => i.id === data.id ? data as PrepTask : i) }));
  },

  addPurchaseInvoice: async (item) => {
    const { data, error } = await supabase.from('purchase_invoices').insert(item).select().single();
    if (error) throw error;
    set(state => ({ purchaseInvoices: [data as PurchaseInvoice, ...state.purchaseInvoices] }));
  },
  updatePurchaseInvoice: async (item) => {
    const { data, error } = await supabase.from('purchase_invoices').update(item).eq('id', item.id!).select().single();
    if (error) throw error;
    set(state => ({ purchaseInvoices: state.purchaseInvoices.map(i => i.id === data.id ? data as PurchaseInvoice : i) }));
  },

  addAuditLog: async (action, entity, details) => {
    // In a real app, user info would come from the auth context
    const logEntry = {
        timestamp: Date.now(),
        user_id: 'user_placeholder_id',
        user_name: 'User Placeholder',
        action,
        entity,
        details,
    };
    const { data, error } = await supabase.from('audit_logs').insert(logEntry).select().single();
    if (error) { console.error("Error logging audit:", error); return; }
    set(state => ({ auditLogs: [data as AuditLog, ...state.auditLogs] }));
  },
  
  // Generic setters for local UI updates
  setInventory: createSetter(set, 'inventory'),
  setPrepTasks: createSetter(set, 'prepTasks'),


  // --- AI ACTIONS (no change) ---
  generateMenuAnalysis: async () => { /* ... */ },
  clearMenuAnalysis: () => set({ menuAnalysis: null }),
  generateProcurementForecast: async () => { /* ... */ },
  generateOperationalForecast: async () => { /* ... */ },
}));
