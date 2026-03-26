import { useState, FormEvent, useEffect, useMemo, useRef } from 'react';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { Plus, Trash2, CalendarDays, ArrowUpRight, ArrowDownRight, RefreshCcw, X, Info, Layers, ChevronDown, Pencil } from 'lucide-react';
import { toast } from 'sonner';

export const RecurringTransactionsPage = () => {
  const { recurring, loading, addRecurring, deleteRecurring, updateRecurring } = useRecurringTransactions();
  
  const [type, setType] = useState<'income' | 'expense'>('income');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly' | 'once'>('monthly');
  const [nextDate, setNextDate] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [isInvestment, setIsInvestment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('');
  const [rates, setRates] = useState<Record<string, number>>({ TRY: 1 });
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false);
  const categoryRef = useRef<HTMLDivElement>(null);
  
  // Debug State
  const [debugError, setDebugError] = useState<string | null>(null);

  // Editing state
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editNextDate, setEditNextDate] = useState('');
  const [editInstallments, setEditInstallments] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());

  // Installment Modal State
  const [selectedInstallmentRec, setSelectedInstallmentRec] = useState<any>(null);
  const [showAllInstallmentsModal, setShowAllInstallmentsModal] = useState(false);

  const generateProjections = () => {
    const items: any[] = [];
    const limit = new Date();
    limit.setFullYear(limit.getFullYear() + 1); // up to 1 year
    
    recurring.forEach(rec => {
      let currentD = new Date(rec.next_date);
      let count = 0;
      while (currentD <= limit) {
        if (rec.total_installments && count >= rec.total_installments) break;
        
        items.push({
           id: `${rec.id}-${count}`,
           date: new Date(currentD),
           category: rec.category,
           amount: rec.amount,
           type: rec.type,
           currency: rec.currency
        });

        count++;
        
        if (rec.frequency === 'monthly') currentD.setMonth(currentD.getMonth() + 1);
        else if (rec.frequency === 'weekly') currentD.setDate(currentD.getDate() + 7);
        else if (rec.frequency === 'yearly') currentD.setFullYear(currentD.getFullYear() + 1);
        else if (rec.frequency === 'once') break;
      }
    });

    return items.sort((a,b) => a.date.getTime() - b.date.getTime()).reduce((acc, item) => {
       const monthYear = item.date.toLocaleDateString('tr-TR', { month: 'long', year: 'numeric' });
       if (!acc[monthYear]) acc[monthYear] = [];
       acc[monthYear].push(item);
       return acc;
    }, {} as Record<string, any[]>);
  };

  // All unique categories from both income and expense recurring transactions
  const allCategories = useMemo(() => {
    const cats = new Set<string>();
    recurring.forEach(r => {
      if (r.category) cats.add(r.category);
    });
    return Array.from(cats).sort((a, b) => a.localeCompare(b, 'tr'));
  }, [recurring]);

  const filteredCategories = useMemo(() => {
    if (!category) return allCategories;
    return allCategories.filter(c => c.toLowerCase().includes(category.toLowerCase()));
  }, [allCategories, category]);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (categoryRef.current && !categoryRef.current.contains(e.target as Node)) {
        setShowCategoryDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    // Set default nextDate to tomorrow
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    setNextDate(tomorrow.toISOString().split('T')[0]);

    // Fetch live currency rates
    fetch('https://open.er-api.com/v6/latest/TRY')
      .then(res => res.json())
      .then(data => {
        if (data && data.rates) {
          setRates(data.rates);
        }
      })
      .catch(e => console.error("Döviz kurları çekilemedi:", e));
  }, []);

  const handleManualSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const parsedAmount = parseFloat(amount);
    
    if (!parsedAmount || !category || !nextDate) return;

    toast.loading(`Düzenli işlem kaydediliyor...`, { id: 'submit-recurring' });

    const { error } = await addRecurring({
      type,
      category,
      amount: parsedAmount,
      currency,
      description,
      frequency,
      next_date: nextDate,
      is_investment: isInvestment,
      total_installments: totalInstallments ? parseInt(totalInstallments) : undefined
    });

    if (!error) {
      toast.success('Düzenli işlem eklendi!', { id: 'submit-recurring' });
      setAmount('');
      setCategory('');
      setDescription('');
      setCurrency('TRY');
      setIsInvestment(false);
      setTotalInstallments('');
      setDebugError(null);
    } else {
      const errMessage = (error as any).message || String(error);
      const errDetails = JSON.stringify(error, null, 2);
      setDebugError(`Hata Mesajı: ${errMessage}\nDetaylar:\n${errDetails}`);
      toast.error('Kayıt başarısız, lütfen sayfadaki hata kutusuna bakın.', { id: 'submit-recurring', duration: 8000 });
      console.error(error);
    }
  };

const today = new Date();
const currentMonth = today.getMonth();
const currentYear = today.getFullYear();

const isCurrentMonth = (dateStr: string) => {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
};

const getAmountInTry = (amt: number, curr: string) => {
  if (!curr || curr === 'TRY' || !rates[curr]) return amt;
  return amt / rates[curr];
};

const totalMonthlyIncome = recurring.filter(r => r.type === 'income').reduce((acc, curr) => {
  const tryValue = getAmountInTry(curr.amount, curr.currency || 'TRY');
  if (curr.frequency === 'monthly') return acc + tryValue;
  if (curr.frequency === 'weekly') return acc + (tryValue * 4);
  if (curr.frequency === 'yearly') return acc + (tryValue / 12);
  if (curr.frequency === 'once' && isCurrentMonth(curr.next_date)) return acc + tryValue;
  return acc;
}, 0);

const totalMonthlyExpense = recurring.filter(r => r.type === 'expense').reduce((acc, curr) => {
  const tryValue = getAmountInTry(curr.amount, curr.currency || 'TRY');
  if (curr.frequency === 'monthly') return acc + tryValue;
  if (curr.frequency === 'weekly') return acc + (tryValue * 4);
  if (curr.frequency === 'yearly') return acc + (tryValue / 12);
  if (curr.frequency === 'once' && isCurrentMonth(curr.next_date)) return acc + tryValue;
  return acc;
}, 0);

  const netMonthly = totalMonthlyIncome - totalMonthlyExpense;

  const freqLabels = {
    monthly: 'Aylık',
    weekly: 'Haftalık',
    yearly: 'Yıllık',
    once: 'Tek Seferlik',
  };

  const filteredRecurring = recurring.filter(r => r.type === type);

  // Group filtered items by category
  const groupedByCategory = useMemo(() => {
    const map = new Map<string, typeof filteredRecurring>();
    filteredRecurring.forEach(rec => {
      const key = rec.category;
      const existing = map.get(key) || [];
      existing.push(rec);
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([categoryName, items]) => ({
        categoryName,
        items,
        totalAmount: items.reduce((sum, r) => sum + getAmountInTry(r.amount, r.currency || 'TRY'), 0),
        itemCount: items.length,
      }))
      .sort((a, b) => b.totalAmount - a.totalAmount);
  }, [filteredRecurring]);

  const toggleCategory = (cat: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat);
      else next.add(cat);
      return next;
    });
  };

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:items-center justify-between gap-2 md:gap-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">Düzenli Gelir / Gider</h1>
      </div>

      {/* Top Tabs */}
      <div className="flex p-1 bg-[var(--color-surface-lowest)] rounded-xl border border-white/5 w-full md:w-[400px] shadow-sm">
        <button
          type="button"
          onClick={() => setType('income')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            type === 'income'
              ? 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/20 shadow-sm'
              : 'text-[var(--color-text-variant)] hover:text-white'
          }`}
        >
          <ArrowUpRight size={18} /> Gelirler
        </button>
        <button
          type="button"
          onClick={() => setType('expense')}
          className={`flex-1 py-3 text-sm font-bold rounded-lg transition-all flex items-center justify-center gap-2 ${
            type === 'expense'
              ? 'bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/20 shadow-sm'
              : 'text-[var(--color-text-variant)] hover:text-white'
          }`}
        >
          <ArrowDownRight size={18} /> Giderler
        </button>
      </div>

      {debugError && (
        <div className="bg-red-900/20 border border-red-500/50 p-4 rounded-xl space-y-2">
          <div className="flex justify-between items-center">
             <h3 className="text-red-400 font-bold flex items-center gap-2">Teknik Hata Meydana Geldi</h3>
             <button onClick={() => setDebugError(null)} className="text-red-300 hover:text-white text-xs">Gizle</button>
          </div>
          <p className="text-red-200/80 text-xs mb-2">Lütfen aşağıdaki hata metnini kopyalayıp asistana gönderin:</p>
          <textarea 
            readOnly 
            value={debugError} 
            className="w-full h-32 bg-black/50 text-red-300 p-3 rounded-lg border border-red-500/30 text-xs font-mono outline-none"
            onClick={(e) => (e.target as HTMLTextAreaElement).select()}
          />
        </div>
      )}
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8">
        <div className="lg:col-span-1 space-y-6">
          <div className="bento-card">
            <h3 className="text-sm font-bold text-white mb-5 flex items-center gap-2 uppercase tracking-wide font-mono">
              <Plus size={18} className={type === 'income' ? 'text-[var(--color-brand-primary)]' : 'text-[#ffb4ab]'} /> 
              {type === 'income' ? 'Yeni Düzenli Gelir' : 'Yeni Düzenli Gider'}
            </h3>
            <form onSubmit={handleManualSubmit} className="space-y-5">
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Sıklık</label>
                  <select value={frequency} onChange={e => setFrequency(e.target.value as any)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors appearance-none">
                    <option value="monthly">Her Ay Düzenli</option>
                    <option value="weekly">Her Hafta</option>
                    <option value="yearly">Her Yıl</option>
                    <option value="once">Sadece Bu Ay (Tek Seferlik)</option>
                  </select>
                </div>
                <div>
                   <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">
                    Süre / Taksit <span className="text-[10px] opacity-50 normal-case tracking-normal">(Opsiyonel)</span>
                  </label>
                  <input type="number" min="1" value={totalInstallments} onChange={e => setTotalInstallments(e.target.value)} placeholder="Örn: 12" className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                 <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Miktar ve Birim</label>
                  <div className="flex gap-2">
                    <input type="number" step="0.01" required value={amount} onChange={e => setAmount(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
                    <select value={currency} onChange={e => setCurrency(e.target.value)} className="w-24 px-2 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors appearance-none text-center">
                      <option value="TRY">TRY</option>
                      <option value="USD">USD</option>
                      <option value="EUR">EUR</option>
                      <option value="GBP">GBP</option>
                    </select>
                  </div>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Sonraki Tarih</label>
                  <input type="date" required value={nextDate} onChange={e => setNextDate(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors [color-scheme:dark]" />
                </div>
              </div>
              
              <div ref={categoryRef} className="relative">
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Kategori</label>
                <div className="relative">
                  <input 
                    type="text" 
                    required 
                    value={category} 
                    onChange={e => { setCategory(e.target.value); setShowCategoryDropdown(true); }}
                    onFocus={() => setShowCategoryDropdown(true)}
                    placeholder={type === 'income' ? 'Örn: Maaş, Kira Geliri...' : 'Örn: Kira, Fatura...'} 
                    className="w-full px-4 py-2.5 pr-10 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" 
                  />
                  <button 
                    type="button"
                    onClick={() => setShowCategoryDropdown(!showCategoryDropdown)}
                    className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-[var(--color-text-variant)] hover:text-white"
                  >
                    <ChevronDown size={16} className={`transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`} />
                  </button>
                </div>
                {showCategoryDropdown && filteredCategories.length > 0 && (
                  <div className="absolute z-20 w-full mt-1 bg-[var(--color-surface-container)] border border-white/10 rounded-xl shadow-2xl overflow-hidden max-h-[200px] overflow-y-auto">
                    {filteredCategories.map(cat => (
                      <button
                        key={cat}
                        type="button"
                        onClick={() => { setCategory(cat); setShowCategoryDropdown(false); }}
                        className={`w-full text-left px-4 py-2.5 text-sm hover:bg-white/5 transition-colors flex items-center justify-between ${
                          category === cat ? 'text-[var(--color-brand-primary)] bg-[var(--color-brand-primary)]/5 font-bold' : 'text-white'
                        }`}
                      >
                        <span>{cat}</span>
                        {recurring.some(r => r.category === cat && r.type === 'income') && recurring.some(r => r.category === cat && r.type === 'expense') ? (
                          <span className="text-[9px] font-mono text-[var(--color-text-variant)]">↑↓</span>
                        ) : recurring.some(r => r.category === cat && r.type === 'income') ? (
                          <span className="text-[9px] font-mono text-[#4edeb3]">gelir</span>
                        ) : (
                          <span className="text-[9px] font-mono text-[#ff7886]">gider</span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Açıklama (Opsiyonel)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>

              {type === 'expense' && (
                <div className="flex items-center gap-3 p-3 bg-[var(--color-surface-lowest)]/50 rounded-xl border border-[var(--color-brand-primary)]/10">
                   <input 
                     type="checkbox" 
                     id="isInvestment" 
                     checked={isInvestment} 
                     onChange={(e) => setIsInvestment(e.target.checked)} 
                     className="w-5 h-5 accent-[var(--color-brand-primary)] bg-[var(--color-surface-lowest)] border-white/20 rounded"
                   />
                   <label htmlFor="isInvestment" className="text-sm font-medium text-white cursor-pointer select-none">
                     Bu bir <span className="text-[var(--color-brand-primary)] font-bold">Birikim / Yatırım</span> mı?<br/>
                     <span className="text-[10px] text-[var(--color-text-variant)] opacity-80 leading-tight block mt-0.5">İşaretlerseniz, "Yatırımlar" sekmesinde otomatik birikir.</span>
                   </label>
                </div>
              )}

              <button type="submit" className={`w-full rounded-xl py-3 font-bold text-[#002113] transition-colors ${type === 'income' ? 'bg-[#4edeb3] hover:bg-[#3bc49c]' : 'bg-[#ffb4ab] hover:bg-[#e09e95]'}`}>
                {type === 'income' ? 'Geliri Ekle' : 'Gideri Ekle'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
          {/* Stats Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 sm:gap-6">
            <div className="bento-card">
              <p className="text-[var(--color-text-variant)] font-bold text-[10px] uppercase tracking-widest font-mono mb-2">Aylık Sabit Gelir</p>
              <h2 className="text-xl sm:text-2xl font-black text-[#4edeb3] font-display tracking-tight mt-1">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalMonthlyIncome)}
              </h2>
            </div>
            <div className="bento-card">
              <p className="text-[var(--color-text-variant)] font-bold text-[10px] uppercase tracking-widest font-mono mb-2">Aylık Sabit Gider</p>
              <h2 className="text-xl sm:text-2xl font-black text-[#ffb4ab] font-display tracking-tight mt-1">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(totalMonthlyExpense)}
              </h2>
            </div>
            <div className="bento-card border border-[var(--color-brand-secondary)]/20 shadow-[0_10px_30px_rgba(173,198,255,0.05)]">
              <p className="text-[var(--color-brand-secondary)] font-bold text-[10px] uppercase tracking-widest font-mono mb-2">Aylık Net Sabit Bakiye</p>
              <h2 className="text-xl sm:text-2xl font-black text-white font-display tracking-tight mt-1">
                {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(netMonthly)}
              </h2>
            </div>
          </div>

          <div className="space-y-3">
            {loading ? (
              <div className="bento-card p-12 text-center text-[var(--color-text-variant)] font-mono animate-pulse">Yükleniyor...</div>
            ) : groupedByCategory.length === 0 ? (
              <div className="bento-card p-12 text-center text-[var(--color-text-variant)] flex flex-col items-center gap-3">
                <CalendarDays size={32} className="opacity-50" />
                <p>Henüz kayıtlı {type === 'income' ? 'gelir' : 'gider'} bulunmuyor.</p>
              </div>
            ) : (
              <>
                {groupedByCategory.map(group => {
                  const isExpanded = expandedCategories.has(group.categoryName);
                  const colorClass = type === 'income' ? '#4edeb3' : '#ffb4ab';
                  
                  return (
                    <div key={group.categoryName} className="bento-card p-0 overflow-hidden transition-all">
                      <button
                        onClick={() => toggleCategory(group.categoryName)}
                        className="w-full flex items-center justify-between p-4 md:p-5 hover:bg-white/[0.02] transition-colors text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${colorClass}15`, color: colorClass }}
                          >
                            {type === 'income' ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
                          </div>
                          <div>
                            <h4 className="font-bold text-white text-sm font-display">{group.categoryName}</h4>
                            <p className="text-[10px] text-[var(--color-text-variant)] font-mono mt-0.5">
                              {group.itemCount} kayıt
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3">
                          <p className="font-black font-mono text-base" style={{ color: colorClass }}>
                            {type === 'income' ? '+' : '-'}
                            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(group.totalAmount)}
                          </p>
                          <ChevronDown size={16} className={`text-[var(--color-text-variant)] transition-transform ${isExpanded ? 'rotate-180' : ''}`} />
                        </div>
                      </button>

                      {isExpanded && (
                        <div className="border-t border-white/5">
                          {group.items.map((rec) => {
                            const isEditing = editingId === rec.id;
                            if (isEditing) {
                              return (
                                <div key={rec.id} className="p-4 bg-[var(--color-brand-primary)]/5 border-l-2 border-[var(--color-brand-primary)]">
                                  <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-3">
                                      <div>
                                        <label className="block text-[9px] font-bold text-[var(--color-text-variant)] uppercase mb-1">Miktar</label>
                                        <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)}
                                          className="w-full px-3 py-2 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-lg text-sm" />
                                      </div>
                                      <div>
                                        <label className="block text-[9px] font-bold text-[var(--color-text-variant)] uppercase mb-1">Tarih</label>
                                        <input type="date" value={editNextDate} onChange={e => setEditNextDate(e.target.value)}
                                          className="w-full px-3 py-2 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-lg text-sm" />
                                      </div>
                                    </div>
                                    <div>
                                      <label className="block text-[9px] font-bold text-[var(--color-text-variant)] uppercase mb-1">Açıklama</label>
                                      <input type="text" value={editDescription} onChange={e => setEditDescription(e.target.value)}
                                        className="w-full px-3 py-2 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-lg text-sm" />
                                    </div>
                                    <div className="flex gap-2">
                                      <button onClick={async () => {
                                        const updates: any = {};
                                        if (parseFloat(editAmount) !== rec.amount) updates.amount = parseFloat(editAmount);
                                        if (editNextDate !== rec.next_date) updates.next_date = editNextDate;
                                        if (editDescription !== rec.description) updates.description = editDescription;
                                        await updateRecurring(rec.id, updates);
                                        setEditingId(null);
                                      }} className="flex-1 py-2 bg-[var(--color-brand-primary)] text-black font-bold rounded-lg text-sm">Kaydet</button>
                                      <button onClick={() => setEditingId(null)} className="px-4 py-2 bg-white/5 text-white rounded-lg text-sm">İptal</button>
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return (
                              <div key={rec.id} className="flex items-center justify-between p-3 md:p-4 group hover:bg-white/[0.02] border-b border-white/[0.03] last:border-0 transition-colors">
                                <div className="flex-1 min-w-0">
                                  <div className="flex items-center gap-2">
                                    <span className="text-sm text-white font-medium">{rec.description || 'Açıklama yok'}</span>
                                    <span className="text-[9px] text-[var(--color-text-variant)] border border-white/10 px-1.5 py-0.5 rounded font-mono bg-white/5">{freqLabels[rec.frequency]}</span>
                                  </div>
                                  <p className="text-[10px] text-[var(--color-text-variant)] font-mono mt-1">{new Date(rec.next_date).toLocaleDateString('tr-TR')}</p>
                                </div>
                                <div className="flex items-center gap-2">
                                  <p className="font-bold font-mono text-sm" style={{ color: colorClass }}>
                                    {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rec.amount)}
                                  </p>
                                  <button onClick={() => {
                                    setEditingId(rec.id);
                                    setEditAmount(String(rec.amount));
                                    setEditNextDate(rec.next_date);
                                    setEditDescription(rec.description || '');
                                  }} className="p-1.5 text-[var(--color-text-variant)] hover:text-white opacity-0 group-hover:opacity-100"><Pencil size={13} /></button>
                                  <button onClick={() => deleteRecurring(rec.id)} className="p-1.5 text-[var(--color-text-variant)] hover:text-red-400 opacity-0 group-hover:opacity-100"><Trash2 size={13} /></button>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}

                <div className="bento-card flex items-center justify-between">
                  <span className="text-sm font-bold text-[var(--color-text-variant)]">Toplam ({groupedByCategory.length} kategori)</span>
                  <span className="font-black font-mono text-lg" style={{ color: type === 'income' ? '#4edeb3' : '#ffb4ab' }}>
                    {type === 'income' ? '+' : '-'} {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(groupedByCategory.reduce((sum, g) => sum + g.totalAmount, 0))}
                  </span>
                </div>

                <button onClick={() => setShowAllInstallmentsModal(true)} className="w-full py-3 bg-white/5 hover:bg-white/10 text-white font-bold rounded-xl transition-colors flex items-center justify-center gap-2 border border-white/10">
                  <Layers size={18} /> Tüm Gelecek İşlemler Özeti
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Installment Detail Modal */}
      {selectedInstallmentRec && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm" onClick={() => setSelectedInstallmentRec(null)}>
          <div className="bg-[var(--color-surface-container)] rounded-2xl w-full max-w-sm border border-white/10 shadow-2xl overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className={`p-4 sm:p-5 flex justify-between items-center border-b border-white/5 ${selectedInstallmentRec.type === 'income' ? 'bg-[#4edeb3]/10' : 'bg-[#ffb4ab]/10'}`}>
              <h3 className="font-bold text-white flex items-center gap-2">
                {selectedInstallmentRec.category} - Taksit Detayı
              </h3>
              <button onClick={() => setSelectedInstallmentRec(null)} className="text-[var(--color-text-variant)] hover:text-white transition-colors">
                <X size={20} />
              </button>
            </div>
            
            <div className="p-4 sm:p-5 space-y-4">
               <div className="grid grid-cols-2 gap-4">
                 <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <p className="text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider font-mono mb-1">Taksit Tutarı</p>
                   <p className={`font-black font-mono text-lg ${selectedInstallmentRec.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ffb4ab]'}`}>
                     {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: selectedInstallmentRec.currency || 'TRY' }).format(selectedInstallmentRec.amount)}
                   </p>
                 </div>
                 <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <p className="text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider font-mono mb-1">Toplam Tutar</p>
                   <p className={`font-black font-mono text-lg ${selectedInstallmentRec.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ffb4ab]'}`}>
                     {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: selectedInstallmentRec.currency || 'TRY' }).format(selectedInstallmentRec.amount * (selectedInstallmentRec.total_installments || 1))}
                   </p>
                 </div>
                 <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <p className="text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider font-mono mb-1">Sıklık</p>
                   <p className="font-bold text-white">{freqLabels[selectedInstallmentRec.frequency as keyof typeof freqLabels]}</p>
                 </div>
                 <div className="bg-white/5 p-3 rounded-xl border border-white/5">
                   <p className="text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider font-mono mb-1">Toplam Süre</p>
                   <p className="font-bold text-white">{selectedInstallmentRec.total_installments} Periyot</p>
                 </div>
               </div>
               
               <div className="bg-white/5 p-3 rounded-xl border border-[var(--color-brand-secondary)]/20 shadow-[0_5px_15px_rgba(173,198,255,0.05)] text-center">
                 <p className="text-[10px] text-[var(--color-brand-secondary)] uppercase tracking-wider font-mono mb-1">Sıradaki Ödeme Tarihi</p>
                 <p className="font-bold text-white">{new Date(selectedInstallmentRec.next_date).toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })}</p>
               </div>
            </div>
          </div>
        </div>
      )}

      {/* All Installments / Projections Modal */}
      {showAllInstallmentsModal && (() => {
         const groupedProjections = generateProjections();
         return (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in" onClick={() => setShowAllInstallmentsModal(false)}>
              <div className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-2xl max-h-[85vh] border border-white/10 shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95" onClick={e => e.stopPropagation()}>
                <div className="p-5 flex justify-between items-center border-b border-white/5 bg-[var(--color-surface-lowest)] shrink-0">
                  <h3 className="font-bold text-white flex items-center gap-2">
                    <Layers size={20} className="text-[var(--color-brand-primary)]" /> Tüm Gelecek Taksit ve İşlemler
                  </h3>
                  <button onClick={() => setShowAllInstallmentsModal(false)} className="text-[var(--color-text-variant)] hover:text-white transition-colors bg-white/5 p-1.5 rounded-lg hover:bg-white/10">
                    <X size={20} />
                  </button>
                </div>
                
                <div className="p-5 overflow-y-auto space-y-8 flex-1">
                  {Object.keys(groupedProjections).length === 0 ? (
                     <div className="flex flex-col items-center justify-center py-12 text-[var(--color-text-variant)] gap-3">
                        <CalendarDays size={32} className="opacity-50" />
                        <p>Gelecek 1 yıl için planlı hiçbir işleminiz bulunmuyor.</p>
                     </div>
                  ) : (
                     Object.entries(groupedProjections).map(([monthYear, items]: [string, any[]]) => {
                       const totalIncome = items.filter(i => i.type === 'income').reduce((acc, curr) => acc + getAmountInTry(curr.amount, curr.currency), 0);
                       const totalExpense = items.filter(i => i.type === 'expense').reduce((acc, curr) => acc + getAmountInTry(curr.amount, curr.currency), 0);
                       const net = totalIncome - totalExpense;

                       return (
                         <div key={monthYear} className="space-y-4">
                           <div className="flex items-center justify-between border-b border-[var(--color-brand-primary)]/20 pb-2">
                             <h4 className="font-bold text-white text-lg font-display tracking-tight">{monthYear}</h4>
                             <div className="text-right">
                               <p className="text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider font-mono mb-0.5">O Ayki Net Sabit</p>
                               <p className={`font-mono text-sm font-bold ${net >= 0 ? 'text-[#4edeb3]' : 'text-[#ffb4ab]'}`}>
                                 {net >= 0 ? '+' : ''}{new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(net)}
                               </p>
                             </div>
                           </div>
                           <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              {items.map(item => (
                                 <div key={item.id} className="bg-[var(--color-surface-lowest)] border border-white/5 hover:border-white/10 p-3.5 rounded-2xl flex justify-between items-center transition-colors">
                                   <div>
                                      <p className="font-bold text-sm text-white mb-0.5">{item.category}</p>
                                      <p className="text-[10px] text-[var(--color-text-variant)] font-mono flex items-center gap-1.5">
                                        {item.date.toLocaleDateString('tr-TR', { day: 'numeric', month: 'long' })}
                                        <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                        {item.currency}
                                      </p>
                                   </div>
                                   <p className={`font-black font-mono text-sm sm:text-base ${item.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ffb4ab]'}`}>
                                      {item.type === 'income' ? '+' : '-'}
                                      {new Intl.NumberFormat('tr-TR', { style: 'decimal', minimumFractionDigits: 2 }).format(item.amount)}
                                   </p>
                                 </div>
                              ))}
                           </div>
                         </div>
                       );
                     })
                  )}
                </div>
              </div>
            </div>
         );
      })()}
    </div>
  );
};
