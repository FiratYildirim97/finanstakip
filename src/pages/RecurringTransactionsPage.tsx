import { useState, FormEvent, useEffect, useMemo, useRef } from 'react';
import { 
  Plus, 
  Trash2, 
  CalendarDays, 
  ArrowUpRight, 
  ArrowDownRight, 
  RefreshCcw, 
  X, 
  Info, 
  Layers, 
  ChevronDown, 
  Pencil, 
  Clock, 
  AlertTriangle, 
  CalendarCheck, 
  ArrowRight, 
  Landmark, 
  Wallet,
  ChevronLeft,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Search,
  ArrowRightLeft,
  CreditCard as CardIcon,
  LayoutList,
  History,
  Target
} from 'lucide-react';
import { useData } from '../context/DataContext';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'motion/react';

interface Period {
  label: string;
  start: Date;
  end: Date;
}

export const RecurringTransactionsPage = () => {
  const { 
    recurring, 
    transactions, 
    creditCardExpenses, 
    loading, 
    accounts, 
    addRecurring, 
    deleteRecurring, 
    updateRecurring,
    deleteTransaction,
    updateTransaction,
    addTransaction
  } = useData();
  
  // Tabs: 'plan' (Recurring management) or 'actuals' (Historical list)
  const [activeTab, setActiveTab] = useState<'plan' | 'actuals'>('plan');
  
  // Period Generation: 15-to-15 logic
  const periods = useMemo(() => {
    const list = [];
    const today = new Date();
    // Generate range: 6 months ago to 12 months ahead for better planning
    for (let i = -6; i <= 12; i++) {
      const start = new Date(today.getFullYear(), today.getMonth() + i, 15, 0, 0, 0);
      const end = new Date(today.getFullYear(), today.getMonth() + i + 1, 14, 23, 59, 59);
      
      const label = `${start.toLocaleDateString('tr-TR', { month: 'short' })} - ${end.toLocaleDateString('tr-TR', { month: 'short' })} ${end.getFullYear()}`;
      list.push({ start, end, label });
    }
    return list;
  }, []);

  const [selectedPeriodIndex, setSelectedPeriodIndex] = useState(6); // Default to current month (offset -6)
  const currentPeriod = periods[selectedPeriodIndex] || periods[0];

  // Forms and filtering state
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly' | 'once'>('monthly');
  const [nextDate, setNextDate] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [isInvestment, setIsInvestment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('');
  const [selectedAccountId, setSelectedAccountId] = useState<string>('');
  const [isExempt, setIsExempt] = useState(false);
  const [rates, setRates] = useState<Record<string, number>>({ TRY: 1 });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const categoryRef = useRef<HTMLDivElement>(null);

  // Edit states for definitions (Master List)
  const [showManageList, setShowManageList] = useState(false);
  const [editingRecurringId, setEditingRecurringId] = useState<string | null>(null);
  const [editRecAmount, setEditRecAmount] = useState('');
  const [editRecCategory, setEditRecCategory] = useState('');
  const [editRecFreq, setEditRecFreq] = useState<any>('monthly');

  // Edit Actual Transaction state
  const [editingActualId, setEditingActualId] = useState<string | null>(null);
  const [editActualAmount, setEditActualAmount] = useState('');
  const [editActualCategory, setEditActualCategory] = useState('');
  const [editActualDesc, setEditActualDesc] = useState('');

  // Stats Logic: Actuals
  const actuals = useMemo(() => {
    const start = currentPeriod.start;
    const end = currentPeriod.end;

    const txInPeriod = transactions.filter(t => {
      const d = new Date(t.date);
      return !t.is_exempt && d >= start && d <= end;
    });

    const income = txInPeriod.filter(t => t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
    const expense = txInPeriod.filter(t => t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);

    return { income, expense, net: income - expense, txCount: txInPeriod.length };
  }, [transactions, currentPeriod]);

  // Stats Logic: Planned (Simulate recurring items that SHOULD fall into this period)
  const planned = useMemo(() => {
    const start = currentPeriod.start;
    const end = currentPeriod.end;
    
    let income = 0;
    let expense = 0;

    recurring.forEach(rec => {
      if (rec.is_exempt) return;

      // Check if this recurring item has at least one occurrence in this period
      let occurs = false;
      const recDate = new Date(rec.next_date);

      if (rec.frequency === 'once') {
        occurs = recDate >= start && recDate <= end;
      } else {
        // Project occurrence date
        let pointer = new Date(recDate);
        let attempts = 0;
        while (pointer <= end && attempts < 500) {
          if (pointer >= start && pointer <= end) {
            occurs = true;
            break;
          }
          if (rec.frequency === 'monthly') pointer.setMonth(pointer.getMonth() + 1);
          else if (rec.frequency === 'weekly') pointer.setDate(pointer.getDate() + 7);
          else if (rec.frequency === 'yearly') pointer.setFullYear(pointer.getFullYear() + 1);
          else break;
          attempts++;
        }
      }

      if (occurs) {
        if (rec.type === 'income') income += Number(rec.amount);
        else expense += Number(rec.amount);
      }
    });

    return { income, expense, net: income - expense };
  }, [recurring, currentPeriod]);

  // The filtered expectations for the "Beklentiler" list should also use this projection
  const projectedRecurringItems = useMemo(() => {
    const start = currentPeriod.start;
    const end = currentPeriod.end;

    return recurring
      .map(rec => {
        const recDate = new Date(rec.next_date);
        let actualOccurrenceDate: Date | null = null;

        if (rec.frequency === 'once') {
           if (recDate >= start && recDate <= end) actualOccurrenceDate = recDate;
        } else {
          // Project occurrence date
          let pointer = new Date(recDate);
          let attempts = 0;
          while (pointer <= end && attempts < 500) {
            if (pointer >= start && pointer <= end) {
              actualOccurrenceDate = new Date(pointer);
              break;
            }
            if (rec.frequency === 'monthly') pointer.setMonth(pointer.getMonth() + 1);
            else if (rec.frequency === 'weekly') pointer.setDate(pointer.getDate() + 7);
            else if (rec.frequency === 'yearly') pointer.setFullYear(pointer.getFullYear() + 1);
            else break;
            attempts++;
          }
        }

        return actualOccurrenceDate ? { ...rec, occurrenceDate: actualOccurrenceDate } : null;
      })
      .filter((item): item is (typeof recurring[0] & { occurrenceDate: Date }) => item !== null)
      .sort((a, b) => a.occurrenceDate.getTime() - b.occurrenceDate.getTime());
  }, [recurring, currentPeriod]);

  // Combined Actual Transaction List
  const filteredActualItems = useMemo(() => {
    const start = currentPeriod.start;
    const end = currentPeriod.end;

    const combined = transactions
      .filter(t => {
        const d = new Date(t.date);
        return d >= start && d <= end;
      })
      .map(t => ({
        id: t.id,
        date: new Date(t.date),
        amount: Number(t.amount),
        type: t.type as 'income' | 'expense',
        category: t.category,
        description: t.description,
        is_exempt: t.is_exempt,
        source: 'General'
      }))
      .sort((a, b) => b.date.getTime() - a.date.getTime());
    
    return searchTerm 
      ? combined.filter(item => 
          item.category.toLowerCase().includes(searchTerm.toLowerCase()) || 
          item.description?.toLowerCase().includes(searchTerm.toLowerCase())
        )
      : combined;
  }, [transactions, currentPeriod, searchTerm]);

  // Existing helpers from RecurringTransactionsPage
  const freqLabels = { monthly: 'Aylık', weekly: 'Haftalık', yearly: 'Yıllık', once: 'Tek Seferlik' };
  
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    recurring.forEach(r => { if (r.category && r.type === type) cats.add(r.category); });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [recurring, type]);

  const filteredCategories = useMemo(() => {
    if (!category) return allCategories;
    return allCategories.filter(c => c.toLowerCase().includes(category.toLowerCase()));
  }, [allCategories, category]);

  useEffect(() => {
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNextDate(tomorrow.toISOString().split('T')[0]);
    fetch('https://open.er-api.com/v6/latest/TRY')
      .then(res => res.json())
      .then(data => { if (data?.rates) setRates(data.rates); })
      .catch(e => console.error("Döviz kurları çekilemedi:", e));
  }, []);

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    if (!parsedAmount || !category || !nextDate) return;
    
    toast.loading(`İşlem kaydediliyor...`, { id: 'submit-rec' });
    
    const todayStr = new Date().toISOString().split('T')[0];
    const isPastOrToday = nextDate <= todayStr;

    let error: any = null;

    if (isPastOrToday) {
      // 1. Add as an ACTUAL transaction immediately
      const { error: txError } = await addTransaction({
        type,
        category,
        amount: parsedAmount,
        date: nextDate,
        description,
        linked_account_id: selectedAccountId || null,
        is_exempt: isExempt
      });
      error = txError;

      // 2. If it's RECURRING, also add a FUTURE plan for the next cycle
      if (!txError && frequency !== 'once') {
        let nextOccurence = new Date(nextDate);
        if (frequency === 'monthly') nextOccurence.setMonth(nextOccurence.getMonth() + 1);
        else if (frequency === 'weekly') nextOccurence.setDate(nextOccurence.getDate() + 7);
        else if (frequency === 'yearly') nextOccurence.setFullYear(nextOccurence.getFullYear() + 1);

        const { error: recError } = await addRecurring({
          type, category, amount: parsedAmount, currency, description,
          frequency, next_date: nextOccurence.toISOString().split('T')[0], 
          is_investment: isInvestment,
          total_installments: totalInstallments ? parseInt(totalInstallments) : undefined,
          linked_account_id: selectedAccountId || null,
          is_exempt: isExempt
        });
        if (recError) console.error("Future recurring failed:", recError);
      }
    } else {
      // FUTURE DATE: Business as usual (just add recurring plan)
      const { error: recError } = await addRecurring({
        type, category, amount: parsedAmount, currency, description,
        frequency, next_date: nextDate, is_investment: isInvestment,
        total_installments: totalInstallments ? parseInt(totalInstallments) : undefined,
        linked_account_id: selectedAccountId || null,
        is_exempt: isExempt
      });
      error = recError;
    }

    if (!error) {
      toast.success('İşlem kaydedildi', { id: 'submit-rec' });
      setAmount(''); setCategory(''); setDescription('');
      setFrequency('monthly'); setCurrency('TRY'); setIsInvestment(false); 
      setTotalInstallments(''); setSelectedAccountId(''); setIsExempt(false);
    } else {
      toast.error('Hata oluştu', { id: 'submit-rec' });
      console.error(error);
    }
  };

  const navigatePeriod = (dir: 'next' | 'prev') => {
    // Next period moves forward in time (higher index)
    if (dir === 'next' && selectedPeriodIndex < periods.length - 1) setSelectedPeriodIndex(s => s + 1);
    // Prev period moves backward in time (lower index)
    if (dir === 'prev' && selectedPeriodIndex > 0) setSelectedPeriodIndex(s => s - 1);
  };

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      {/* Header & Period Selector */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
        <div>
          <h1 className="text-4xl font-black tracking-tight text-white font-display">Aylık Plan & Rapor</h1>
          <p className="text-[var(--color-text-variant)] mt-1 font-mono text-sm max-w-md">
            15 - 14 döngüsünde beklenti vs gerçekleşen durumunuzu yönetin.
          </p>
        </div>

        <div className="flex items-center gap-2 bg-[var(--color-surface-container)] p-1.5 rounded-2xl border border-white/5 shadow-2xl">
          <button 
            onClick={() => navigatePeriod('prev')}
            disabled={selectedPeriodIndex === 0}
            className="p-2 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-20 rounded-xl transition-all"
          >
            <ChevronLeft size={24} />
          </button>
          
          <div className="px-6 py-2 text-center min-w-[240px]">
            <p className="text-[10px] text-[var(--color-brand-primary)] font-bold uppercase tracking-[0.2em] mb-1 font-mono">Dönem Seçimi</p>
            <p className="text-sm font-bold text-white font-display">{currentPeriod.label}</p>
          </div>

          <button 
            onClick={() => navigatePeriod('next')}
            disabled={selectedPeriodIndex === periods.length - 1}
            className="p-2 text-white/50 hover:text-white hover:bg-white/5 disabled:opacity-20 rounded-xl transition-all"
          >
            <ChevronRight size={24} />
          </button>
        </div>
      </div>

      {/* Stats Section: Plan vs Actual */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
         {/* Planned Stat - Focus on Remaining Payments */}
         {(() => {
           const unpaidExpenses = recurring.filter(r => {
             const d = new Date(r.next_date);
             return r.type === 'expense' && d >= currentPeriod.start && d <= currentPeriod.end;
           }).reduce((a, b) => a + Number(b.amount), 0);

           return (
            <div className="bento-card group relative overflow-hidden bg-white/[0.01]">
                <div className="absolute top-0 right-0 p-3 text-white/5 group-hover:text-white/10 transition-colors">
                   <Clock size={48} strokeWidth={1} />
                </div>
                <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono mb-4">Ödeme Planı (Dönem)</p>
                <div className="space-y-1">
                  <h3 className="text-2xl font-black font-mono text-white">
                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(planned.expense)}
                  </h3>
                  <p className="text-[10px] text-[var(--color-text-variant)] font-mono">Toplam planlanan gider bütçesi</p>
                  
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <div className="flex justify-between items-center text-xs">
                      <span className="text-white/60">Bekleyen Ödemeler:</span>
                      <span className="text-[#ffcf70] font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(unpaidExpenses)}</span>
                    </div>
                  </div>
                </div>
            </div>
           );
         })()}

         {/* Actuals Stat - KEPT (The middle one the user likes) */}
         <div className="bento-card group relative overflow-hidden bg-white/[0.01] border-l-4 border-l-[var(--color-brand-primary)]">
            <div className="absolute top-0 right-0 p-3 text-white/5 group-hover:text-white/10 transition-colors">
               <TrendingUp size={48} strokeWidth={1} />
            </div>
            <p className="text-[10px] font-bold text-[var(--color-brand-primary)] uppercase tracking-widest font-mono mb-4">Gerçekleşen (Nakit Akışı)</p>
            <div className="space-y-2">
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-[#4edeb3]">Alınan (+)</span>
                <span className="text-white font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(actuals.income)}</span>
              </div>
              <div className="flex justify-between items-center text-sm font-mono">
                <span className="text-[#ff7886]">Harcanan (-)</span>
                <span className="text-white font-bold">{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(actuals.expense)}</span>
              </div>
              <div className="h-px bg-white/5 my-2" />
              <div className="flex justify-between items-center">
                <span className="text-xs text-[var(--color-text-variant)]">Kalan +/-</span>
                <span className={`text-xl font-black font-mono ${actuals.net >= 0 ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>
                  {actuals.net >= 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(actuals.net)}
                </span>
              </div>
            </div>
         </div>

         {/* Period End Forecast Context */}
         {(() => {
           // Forecast = Current Actual Net + Remaining Planned Net
           const forecastNet = actuals.net + planned.net;

           return (
            <div className="bento-card group relative overflow-hidden bg-white/[0.01]">
                <div className="absolute top-0 right-0 p-3 text-white/5 group-hover:text-white/10 transition-colors">
                   <Target size={48} strokeWidth={1} />
                </div>
                <p className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono mb-4">Dönem Sonu Tahmini</p>
                <div className="space-y-1">
                  <h3 className={`text-2xl font-black font-mono ${forecastNet >= 0 ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>
                    {forecastNet >= 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(forecastNet)}
                  </h3>
                  <p className="text-[10px] text-[var(--color-text-variant)] font-mono">14. güne ait tahmini net bakiye</p>
                  
                  <div className="mt-4 pt-4 border-t border-white/5">
                    <p className="text-[9px] text-[var(--color-text-variant)] italic">
                      * Planlanan tüm ödemeler yapıldığında oluşacak durum.
                    </p>
                  </div>
                </div>
            </div>
           );
         })()}
      </div>

      {/* Main Content Tabs */}
      <div className="bg-[var(--color-surface-container)] rounded-3xl border border-white/5 overflow-hidden shadow-2xl">
         <div className="flex border-b border-white/5 p-2 bg-white/[0.02]">
            <button 
               onClick={() => setActiveTab('plan')}
               className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'plan' ? 'bg-white/5 text-[var(--color-brand-primary)]' : 'text-[var(--color-text-variant)] hover:text-white'}`}
            >
               <LayoutList size={20} /> Planlama & Düzenli İşlemler
            </button>
            <button 
               onClick={() => setActiveTab('actuals')}
               className={`flex-1 flex items-center justify-center gap-2 py-4 rounded-2xl text-sm font-bold transition-all ${activeTab === 'actuals' ? 'bg-white/5 text-[var(--color-brand-primary)]' : 'text-[var(--color-text-variant)] hover:text-white'}`}
            >
               <History size={20} /> Gerçekleşen Hareketler
            </button>
         </div>

         <div className="p-6">
            {activeTab === 'plan' ? (
               <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                  {/* Form Column */}
                  <div className="lg:col-span-1">
                     <div className="p-5 bg-white/[0.02] rounded-2xl border border-white/5 space-y-5">
                        <div className="flex p-1 bg-black/20 rounded-xl mb-4">
                           <button onClick={() => setType('income')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${type === 'income' ? 'bg-[#4edeb3] text-[#002113]' : 'text-white/40'}`}>GELİR</button>
                           <button onClick={() => setType('expense')} className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${type === 'expense' ? 'bg-[#ffb4ab] text-[#002113]' : 'text-white/40'}`}>GİDER</button>
                        </div>
                        
                        <form onSubmit={handleManualSubmit} className="space-y-4">
                           <div className="grid grid-cols-2 gap-3">
                              <div>
                                 <label className="text-[9px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest block mb-1">Miktar</label>
                                 <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl text-sm outline-none focus:border-[var(--color-brand-primary)]" />
                              </div>
                              <div>
                                 <label className="text-[9px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest block mb-1">Sıklık</label>
                                 <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl text-sm outline-none">
                                    <option value="monthly">Aylık</option>
                                    <option value="once">Tek Sefer</option>
                                 </select>
                              </div>
                           </div>

                           <div className="grid grid-cols-1 gap-3">
                              <div>
                                 <label className="text-[9px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest block mb-1">Tarih</label>
                                 <input 
                                    type="date" required value={nextDate} 
                                    onChange={e => setNextDate(e.target.value)}
                                    className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl text-sm outline-none [color-scheme:dark]" 
                                 />
                              </div>
                           </div>

                           <div ref={categoryRef} className="relative">
                              <label className="text-[9px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest block mb-1">Kategori</label>
                              <input 
                                 type="text" required value={category} 
                                 onChange={e => { setCategory(e.target.value); setShowCategoryDropdown(true); }}
                                 onFocus={() => setShowCategoryDropdown(true)}
                                 className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl text-sm outline-none" 
                              />
                              {showCategoryDropdown && filteredCategories.length > 0 && (
                                 <div className="absolute z-20 w-full mt-1 bg-[#1a1a1e] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[150px] overflow-y-auto">
                                    {filteredCategories.map(cat => (
                                       <button key={cat} type="button" onClick={() => { setCategory(cat); setShowCategoryDropdown(false); }} className="w-full text-left px-4 py-2 text-xs text-white hover:bg-white/5">{cat}</button>
                                    ))}
                                 </div>
                              )}
                           </div>

                           <div>
                              <label className="text-[9px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest block mb-1">Açıklama (Opsiyonel)</label>
                              <input 
                                 type="text" value={description} 
                                 onChange={e => setDescription(e.target.value)}
                                 placeholder="Örn: Kira yardımı, İnternet faturası..."
                                 className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl text-sm outline-none focus:border-[var(--color-brand-primary)]" 
                              />
                              <div className="flex items-center justify-between p-3 bg-white/[0.03] border border-white/5 rounded-2xl group hover:border-white/10 transition-all mt-4">
                               <div className="flex flex-col">
                                  <label className="text-[10px] font-bold text-white/70 uppercase tracking-widest leading-none">Raporlardan Muaf Tut</label>
                                  <span className="text-[8px] text-white/30 font-medium mt-1">+/- tablosuna dahil edilmez</span>
                               </div>
                               <button 
                                 type="button"
                                 onClick={() => setIsExempt(!isExempt)}
                                 className={`relative w-10 h-5 rounded-full transition-all duration-300 flex items-center px-1 ${isExempt ? 'bg-[var(--color-brand-primary)]' : 'bg-white/10'}`}
                               >
                                 <div className={`w-3 h-3 bg-white rounded-full transition-all duration-300 transform ${isExempt ? 'translate-x-5' : 'translate-x-0'}`} />
                               </button>
                            </div>
                           </div>

                           <div>
                              <label className="text-[9px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest block mb-1">Banka Hesabı</label>
                              <select value={selectedAccountId} onChange={e => setSelectedAccountId(e.target.value)} className="w-full px-3 py-2 bg-black/20 text-white border border-white/10 rounded-xl text-sm outline-none">
                                 <option value="">Bağlamayı İptal Et</option>
                                 {accounts.map(acc => <option key={acc.id} value={acc.id}>{acc.name}</option>)}
                              </select>
                           </div>

                           <button type="submit" className={`w-full py-4 rounded-2xl font-bold text-[#002113] transition-all hover:scale-[1.02] active:scale-[0.98] shadow-xl ${type === 'income' ? 'bg-[#4edeb3]/90 hover:bg-[#4edeb3]' : 'bg-[#ffb4ab]/90 hover:bg-[#ffb4ab]'}`}>
                              İşlemi Kaydet
                           </button>
                        </form>
                     </div>
                  </div>

                  {/* List Column */}
                  <div className="lg:col-span-2 space-y-4">
                     <h3 className="text-xs font-bold text-white uppercase tracking-widest font-mono flex items-center gap-2">
                        <AlertTriangle size={14} className="text-[#ffcf70]" /> Aktif Beklentiler ({projectedRecurringItems.length})
                     </h3>
                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {projectedRecurringItems.map(rec => {
                           const isFutureProjection = new Date(rec.next_date) < currentPeriod.start;

                           return (
                              <div key={rec.id} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl group relative overflow-hidden">
                                 {isFutureProjection && (
                                    <div className="absolute top-0 right-0 px-2 py-1 bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] text-[8px] font-bold font-mono tracking-tighter uppercase">Projeksiyon</div>
                                 )}
                                 <div className="flex justify-between items-start mb-3">
                                    <div className={`p-2 rounded-lg ${rec.type === 'income' ? 'bg-[#4edeb3]/10 text-[#4edeb3]' : 'bg-[#ff7886]/10 text-[#ff7886]'}`}>
                                       {rec.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                                    </div>
                                    <div className="flex gap-2 items-center">
                                       {rec.is_exempt && (
                                         <span className="px-2 py-0.5 bg-white/5 border border-white/10 text-white/40 text-[7px] font-black uppercase tracking-tighter rounded-full">MUAF</span>
                                       )}
                                       <button onClick={() => deleteRecurring(rec.id)} className="p-1.5 opacity-0 group-hover:opacity-100 text-white/20 hover:text-red-400 transition-all">
                                          <Trash2 size={14} />
                                       </button>
                                    </div>
                                 </div>
                                 <h4 className="font-bold text-white text-sm">{rec.category}</h4>
                                 <p className="text-[10px] text-[var(--color-text-variant)] font-mono">{rec.description || 'Açıklama yok'}</p>
                                 <div className="mt-4 flex items-end justify-between">
                                    <div>
                                       <p className="text-[9px] text-white/30 uppercase font-bold font-mono">Tutar</p>
                                       <p className={`text-lg font-black font-mono ${rec.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>
                                          {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rec.amount)}
                                       </p>
                                    </div>
                                    <div className="text-right flex flex-col items-end">
                                       <p className="text-[9px] text-white/30 uppercase font-bold font-mono">Vade</p>
                                       <div className="flex items-center gap-1.5 mt-0.5">
                                          <div className="flex flex-col items-end">
                                             <span className="text-xl font-black text-white leading-none">
                                                {rec.occurrenceDate.getDate()}
                                             </span>
                                             <span className="text-[8px] text-white/50 uppercase font-bold tracking-tighter">
                                                {rec.occurrenceDate.toLocaleDateString('tr-TR', { month: 'short' })}
                                             </span>
                                          </div>
                                          {isFutureProjection && <span className="text-[var(--color-brand-primary)] text-sm font-black">*</span>}
                                       </div>
                                    </div>
                                 </div>
                              </div>
                           );
                        })}
                     </div>
                  </div>
               </div>
            ) : (
               /* Actuals Tab Content */
               <div className="space-y-6">
                  <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                     <h3 className="text-xl font-bold text-white font-display flex items-center gap-2">
                        <History size={20} className="text-[var(--color-brand-primary)]" />
                        Dönem Hareketleri
                     </h3>
                     <div className="relative w-full md:w-64">
                        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--color-text-variant)]" />
                        <input 
                           type="text" placeholder="Ara..." value={searchTerm}
                           onChange={(e) => setSearchTerm(e.target.value)}
                           className="w-full pl-10 pr-4 py-2 bg-black/20 border border-white/10 rounded-xl text-sm text-white outline-none"
                        />
                     </div>
                  </div>

                  <div className="overflow-x-auto min-h-[400px]">
                     <table className="w-full text-left">
                        <thead>
                           <tr className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono border-b border-white/5">
                              <th className="px-4 py-3">Tarih</th>
                              <th className="px-4 py-3">Kategori</th>
                              <th className="px-4 py-3">Açıklama</th>
                              <th className="px-4 py-3 text-right">Tutar</th>
                              <th className="px-4 py-3 text-center">Aksiyon</th>
                           </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                           {filteredActualItems.map(item => {
                              const isEditing = editingActualId === item.id;
                              
                              if (isEditing) {
                                return (
                                  <tr key={item.id} className="bg-[var(--color-brand-primary)]/5">
                                    <td className="px-4 py-3 text-xs font-mono text-white/50">
                                      {item.date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                                    </td>
                                    <td className="px-4 py-3">
                                      <input 
                                        value={editActualCategory} 
                                        onChange={e => setEditActualCategory(e.target.value)}
                                        className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <input 
                                        value={editActualDesc} 
                                        onChange={e => setEditActualDesc(e.target.value)}
                                        className="w-full px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white"
                                      />
                                    </td>
                                    <td className="px-4 py-3 text-right">
                                      <input 
                                        type="number"
                                        value={editActualAmount} 
                                        onChange={e => setEditActualAmount(e.target.value)}
                                        className="w-24 px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white text-right"
                                      />
                                    </td>
                                    <td className="px-4 py-3">
                                      <div className="flex items-center justify-center gap-2">
                                        <button 
                                          onClick={async () => {
                                            await updateTransaction(item.id, { 
                                              category: editActualCategory,
                                              description: editActualDesc,
                                              amount: parseFloat(editActualAmount)
                                            });
                                            setEditingActualId(null);
                                            toast.success('Güncellendi');
                                          }}
                                          className="p-1 px-2 text-[10px] bg-[var(--color-brand-primary)] text-black font-bold rounded"
                                        >
                                          Tamam
                                        </button>
                                        <button onClick={() => setEditingActualId(null)} className="p-1 px-2 text-[10px] bg-white/5 text-white rounded">İptal</button>
                                      </div>
                                    </td>
                                  </tr>
                                );
                              }

                              return (
                                <tr key={item.id} className="hover:bg-white/[0.02] transition-colors group">
                                  <td className="px-4 py-4 whitespace-nowrap text-xs font-mono text-white">
                                     {item.date.toLocaleDateString('tr-TR', { day: '2-digit', month: '2-digit' })}
                                  </td>
                                  <td className="px-4 py-4">
                                     <span className="px-2 py-0.5 rounded-lg bg-white/5 border border-white/5 text-[10px] font-bold text-white/50">{item.category}</span>
                                  </td>
                                  <td className="px-4 py-4 text-xs text-white/70 truncate max-w-[150px]">{item.description || '-'}</td>
                                  <td className={`px-4 py-4 text-right font-mono font-bold ${item.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>
                                     <div className="flex flex-col items-end gap-0.5">
                                       <span>{item.type === 'income' ? '+' : '-'}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(item.amount)}</span>
                                       {item.is_exempt && <span className="text-[7px] text-white/30 font-black border border-white/5 px-1 rounded-sm">MUAF</span>}
                                     </div>
                                  </td>
                                  <td className="px-4 py-4">
                                     <div className="flex items-center justify-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button 
                                          onClick={() => {
                                            setEditingActualId(item.id);
                                            setEditActualCategory(item.category);
                                            setEditActualDesc(item.description || '');
                                            setEditActualAmount(String(item.amount));
                                          }}
                                          className="p-1.5 text-white/40 hover:text-[var(--color-brand-primary)] hover:bg-white/5 rounded-lg transition-colors"
                                        >
                                          <Pencil size={14} />
                                        </button>
                                        <button 
                                          onClick={async () => {
                                            if (confirm('Bu işlemi silmek istediğinize emin misiniz?')) {
                                              await deleteTransaction(item.id);
                                              toast.success('Silindi');
                                            }
                                          }}
                                          className="p-1.5 text-white/40 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                                        >
                                          <Trash2 size={14} />
                                        </button>
                                     </div>
                                  </td>
                                </tr>
                              );
                           })}
                           {filteredActualItems.length === 0 && (
                              <tr><td colSpan={5} className="py-20 text-center text-[var(--color-text-variant)] font-mono text-sm opacity-50">Kayıt bulunamadı.</td></tr>
                           )}
                        </tbody>
                     </table>
                  </div>
                </div>
             )}
          </div>
       </div>

      {/* Manage Master Recurring List Button */}
      <div className="mt-8 space-y-4">
         <button 
           onClick={() => setShowManageList(!showManageList)}
           className="w-full py-4 bg-white/[0.02] hover:bg-white/[0.05] border border-white/5 rounded-3xl flex items-center justify-center gap-3 text-sm font-bold text-white/70 hover:text-white transition-all shadow-lg"
         >
           <LayoutList size={20} className={showManageList ? 'text-[var(--color-brand-primary)]' : ''} />
           {showManageList ? 'Yönetim Panelini Kapat' : 'Tüm Düzenli İşlemleri Yönet (Tanımlar)'}
         </button>

         {showManageList && (
           <div className="bento-card bg-black/40 border-white/10 animate-in fade-in slide-in-from-bottom-4 duration-500 overflow-hidden">
             <div className="flex justify-between items-center mb-6">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                   <LayoutList size={20} className="text-[var(--color-brand-primary)]" />
                   Düzenli İşlem Tanımları
                </h3>
                <p className="text-[10px] text-[var(--color-text-variant)] font-mono uppercase tracking-widest">{recurring.length} Kayıtlı Tanım</p>
             </div>

             <div className="overflow-x-auto">
               <table className="w-full text-left border-collapse">
                  <thead>
                     <tr className="text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest font-mono border-b border-white/5">
                        <th className="px-4 py-3">Tip / Kategori</th>
                        <th className="px-4 py-3">Frekans / Gün</th>
                        <th className="px-4 py-3">Bağlı Hesap</th>
                        <th className="px-4 py-3 text-right">Tutar</th>
                        <th className="px-4 py-3 text-center">İşlem</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                     {recurring.map(rec => {
                        const isEditing = editingRecurringId === rec.id;
                        const freqLabels = { monthly: 'Aylık', weekly: 'Haftalık', yearly: 'Yıllık', once: 'Tek Sefer' };
                        
                        if (isEditing) {
                          return (
                            <tr key={rec.id} className="bg-[var(--color-brand-primary)]/5">
                              <td className="px-4 py-3">
                                <div className="flex flex-col gap-1 min-w-[120px]">
                                  <span className={`text-[8px] font-bold uppercase ${rec.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>{rec.type === 'income' ? 'GELİR' : 'GİDER'}</span>
                                  <input 
                                    className="px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white outline-none"
                                    value={editRecCategory} 
                                    onChange={e => setEditRecCategory(e.target.value)} 
                                  />
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex items-center gap-1">
                                  <select 
                                    className="px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white outline-none"
                                    value={editRecFreq} 
                                    onChange={e => setEditRecFreq(e.target.value as any)}
                                  >
                                    <option value="monthly">Aylık</option>
                                    <option value="weekly">Haftalık</option>
                                    <option value="yearly">Yıllık</option>
                                    <option value="once">Tek Sefer</option>
                                  </select>
                                  <span className="text-[10px] text-white/40">Ayın {new Date(rec.next_date).getDate()}. günü</span>
                                </div>
                              </td>
                              <td className="px-4 py-3 text-right">
                                <input 
                                  type="number"
                                  className="w-24 px-2 py-1 bg-black/40 border border-white/10 rounded text-xs text-white outline-none text-right"
                                  value={editRecAmount} 
                                  onChange={e => setEditRecAmount(e.target.value)} 
                                />
                              </td>
                              <td className="px-4 py-3">
                                <div className="flex gap-2 justify-center">
                                  <button 
                                    onClick={async () => {
                                      await updateRecurring(rec.id, { 
                                        category: editRecCategory, 
                                        amount: parseFloat(editRecAmount),
                                        frequency: editRecFreq
                                      });
                                      setEditingRecurringId(null);
                                      toast.success('Tanım güncellendi');
                                    }}
                                    className="p-1 px-3 bg-[var(--color-brand-primary)] text-black font-bold text-[10px] rounded hover:brightness-110 transition-all"
                                  >
                                    Tamam
                                  </button>
                                  <button onClick={() => setEditingRecurringId(null)} className="p-1 px-3 bg-white/5 text-white text-[10px] rounded hover:bg-white/10 transition-all">İptal</button>
                                </div>
                              </td>
                            </tr>
                          );
                        }

                        return (
                          <tr key={rec.id} className="hover:bg-white/[0.01] transition-colors group">
                            <td className="px-4 py-4">
                              <div className="flex flex-col">
                                <span className={`text-[8px] font-black tracking-widest ${rec.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>{rec.type === 'income' ? 'GELİR' : 'GİDER'}</span>
                                <span className="text-xs font-bold text-white">{rec.category}</span>
                              </div>
                            </td>
                            <td className="px-4 py-4">
                                 <div className="flex flex-col">
                                    <span className="text-xs font-bold text-white leading-tight">
                                       {freqLabels[rec.frequency as keyof typeof freqLabels]}
                                    </span>
                                    <span className="text-[10px] text-[var(--color-brand-primary)] font-mono font-bold">
                                       Ayın {new Date(rec.next_date).getDate()}. Günü
                                    </span>
                                 </div>
                            </td>
                            <td className="px-4 py-4">
                                 {rec.linked_account_id ? (
                                    <div className="flex items-center gap-1.5 px-2 py-1 bg-white/5 border border-white/5 rounded-lg w-fit">
                                       <span className="text-[10px] text-white/70 font-medium">
                                          {accounts.find(a => a.id === rec.linked_account_id)?.name || 'Bilinmeyen'}
                                       </span>
                                    </div>
                                 ) : (
                                    <span className="text-[9px] text-white/20 italic">Bağlı değil</span>
                                 )}
                            </td>
                            <td className="px-4 py-4 text-right">
                              <span className={`text-sm font-black font-mono ${rec.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>
                                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rec.amount)}
                              </span>
                            </td>
                            <td className="px-4 py-4">
                                <div className="flex justify-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button 
                                      onClick={() => {
                                        setEditingRecurringId(rec.id);
                                        setEditRecCategory(rec.category);
                                        setEditRecAmount(rec.amount.toString());
                                        setEditRecFreq(rec.frequency);
                                      }}
                                      className="p-2 text-white/30 hover:text-[var(--color-brand-primary)] hover:bg-white/5 rounded-lg transition-colors"
                                   >
                                      <Pencil size={14} />
                                   </button>
                                   <button 
                                      onClick={async () => {
                                        if (confirm('Bu düzenli işlemi tamamen silmek istediğinize emin misiniz?')) {
                                          await deleteRecurring(rec.id);
                                          toast.success('Tanım silindi');
                                        }
                                      }}
                                      className="p-2 text-white/30 hover:text-red-400 hover:bg-white/5 rounded-lg transition-colors"
                                   >
                                      <Trash2 size={14} />
                                   </button>
                                </div>
                            </td>
                          </tr>
                        );
                     })}
                  </tbody>
               </table>
             </div>
           </div>
         )}
      </div>
    </div>
  );
};
