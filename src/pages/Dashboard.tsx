import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useNetWorth } from '../hooks/useNetWorth';
import { useTransactions } from '../hooks/useTransactions';
import { useInvestments } from '../hooks/useInvestments';
import { useVirtualSavings } from '../hooks/useVirtualSavings';
import { useBankAccounts } from '../hooks/useBankAccounts';
import { useRecurringTransactions } from '../hooks/useRecurringTransactions';
import { useGoalsAndBudgets } from '../hooks/useGoalsAndBudgets';
import { useCreditCards } from '../hooks/useCreditCards';
import { useCreditCardExpenses } from '../hooks/useCreditCardExpenses';
import { NetWorthLineChart } from '../components/charts/NetWorthLineChart';
import { ExpensePieChart } from '../components/charts/ExpensePieChart';
import { MonthlyBarChart } from '../components/charts/MonthlyBarChart';
import { advisorAgent } from '../lib/agents';
import { PendingRecurringTransactions } from '../components/PendingRecurringTransactions';
import { BankAccount } from '../types';
import { 
  Wallet, TrendingUp, Sparkles, RefreshCcw, ArrowDownRight, ArrowUpRight, 
  Clock, Landmark, Activity, CreditCard, PiggyBank, Target, CalendarDays,
  TrendingDown, BarChart3, Banknote, Shield, ChevronRight, DollarSign,
  ArrowRight, Zap, AlertTriangle, CheckCircle2, Percent, Eye, Pencil,
  ChevronDown, X
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { tr } from 'date-fns/locale';

// Bank interest calculator (same logic as BankAccountsPage)
function daysBetween(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  const diffMs = now.getTime() - d.getTime();
  return Math.max(0, Math.floor(diffMs / (1000 * 60 * 60 * 24)));
}

function daysUntil(dateStr: string, now: Date): number {
  const d = new Date(dateStr);
  const diffMs = d.getTime() - now.getTime();
  return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
}

function calculateAccruedInterest(acc: BankAccount, now: Date) {
  const taxMultiplier = 1 - (acc.tax_rate || 0) / 100;

  if (acc.account_type === 'daily_deposit') {
    const depositDate = acc.deposit_date || acc.created_at.split('T')[0];
    const daysAccrued = daysBetween(depositDate, now);
    const workingBal = Math.max(0, acc.balance - acc.exempt_amount);
    const dailyRate = acc.interest_rate ? (acc.interest_rate / 100) / 365 : 0;
    const grossInterest = workingBal * dailyRate * daysAccrued;
    const netInterest = grossInterest * taxMultiplier;
    return { grossInterest, netInterest, daysAccrued, currentValue: acc.balance + netInterest };
  }

  if (acc.account_type === 'term_deposit') {
    const depositDate = acc.deposit_date || acc.created_at.split('T')[0];
    const maturityDate = acc.maturity_date;
    if (!maturityDate) return { grossInterest: 0, netInterest: 0, daysAccrued: 0, currentValue: acc.balance };
    const totalDays = daysBetween(depositDate, new Date(maturityDate));
    const elapsedDays = daysBetween(depositDate, now);
    const actualDays = Math.min(elapsedDays, totalDays);
    const dailyRate = acc.interest_rate ? (acc.interest_rate / 100) / 365 : 0;
    const grossInterest = acc.balance * dailyRate * actualDays;
    const netInterest = grossInterest * taxMultiplier;
    return { grossInterest, netInterest, daysAccrued: actualDays, currentValue: acc.balance + netInterest };
  }

  return { grossInterest: 0, netInterest: 0, daysAccrued: 0, currentValue: acc.balance };
}

export const Dashboard = () => {
  const { currentNetWorth, history, saveTodayNetWorth } = useNetWorth();
  const navigate = useNavigate();
  const { transactions } = useTransactions();
  const { investments } = useInvestments();
  const { combinedSavings, totalVirtualValue } = useVirtualSavings();
  const { accounts } = useBankAccounts();
  const { recurring } = useRecurringTransactions();
  const { goals, budgets } = useGoalsAndBudgets();
  const { cards } = useCreditCards();
  const { expenses: ccExpenses, totalExpenses: totalCCExpenses } = useCreditCardExpenses();
  
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [expandedBreakdown, setExpandedBreakdown] = useState<'banks' | 'investments' | 'savings' | 'interest' | null>(null);

  const toggleBreakdown = (section: 'banks' | 'investments' | 'savings' | 'interest') => {
    setExpandedBreakdown(prev => prev === section ? null : section);
  };

  const now = useMemo(() => new Date(), []);
  const formatMoney = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const formatCompact = (val: number) => {
    if (Math.abs(val) >= 1000000) return `₺${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `₺${(val / 1000).toFixed(1)}K`;
    return formatMoney(val);
  };

  // ─── Net Worth Breakdown ─────────────────────────────────
  const bankProcessed = useMemo(() => accounts.map(acc => ({
    ...acc,
    ...calculateAccruedInterest(acc, now)
  })), [accounts, now]);

  const totalBankValue = bankProcessed.reduce((a, b) => a + b.currentValue, 0);
  const totalBankInterest = bankProcessed.reduce((a, b) => a + b.netInterest, 0);

  let totalDailyInterest = 0;
  bankProcessed.forEach(acc => {
    const taxMulti = 1 - (acc.tax_rate || 0) / 100;
    if (acc.account_type === 'term_deposit' && acc.interest_rate && !(acc.maturity_date && daysUntil(acc.maturity_date, now) <= 0)) {
      totalDailyInterest += (acc.balance * (acc.interest_rate / 100)) / 365 * taxMulti;
    } else if (acc.account_type === 'daily_deposit' && acc.interest_rate) {
      const workingBalance = Math.max(0, acc.balance - acc.exempt_amount);
      totalDailyInterest += (workingBalance * (acc.interest_rate / 100)) / 365 * taxMulti;
    }
  });
  
  const portfolioValue = investments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);

  // ─── Cash Flow Analysis ──────────────────────────────────
  const currentMonth = now.getMonth();
  const currentYear = now.getFullYear();
  
  const currentMonthTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });

  const currentMonthIncome = currentMonthTransactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0);
  const currentMonthExpense = currentMonthTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0);
  const currentMonthNet = currentMonthIncome - currentMonthExpense;

  // Last 6 months bar chart data
  const monthlyBarData = useMemo(() => {
    const months: { month: string; income: number; expense: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear, currentMonth - i, 1);
      const label = d.toLocaleDateString('tr-TR', { month: 'short' });
      const m = d.getMonth();
      const y = d.getFullYear();
      const mTransactions = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y;
      });
      months.push({
        month: label,
        income: mTransactions.filter(t => t.type === 'income').reduce((a, b) => a + b.amount, 0),
        expense: mTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + b.amount, 0),
      });
    }
    return months;
  }, [transactions, currentMonth, currentYear]);

  // Expense Categories (Current Month)
  const expenseData = currentMonthTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => {
      const existing = acc.find(item => item.name === curr.category);
      if (existing) existing.value += curr.amount;
      else acc.push({ name: curr.category, value: curr.amount });
      return acc;
    }, [] as { name: string; value: number }[])
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  // Recent Transactions
  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  // ─── Recurring Summary (all upcoming payments count) ─────
  const recurringIncomeItems = recurring.filter(r => r.type === 'income');
  const recurringExpenseItems = recurring.filter(r => r.type === 'expense');

  // Helper: normalize to monthly equivalent
  const toMonthly = (r: { amount: number; frequency: string }) => {
    if (r.frequency === 'monthly') return r.amount;
    if (r.frequency === 'weekly') return r.amount * 4;
    if (r.frequency === 'yearly') return r.amount / 12;
    if (r.frequency === 'once') return r.amount; // tek seferlik = bu ay gelecek/gidecek
    return r.amount;
  };

  const recurringIncome = recurringIncomeItems.reduce((acc, r) => acc + toMonthly(r), 0);
  const recurringExpense = recurringExpenseItems.reduce((acc, r) => acc + toMonthly(r), 0);
  const recurringNet = recurringIncome - recurringExpense;

  // Categorized grouping for display
  const groupByCategory = (items: typeof recurring) => {
    const map = new Map<string, { total: number; count: number; items: typeof recurring }>();
    items.forEach(item => {
      const key = item.category;
      const existing = map.get(key) || { total: 0, count: 0, items: [] };
      existing.total += toMonthly(item);
      existing.count += 1;
      existing.items.push(item);
      map.set(key, existing);
    });
    return Array.from(map.entries())
      .map(([category, data]) => ({ category, ...data }))
      .sort((a, b) => b.total - a.total);
  };

  const incomeCategories = groupByCategory(recurringIncomeItems);
  const expenseCategories = groupByCategory(recurringExpenseItems);

  // ─── Upcoming Dates ──────────────────────────────────────
  const upcomingMaturities = bankProcessed
    .filter(a => a.account_type === 'term_deposit' && a.maturity_date && daysUntil(a.maturity_date, now) > 0)
    .sort((a, b) => daysUntil(a.maturity_date!, now) - daysUntil(b.maturity_date!, now))
    .slice(0, 3);

  // ─── Credit Card Summary ────────────────────────────────
  const currentMonthCCExpenses = ccExpenses.filter(e => {
    const d = new Date(e.date);
    return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
  });
  const totalCurrentMonthCC = currentMonthCCExpenses.reduce((sum, e) => sum + e.amount, 0);

  // ─── Goals Progress ──────────────────────────────────────
  const topGoals = goals.slice(0, 3);

  // ─── Budget Tracking ─────────────────────────────────────
  const budgetStatus = budgets.map(b => {
    const spent = currentMonthTransactions
      .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
      .reduce((sum, t) => sum + t.amount, 0);
    const pct = b.limit_amount > 0 ? (spent / b.limit_amount) * 100 : 0;
    return { ...b, spent, pct };
  }).sort((a, b) => b.pct - a.pct).slice(0, 4);

  // ─── AI Advisor ──────────────────────────────────────────
  const handleGetAdvice = async () => {
    setLoadingAdvice(true);
    setAdvice(null);
    try {
      const snapshot = {
        currentMonthIncome,
        currentMonthExpense,
        totalBankValue,
        totalBankInterest,
        dailyInterestEarning: totalDailyInterest,
        portfolioValue,
        savingsValue: totalVirtualValue,
        recurringIncome,
        recurringExpense,
        netWorth: currentNetWorth || 0,
      };
      const response = await advisorAgent.getAdvice(currentMonthTransactions, budgets, goals, snapshot); 
      setAdvice(response);
      toast.success("AI Finansal analizi tamamlandı");
    } catch (err: any) { 
      const msg = err?.message || 'Bilinmeyen hata';
      toast.error(`AI analizi başarısız: ${msg}`); 
      console.error('AI Advice Error:', err);
    }
    finally { setLoadingAdvice(false); }
  };

  // Net worth change from history
  const lastValue = history.length >= 2 ? history[history.length - 2].total_value : null;
  const netWorthChange = lastValue ? (currentNetWorth || 0) - lastValue : null;
  const netWorthChangePct = lastValue && lastValue !== 0 ? ((netWorthChange || 0) / lastValue) * 100 : null;

  return (
    <div className="space-y-5 md:space-y-6 pb-10">

      {/* ─── HEADER ─────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">Finansal Kokpit</h1>
          <p className="text-[var(--color-text-variant)] text-sm mt-1">
            {now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button 
          onClick={saveTodayNetWorth}
          title="Bugünün tüm değerlerini geçmişe kaydet"
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-[var(--color-surface-variant)]/40 border border-white/5 text-[var(--color-text-main)] rounded-full hover:bg-[var(--color-brand-primary)] hover:text-black font-medium transition-all backdrop-blur-md w-full sm:w-auto group"
        >
          <RefreshCcw size={16} className="group-hover:animate-spin" /> Durumu Kaydet
        </button>
      </div>

      {/* ─── PENDING RECURRING ──────────────────────────────── */}
      <PendingRecurringTransactions />

      {/* ─── NET WORTH HERO + QUICK STATS ──────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        
        {/* Main Net Worth Card */}
        <div className="lg:col-span-5 primary-gradient-btn rounded-3xl p-6 md:p-7 relative overflow-hidden shadow-[0_10px_40px_rgba(78,222,163,0.12)] group">
          <div className="absolute -right-10 -top-10 w-64 h-64 bg-white/10 rounded-full blur-3xl group-hover:bg-white/20 transition-all duration-700 pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-1">
              <Shield size={14} className="text-black/50" />
              <p className="text-black/60 font-bold text-[10px] uppercase tracking-widest font-mono">Toplam Net Varlık</p>
            </div>
            <h2 className="text-3xl lg:text-4xl font-black text-black font-display tracking-tight">
              {formatMoney(currentNetWorth || 0)}
            </h2>
            {netWorthChange !== null && (
              <div className={`mt-2 flex items-center gap-1.5 ${netWorthChange >= 0 ? 'text-black/70' : 'text-red-900/70'}`}>
                {netWorthChange >= 0 ? <TrendingUp size={14} /> : <TrendingDown size={14} />}
                <span className="text-xs font-bold font-mono">
                  {netWorthChange >= 0 ? '+' : ''}{formatMoney(netWorthChange)}
                </span>
                {netWorthChangePct !== null && (
                  <span className="text-[10px] font-mono opacity-70">
                    ({netWorthChangePct >= 0 ? '+' : ''}{netWorthChangePct.toFixed(1)}%)
                  </span>
                )}
              </div>
            )}

            {/* Mini Breakdown - Clickable */}
            <div className="grid grid-cols-2 gap-2 mt-5">
              <button
                onClick={() => toggleBreakdown('banks')}
                className={`bg-black/5 rounded-xl p-2.5 border text-left transition-all duration-200 hover:bg-black/10 hover:scale-[1.02] active:scale-[0.98] ${
                  expandedBreakdown === 'banks' ? 'border-black/20 bg-black/10 ring-1 ring-black/10' : 'border-black/5'
                }`}
              >
                <p className="text-[9px] text-black/60 uppercase font-bold tracking-wider mb-0.5 flex items-center gap-1">
                  <Landmark size={10}/> Bankalar
                  <ChevronDown size={8} className={`ml-auto transition-transform duration-300 ${expandedBreakdown === 'banks' ? 'rotate-180' : ''}`} />
                </p>
                <p className="font-bold text-black font-mono text-sm">{formatCompact(totalBankValue)}</p>
              </button>
              <button
                onClick={() => toggleBreakdown('investments')}
                className={`bg-black/5 rounded-xl p-2.5 border text-left transition-all duration-200 hover:bg-black/10 hover:scale-[1.02] active:scale-[0.98] ${
                  expandedBreakdown === 'investments' ? 'border-black/20 bg-black/10 ring-1 ring-black/10' : 'border-black/5'
                }`}
              >
                <p className="text-[9px] text-black/60 uppercase font-bold tracking-wider mb-0.5 flex items-center gap-1">
                  <Activity size={10}/> Yatırım
                  <ChevronDown size={8} className={`ml-auto transition-transform duration-300 ${expandedBreakdown === 'investments' ? 'rotate-180' : ''}`} />
                </p>
                <p className="font-bold text-black font-mono text-sm">{formatCompact(portfolioValue)}</p>
              </button>
              <button
                onClick={() => toggleBreakdown('savings')}
                className={`bg-black/5 rounded-xl p-2.5 border text-left transition-all duration-200 hover:bg-black/10 hover:scale-[1.02] active:scale-[0.98] ${
                  expandedBreakdown === 'savings' ? 'border-black/20 bg-black/10 ring-1 ring-black/10' : 'border-black/5'
                }`}
              >
                <p className="text-[9px] text-black/60 uppercase font-bold tracking-wider mb-0.5 flex items-center gap-1">
                  <PiggyBank size={10}/> Birikim
                  <ChevronDown size={8} className={`ml-auto transition-transform duration-300 ${expandedBreakdown === 'savings' ? 'rotate-180' : ''}`} />
                </p>
                <p className="font-bold text-black font-mono text-sm">{formatCompact(totalVirtualValue)}</p>
              </button>
              <button
                onClick={() => toggleBreakdown('interest')}
                className={`bg-black/5 rounded-xl p-2.5 border text-left transition-all duration-200 hover:bg-black/10 hover:scale-[1.02] active:scale-[0.98] ${
                  expandedBreakdown === 'interest' ? 'border-black/20 bg-black/10 ring-1 ring-black/10' : 'border-black/5'
                }`}
              >
                <p className="text-[9px] text-black/60 uppercase font-bold tracking-wider mb-0.5 flex items-center gap-1">
                  <Percent size={10}/> Faiz Geliri
                  <ChevronDown size={8} className={`ml-auto transition-transform duration-300 ${expandedBreakdown === 'interest' ? 'rotate-180' : ''}`} />
                </p>
                <p className="font-bold text-black font-mono text-sm">+{formatCompact(totalBankInterest)}</p>
              </button>
            </div>

            {/* Expanded Detail Panel */}
            {expandedBreakdown && (
              <div className="mt-3 bg-black/10 rounded-xl border border-black/10 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-300">
                <div className="flex items-center justify-between px-3 py-2 border-b border-black/5">
                  <span className="text-[10px] font-bold text-black/70 uppercase tracking-wider">
                    {expandedBreakdown === 'banks' && '🏦 Banka Hesapları Detayı'}
                    {expandedBreakdown === 'investments' && '📈 Yatırım Portföyü Detayı'}
                    {expandedBreakdown === 'savings' && '🐷 Birikim Detayı'}
                    {expandedBreakdown === 'interest' && '💰 Faiz Geliri Detayı'}
                  </span>
                  <button onClick={() => setExpandedBreakdown(null)} className="text-black/40 hover:text-black/70 transition-colors">
                    <X size={12} />
                  </button>
                </div>
                <div className="px-3 py-2 max-h-[200px] overflow-y-auto custom-scrollbar space-y-1.5">
                  
                  {/* Banks Detail */}
                  {expandedBreakdown === 'banks' && (
                    bankProcessed.length > 0 ? bankProcessed.map(acc => (
                      <div key={acc.id} className="flex items-center justify-between py-1.5 px-2 bg-black/5 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                            acc.account_type === 'daily_deposit' ? 'bg-emerald-500/20 text-emerald-700' :
                            acc.account_type === 'term_deposit' ? 'bg-purple-500/20 text-purple-700' :
                            'bg-blue-500/20 text-blue-700'
                          }`}>
                            {acc.account_type === 'checking' ? <Wallet size={10}/> :
                             acc.account_type === 'daily_deposit' ? <TrendingUp size={10}/> :
                             <Clock size={10}/>}
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-black/80 truncate max-w-[100px]">{acc.name}</p>
                            <p className="text-[9px] text-black/50 font-mono">
                              {acc.account_type === 'checking' ? 'Vadesiz' : acc.account_type === 'daily_deposit' ? 'Günlük' : 'Vadeli'}
                              {acc.interest_rate ? ` • %${acc.interest_rate}` : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-bold font-mono text-black/80">{formatCompact(acc.currentValue)}</p>
                          {acc.netInterest > 0 && (
                            <p className="text-[9px] font-mono text-emerald-700">+{formatMoney(acc.netInterest)}</p>
                          )}
                        </div>
                      </div>
                    )) : (
                      <p className="text-[11px] text-black/50 text-center py-3">Henüz banka hesabı eklenmedi</p>
                    )
                  )}

                  {/* Investments Detail */}
                  {expandedBreakdown === 'investments' && (
                    investments.length > 0 ? investments.map(inv => {
                      const value = inv.quantity * inv.current_price;
                      const cost = inv.quantity * (inv.avg_price || inv.current_price);
                      const pnl = value - cost;
                      const pnlPct = cost > 0 ? (pnl / cost) * 100 : 0;
                      return (
                        <div key={inv.id} className="flex items-center justify-between py-1.5 px-2 bg-black/5 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className={`w-5 h-5 rounded-md flex items-center justify-center shrink-0 ${
                              inv.asset_type === 'stock' ? 'bg-blue-500/20 text-blue-700' :
                              inv.asset_type === 'crypto' ? 'bg-orange-500/20 text-orange-700' :
                              inv.asset_type === 'commodity' ? 'bg-yellow-500/20 text-yellow-700' :
                              'bg-green-500/20 text-green-700'
                            }`}>
                              <Activity size={10}/>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-black/80 truncate max-w-[100px]">{inv.name}</p>
                              <p className="text-[9px] text-black/50 font-mono">{inv.symbol} • {inv.quantity.toFixed(inv.asset_type === 'crypto' ? 4 : 2)} adet</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-bold font-mono text-black/80">{formatCompact(value)}</p>
                            <p className={`text-[9px] font-mono font-bold ${pnl >= 0 ? 'text-emerald-700' : 'text-red-600'}`}>
                              {pnl >= 0 ? '+' : ''}{formatCompact(pnl)} ({pnlPct >= 0 ? '+' : ''}{pnlPct.toFixed(1)}%)
                            </p>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-[11px] text-black/50 text-center py-3">Henüz yatırım eklenmedi</p>
                    )
                  )}

                  {/* Savings Detail */}
                  {expandedBreakdown === 'savings' && (
                    combinedSavings.length > 0 ? combinedSavings.map(sav => {
                      const value = sav.quantity * sav.current_price;
                      return (
                        <div key={sav.id} className="flex items-center justify-between py-1.5 px-2 bg-black/5 rounded-lg">
                          <div className="flex items-center gap-2 min-w-0">
                            <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-pink-500/20 text-pink-700">
                              <PiggyBank size={10}/>
                            </div>
                            <div className="min-w-0">
                              <p className="text-[11px] font-bold text-black/80 truncate max-w-[100px]">{sav.name}</p>
                              <p className="text-[9px] text-black/50 font-mono">{sav.symbol}</p>
                            </div>
                          </div>
                          <div className="text-right shrink-0">
                            <p className="text-[11px] font-bold font-mono text-black/80">{formatCompact(value)}</p>
                          </div>
                        </div>
                      );
                    }) : (
                      <p className="text-[11px] text-black/50 text-center py-3">Henüz birikim eklenmedi</p>
                    )
                  )}

                  {/* Interest Detail */}
                  {expandedBreakdown === 'interest' && (
                    bankProcessed.filter(a => a.netInterest > 0).length > 0 ? 
                    bankProcessed.filter(a => a.netInterest > 0).map(acc => (
                      <div key={acc.id} className="flex items-center justify-between py-1.5 px-2 bg-black/5 rounded-lg">
                        <div className="flex items-center gap-2 min-w-0">
                          <div className="w-5 h-5 rounded-md flex items-center justify-center shrink-0 bg-emerald-500/20 text-emerald-700">
                            <Percent size={10}/>
                          </div>
                          <div className="min-w-0">
                            <p className="text-[11px] font-bold text-black/80 truncate max-w-[100px]">{acc.name}</p>
                            <p className="text-[9px] text-black/50 font-mono">
                              %{acc.interest_rate} • {acc.daysAccrued} gün
                              {acc.account_type === 'term_deposit' && acc.maturity_date && daysUntil(acc.maturity_date, now) > 0
                                ? ` • ${daysUntil(acc.maturity_date, now)}g kaldı`
                                : ''}
                            </p>
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <p className="text-[11px] font-bold font-mono text-emerald-700">+{formatMoney(acc.netInterest)}</p>
                          <p className="text-[9px] text-black/50 font-mono">günlük: +{formatMoney(
                            acc.account_type === 'daily_deposit'
                              ? (Math.max(0, acc.balance - acc.exempt_amount) * ((acc.interest_rate || 0) / 100) / 365) * (1 - (acc.tax_rate || 0) / 100)
                              : (acc.balance * ((acc.interest_rate || 0) / 100) / 365) * (1 - (acc.tax_rate || 0) / 100)
                          )}</p>
                        </div>
                      </div>
                    )) : (
                      <p className="text-[11px] text-black/50 text-center py-3">Faiz geliri olan hesap bulunmuyor</p>
                    )
                  )}
                </div>
                {/* Footer with navigation */}
                <div className="px-3 py-2 border-t border-black/5">
                  <button
                    onClick={() => {
                      if (expandedBreakdown === 'banks') navigate('/banks');
                      else if (expandedBreakdown === 'investments') navigate('/investments');
                      else if (expandedBreakdown === 'savings') navigate('/net-worth');
                      else if (expandedBreakdown === 'interest') navigate('/banks');
                    }}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-[10px] font-bold text-black/60 hover:text-black transition-colors rounded-lg hover:bg-black/5"
                  >
                    Detaylı Görüntüle <ChevronRight size={10} />
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Right: Quick Insight Cards */}
        <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-3 md:gap-4">
          
          {/* This Month Net */}
          <div className="bento-card flex flex-col justify-between min-h-[130px] sm:min-h-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${currentMonthNet >= 0 ? 'bg-[#4edeb3]/10 text-[#4edeb3]' : 'bg-[#ff7886]/10 text-[#ff7886]'}`}>
              {currentMonthNet >= 0 ? <ArrowUpRight size={20} /> : <ArrowDownRight size={20} />}
            </div>
            <div>
              <p className="text-[9px] text-[var(--color-text-variant)] uppercase tracking-wider font-bold font-mono mb-1">Bu Ay Net</p>
              <p className={`font-black font-mono text-lg ${currentMonthNet >= 0 ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>
                {currentMonthNet >= 0 ? '+' : ''}{formatCompact(currentMonthNet)}
              </p>
            </div>
          </div>

          {/* Daily Interest Earning */}
          <div className="bento-card flex flex-col justify-between min-h-[130px] sm:min-h-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#cda4ff]/10 text-[#cda4ff]">
              <Zap size={20} />
            </div>
            <div>
              <p className="text-[9px] text-[var(--color-text-variant)] uppercase tracking-wider font-bold font-mono mb-1">Günlük Faiz</p>
              <p className="font-black font-mono text-lg text-[#cda4ff]">
                +{formatMoney(totalDailyInterest)}
              </p>
            </div>
          </div>

          {/* Recurring Balance */}
          <div className="bento-card flex flex-col justify-between min-h-[130px] sm:min-h-0">
            <div className={`w-9 h-9 rounded-xl flex items-center justify-center mb-3 ${recurringNet >= 0 ? 'bg-[#adc6ff]/10 text-[#adc6ff]' : 'bg-[#ffcf70]/10 text-[#ffcf70]'}`}>
              <CalendarDays size={20} />
            </div>
            <div>
              <p className="text-[9px] text-[var(--color-text-variant)] uppercase tracking-wider font-bold font-mono mb-1">Sabit Net</p>
              <p className={`font-black font-mono text-lg ${recurringNet >= 0 ? 'text-[#adc6ff]' : 'text-[#ffcf70]'}`}>
                {recurringNet >= 0 ? '+' : ''}{formatCompact(recurringNet)}
              </p>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-[9px] font-mono text-[#4edeb3]">↑{formatCompact(recurringIncome)}</span>
                <span className="text-[9px] font-mono text-[#ff7886]">↓{formatCompact(recurringExpense)}</span>
              </div>
            </div>
          </div>

          {/* Credit Card */}
          <div className="bento-card flex flex-col justify-between min-h-[130px] sm:min-h-0">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3 bg-[#ff7886]/10 text-[#ff7886]">
              <CreditCard size={20} />
            </div>
            <div>
              <p className="text-[9px] text-[var(--color-text-variant)] uppercase tracking-wider font-bold font-mono mb-1">KK Harcama</p>
              <p className="font-black font-mono text-lg text-[#ff7886]">
                {formatCompact(totalCurrentMonthCC)}
              </p>
            </div>
          </div>

        </div>
      </div>

      {/* ─── MAIN GRID ──────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4 md:gap-5">
        
        {/* LEFT: Charts & Analysis */}
        <div className="lg:col-span-8 space-y-4 md:space-y-5">
          
          {/* 6-Month Income vs Expense */}
          <div className="bento-card">
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono flex items-center gap-2">
                <BarChart3 size={14} className="text-[var(--color-brand-primary)]" /> Son 6 Aylık Gelir & Gider
              </h3>
              <div className="flex items-center gap-3 text-[10px] font-mono">
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#4edeb3]"></span> Gelir</span>
                <span className="flex items-center gap-1.5"><span className="w-2 h-2 rounded-full bg-[#ff7886]"></span> Gider</span>
              </div>
            </div>
            <MonthlyBarChart data={monthlyBarData} />
          </div>

          {/* This Month Overview + Pie */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-5">
            
            {/* Cash Flow Box */}
            <div className="bento-card">
              <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-5">
                {now.toLocaleDateString('tr-TR', { month: 'long' })} Nakit Akışı
              </h3>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-[var(--color-surface-lowest)] border border-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#4edeb3]/10 text-[#4edeb3] flex items-center justify-center">
                      <ArrowUpRight size={16} />
                    </div>
                    <span className="text-sm text-[var(--color-text-variant)]">Gelir</span>
                  </div>
                  <span className="font-bold font-mono text-[#4edeb3]">{formatMoney(currentMonthIncome)}</span>
                </div>
                <div className="flex items-center justify-between p-3 bg-[var(--color-surface-lowest)] border border-white/5 rounded-xl">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#ff7886]/10 text-[#ff7886] flex items-center justify-center">
                      <ArrowDownRight size={16} />
                    </div>
                    <span className="text-sm text-[var(--color-text-variant)]">Gider</span>
                  </div>
                  <span className="font-bold font-mono text-[#ff7886]">{formatMoney(currentMonthExpense)}</span>
                </div>
                
                <div className="border-t border-white/5 pt-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs text-[var(--color-text-variant)] font-bold uppercase tracking-wider">Net</span>
                    <span className={`font-black font-mono text-lg ${currentMonthNet >= 0 ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>
                      {currentMonthNet >= 0 ? '+' : ''}{formatMoney(currentMonthNet)}
                    </span>
                  </div>
                </div>

                {/* Savings rate */}
                {currentMonthIncome > 0 && (
                  <div className="bg-[var(--color-brand-primary)]/5 border border-[var(--color-brand-primary)]/10 rounded-xl p-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-[10px] text-[var(--color-text-variant)] uppercase tracking-wider font-bold">Tasarruf Oranı</span>
                      <span className="text-[var(--color-brand-primary)] font-black font-mono text-sm">
                        %{Math.max(0, (currentMonthNet / currentMonthIncome) * 100).toFixed(0)}
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-[var(--color-brand-primary)] rounded-full transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, (currentMonthNet / currentMonthIncome) * 100))}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Expense Pie */}
            <div className="bento-card">
              <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-4">
                Harcama Dağılımı
              </h3>
              {expenseData.length > 0 ? (
                <ExpensePieChart data={expenseData} compact />
              ) : (
                <div className="h-52 flex items-center justify-center text-[var(--color-text-variant)] text-sm">
                  Bu ay henüz harcama yok
                </div>
              )}
            </div>
          </div>

          {/* Net Worth Chart */}
          <div className="bento-card">
            <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-5 flex items-center gap-2">
              <TrendingUp size={14} className="text-[var(--color-brand-primary)]" /> Net Varlık Geçmişi
            </h3>
            {history && history.length > 1 ? (
              <NetWorthLineChart history={history} />
            ) : (
              <div className="flex flex-col items-center justify-center h-[200px] bg-[var(--color-surface-lowest)] rounded-2xl border border-white/5 border-dashed gap-3 text-center p-6">
                <Activity size={28} className="text-[var(--color-text-variant)] opacity-40" />
                <p className="text-xs text-[var(--color-text-variant)]">
                  "Durumu Kaydet" ile gün gün varlık grafiğinizi oluşturun.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: Sidebar */}
        <div className="lg:col-span-4 space-y-4 md:space-y-5">

          {/* Banka Hesapları Özeti */}
          <div className="bento-card">
            <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
              <Landmark size={14} className="text-[#cda4ff]" /> Banka Hesapları
            </h3>
            {bankProcessed.length === 0 ? (
              <p className="text-[var(--color-text-variant)] text-sm text-center py-4">Henüz hesap eklenmedi</p>
            ) : (
              <div className="space-y-2.5">
                {bankProcessed.map(acc => {
                  const isMatured = acc.account_type === 'term_deposit' && acc.maturity_date && daysUntil(acc.maturity_date, now) <= 0;
                  return (
                    <div key={acc.id} className="p-3 bg-[var(--color-surface-lowest)] border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className={`w-6 h-6 rounded-md flex items-center justify-center ${
                            acc.account_type === 'daily_deposit' ? 'bg-[#4edeb3]/10 text-[#4edeb3]' :
                            acc.account_type === 'term_deposit' ? 'bg-[#cda4ff]/10 text-[#cda4ff]' :
                            'bg-[#adc6ff]/10 text-[#adc6ff]'
                          }`}>
                            {acc.account_type === 'checking' ? <Wallet size={12}/> :
                             acc.account_type === 'daily_deposit' ? <TrendingUp size={12}/> :
                             <Clock size={12}/>}
                          </div>
                          <span className="text-sm font-bold text-white truncate max-w-[120px]">{acc.name}</span>
                        </div>
                        <span className="font-mono font-bold text-white text-sm">{formatCompact(acc.currentValue)}</span>
                      </div>
                      {acc.netInterest > 0 && (
                        <div className="flex items-center justify-between mt-1">
                          <span className="text-[10px] text-[var(--color-text-variant)] font-mono">
                            {acc.interest_rate && `%${acc.interest_rate}`} • {acc.daysAccrued}g
                          </span>
                          <span className="text-[10px] text-[#4edeb3] font-mono font-bold">+{formatMoney(acc.netInterest)}</span>
                        </div>
                      )}
                      {isMatured && (
                        <div className="flex items-center gap-1 mt-1">
                          <CheckCircle2 size={10} className="text-[#4edeb3]" />
                          <span className="text-[10px] text-[#4edeb3] font-bold">Vadesi Doldu</span>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Sabit Gelir & Gider Kategorize */}
          {(recurringIncomeItems.length > 0 || recurringExpenseItems.length > 0) && (
            <div className="bento-card">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono flex items-center gap-2">
                  <Banknote size={14} className="text-[#adc6ff]" /> Sabit Gelir & Gider
                </h3>
                <button 
                  onClick={() => navigate('/recurring')}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-[var(--color-brand-primary)]/10 border border-white/10 hover:border-[var(--color-brand-primary)]/20 rounded-lg text-[10px] font-bold text-[var(--color-text-variant)] hover:text-[var(--color-brand-primary)] transition-all"
                >
                  <Pencil size={10} /> Düzenle
                </button>
              </div>

              {/* Income vs Expense Bar */}
              {recurringIncome > 0 && (
                <div className="mb-4">
                  <div className="flex justify-between text-[10px] font-mono mb-1.5">
                    <span className="text-[#4edeb3] font-bold">Gelir: {formatMoney(recurringIncome)}</span>
                    <span className="text-[#ff7886] font-bold">Gider: {formatMoney(recurringExpense)}</span>
                  </div>
                  <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden flex">
                    <div 
                      className="h-full bg-[#4edeb3] rounded-l-full transition-all"
                      style={{ width: `${(recurringIncome / (recurringIncome + recurringExpense)) * 100}%` }}
                    />
                    <div 
                      className="h-full bg-[#ff7886] rounded-r-full transition-all"
                      style={{ width: `${(recurringExpense / (recurringIncome + recurringExpense)) * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {/* Income Categories */}
              {incomeCategories.length > 0 && (
                <div className="mb-3">
                  <p className="text-[10px] text-[#4edeb3] font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ArrowUpRight size={10} /> Gelirler
                  </p>
                  <div className="space-y-1.5">
                    {incomeCategories.map(cat => (
                      <div key={cat.category} className="flex items-center justify-between p-2 bg-[#4edeb3]/5 border border-[#4edeb3]/10 rounded-lg">
                        <span className="text-xs text-white font-medium truncate max-w-[140px]">{cat.category}</span>
                        <span className="text-xs font-mono font-bold text-[#4edeb3] shrink-0">+{formatMoney(cat.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Expense Categories */}
              {expenseCategories.length > 0 && (
                <div>
                  <p className="text-[10px] text-[#ff7886] font-bold uppercase tracking-wider mb-2 flex items-center gap-1">
                    <ArrowDownRight size={10} /> Giderler
                  </p>
                  <div className="space-y-1.5">
                    {expenseCategories.map(cat => (
                      <div key={cat.category} className="flex items-center justify-between p-2 bg-[#ff7886]/5 border border-[#ff7886]/10 rounded-lg">
                        <div className="flex items-center gap-1.5 min-w-0">
                          <span className="text-xs text-white font-medium truncate max-w-[120px]">{cat.category}</span>
                          {cat.items[0]?.total_installments && (
                            <span className="text-[9px] font-mono text-[var(--color-text-variant)] opacity-70 shrink-0">
                              ({cat.items[0].total_installments}T)
                            </span>
                          )}
                        </div>
                        <span className="text-xs font-mono font-bold text-[#ff7886] shrink-0">-{formatMoney(cat.total)}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Net Summary */}
              <div className="mt-3 pt-3 border-t border-white/5 flex items-center justify-between">
                <span className="text-xs text-[var(--color-text-variant)] font-bold">Net Sabit</span>
                <span className={`font-mono font-black text-sm ${recurringNet >= 0 ? 'text-[#4edeb3]' : 'text-[#ff7886]'}`}>
                  {recurringNet >= 0 ? '+' : ''}{formatMoney(recurringNet)}
                </span>
              </div>
            </div>
          )}

          {/* Bütçe Takibi */}
          {budgetStatus.length > 0 && (
            <div className="bento-card">
              <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
                <Target size={14} className="text-[#ffcf70]" /> Bütçe Takibi
              </h3>
              <div className="space-y-3">
                {budgetStatus.map(b => (
                  <div key={b.id}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm text-white font-medium truncate max-w-[150px]">{b.category}</span>
                      <span className="text-[10px] font-mono text-[var(--color-text-variant)]">
                        {formatCompact(b.spent)} / {formatCompact(b.limit_amount)}
                      </span>
                    </div>
                    <div className="w-full h-2 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                          b.pct > 100 ? 'bg-[#ff7886]' : b.pct > 80 ? 'bg-[#ffcf70]' : 'bg-[#4edeb3]'
                        }`}
                        style={{ width: `${Math.min(100, b.pct)}%` }}
                      />
                    </div>
                    {b.pct > 90 && (
                      <div className="flex items-center gap-1 mt-1">
                        <AlertTriangle size={10} className={b.pct > 100 ? 'text-[#ff7886]' : 'text-[#ffcf70]'} />
                        <span className={`text-[10px] font-bold ${b.pct > 100 ? 'text-[#ff7886]' : 'text-[#ffcf70]'}`}>
                          {b.pct > 100 ? `%${(b.pct - 100).toFixed(0)} aşıldı!` : `%${b.pct.toFixed(0)} kullanıldı`}
                        </span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hedefler */}
          {topGoals.length > 0 && (
            <div className="bento-card">
              <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
                <Target size={14} className="text-[#4edeb3]" /> Hedeflerim
              </h3>
              <div className="space-y-3">
                {topGoals.map(g => {
                  const pct = g.target_amount > 0 ? (g.current_amount / g.target_amount) * 100 : 0;
                  return (
                    <div key={g.id} className="p-3 bg-[var(--color-surface-lowest)] border border-white/5 rounded-xl">
                      <div className="flex items-center justify-between mb-2">
                        <span className="text-sm font-bold text-white truncate max-w-[160px]">{g.name}</span>
                        <span className="text-[10px] text-[var(--color-brand-primary)] font-mono font-bold">%{pct.toFixed(0)}</span>
                      </div>
                      <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden mb-1.5">
                        <div className="h-full bg-gradient-to-r from-[#4edeb3] to-[#3bc49c] rounded-full transition-all" style={{ width: `${Math.min(100, pct)}%` }} />
                      </div>
                      <div className="flex justify-between text-[10px] font-mono text-[var(--color-text-variant)]">
                        <span>{formatCompact(g.current_amount)}</span>
                        <span>{formatCompact(g.target_amount)}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Vadesi Yaklaşan */}
          {upcomingMaturities.length > 0 && (
            <div className="bento-card">
              <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
                <CalendarDays size={14} className="text-[#adc6ff]" /> Yaklaşan Vadeler
              </h3>
              <div className="space-y-2.5">
                {upcomingMaturities.map(acc => {
                  const remaining = daysUntil(acc.maturity_date!, now);
                  return (
                    <div key={acc.id} className="flex items-center justify-between p-3 bg-[var(--color-surface-lowest)] border border-white/5 rounded-xl">
                      <div>
                        <p className="text-sm font-bold text-white">{acc.name}</p>
                        <p className="text-[10px] text-[var(--color-text-variant)] font-mono mt-0.5">
                          {new Date(acc.maturity_date!).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' })}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className={`text-xs font-bold font-mono ${remaining <= 7 ? 'text-[#ffcf70]' : 'text-[#adc6ff]'}`}>
                          {remaining} gün
                        </p>
                        <p className="text-[10px] text-[#4edeb3] font-mono">+{formatMoney(acc.netInterest)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Son Hareketler */}
          <div className="bento-card">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-[var(--color-text-variant)] font-bold text-xs uppercase tracking-widest font-mono flex items-center gap-2">
                <Clock size={14} /> Son Hareketler
              </h3>
            </div>
            {recentTransactions.length > 0 ? (
              <div className="space-y-2">
                {recentTransactions.map(t => (
                  <div key={t.id} className="flex items-center justify-between p-2.5 bg-[var(--color-surface-lowest)] border border-white/5 rounded-xl hover:border-white/10 transition-colors">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                        t.type === 'income' ? 'bg-[#4edeb3]/10 text-[#4edeb3]' : 'bg-[#ff7886]/10 text-[#ff7886]'
                      }`}>
                        {t.type === 'income' ? <ArrowUpRight size={14} /> : <ArrowDownRight size={14} />}
                      </div>
                      <div className="min-w-0">
                        <p className="font-bold text-white text-xs truncate">{t.category}</p>
                        <p className="text-[10px] text-[var(--color-text-variant)] truncate">
                          {formatDistanceToNow(new Date(t.date), { addSuffix: true, locale: tr })}
                        </p>
                      </div>
                    </div>
                    <span className={`font-bold font-mono text-xs shrink-0 ml-2 ${
                      t.type === 'income' ? 'text-[#4edeb3]' : 'text-white'
                    }`}>
                      {t.type === 'income' ? '+' : '-'}{formatCompact(t.amount)}
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-[var(--color-text-variant)] gap-2">
                <Eye size={24} className="opacity-30" />
                <p className="text-xs">Henüz işlem yok</p>
              </div>
            )}
          </div>
          
          {/* AI Advisor */}
          <div className="bento-card border border-[var(--color-brand-primary)]/15 bg-gradient-to-b from-[var(--color-brand-primary)]/5 to-transparent">
            <div className="flex items-center gap-3 mb-3">
              <div className="w-9 h-9 rounded-xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] flex items-center justify-center">
                <Sparkles size={18} />
              </div>
              <div>
                <h3 className="font-bold text-white text-sm font-display">AI Danışman</h3>
                <p className="text-[10px] text-[var(--color-text-variant)]">Kişiselleştirilmiş analiz</p>
              </div>
            </div>
            <button 
              onClick={handleGetAdvice}
              disabled={loadingAdvice}
              className="w-full py-2.5 bg-white/5 hover:bg-[var(--color-brand-primary)] hover:text-black border border-white/10 hover:border-transparent rounded-xl flex items-center justify-center gap-2 font-bold text-sm transition-all"
            >
              {loadingAdvice ? (
                <><RefreshCcw size={14} className="animate-spin" /> Analiz Ediliyor...</>
              ) : 'Rapor Çıkart'}
            </button>
          </div>
        </div>
      </div>

      {/* AI Advice Result */}
      {advice && (
        <div className="glass-panel p-6 rounded-3xl relative overflow-hidden border border-[var(--color-brand-primary)]/30 shadow-[0_10px_40px_rgba(78,222,163,0.1)] animate-in fade-in slide-in-from-top-4">
          <div className="absolute top-0 left-0 w-1.5 h-full bg-[var(--color-brand-primary)]"></div>
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 font-display">
              <Sparkles size={20} className="text-[var(--color-brand-primary)]" /> AI Finansal Öngörü
            </h3>
            <button onClick={() => setAdvice(null)} className="text-[var(--color-text-variant)] hover:text-white text-sm font-medium px-3 py-1 rounded-lg hover:bg-white/5 transition-colors">Kapat</button>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-[#bbcabf] whitespace-pre-wrap font-sans leading-relaxed">
            {advice}
          </div>
        </div>
      )}
    </div>
  );
};
