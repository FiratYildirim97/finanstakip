import { useState, FormEvent, useEffect } from 'react';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { Plus, Trash2, CalendarDays, ArrowUpRight, ArrowDownRight, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

export const RecurringTransactionsPage = () => {
  const { recurring, loading, addRecurring, deleteRecurring } = useRecurringTransactions();
  
  const [type, setType] = useState<'income' | 'expense'>('expense');
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [description, setDescription] = useState('');
  const [frequency, setFrequency] = useState<'monthly' | 'weekly' | 'yearly' | 'once'>('monthly');
  const [nextDate, setNextDate] = useState('');
  const [currency, setCurrency] = useState('TRY');
  const [isInvestment, setIsInvestment] = useState(false);
  const [totalInstallments, setTotalInstallments] = useState('');
  const [rates, setRates] = useState<Record<string, number>>({ TRY: 1 });
  
  // Debug State
  const [debugError, setDebugError] = useState<string | null>(null);

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

  return (
    <div className="space-y-6 md:space-y-8">
      <div className="flex flex-col md:flex-row space-y-4 md:space-y-0 md:items-center justify-between gap-2 md:gap-4">
        <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">Düzenli Gelir / Gider</h1>
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
              <Plus size={18} className="text-[var(--color-brand-secondary)]" /> Yeni Düzenli İşlem
            </h3>
            <form onSubmit={handleManualSubmit} className="space-y-5">
              
              <div className="flex p-1 bg-[var(--color-surface-lowest)] rounded-xl border border-white/5">
                <button
                  type="button"
                  onClick={() => setType('expense')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    type === 'expense'
                      ? 'bg-[#ffb4ab]/10 text-[#ffb4ab] border border-[#ffb4ab]/20'
                      : 'text-[var(--color-text-variant)] hover:text-white'
                  }`}
                >
                  <ArrowDownRight size={16} className="inline mr-1" /> Düzenli Gider
                </button>
                <button
                  type="button"
                  onClick={() => setType('income')}
                  className={`flex-1 py-2 text-sm font-bold rounded-lg transition-all ${
                    type === 'income'
                      ? 'bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] border border-[var(--color-brand-primary)]/20'
                      : 'text-[var(--color-text-variant)] hover:text-white'
                  }`}
                >
                  <ArrowUpRight size={16} className="inline mr-1" /> Düzenli Gelir
                </button>
              </div>

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
              
              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Kategori</label>
                <input type="text" required value={category} onChange={e => setCategory(e.target.value)} placeholder="Örn: Kira, Maaş, Elektrik..." className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>

              <div>
                <label className="block text-[10px] font-bold text-[var(--color-text-variant)] uppercase tracking-widest mb-1.5 font-mono">Açıklama (Opsiyonel)</label>
                <input type="text" value={description} onChange={e => setDescription(e.target.value)} className="w-full px-4 py-2.5 bg-[var(--color-surface-lowest)] text-white border border-white/10 rounded-xl outline-none focus:border-[var(--color-brand-primary)] transition-colors" />
              </div>

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

              <button type="submit" className={`w-full rounded-xl py-3 font-bold text-[#002113] ${type === 'income' ? 'bg-[#4edeb3] hover:bg-[#3bc49c]' : 'bg-[#ffb4ab] hover:bg-[#e09e95]'}`}>
                {type === 'income' ? 'Geliri Ekle' : 'Gideri Ekle'}
              </button>
            </form>
          </div>
        </div>

        <div className="lg:col-span-2 space-y-6">
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

          <div className="bento-card p-0 overflow-hidden flex flex-col h-full">
            <div className="px-6 py-5 border-b border-white/5 bg-[var(--color-surface-container)]">
              <h3 className="font-bold text-white uppercase tracking-wider text-sm font-mono">Tüm Düzenli İşlemleriniz</h3>
            </div>
            
            {loading ? (
               <div className="p-12 text-center text-[var(--color-text-variant)] font-mono animate-pulse">Yükleniyor...</div>
            ) : recurring.length === 0 ? (
               <div className="p-12 text-center text-[var(--color-text-variant)] flex flex-col items-center gap-3">
                 <CalendarDays size={32} className="opacity-50" />
                 <p>Henüz düzenli bir işlem girmediniz.</p>
               </div>
            ) : (
              <div className="max-h-[600px] overflow-y-auto">
                <ul className="divide-y divide-white/5">
                  {recurring.map((rec, idx) => (
                    <li key={rec.id} className={`p-4 md:p-5 hover:bg-[var(--color-surface-container)] transition-colors flex flex-col sm:flex-row sm:items-center justify-between gap-4 group ${idx % 2 === 0 ? 'bg-[var(--color-surface-lowest)]' : 'bg-transparent'}`}>
                      <div className="flex items-center gap-4 md:gap-5">
                        <div className={`p-3 rounded-2xl shrink-0 ${rec.type === 'income' ? 'bg-[#4edeb3]/10 text-[#4edeb3] shadow-[inset_0_0_10px_rgba(78,222,179,0.1)]' : 'bg-[#ffb4ab]/10 text-[#ffb4ab] shadow-[inset_0_0_10px_rgba(255,180,171,0.1)]'}`}>
                          <RefreshCcw size={24} strokeWidth={2.5}/>
                        </div>
                        <div>
                          <p className="font-bold text-white text-base font-display">{rec.category} <span className="text-[10px] text-[var(--color-text-variant)] border border-white/10 px-2 py-0.5 rounded-md ml-2 font-mono sm:inline-block bg-white/5">{freqLabels[rec.frequency]} {rec.total_installments ? `(${rec.total_installments} Periyot)` : ''}</span></p>
                          <p className="text-xs text-[var(--color-text-variant)] mt-1 font-mono">{rec.frequency === 'once' ? 'Tarih' : 'Sıradaki'}: <strong className="text-white">{new Date(rec.next_date).toLocaleDateString('tr-TR')}</strong> {rec.description && `• ${rec.description}`}</p>
                        </div>
                      </div>
                      <div className="text-left sm:text-right flex items-center justify-between sm:justify-end gap-5 w-full sm:w-auto mt-2 sm:mt-0">
                        <div>
                          <p className={`font-black font-mono text-lg text-right ${rec.type === 'income' ? 'text-[#4edeb3]' : 'text-[#ffb4ab]'}`}>
                            {rec.type === 'income' ? '+' : '-'}
                            {rec.currency && rec.currency !== 'TRY' ? (
                               new Intl.NumberFormat('en-US', { style: 'currency', currency: rec.currency }).format(rec.amount)
                            ) : (
                               new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(rec.amount)
                            )}
                          </p>
                          {rec.currency && rec.currency !== 'TRY' && (
                            <p className="text-[10px] text-[var(--color-text-variant)] text-right mt-0.5 font-mono opacity-80">
                              ≈ {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(getAmountInTry(rec.amount, rec.currency))}
                            </p>
                          )}
                        </div>
                        <button 
                          onClick={() => deleteRecurring(rec.id)}
                          className="p-2.5 text-[var(--color-text-variant)] hover:text-[#ff7886] hover:bg-[#ffb4ab]/10 rounded-xl transition-all sm:opacity-0 group-hover:opacity-100 focus:opacity-100"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
