import { useState } from 'react';
import { useNetWorth } from '../hooks/useNetWorth';
import { useTransactions } from '../hooks/useTransactions';
import { useInvestments } from '../hooks/useInvestments';
import { NetWorthLineChart } from '../components/charts/NetWorthLineChart';
import { ExpensePieChart } from '../components/charts/ExpensePieChart';
import { advisorAgent } from '../lib/agents';
import { Wallet, TrendingUp, Sparkles, RefreshCcw } from 'lucide-react';
import { toast } from 'sonner';

export const Dashboard = () => {
  const { currentNetWorth, history, saveTodayNetWorth } = useNetWorth();
  const { transactions } = useTransactions();
  const { investments } = useInvestments();
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);

  // Calculate expense distribution for the PieChart
  const expenseData = transactions
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
    .slice(0, 5); // top 5 categories

  const handleGetAdvice = async () => {
    setLoadingAdvice(true);
    setAdvice(null);
    try {
      const response = await advisorAgent.getAdvice(transactions, [], []); // passing empty arrays for budgets/goals for now
      setAdvice(response);
      toast.success("AI Finansal analizi tamamlandı");
    } catch (error) {
      toast.error("AI tavsiyesi alınırken bir hata oluştu");
    } finally {
      setLoadingAdvice(false);
    }
  };

  return (
    <div className="space-y-10">
      <div className="flex items-center justify-between">
        <h1 className="text-4xl font-bold tracking-tight text-white font-display">Finansal Kokpit</h1>
        <button 
          onClick={saveTodayNetWorth}
          className="flex items-center gap-2 px-5 py-2.5 bg-[var(--color-surface-variant)]/40 border border-white/5 text-[var(--color-text-main)] rounded-full hover:bg-[var(--color-surface-variant)]/80 font-medium transition backdrop-blur-md"
        >
          <RefreshCcw size={16} /> Bugünü Kaydet
        </button>
      </div>

      {/* Top Value Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bento-card relative overflow-hidden flex flex-col justify-center min-h-[160px]">
          <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <Wallet size={80} />
          </div>
          <p className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-2">Toplam Net Varlık</p>
          <h2 className="text-4xl font-black text-white font-display tracking-tight">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(currentNetWorth || 0)}
          </h2>
        </div>

        <div className="bento-card relative overflow-hidden flex flex-col justify-center min-h-[160px]">
           <div className="absolute top-0 right-0 p-6 opacity-5 pointer-events-none">
            <TrendingUp size={80} />
          </div>
          <p className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-2">Aylık Harcama (Özet)</p>
          <h2 className="text-4xl font-black text-white font-display tracking-tight">
            {new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(
              transactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0)
            )}
          </h2>
        </div>

        {/* AI Advisor Card Trigger */}
        <div className="bg-[var(--color-brand-primary-container)]/10 rounded-3xl p-6 border border-[var(--color-brand-primary)]/20 shadow-[inset_0_1px_0_0_rgba(78,222,163,0.1)] flex flex-col justify-between min-h-[160px]">
          <div>
            <div className="flex items-center gap-2 text-[var(--color-brand-primary)] font-bold mb-2">
              <Sparkles size={20} /> Groq AI Danışman
            </div>
            <p className="text-sm text-[var(--color-brand-primary)]/70 font-medium">
              Geçmiş verilerinize dayanarak yapay zekadan anlık tavsiyeler alın.
            </p>
          </div>
          <button 
            onClick={handleGetAdvice}
            disabled={loadingAdvice}
            className="mt-4 w-full primary-gradient-btn rounded-xl py-2.5 flex items-center justify-center gap-2"
          >
            {loadingAdvice ? (
              <><RefreshCcw size={16} className="animate-spin" /> Analiz Ediliyor...</>
            ) : 'Danışmana Sor'}
          </button>
        </div>
      </div>

      {/* AI Advice Result Banner */}
      {advice && (
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden">
          <div className="absolute top-0 left-0 w-1 h-full bg-[var(--color-brand-primary)]"></div>
          <h3 className="text-lg font-bold text-white mb-3 flex items-center gap-2 font-display">
            <Sparkles size={20} className="text-[var(--color-brand-primary)]" /> Yapay Zeka Finansal Raporu
          </h3>
          <div className="prose prose-sm prose-invert max-w-none text-[#bbcabf] whitespace-pre-wrap font-sans">
            {advice}
          </div>
        </div>
      )}

      {/* Charts section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bento-card">
          <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-6">Net Varlık Geçmişi</h3>
          <NetWorthLineChart history={history} />
        </div>
        <div className="bento-card">
          <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-6">Gider Dağılımı (Kategoriler)</h3>
          <ExpensePieChart data={expenseData} colors={['#4edea3', '#adc6ff', '#ffb2b7', '#ff7886', '#0566d9']} />
        </div>
      </div>
    </div>
  );
};
