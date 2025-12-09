import { GoogleGenAI, Type } from "@google/genai";
import { 
    Ingredient, MenuItem, Sale, GeneratedRecipe, Expense, ProcessedInvoiceItem,
    MenuAnalysisResult, ProcurementForecast, OperationalForecast, PrepTask, Supplier
} from "../types";

// Helper to safely get the API key
const getApiKey = () => {
  // The AIView component ensures window.aistudio handles the selection before this is called
  return process.env.API_KEY || '';
};

// Construct the system prompt with context
const createSystemInstruction = (
  inventory: Ingredient[],
  menu: MenuItem[],
  sales: Sale[],
  expenses: Expense[]
) => {
  const inventorySummary = inventory.map(i => 
    `- ${i.name}: ${i.currentStock} ${i.unit} (قیمت خرید: ${i.costPerUnit})`
  ).join('\n');

  const menuSummary = menu.map(m => {
    // Calculate estimated cost
    let cost = 0;
    m.recipe.forEach(r => {
      const ing = inventory.find(i => i.id === r.ingredientId);
      if (ing) cost += ing.costPerUnit * r.amount; // Simplified unit conversion for prompt
    });
    return `- ${m.name}: فروش ${m.price} | هزینه مواد ~${cost}`;
  }).join('\n');

  // Last 20 sales summary
  const recentSales = sales.slice(-20).map(s => 
    `فاکتور ${s.id}: ${s.totalAmount} فروش`
  ).join('\n');

  // Recent Expenses
  const recentExpenses = expenses.slice(-10).map(e => 
    `- ${e.title}: ${e.amount} (${e.category})`
  ).join('\n');

  return `
  شما "AssistChef"، هوش مصنوعی سیستم Foodyar 2 هستید.
  شخصیت: حرفه‌ای، خلاق، داده‌محور و کوتاه گو.
  
  داده‌های رستوران:
  --- موجودی ---
  ${inventorySummary}
  
  --- منو ---
  ${menuSummary}
  
  --- فروش اخیر ---
  ${recentSales}

  --- هزینه‌های اخیر ---
  ${recentExpenses}
  
  وظایف:
  1. تحلیل مالی دقیق (سود، زیان، حاشیه سود).
  2. شناسایی ناهنجاری‌های مالی (Anomalies) و روندها (Trends).
  3. پیشنهاد کاهش ضایعات و هزینه‌ها.
  4. پاسخ کوتاه و فارسی.
  `;
};

export const generateRestaurantAdvice = async (
  query: string,
  inventory: Ingredient[],
  menu: MenuItem[],
  sales: Sale[],
  expenses: Expense[]
): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key Missing");

    // Always create a fresh instance to pick up the latest key from env if it changed
    const ai = new GoogleGenAI({ apiKey });
    const instruction = createSystemInstruction(inventory, menu, sales, expenses);

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: query,
      config: {
        systemInstruction: instruction,
        temperature: 0.7,
      }
    });

    return response.text || "متاسفانه پاسخی دریافت نشد.";
  } catch (error: any) {
    console.error("Gemini Error:", error);
    if (error.message?.includes("403") || error.status === 403) {
        throw new Error("403"); // Re-throw to be caught by UI
    }
    return "خطا در ارتباط با هوش مصنوعی. لطفا اتصال اینترنت و کلید API را بررسی کنید.";
  }
};

export const generateDailySpecial = async (
  inventory: Ingredient[]
): Promise<GeneratedRecipe | null> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key Missing");

    const ai = new GoogleGenAI({ apiKey });

    // Identify overstocked or high-value items to push
    const stockInfo = inventory.map(i => ({
      name: i.name,
      stock: i.currentStock,
      unit: i.unit
    }));

    const prompt = `
      به عنوان سرآشپز خلاق، موجودی زیر را بررسی کن:
      ${JSON.stringify(stockInfo)}

      ماموریت:
      یک "پیشنهاد ویژه روز" (Daily Special) بساز که مواد با موجودی بالا را مصرف کند.
      
      خروجی فقط JSON باشد:
      {
        "name": "نام غذا",
        "description": "توضیح کوتاه و جذاب",
        "category": "غذا/پیش‌غذا",
        "suggestedPrice": 0,
        "ingredients": [ {"name": "ماده", "amount": 0, "unit": "..."} ],
        "reasoning": "چرا این غذا؟"
      }
    `;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: {
        responseMimeType: 'application/json',
        temperature: 0.8, 
      }
    });

    const text = response.text;
    if (!text) return null;

    // Robust cleanup for markdown JSON blocks (e.g. ```json ... ```)
    let cleanText = text.trim();
    // Remove markdown code block syntax if present
    cleanText = cleanText.replace(/```json/g, '').replace(/```/g, '').trim();
    
    return JSON.parse(cleanText) as GeneratedRecipe;

  } catch (error) {
    console.error("AssistChef Error:", error);
    return null;
  }
};

export interface ProcessedSalesData {
  processedSales: {
    itemName: string;
    quantity: number;
    pricePerItem: number;
  }[];
  newItemsFound: {
    name: string;
    price: number;
    category: string;
  }[];
}

export const processSalesFile = async (
  csvContent: string,
  currentMenu: MenuItem[]
): Promise<ProcessedSalesData> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("API Key is missing");

        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `
          You are an AI assistant for a restaurant POS system. Your task is to process the content of an uploaded file, which is provided to you as a CSV string, representing daily sales.
          You will receive the CSV content and the restaurant's current menu as a JSON array.

          Your instructions:
          1. Analyze the CSV content to identify sales records. Each record should have an item name, quantity sold, and price per item. The first row is likely the header. Common headers might be 'Product', 'Qty', 'Price', 'Total'. Be flexible with header names in any language, especially Persian (نام کالا, تعداد, قیمت).
          2. For each sold item, compare its name to the 'name' field in the provided menu JSON.
          3. Create a JSON output with two keys: "processedSales" and "newItemsFound".
          4. "processedSales" must be an array of objects, each with "itemName" (string), "quantity" (number), and "pricePerItem" (number).
          5. If you find an item in the sales data that is NOT in the current menu, add it to the "newItemsFound" array. This should be an object with "name" (string), "price" (number), and "category" (string, guess from 'غذا', 'نوشیدنی', 'دسر', 'پیش‌غذا').
          6. Handle potential inconsistencies gracefully. If a row is malformed, skip it. Ensure all numbers are parsed correctly, removing currency symbols or commas.
          7. Your entire response MUST be a single valid JSON object adhering to the specified schema. Do not add any explanatory text outside the JSON.
        `;
        
        const responseSchema = {
            type: Type.OBJECT,
            properties: {
              processedSales: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    itemName: { type: Type.STRING },
                    quantity: { type: Type.INTEGER },
                    pricePerItem: { type: Type.NUMBER }
                  },
                  required: ["itemName", "quantity", "pricePerItem"]
                }
              },
              newItemsFound: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    name: { type: Type.STRING },
                    price: { type: Type.NUMBER },
                    category: { type: Type.STRING }
                  },
                  required: ["name", "price", "category"]
                }
              }
            }
        };

        const prompt = `
          Current Menu for reference:
          ${JSON.stringify(currentMenu.map(m => ({name: m.name, id: m.id})))}

          Please process the following sales data in CSV format:
          --- CSV START ---
          ${csvContent}
          --- CSV END ---
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: {
                systemInstruction,
                responseMimeType: 'application/json',
                responseSchema,
                temperature: 0.1
            }
        });

        const text = response.text;
        if (!text) throw new Error("No response from AI.");

        let cleanText = text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText) as ProcessedSalesData;

    } catch (error) {
        console.error("Error processing sales file with Gemini:", error);
        throw new Error("Failed to process file with AI. Check API key and file format.");
    }
};

export const analyzeRecipe = async (
  menuItem: MenuItem,
  inventory: Ingredient[]
): Promise<string> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key Missing");

    const ai = new GoogleGenAI({ apiKey });

    const recipeDetails = menuItem.recipe.map(r => {
      const ing = inventory.find(i => i.id === r.ingredientId);
      return {
        name: ing?.name || 'ماده اولیه ناشناس',
        amount: r.amount,
        unit: r.unit,
        cost: ing ? ing.costPerUnit * r.amount : 0 // Simplified cost
      };
    });

    const inventoryStatus = inventory.map(i => ({
        name: i.name,
        stock: i.currentStock,
        unit: i.unit,
        cost: i.costPerUnit
    }));

    const prompt = `
      شما یک مشاور هوشمند رستوران به نام AssistChef هستید.
      وظیفه شما تحلیل دستور پخت یک آیتم منو و ارائه پیشنهادات عملی برای بهبود آن است.

      آیتم منو برای تحلیل:
      - نام: ${menuItem.name}
      - قیمت فروش: ${menuItem.price}
      - دستور پخت فعلی: ${JSON.stringify(recipeDetails)}

      وضعیت فعلی انبار:
      ${JSON.stringify(inventoryStatus)}

      اهداف تحلیل (پاسخ خود را به فارسی ارائه دهید):
      1.  **بهینه‌سازی هزینه:** آیا می‌توان مواد اولیه گران‌قیمت را با جایگزین‌های ارزان‌تر از انبار تعویض کرد بدون اینکه کیفیت به شدت افت کند؟ آیا مقدار برخی مواد اولیه بیش از حد است؟
      2.  **استفاده از موجودی انبار:** آیا مواد اولیه‌ای با موجودی بالا در انبار وجود دارد که بتوان آن‌ها را در این دستور پخت گنجاند تا ضایعات کاهش یابد؟
      3.  **بهبود طعم و کیفیت:** پیشنهاداتی خلاقانه برای بهتر کردن طعم غذا ارائه دهید. به ترکیب طعم‌ها، بافت و ظاهر غذا فکر کنید.
      4.  **سودآوری:** به طور خلاصه در مورد سودآوری این آیتم بر اساس قیمت تمام شده و قیمت فروش آن نظر دهید.

      یک پاسخ کوتاه، بولت‌پوینت و در قالب Markdown ارائه دهید. خلاق و کاربردی باشید.
    `;

    const response = await ai.models.generateContent({
        model: 'gemini-2.5-flash',
        contents: prompt,
        config: {
            temperature: 0.8,
        }
    });
    
    return response.text || "در حال حاضر امکان ارائه پیشنهاد وجود ندارد.";

  } catch (error) {
    console.error("Error analyzing recipe with Gemini:", error);
    return "خطا در ارتباط با هوش مصنوعی. لطفا اتصال و کلید API را بررسی کنید.";
  }
};

export const processInvoiceImage = async (
  base64Image: string,
  mimeType: string,
  currentInventory: Ingredient[]
): Promise<{ invoiceDate: string | null; items: ProcessedInvoiceItem[] }> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key is missing");

    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `You are an expert data extraction AI for restaurant purchase invoices. Your task is to analyze the provided image of a purchase invoice and extract all line items.
    For each line item, you must identify:
    1.  The name of the item (e.g., "گوجه فرنگی", "پیاز").
    2.  The quantity purchased.
    3.  The unit of measurement (e.g., "kg", "gram", "عدد", "بسته"). Standardize common units.
    4.  The price PER UNIT (not the total price for the line).
    5.  Also, find the invoice date from anywhere on the document.

    You will be given a list of existing inventory items for reference. Use this list to match names if possible, but prioritize what is written on the invoice.
    Your entire response MUST be a single, valid JSON object that conforms to the provided schema. Do not include any text outside of the JSON structure.
    `;

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        invoiceDate: { 
          type: Type.STRING, 
          description: "Date from invoice in YYYY-MM-DD format, if found. Otherwise null." 
        },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              quantity: { type: Type.NUMBER },
              unit: { type: Type.STRING },
              costPerUnit: { type: Type.NUMBER }
            },
            required: ["name", "quantity", "unit", "costPerUnit"]
          }
        }
      }
    };
    
    const imagePart = {
      inlineData: {
        mimeType: mimeType,
        data: base64Image,
      },
    };

    const textPart = {
      text: `
        Existing inventory names for reference (use for matching if names are similar):
        ${JSON.stringify(currentInventory.map(i => i.name))}
        
        Please process the invoice image.
      `
    };

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: { parts: [imagePart, textPart] },
      config: {
        responseMimeType: 'application/json',
        responseSchema,
        temperature: 0.1,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from AI.");

    let cleanText = text.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    const extractedData = JSON.parse(cleanText) as { invoiceDate: string | null; items: Omit<ProcessedInvoiceItem, 'isNew' | 'matchedId'>[] };

    if (!extractedData.items) return { invoiceDate: null, items: [] };

    // Client-side matching logic
    const processedItems = extractedData.items.map(item => {
      const lowerCaseItemName = item.name.toLowerCase().trim();
      const match = currentInventory.find(invItem =>
        lowerCaseItemName.includes(invItem.name.toLowerCase().trim()) ||
        invItem.name.toLowerCase().trim().includes(lowerCaseItemName)
      );

      if (match) {
        return { ...item, isNew: false, matchedId: match.id };
      } else {
        return { ...item, isNew: true, matchedId: undefined };
      }
    });

    return { invoiceDate: extractedData.invoiceDate, items: processedItems };

  } catch (error) {
    console.error("Error processing invoice image with Gemini:", error);
    throw new Error("Failed to process invoice with AI. Check API key and file format.");
  }
};


// --- ADVANCED AI FUNCTIONS ---

export const generateMenuEngineeringAnalysis = async (
  menu: MenuItem[],
  sales: Sale[],
  inventory: Ingredient[]
): Promise<MenuAnalysisResult | null> => {
  try {
    const apiKey = getApiKey();
    if (!apiKey) throw new Error("API Key Missing");
    const ai = new GoogleGenAI({ apiKey });

    const salesData = menu.map(item => {
      const salesCount = sales.reduce((acc, sale) => {
        const saleItem = sale.items.find(si => si.menuItemId === item.id);
        return acc + (saleItem ? saleItem.quantity : 0);
      }, 0);
      const cost = item.recipe.reduce((total, r) => {
          const ing = inventory.find(i => i.id === r.ingredientId);
          return total + (ing ? ing.costPerUnit * r.amount : 0);
      }, 0);
      return {
        name: item.name,
        salesCount,
        profit: item.price - cost,
      };
    });

    const systemInstruction = `
      You are an expert restaurant consultant AI. Your task is to perform a "Menu Engineering" analysis based on the provided sales data.
      You must classify each menu item into one of four categories based on its profitability (profit) and popularity (salesCount):
      1. star: High profit, High popularity. (Keep promoting these)
      2. plowhorse: Low profit, High popularity. (Increase price or reduce cost)
      3. puzzle: High profit, Low popularity. (Promote more or reposition on the menu)
      4. dog: Low profit, Low popularity. (Consider removing from the menu)
      5. other: Not enough data to classify.

      For each item, provide a concise, actionable suggestion in Persian.
      Your entire response MUST be a single valid JSON object.
    `;
    
    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        analysisDate: { type: Type.NUMBER },
        summary: { type: Type.STRING, description: "A brief, overall summary of the menu's health in Persian." },
        items: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              category: { type: Type.STRING, enum: ['star', 'puzzle', 'plowhorse', 'dog', 'other'] },
              suggestion: { type: Type.STRING, description: "Actionable suggestion in Persian." },
              reasoning: { type: Type.STRING, description: "Brief reasoning for the classification in Persian." }
            },
            required: ["name", "category", "suggestion", "reasoning"]
          }
        }
      }
    };
    
    const prompt = `Sales Data:\n${JSON.stringify(salesData)}`;

    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash',
      contents: prompt,
      config: { systemInstruction, responseMimeType: 'application/json', responseSchema, temperature: 0.3 }
    });

    const text = response.text?.trim().replace(/```json/g, '').replace(/```/g, '').trim();
    if (!text) return null;
    return JSON.parse(text) as MenuAnalysisResult;
  } catch (error) {
    console.error("Menu Engineering Error:", error);
    return null;
  }
};

export const generateProcurementForecast = async (
    sales: Sale[],
    inventory: Ingredient[],
    suppliers: Supplier[]
): Promise<ProcurementForecast | null> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("API Key Missing");
        const ai = new GoogleGenAI({ apiKey });

        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const recentSales = sales.filter(s => s.timestamp > thirtyDaysAgo);
        const inventoryData = inventory.map(i => ({ id: i.id, name: i.name, stock: i.currentStock, unit: i.unit, supplierId: i.supplierId }));

        const systemInstruction = `
            You are an AI procurement expert for a restaurant. Your task is to generate a smart shopping list.
            You will receive historical sales data and current inventory levels.
            Your goal is to forecast the necessary ingredients for the next 7 days, considering that consumption might be higher on weekends (Thursday/Friday in Persian calendar).
            1. Analyze the sales data to understand consumption patterns for each ingredient.
            2. Compare the forecasted need with the current stock.
            3. Generate an order list for items that are running low. The quantity to order should be enough for about 7-10 days of operations to avoid overstocking.
            4. Group the items to be ordered by their supplier. If an item has no supplier, list it under "noSupplierItems".
            Your entire response MUST be a single valid JSON object.
        `;

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            forecastDate: { type: Type.NUMBER },
            orders: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  supplierId: { type: Type.STRING },
                  supplierName: { type: Type.STRING },
                  items: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            itemId: { type: Type.STRING },
                            itemName: { type: Type.STRING },
                            quantityToOrder: { type: Type.NUMBER },
                            currentStock: { type: Type.NUMBER },
                            unit: { type: Type.STRING }
                        },
                        required: ["itemId", "itemName", "quantityToOrder", "currentStock", "unit"]
                    }
                  }
                }
              }
            },
            noSupplierItems: {
              type: Type.ARRAY,
              items: {
                  type: Type.OBJECT,
                  properties: {
                      itemId: { type: Type.STRING },
                      itemName: { type: Type.STRING },
                      quantityToOrder: { type: Type.NUMBER },
                      currentStock: { type: Type.NUMBER },
                      unit: { type: Type.STRING }
                  },
                  required: ["itemId", "itemName", "quantityToOrder", "currentStock", "unit"]
              }
            }
          }
        };

        const prompt = `
            Recent Sales: ${JSON.stringify(recentSales.map(s => ({ timestamp: s.timestamp, items: s.items.length })))}
            Current Inventory: ${JSON.stringify(inventoryData)}
            Suppliers: ${JSON.stringify(suppliers)}
            Today is ${new Date().toLocaleDateString('en-US', { weekday: 'long' })}. Generate the shopping list.
        `;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction, responseMimeType: 'application/json', responseSchema, temperature: 0.2 }
        });
        
        const text = response.text?.trim().replace(/```json/g, '').replace(/```/g, '').trim();
        if (!text) return null;
        return JSON.parse(text) as ProcurementForecast;

    } catch (error) {
        console.error("Procurement Forecast Error:", error);
        return null;
    }
};

export const generateOperationalForecast = async (
    sales: Sale[],
    prepTasks: PrepTask[]
): Promise<OperationalForecast | null> => {
    try {
        const apiKey = getApiKey();
        if (!apiKey) throw new Error("API Key Missing");
        const ai = new GoogleGenAI({ apiKey });

        const systemInstruction = `
            You are an AI Sous-Chef. Your task is to generate a prioritized prep list for tomorrow's service.
            Analyze the historical sales data to forecast which menu items will be popular tomorrow.
            Based on this forecast, create a list of prep tasks (Mise en place) that the kitchen staff needs to complete.
            Assign a priority ('high', 'medium', 'low') to each task based on the forecasted demand and the complexity of the prep item.
            Your entire response MUST be a single valid JSON object.
        `;

        const responseSchema = {
          type: Type.OBJECT,
          properties: {
            forecastDate: { type: Type.NUMBER },
            summary: { type: Type.STRING, description: "A brief summary of the forecast for tomorrow in Persian." },
            tasks: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  prepTaskId: { type: Type.STRING },
                  prepTaskName: { type: Type.STRING },
                  quantityToPrep: { type: Type.NUMBER },
                  priority: { type: Type.STRING, enum: ['high', 'medium', 'low'] },
                  reasoning: { type: Type.STRING, description: "Brief reasoning for the priority in Persian." }
                },
                required: ["prepTaskId", "prepTaskName", "quantityToPrep", "priority", "reasoning"]
              }
            }
          }
        };
        
        const thirtyDaysAgo = Date.now() - 30 * 24 * 60 * 60 * 1000;
        const recentSales = sales.filter(s => s.timestamp > thirtyDaysAgo);

        const prompt = `
            Recent Sales: ${JSON.stringify(recentSales.map(s => ({ timestamp: s.timestamp, items: s.items.length })))}
            Available Prep Tasks: ${JSON.stringify(prepTasks.map(p => ({ id: p.id, name: p.item, unit: p.unit, onHand: p.onHand, parLevel: p.parLevel })))}
            Tomorrow will be ${new Date(Date.now() + 86400000).toLocaleDateString('en-US', { weekday: 'long' })}. Generate the prioritized prep list.
        `;

        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
            config: { systemInstruction, responseMimeType: 'application/json', responseSchema, temperature: 0.4 }
        });

        const text = response.text?.trim().replace(/```json/g, '').replace(/```/g, '').trim();
        if (!text) return null;
        return JSON.parse(text) as OperationalForecast;

    } catch (error) {
        console.error("Operational Forecast Error:", error);
        return null;
    }
};