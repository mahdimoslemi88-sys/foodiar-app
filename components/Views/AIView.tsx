import React, { useState, useRef, useEffect } from 'react';
import { MenuItem, GeneratedRecipe } from '../../types';
import { generateRestaurantAdvice, generateDailySpecial } from '../../services/geminiService';
import { useDataStore } from '../../contexts/DataContext';
import { Sparkles, Send, Bot, User, StopCircle, ChefHat, PlusCircle, CheckCircle, Key, TrendingUp } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface Message {
    role: 'user' | 'ai';
    content: string;
    timestamp: number;
}

export const AIView: React.FC = () => {
  const { inventory, menu, setMenu, sales, expenses } = useDataStore(state => ({
      inventory: state.inventory,
      menu: state.menu,
      setMenu: state.setMenu,
      sales: state.sales,
      expenses: state.expenses
  }));

  const [query, setQuery] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  
  const [hasApiKey, setHasApiKey] = useState(false);
  
  const [generatedRecipe, setGeneratedRecipe] = useState<GeneratedRecipe | null>(null);
  const [recipeAdded, setRecipeAdded] = useState(false);

  const quickPrompts = [
    { text: "تحلیل سود و زیان این هفته", icon: "💰" },
    { text: "کدام مواد اولیه در حال فساد هستند؟", icon: "🥦" },
    { text: "راهکار کاهش هزینه منو", icon: "📉" }
  ];

  const getAIStudio = (): any | undefined => (window as any).aistudio;

  useEffect(() => {
    checkApiKey();
  }, []);

  const checkApiKey = async () => {
    const studio = getAIStudio();
    if (studio) {
      const hasKey = await studio.hasSelectedApiKey();
      setHasApiKey(hasKey);
    } else {
        // Assume key is available in env if aistudio is not present
        setHasApiKey(true);
    }
  };

  const handleSelectKey = async () => {
    const studio = getAIStudio();
    if (studio) {
      await studio.openSelectKey();
      // Assume success and set key to true to allow immediate use
      setHasApiKey(true); 
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
        scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading, generatedRecipe]);

  const handleSend = async (text: string) => {
    if (!text.trim()) return;
    if (!hasApiKey && getAIStudio()) {
        handleSelectKey();
        return;
    }
    
    setGeneratedRecipe(null);
    setRecipeAdded(false);
    
    const userMsg: Message = { role: 'user', content: text, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setQuery('');
    setLoading(true);
    
    await new Promise(r => setTimeout(r, 600));

    try {
        const result = await generateRestaurantAdvice(text, inventory, menu, sales, expenses);
        const aiMsg: Message = { role: 'ai', content: result, timestamp: Date.now() };
        setMessages(prev => [...prev, aiMsg]);
    } catch (error: any) {
        const isAuthError = error.message === "403" || error.toString().includes("403");
        const aiMsg: Message = { 
            role: 'ai', 
            content: isAuthError 
                ? "خطا در احراز هویت. لطفا کلید API خود را بررسی کرده و مجددا انتخاب کنید."
                : "خطا در برقراری ارتباط با هوش مصنوعی. لطفا اتصال اینترنت خود را بررسی کنید.", 
            timestamp: Date.now() 
        };
        setMessages(prev => [...prev, aiMsg]);
        if (isAuthError && getAIStudio()) {
            setHasApiKey(false);
        }
    } finally {
        setLoading(false);
    }
  };

  const handleFinancialDeepDive = () => {
      const prompt = "لطفا یک تحلیل عمیق مالی (Financial Deep Dive) ارائه بده. تمرکز روی: ۱. روندهای درآمد و هزینه در داده‌های موجود. ۲. شناسایی ناهنجاری‌های مالی (هزینه‌های غیرعادی یا افت فروش). ۳. پیش‌بینی وضعیت آینده بر اساس روند فعلی. ۴. پیشنهادات استراتژیک برای افزایش حاشیه سود.";
      handleSend(prompt);
  };

  const handleGenerateSpecial = async () => {
      if (!hasApiKey && getAIStudio()) {
          handleSelectKey();
          return;
      }
      setGeneratedRecipe(null);
      setRecipeAdded(false);
      setLoading(true);
      
      try {
        const recipe = await generateDailySpecial(inventory);
        if (recipe) {
            setGeneratedRecipe(recipe);
        } else {
            setMessages(prev => [...prev, { role: 'ai', content: 'متاسفانه در تولید رسپی مشکلی پیش آمد. لطفا دوباره تلاش کنید.', timestamp: Date.now() }]);
        }
      } catch (error) {
        setMessages(prev => [...prev, { role: 'ai', content: 'خطا در دسترسی به هوش مصنوعی.', timestamp: Date.now() }]);
        if (getAIStudio()) setHasApiKey(false);
      } finally {
        setLoading(false);
      }
  };

  const handleAddRecipeToMenu = () => {
      if (!generatedRecipe) return;

      const newMenuItem: MenuItem = {
          id: crypto.randomUUID(),
          name: generatedRecipe.name,
          category: generatedRecipe.category,
          price: generatedRecipe.suggestedPrice,
          recipe: generatedRecipe.ingredients.map(ing => {
              const matchedInventory = inventory.find(inv => inv.name === ing.name);
              return {
                  ingredientId: matchedInventory ? matchedInventory.id : `new-${ing.name}`,
                  amount: ing.amount,
                  unit: ing.unit,
                  source: 'inventory'
              }
          })
      };

      setMenu(prev => [...prev, newMenuItem]);
      setRecipeAdded(true);
  };

  if (!hasApiKey && getAIStudio()) {
      return (
          <div className="h-full flex flex-col items-center justify-center p-8 text-center space-y-6 animate-in fade-in duration-700">
              <div className="w-24 h-24 bg-indigo-50 rounded-[32px] flex items-center justify-center shadow-xl shadow-indigo-100">
                  <Key className="w-10 h-10 text-indigo-600" />
              </div>
              <div>
                  <h2 className="text-3xl font-black text-slate-800 mb-2">اتصال به هوش مصنوعی</h2>
                  <p className="text-slate-500 max-w-md mx-auto">برای استفاده از قابلیت‌های هوشمند AssistChef، لطفا کلید API خود را متصل کنید.</p>
              </div>
              <button 
                onClick={handleSelectKey}
                className="bg-slate-900 text-white px-8 py-4 rounded-2xl font-bold text-lg shadow-xl shadow-slate-300 hover:scale-105 transition-transform flex items-center gap-3"
              >
                  <Sparkles className="w-5 h-5" />
                  انتخاب کلید API
              </button>
              <p className="text-xs text-slate-400 mt-8">اطلاعات شما امن است و مستقیماً به گوگل ارسال می‌شود.</p>
          </div>
      );
  }

  return (
    <div className="h-full flex flex-col p-4 md:p-8 pt-24 pb-32 md:pb-8 md:pt-8 max-w-5xl mx-auto animate-in fade-in duration-500">
       {/* Header */}
       <div className="flex flex-col md:flex-row items-center justify-between mb-8 px-2 gap-4">
         <div className="flex items-center gap-4 self-start md:self-auto">
            <div className="w-14 h-14 bg-white border border-slate-100 rounded-[20px] flex items-center justify-center shadow-lg shadow-indigo-100/50">
                <Sparkles className="w-7 h-7 text-indigo-600" />
            </div>
            <div>
                <h2 className="text-3xl font-black text-slate-800 tracking-tight">AssistChef</h2>
                <p className="text-sm font-bold text-slate-400">دستیار هوشمند رستوران</p>
            </div>
         </div>
         
         <div className="flex gap-3 w-full md:w-auto">
             <button 
                onClick={handleFinancialDeepDive}
                disabled={loading}
                className="flex-1 md:flex-none group flex items-center justify-center gap-2 bg-white text-slate-700 border border-slate-200 px-5 py-3.5 rounded-full font-bold shadow-sm hover:bg-slate-50 transition-all disabled:opacity-50"
             >
                 <TrendingUp className="w-5 h-5 text-indigo-500" />
                 <span className="text-xs md:text-sm">تحلیل عمیق مالی</span>
             </button>

             <button 
                onClick={handleGenerateSpecial}
                disabled={loading}
                className="flex-1 md:flex-none group flex items-center justify-center gap-3 bg-slate-900 text-white px-6 py-3.5 rounded-full font-bold shadow-xl shadow-slate-300 hover:shadow-2xl hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
             >
                 <ChefHat className="w-5 h-5 group-hover:rotate-12 transition-transform" />
                 <span className="hidden md:inline">پیشنهاد غذای روز</span>
                 <span className="md:hidden">Special</span>
             </button>
         </div>
       </div>

       {/* Chat Container */}
       <div className="flex-1 bg-white rounded-[40px] shadow-2xl shadow-slate-200/50 border border-slate-50 overflow-hidden flex flex-col relative min-h-0">
          
          {/* Messages Area */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 md:p-8 space-y-8 custom-scrollbar scroll-smooth">
             {messages.length === 0 && !generatedRecipe && !loading ? (
               <div className="h-full flex flex-col items-center justify-center text-center opacity-0 animate-in fade-in slide-in-from-bottom-10 duration-700 delay-100 fill-mode-forwards">
                  <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-8">
                     <Bot className="w-12 h-12 text-slate-300" />
                  </div>
                  <h3 className="text-2xl font-black text-slate-800 mb-3">چطور می‌توانم کمک کنم؟</h3>
                  <p className="text-slate-400 font-medium max-w-md mb-10 leading-relaxed">من تمام داده‌های مالی و انبار شما را تحلیل می‌کنم تا بهترین تصمیم را بگیرید.</p>
                  
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-2xl">
                    {quickPrompts.map((p, i) => (
                        <button 
                            key={i}
                            onClick={() => handleSend(p.text)}
                            className="text-right p-5 rounded-3xl border border-slate-100 bg-white hover:border-indigo-100 hover:shadow-lg hover:shadow-indigo-50 transition-all group"
                        >
                            <span className="text-2xl mb-2 block group-hover:scale-110 transition-transform origin-right grayscale group-hover:grayscale-0">{p.icon}</span>
                            <span className="font-bold text-slate-700 text-sm">{p.text}</span>
                        </button>
                    ))}
                  </div>
               </div>
             ) : (
                <>
                {messages.map((msg, idx) => (
                    <div key={idx} className={`flex gap-5 ${msg.role === 'user' ? 'flex-row-reverse' : ''} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
                        <div className={`w-10 h-10 rounded-full flex items-center justify-center shrink-0 shadow-sm border border-slate-100 ${msg.role === 'ai' ? 'bg-indigo-50 text-indigo-600' : 'bg-slate-900 text-white'}`}>
                            {msg.role === 'ai' ? <Sparkles className="w-5 h-5" /> : <User className="w-5 h-5" />}
                        </div>
                        <div className={`max-w-[85%] rounded-[24px] px-6 py-5 leading-7 shadow-sm ${
                            msg.role === 'user' 
                            ? 'bg-slate-900 text-white rounded-tr-none' 
                            : 'bg-white border border-slate-100 text-slate-700 rounded-tl-none'
                        }`}>
                            {msg.role === 'ai' ? (
                                <ReactMarkdown 
                                    className="prose prose-sm prose-slate max-w-none prose-p:leading-7 prose-headings:font-black prose-headings:text-slate-800 prose-strong:text-indigo-700 prose-a:text-indigo-600"
                                    components={{
                                        ul: ({node, ...props}) => <ul className="list-disc list-inside space-y-2 my-2 marker:text-indigo-300" {...props} />,
                                        li: ({node, ...props}) => <li className="" {...props} />,
                                    }}
                                >
                                    {msg.content}
                                </ReactMarkdown>
                            ) : (
                                <p className="font-medium">{msg.content}</p>
                            )}
                        </div>
                    </div>
                ))}
                
                {generatedRecipe && (
                    <div className="flex flex-col items-center animate-in fade-in zoom-in-95 duration-500 my-6">
                        <div className="bg-white w-full max-w-md rounded-[40px] border border-orange-100 shadow-2xl shadow-orange-100/50 overflow-hidden relative">
                            <div className="absolute top-0 left-0 w-full h-2 bg-gradient-to-r from-amber-400 to-orange-600"></div>
                            <div className="p-8 space-y-6">
                                <div className="text-center">
                                    <div className="inline-flex items-center gap-2 px-3 py-1 bg-orange-50 text-orange-600 rounded-full text-[10px] font-black uppercase tracking-widest mb-4">
                                        <ChefHat className="w-3 h-3" />
                                        Chef's Special
                                    </div>
                                    <h2 className="text-3xl font-black text-slate-900 mb-2 leading-tight">{generatedRecipe.name}</h2>
                                    <p className="text-slate-500 text-sm leading-relaxed font-medium">{generatedRecipe.description}</p>
                                </div>
                                
                                <div className="bg-slate-50 rounded-2xl p-5">
                                    <p className="text-xs font-bold text-slate-400 mb-3 uppercase tracking-wider">مواد اولیه:</p>
                                    <div className="flex flex-wrap gap-2">
                                        {generatedRecipe.ingredients.map((ing, i) => (
                                            <span key={i} className="text-xs font-bold bg-white border border-slate-200 px-3 py-1.5 rounded-xl text-slate-700 shadow-sm">
                                                {ing.name}
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-2">
                                    <div>
                                        <p className="text-[10px] text-slate-400 font-bold uppercase">قیمت پیشنهادی</p>
                                        <p className="text-2xl font-black text-slate-800">{generatedRecipe.suggestedPrice.toLocaleString()}</p>
                                    </div>
                                    <button 
                                        onClick={handleAddRecipeToMenu}
                                        disabled={recipeAdded}
                                        className={`flex items-center gap-2 px-6 py-4 rounded-2xl font-bold transition-all shadow-lg ${
                                            recipeAdded 
                                            ? 'bg-emerald-50 text-emerald-600 shadow-emerald-100 cursor-default' 
                                            : 'bg-slate-900 text-white hover:scale-105 active:scale-95 shadow-slate-300'
                                        }`}
                                    >
                                        {recipeAdded ? (
                                            <>
                                                <CheckCircle className="w-5 h-5" />
                                                <span>Added</span>
                                            </>
                                        ) : (
                                            <>
                                                <PlusCircle className="w-5 h-5" />
                                                <span>افزودن به منو</span>
                                            </>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {loading && (
                    <div className="flex flex-col items-center justify-center py-12 gap-4">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full animate-ping"></div>
                        <p className="text-slate-400 text-xs font-bold tracking-widest uppercase">Thinking...</p>
                    </div>
                )}
                </>
             )}
          </div>

          {/* Input Area */}
          <div className="p-4 md:p-6 bg-white border-t border-slate-50">
             <div className="relative max-w-4xl mx-auto">
                <input 
                  type="text" 
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && !loading && handleSend(query)}
                  placeholder="Ask anything..."
                  className="w-full bg-slate-50 hover:bg-slate-100 focus:bg-white border-none rounded-3xl pl-6 pr-16 py-5 focus:ring-2 focus:ring-indigo-100 transition-all font-bold text-slate-800 placeholder:text-slate-300 shadow-sm"
                  disabled={loading}
                />
                <button 
                  onClick={() => handleSend(query)}
                  disabled={!query && !loading}
                  className={`absolute right-2 top-2 bottom-2 aspect-square rounded-[20px] flex items-center justify-center transition-all ${
                    loading 
                    ? 'bg-transparent text-slate-400' 
                    : query 
                        ? 'bg-slate-900 text-white shadow-lg hover:scale-105 active:scale-95' 
                        : 'bg-transparent text-slate-300 cursor-not-allowed'
                  }`}
                >
                  {loading ? <StopCircle className="w-6 h-6 animate-pulse" /> : <Send className="w-5 h-5" />}
                </button>
             </div>
          </div>
       </div>
    </div>
  );
};