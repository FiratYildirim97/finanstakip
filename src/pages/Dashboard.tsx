import { useState } from 'react';
import { useNetWorth } from '../hooks/useNetWorth';
import { useTransactions } from '../hooks/useTransactions';
import { useInvestments } from '../hooks/useInvestments';
import { useVirtualSavings } from '../hooks/useVirtualSavings';
import { useBankAccounts } from '../hooks/useBankAccounts';
import { NetWorthLineChart } from '../components/charts/NetWorthLineChart';
import { ExpensePieChart } from '../components/charts/ExpensePieChart';
import { advisorAgent } from '../lib/agents';
import { Wallet, TrendingUp, Sparkles, RefreshCcw, ArrowDownRight, ArrowUpRight, Clock, Landmark, Activity, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';
import { BankAccount } from '../types';

export const Dashboard = () => {
  const { currentNetWorth, history, saveTodayNetWorth } = useNetWorth();
  const { transactions } = useTransactions();
  const { investments } = useInvestments();
  const { combinedSavings, totalVirtualValue } = useVirtualSavings();
  const { accounts } = useBankAccounts();
  
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [selectedSummary, setSelectedSummary] = useState<'cash' | 'investments' | 'savings' | null>(null);

  // --- Calculations ---

  // Net Worth Breakdown
  const cashFlow = transactions.reduce((acc, curr) => curr.type === 'income' ? acc + curr.amount : acc - curr.amount, 0);
  const bankCash = accounts.reduce((acc, a) => acc + a.balance, 0);
  const cash = cashFlow + bankCash;
  
  const portfolioValue = investments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);
  
  // Current Month Cash Flow
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  
  const currentMonthTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const currentMonthIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const currentMonthExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);

  // Expense Categories (Current Month)
  const expenseData = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => {
      const existing = acc.find(item => item.name === curr.category);
      if (existing) {
        existing.value += curr.amount;
      } else {
        acc.push({ name: curr.category, value: curr.amount });
      }
      return acc;
    }, [] as { name: string; value: number }[])
    .sort((a, b) => b.value - a.value)
    .slice(0, 5);

  // Recent Transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 5);

  const handleGetAdvice = async () => {
    setLoadingAdvice(true);
    setAdvice(null);
    try {
      // Just pass the current month to focus the AI on recent activity
      const response = await advisorAgent.getAdvice(currentMonthTransactions, [], []); 
      setAdvice(response);
      toast.success("AI Finansal analizi tamamlandı");
    } catch (error) {
      toast.error("AI tavsiyesi alınırken bir hata oluştu");
    } finally {
      setLoadingAdvice(false);
    }
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);

  return (
    <div className="space-y-6 md:space-y-8 pb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">Genel Bakış</h1>
          <p className="text-[var(--color-text-variant)] text-sm mt-1">Hoş geldiniz, işte finansal durumunuzun özeti.</p>
        </div>
        <button 
          onClick={saveTodayNetWorth}
          title="Bugünün tüm değerlerini geçmişe bir veri noktası olarak kaydeder."
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-surface-variant)]/40 border border-white/5 text-[var(--color-text-main)] rounded-full hover:bg-[var(--color-surface-variant)]/80 font-medium transition backdrop-blur-md w-full sm:w-auto hover:text-white"
        >
          <RefreshCcw size={16} /> Durumu Kaydet
        </button>
      </div>

      {/* Hero Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-6">
        
        {/* Main Net Worth Card */}
        <div className="lg:col-span-8 primary-gradient-btn rounded-3xl p-6 md:p-8 relative overflow-hidden flex flex-col justify-between min-h-[220px] shadow-[0_10px_40px_rgba(78,222,163,0.15)] group">
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700 pointer-events-none"></div>
          
          <div className="relative z-10 flex flex-col h-full justify-between">
            <div className="flex items-start justify-between">
              <div>
                 <p className="text-black/60 font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Net Varlık</p>
                 <h2 className="text-4xl lg:text-5xl font-black text-black font-display tracking-tight">
                   {formatMoney(currentNetWorth || 0)}
                 </h2>
              </div>
              <div className="p-3 bg-black/5 rounded-2xl">
                 <Wallet size={32} className="text-black/70" />
              </div>
            </div>

            {/* Breakdown Mini Cards */}
            <div className="grid grid-cols-3 gap-2 mt-8">
               <div 
                  onClick={() => setSelectedSummary('cash')}
                  className="bg-black/5 rounded-xl p-3 backdrop-blur-sm border border-black/5 cursor-pointer hover:bg-black/10 transition-colors"
                >
                  <p className="text-[10px] text-black/70 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><CreditCard size={12}/> Toplam Nakit</p>
                  <p className="font-bold text-black font-mono text-sm sm:text-base">{formatMoney(cash)}</p>
               </div>
               <div 
                  onClick={() => setSelectedSummary('investments')}
                  className="bg-black/5 rounded-xl p-3 backdrop-blur-sm border border-black/5 cursor-pointer hover:bg-black/10 transition-colors"
                >
                  <p className="text-[10px] text-black/70 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Activity size={12}/> Fon/Borsa</p>
                  <p className="font-bold text-black font-mono text-sm sm:text-base">{formatMoney(portfolioValue)}</p>
               </div>
               <div 
                  onClick={() => setSelectedSummary('savings')}
                  className="bg-black/5 rounded-xl p-3 backdrop-blur-sm border border-black/5 cursor-pointer hover:bg-black/10 transition-colors"
                >
                  <p className="text-[10px] text-black/70 uppercase font-bold tracking-wider mb-1 flex items-center gap-1"><Landmark size={12}/> Birikim & BES</p>
                  <p className="font-bold text-black font-mono text-sm sm:text-base">{formatMoney(totalVirtualValue)}</p>
               </div>
            </div>
          </div>
        </div>

        {/* AI Advisor Trigger */}
        <div className="lg:col-span-4 bg-[var(--color-brand-primary-container)]/10 rounded-3xl p-6 border border-[var(--color-brand-primary)]/20 shadow-[inset_0_1px_0_0_rgba(78,222,163,0.1)] flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
               <div className="p-2.5 bg-[var(--color-brand-primary)]/10 rounded-xl text-[var(--color-brand-primary)]">
                 <Sparkles size={24} />
               </div>
               <span className="text-[10px] uppercase tracking-widest font-bold text-[var(--color-brand-primary)]/70 font-mono">Yapay Zeka</span>
            </div>
            <h3 className="text-xl font-bold text-white font-display mb-2">Finansal Danışman</h3>
            <p className="text-sm text-[var(--color-text-variant)] leading-relaxed">
              Bu aya ait gelir/gider hareketlerinize ve genel gidişatınıza göre kişiselleştirilmiş AI analizi alın.
            </p>
          </div>
          <button 
            onClick={handleGetAdvice}
            disabled={loadingAdvice}
            className="mt-6 w-full py-3 bg-white/5 hover:bg-[var(--color-brand-primary)] hover:text-black border border-white/10 hover:border-transparent rounded-xl flex items-center justify-center gap-2 font-bold transition-all"
          >
            {loadingAdvice ? (
              <><RefreshCcw size={16} className="animate-spin" /> Analiz Ediliyor...</>
            ) : 'Rapor Çıkart'}
          </button>
        </div>
      </div>

      {/* AI Advice Result Banner */}
      {advice && (
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-[var(--color-brand-primary)]/30 shadow-[0_10px_40px_rgba(78,222,163,0.1)] animate-in fade-in slide-in-from-top-4">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--color-brand-primary)]"></div>
          <div className="flex items-center justify-between mb-4">
             <h3 className="text-lg font-bold text-white flex items-center gap-2 font-display">
               <Sparkles size={20} className="text-[var(--color-brand-primary)]" /> AI Finansal Öngörü
             </h3>
             <button onClick={() => setAdvice(null)} className="text-[var(--color-text-variant)] hover:text-white text-sm font-medium">Kapat</button>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-[#bbcabf] whitespace-pre-wrap font-sans leading-relaxed">
            {advice}
          </div>
        </div>
      )}

      {/* Two Column Layout: Cash Flow & Recent Transactions */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 md:gap-6">
         
         {/* Monthly Cash Flow Overview */}
         <div className="bento-card flex flex-col">
            <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-6">Bu Ayın Özeti ({new Date().toLocaleString('tr-TR', { month: 'long' })})</h3>
            
            <div className="grid grid-cols-2 gap-4 mb-6">
               <div className="bg-[var(--color-surface-lowest)] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 rounded-full bg-[#4edea3]/10 text-[#4edea3] flex items-center justify-center mb-3">
                     <ArrowUpRight size={20} />
                  </div>
                  <p className="text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider font-bold mb-1">Gelen Para</p>
                  <p className="font-bold text-white font-mono text-lg">{formatMoney(currentMonthIncome)}</p>
               </div>
               <div className="bg-[var(--color-surface-lowest)] border border-white/5 rounded-2xl p-4 flex flex-col items-center justify-center text-center">
                  <div className="w-10 h-10 rounded-full bg-[#ff7886]/10 text-[#ff7886] flex items-center justify-center mb-3">
                     <ArrowDownRight size={20} />
                  </div>
                  <p className="text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider font-bold mb-1">Çıkan Para</p>
                  <p className="font-bold text-white font-mono text-lg">{formatMoney(currentMonthExpense)}</p>
               </div>
            </div>

            <div className="mt-auto">
               <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-4 text-center">Bu Ay Nereye Harcadınız?</h3>
               {expenseData.length > 0 ? (
                  <ExpensePieChart data={expenseData} colors={['#4edea3', '#adc6ff', '#ffb2b7', '#ff7886', '#0566d9']} />
               ) : (
                  <p className="text-center text-white/40 text-sm py-4">Bu ay henüz harcama kaydı yok.</p>
               )}
            </div>
         </div>

         {/* Needs a recent transactions widget */}
         <div className="bento-card flex flex-col">
            <div className="flex items-center justify-between mb-6">
               <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono">Son Hareketler</h3>
               <div className="flex items-center gap-1 text-[var(--color-text-variant)] text-[10px] uppercase font-bold tracking-widest">
                  <Clock size={12} /> Yakın Zaman
               </div>
            </div>

            {recentTransactions.length > 0 ? (
               <ul className="space-y-3 mt-auto">
                  {recentTransactions.map(t => (
                     <li key={t.id} className="flex items-center justify-between p-3 sm:p-4 bg-[var(--color-surface-lowest)] border border-white/5 hover:border-white/10 rounded-2xl transition-all group">
                        <div className="flex items-center gap-3">
                           <div className={`p-2.5 rounded-xl shrink-0 ${t.type === 'income' ? 'bg-[#4edea3]/10 text-[#4edea3]' : 'bg-[#ff7886]/10 text-[#ff7886]'}`}>
                              {t.type === 'income' ? <ArrowUpRight size={18} /> : <ArrowDownRight size={18} />}
                           </div>
                           <div>
                              <p className="font-bold text-white text-sm sm:text-base">{t.title}</p>
                              <p className="text-xs text-[var(--color-text-variant)] flex items-center gap-2 mt-0.5">
                                 <span className="uppercase tracking-wider font-mono opacity-80 text-[10px]">{t.category}</span>
                                 <span className="w-1 h-1 rounded-full bg-white/20"></span>
                                 <span>{formatDistanceToNow(new Date(t.date), { addSuffix: true, locale: tr })}</span>
                              </p>
                           </div>
                        </div>
                        <div className={`font-black font-mono text-sm sm:text-base shrink-0 ${
                           t.type === 'income' ? 'text-[#4edea3]' : 'text-white'
                        }`}>
                           {t.type === 'income' ? '+' : '-'}{formatMoney(t.amount)}
                        </div>
                     </li>
                  ))}
               </ul>
            ) : (
               <div className="flex flex-col items-center justify-center flex-1 h-[200px] text-[var(--color-text-variant)] gap-3">
                  <TrendingUp size={32} className="opacity-40" />
                  <p className="text-sm">Henüz bir finansal işlem kaydı yok.</p>
               </div>
            )}
         </div>
      </div>

      {/* Expanded Chart */}
      <div className="bento-card">
        <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-6">Net Varlık Gelişim Geçmişiniz</h3>
        {history && history.length > 1 ? (
           <NetWorthLineChart history={history} />
        ) : (
           <div className="flex flex-col items-center justify-center h-[250px] bg-[var(--color-surface-lowest)] rounded-2xl border border-white/5 border-dashed gap-3 text-center p-6">
              <Activity size={32} className="text-[var(--color-text-variant)] opacity-50" />
              <div>
                 <p className="text-[var(--color-text-main)] font-medium mb-1">Henüz Yeterli Veri Yok</p>
                 <p className="text-xs text-[var(--color-text-variant)]">Sağ üstteki "Durumu Kaydet" butonunu kullanarak gün be gün varlık grafiğinizi oluşturun.</p>
              </div>
           </div>
        )}
      </div>

      {/* Summary Modal */}
      {selectedSummary && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
           <div className="bg-[var(--color-surface-container)] rounded-3xl w-full max-w-md border border-white/5 shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 flex flex-col max-h-[85vh]">
              <div className="p-6 border-b border-white/5 relative shrink-0">
                 <button onClick={() => setSelectedSummary(null)} className="absolute top-4 right-4 text-[var(--color-text-variant)] hover:text-white p-2">✕</button>
                 <div className={`w-12 h-12 rounded-2xl flex items-center justify-center mb-4 ${
                    selectedSummary === 'cash' ? 'bg-[#ffcf70]/10 text-[#ffcf70]' :
                    selectedSummary === 'investments' ? 'bg-[#4edea3]/10 text-[#4edea3]' :
                    'bg-[#adc6ff]/10 text-[#adc6ff]'
                 }`}>
                    {selectedSummary === 'cash' && <CreditCard size={24} />}
                    {selectedSummary === 'investments' && <Activity size={24} />}
                    {selectedSummary === 'savings' && <Landmark size={24} />}
                 </div>
                 <h2 className="text-xl font-bold text-white font-display mb-1">
                    {selectedSummary === 'cash' && 'Nakit Pano Özeti'}
                    {selectedSummary === 'investments' && 'Fon/Borsa Portföy Özeti'}
                    {selectedSummary === 'savings' && 'Birikim & BES Özeti'}
                 </h2>
                 <p className="text-3xl font-black text-white font-mono tracking-tight mt-2">
                    {selectedSummary === 'cash' && formatMoney(cash)}
                    {selectedSummary === 'investments' && formatMoney(portfolioValue)}
                    {selectedSummary === 'savings' && formatMoney(totalVirtualValue)}
                 </p>
              </div>

              <div className="p-4 overflow-y-auto space-y-2">
                 {selectedSummary === 'cash' && (
                    <>
                       <div className="p-4 rounded-2xl bg-[var(--color-surface-lowest)] border border-white/5 flex justify-between items-center">
                          <div>
                             <p className="text-[10px] text-[var(--color-text-variant)] font-bold uppercase tracking-wider mb-1">Cüzdan / Nakit Akışı</p>
                             <p className="text-sm font-bold text-white">Genel Harcama Özeti</p>
                          </div>
                          <p className="font-mono font-bold text-[#ffae70]">{formatMoney(cashFlow)}</p>
                       </div>
                       {accounts.map(acc => (
                         <div key={acc.id} className="p-4 rounded-2xl bg-[var(--color-surface-lowest)] border border-white/5">
                            <div className="flex justify-between items-center mb-1">
                               <div>
                                  <p className="text-[10px] text-[var(--color-text-variant)] font-bold uppercase tracking-wider mb-1">
                                    {acc.account_type === 'checking' ? 'Vadesiz Hesap' : acc.account_type === 'term_deposit' ? 'Vadeli Hesap' : 'Günlük Mevduat'}
                                  </p>
                                  <p className="text-sm font-bold text-white">{acc.name}</p>
                               </div>
                               <p className="font-mono font-bold text-[#4edea3] text-lg">{formatMoney(acc.balance)}</p>
                            </div>
                            {acc.account_type !== 'checking' && (
                               <div className="flex gap-3 text-[10px] text-[var(--color-text-variant)] mt-2 font-mono">
                                 {acc.interest_rate ? <span>Faiz: %{acc.interest_rate}</span> : null}
                                 {acc.maturity_date && <span>Vade: {new Date(acc.maturity_date).toLocaleDateString('tr-TR')}</span>}
                               </div>
                            )}
                         </div>
                       ))}
                    </>
                 )}

                 {selectedSummary === 'investments' && (
                    <>
                       {investments.length === 0 && <p className="text-[var(--color-text-variant)] text-center py-6 text-sm">Aktif yatırımınız bulunmuyor.</p>}
                       {investments.map(inv => (
                          <div key={inv.id} className="p-4 rounded-2xl bg-[var(--color-surface-lowest)] border border-white/5 flex justify-between items-center">
                             <div>
                                <p className="text-sm font-bold text-white mb-0.5">{inv.name}</p>
                                <p className="text-[10px] text-[var(--color-text-variant)] font-mono">{inv.symbol} • Adet: {inv.quantity}</p>
                             </div>
                             <p className="font-mono font-bold text-[#4edea3]">{formatMoney(inv.quantity * inv.current_price)}</p>
                          </div>
                       ))}
                    </>
                 )}

                 {selectedSummary === 'savings' && (
                    <>
                       {combinedSavings.length === 0 && <p className="text-[var(--color-text-variant)] text-center py-6 text-sm">Aktif birikim kaydınız bulunmuyor.</p>}
                       {combinedSavings.map(inv => (
                          <div key={inv.id} className="p-4 rounded-2xl bg-[var(--color-surface-lowest)] border border-white/5 flex justify-between items-center">
                             <div>
                                <p className="text-sm font-bold text-white mb-0.5">{inv.name}</p>
                                <p className="text-[10px] text-[var(--color-text-variant)] font-mono">{inv.asset_type === 'commodity' ? 'Altın Günü / Fon' : 'Nakit / Kur'}</p>
                             </div>
                             <p className="font-mono font-bold text-[#adc6ff]">{formatMoney(inv.quantity * inv.current_price)}</p>
                          </div>
                       ))}
                    </>
                 )}
              </div>

              <div className="p-4 bg-[var(--color-surface-lowest)] border-t border-white/5 shrink-0">
                 <button onClick={() => setSelectedSummary(null)} className="w-full py-3 text-sm font-bold text-white bg-white/5 hover:bg-white/10 rounded-xl transition-colors">
                    Kapat
                 </button>
              </div>
           </div>
        </div>
      )}

    </div>
  );
};
