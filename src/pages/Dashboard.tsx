import React, { useState, useMemo, useEffect, FormEvent } from 'react';
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
  ChevronDown, X, LayoutList, MessageSquare, Bot, Loader2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
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
  const now = useMemo(() => new Date(), []);
  const { cards } = useCreditCards();
  const { expenses: ccExpenses } = useCreditCardExpenses();
  
  // ─── Period Logic (15th-14th cycle) ───────────────────
  const activePeriod = useMemo(() => {
    let start: Date;
    if (now.getDate() >= 15) {
      start = new Date(now.getFullYear(), now.getMonth(), 15);
    } else {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 15);
    }
    const end = new Date(start.getFullYear(), start.getMonth() + 1, 14, 23, 59, 59);
    return { start, end };
  }, [now]);

  // Asset Visibility State
  const [assetVisibility, setAssetVisibility] = useState({
    banks: true,
    investments: true,
    savings: true,
    cards: true
  });

  const [selectedBankIds, setSelectedBankIds] = useState<string[]>([]);
  
  // Initialize selectedBankIds when accounts are loaded
  useEffect(() => {
    if (accounts.length > 0 && selectedBankIds.length === 0) {
      setSelectedBankIds(accounts.map(a => a.id));
    }
  }, [accounts]);

  const toggleBankSelection = (id: string) => {
    setSelectedBankIds(prev => 
      prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
    );
  };

  const [isBankModalOpen, setIsBankModalOpen] = useState(false);
  const [advice, setAdvice] = useState<string | null>(null);
  const [loadingAdvice, setLoadingAdvice] = useState(false);
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatResponse, setChatResponse] = useState<string | null>(null);
  const [isChatLoading, setIsChatLoading] = useState(false);
  const [expandedBreakdown, setExpandedBreakdown] = useState<'interest' | null>(null);

  const toggleBreakdown = (section: 'banks' | 'investments' | 'savings' | 'interest') => {
    setExpandedBreakdown(prev => prev === section ? null : section);
  };

  const formatMoney = (val: number) => new Intl.NumberFormat('tr-TR', { style: 'currency', currency: 'TRY' }).format(val);
  const formatCompact = (val: number) => {
    if (Math.abs(val) >= 1000000) return `₺${(val / 1000000).toFixed(1)}M`;
    if (Math.abs(val) >= 1000) return `₺${(val / 1000).toFixed(1)}K`;
    return formatMoney(val);
  };

  const bankProcessed = useMemo(() => accounts.map(acc => ({
    ...acc,
    ...calculateAccruedInterest(acc, now)
  })), [accounts, now]);

  const totalBankValue = useMemo(() => {
    return bankProcessed
      .filter(acc => selectedBankIds.includes(acc.id))
      .reduce((a, b) => a + b.currentValue, 0);
  }, [bankProcessed, selectedBankIds]);

  const totalBankInterest = bankProcessed.reduce((a, b) => a + b.netInterest, 0);

  // Profit calculation for Dashboard KPI
  let dailyDepositProfit = 0;
  bankProcessed.forEach(acc => {
    const taxMulti = 1 - (acc.tax_rate || 0) / 100;
    if (acc.account_type === 'daily_deposit' && acc.interest_rate) {
      const workingBalance = Math.max(0, acc.balance - acc.exempt_amount);
      dailyDepositProfit += (workingBalance * (acc.interest_rate / 100)) / 365 * taxMulti;
    }
  });

  const portfolioValue = investments.reduce((acc, curr) => acc + (curr.quantity * curr.current_price), 0);

  const cardDebt = cards.reduce((acc, c) => acc + (Number(c.current_debt) || 0), 0);


  const visibleNetWorth = useMemo(() => {
    let total = 0;
    if (assetVisibility.banks) total += totalBankValue;
    if (assetVisibility.investments) total += portfolioValue;
    if (assetVisibility.savings) total += totalVirtualValue;
    if (assetVisibility.cards) total -= cardDebt;
    return total;
  }, [assetVisibility, totalBankValue, portfolioValue, totalVirtualValue, cardDebt]);


  // Period-based Analytics
  const currentPeriodTransactions = transactions.filter(t => {
    const d = new Date(t.date);
    return d >= activePeriod.start && d <= activePeriod.end && !t.is_exempt;
  });

  const currentMonthIncome = currentPeriodTransactions.filter(t => t.type === 'income').reduce((a, b) => a + Number(b.amount), 0);
  const currentMonthExpense = currentPeriodTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0);
  const currentMonthNet = currentMonthIncome - currentMonthExpense;


  // Last 6 months bar chart data
  const monthlyBarData = useMemo(() => {
    const data: { month: string; income: number; expense: number }[] = [];
    const currentMonth_Calendar = now.getMonth();
    const currentYear_Calendar = now.getFullYear();
    for (let i = 5; i >= 0; i--) {
      const d = new Date(currentYear_Calendar, currentMonth_Calendar - i, 1);
      const label = d.toLocaleDateString('tr-TR', { month: 'short' });
      const m = d.getMonth();
      const y = d.getFullYear();
      const mTransactions = transactions.filter(t => {
        const td = new Date(t.date);
        return td.getMonth() === m && td.getFullYear() === y && !t.is_exempt;
      });
      data.push({
        month: label,
        income: mTransactions.filter(t => t.type === 'income').reduce((a, b) => a + Number(b.amount), 0),
        expense: mTransactions.filter(t => t.type === 'expense').reduce((a, b) => a + Number(b.amount), 0),
      });
    }
    return data;
  }, [transactions, now]);

  const expenseData = currentPeriodTransactions
    .filter(t => t.type === 'expense')
    .reduce((acc, curr) => {
      const existing = acc.find(item => item.name === curr.category);
      if (existing) existing.value += Number(curr.amount);
      else acc.push({ name: curr.category, value: Number(curr.amount) });
      return acc;
    }, [] as { name: string; value: number }[])
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const recentTransactions = [...transactions]
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 6);

  const recurringIncomeItems = recurring.filter(r => r.type === 'income');
  const recurringExpenseItems = recurring.filter(r => r.type === 'expense');

  const budgetAlerts = useMemo(() => {
    return budgets.filter(b => {
      const spent = currentPeriodTransactions
        .filter(t => t.category === b.category && t.type === 'expense')
        .reduce((sum, t) => sum + Number(t.amount), 0);
      return b.limit_amount > 0 && (spent / b.limit_amount) > 0.8;
    }).length;
  }, [budgets, currentPeriodTransactions]);

  const creditCardSummary = useMemo(() => {
    const totalLimit = cards.reduce((sum, c) => sum + (c.limit_amount || 0), 0);
    const totalDebt = cards.reduce((sum, c) => sum + (c.current_debt || 0), 0);
    const usagePct = totalLimit > 0 ? (totalDebt / totalLimit) * 100 : 0;
    return {
      totalDebt,
      usagePct,
      cardsList: [...cards].sort((a,b) => (b.current_debt || 0) - (a.current_debt || 0))
    };
  }, [cards]);

  const pendingTransactionsData = useMemo(() => {
    let expenseSum = 0;
    let incomeSum = 0;
    const expenseList: { category: string; amount: number; type: 'expense' }[] = [];
    const incomeList: { category: string; amount: number; type: 'income' }[] = [];

    recurring.filter(r => !r.is_exempt).forEach(rec => {
       let pointer = new Date(rec.next_date);
       let attempts = 0;
       while (pointer <= activePeriod.end && attempts < 100) {
         if (pointer >= activePeriod.start && pointer <= activePeriod.end) {
           const alreadyHandled = transactions.find(t => 
             t.type === rec.type && 
             t.category.toLowerCase() === rec.category.toLowerCase() &&
             Math.abs(Number(t.amount) - Number(rec.amount)) < 1 &&
             new Date(t.date) >= activePeriod.start
           );

           if (!alreadyHandled) {
             if (rec.type === 'expense') {
               expenseSum += Number(rec.amount);
               expenseList.push({ category: rec.category, amount: Number(rec.amount), type: 'expense' });
             } else {
               incomeSum += Number(rec.amount);
               incomeList.push({ category: rec.category, amount: Number(rec.amount), type: 'income' });
             }
           }
         }
         if (rec.frequency === 'monthly') pointer.setMonth(pointer.getMonth() + 1);
         else if (rec.frequency === 'weekly') pointer.setDate(pointer.getDate() + 7);
         else break;
         attempts++;
       }
    });

    return { 
      expenseSum, 
      incomeSum, 
      expenseList: expenseList.sort((a,b) => b.amount - a.amount), 
      incomeList: incomeList.sort((a,b) => b.amount - a.amount) 
    };
  }, [recurring, activePeriod, transactions]);

  // Calculations for EOM Forecast (Factual Based)
  const eomForecast = useMemo(() => {
    const totalLimit = budgets.length > 0 ? budgets.reduce((a, b) => a + b.limit_amount, 0) : (currentMonthIncome || 5000);
    
    // Factual EOM Net = (Money I have/will have) - (Money I spent/will spend)
    const expectedIncome = currentMonthIncome + pendingTransactionsData.incomeSum;
    const expectedExpense = currentMonthExpense + pendingTransactionsData.expenseSum;
    const projectedNet = expectedIncome - expectedExpense;

    return {
      projected: expectedExpense,
      isOverBudget: expectedExpense > totalLimit,
      remainingBudget: totalLimit,
      projectedNet
    };
  }, [currentMonthExpense, currentMonthIncome, pendingTransactionsData, budgets]);

  const budgetStatus = budgets.map(b => {
    const spent = currentPeriodTransactions
      .filter(t => t.type === 'expense' && t.category.toLowerCase() === b.category.toLowerCase())
      .reduce((sum, t) => sum + Number(t.amount), 0);
    const pct = b.limit_amount > 0 ? (spent / b.limit_amount) * 100 : 0;
    return { ...b, spent, pct };
  }).sort((a, b) => b.pct - a.pct).slice(0, 4);

  const topGoals = goals.slice(0, 3);


  const handleGetAdvice = async () => {
    setLoadingAdvice(true);
    setAdvice(null);
    try {
      const snapshot = {
        currentMonthIncome,
        currentMonthExpense,
        totalBankValue,
        totalBankInterest,
        dailyInterestEarning: dailyDepositProfit,
        portfolioValue,
        savingsValue: totalVirtualValue,
        recurringIncome: recurring.filter(r => r.type === 'income').reduce((a,b) => a + Number(b.amount), 0),
        recurringExpense: recurring.filter(r => r.type === 'expense').reduce((a,b) => a + Number(b.amount), 0),
        netWorth: visibleNetWorth || 0,
      };
      const response = await advisorAgent.getAdvice(currentPeriodTransactions, budgets, goals, snapshot); 
      setAdvice(response);
      toast.success("AI Finansal analizi tamamlandı");
    } catch (err: any) { 
      toast.error("AI analizi başarısız oldu"); 
    } finally { setLoadingAdvice(false); }
  };

  const handleAskChat = async (e: FormEvent) => {
    e.preventDefault();
    if (!chatQuestion.trim()) return;
    setIsChatLoading(true);
    setChatResponse(null);
    try {
      const snapshot = {
        currentMonthIncome,
        currentMonthExpense,
        totalBankValue,
        totalBankInterest,
        dailyInterestEarning: dailyDepositProfit,
        portfolioValue,
        savingsValue: totalVirtualValue,
        recurringIncome: recurring.filter(r => r.type === 'income').reduce((a,b) => a + Number(b.amount), 0),
        recurringExpense: recurring.filter(r => r.type === 'expense').reduce((a,b) => a + Number(b.amount), 0),
        netWorth: visibleNetWorth || 0,
      };
      const response = await advisorAgent.askQuestion(chatQuestion, snapshot);
      setChatResponse(response);
      setChatQuestion('');
    } catch (err) {
      toast.error("Sorun cevaplanamadı.");
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="space-y-5 md:space-y-6 pb-10">

      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight text-white font-display">Finansal Kokpit</h1>
          <p className="text-[var(--color-text-variant)] text-sm mt-1">
            {now.toLocaleDateString('tr-TR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        <button 
          onClick={saveTodayNetWorth}
          className="flex items-center justify-center gap-2 px-5 py-2.5 bg-white/5 border border-white/5 text-white rounded-full hover:bg-[var(--color-brand-primary)] hover:text-black font-medium transition-all backdrop-blur-md"
        >
          <RefreshCcw size={16} /> Durumu Kaydet
        </button>
      </div>

      <PendingRecurringTransactions />

      {/* INSIGHT BAR */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {budgetAlerts > 0 && (
          <div className="flex items-center gap-3 px-4 py-2.5 bg-orange-500/10 border border-orange-500/20 rounded-2xl">
            <AlertTriangle className="text-orange-500" size={16} />
            <span className="text-[11px] font-bold text-orange-200 uppercase tracking-wide">{budgetAlerts} bütçe zorlanıyor!</span>
          </div>
        )}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#4edeb3]/10 border border-[#4edeb3]/20 rounded-2xl">
          <Zap className="text-[#4edeb3]" size={16} />
          <span className="text-[11px] font-bold text-[#4edeb3] uppercase tracking-wide">Günlük {formatMoney(dailyDepositProfit)} Mevduat Karı</span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 bg-blue-500/10 border border-blue-500/20 rounded-2xl">
          <Clock className="text-blue-500" size={16} />
          <span className="text-[11px] font-bold text-blue-200 uppercase tracking-wide">{activePeriod.start.toLocaleDateString('tr-TR')} - {activePeriod.end.toLocaleDateString('tr-TR')}</span>
        </div>
      </div>

      {/* HERO SECTION */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        
        {/* Net Worth Control Card */}
        <div className="lg:col-span-12 xl:col-span-5 primary-gradient-btn rounded-3xl p-6 md:p-8 relative overflow-hidden group shadow-2xl">
          <div className="absolute -right-20 -top-20 w-80 h-80 bg-white/10 rounded-full blur-3xl pointer-events-none"></div>
          <div className="relative z-10">
            <div className="flex items-center gap-2 mb-2 opacity-60">
              <Shield size={14} />
              <p className="text-[10px] font-bold uppercase tracking-widest font-mono">Toplam Varlık Portföyü</p>
            </div>
            <h2 className="text-4xl md:text-5xl font-black text-black font-display tracking-tight mb-8">
              {formatMoney(assetVisibility.cards ? visibleNetWorth - cardDebt : visibleNetWorth)}
            </h2>
            
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { key: 'banks', label: 'Banka', val: totalBankValue, act: assetVisibility.banks },
                { key: 'investments', label: 'Yatırım', val: portfolioValue, act: assetVisibility.investments },
                { key: 'savings', label: 'Birikim', val: totalVirtualValue, act: assetVisibility.savings },
                { key: 'cards', label: 'Kredi Borcu', val: cardDebt, act: assetVisibility.cards }
              ].map(item => (
                <div key={item.key} className="flex flex-col gap-1">
                  <button
                    onClick={() => {
                      if (item.key === 'banks') {
                        setIsBankModalOpen(true);
                        setAssetVisibility(v => ({ ...v, banks: true }));
                      } else {
                        setAssetVisibility(v => ({ ...v, [item.key]: !v[item.key as keyof typeof v] }));
                      }
                    }}
                    className={`p-4 rounded-2xl border text-left transition-all w-full ${item.act && (item.key !== 'banks' || selectedBankIds.length > 0) ? 'bg-black/5 border-black/10' : 'bg-transparent border-black/5 opacity-40 grayscale'}`}
                  >
                    <p className="text-[10px] font-bold text-black/40 uppercase tracking-widest font-mono mb-1">{item.label}</p>
                    <p className="text-sm font-bold text-black font-mono">{formatCompact(item.val)}</p>
                  </button>
                </div>
              ))}
            </div>

            {expandedBreakdown === 'interest' && (
              <div className="mt-4 bg-black/10 rounded-2xl border border-black/10 p-4 animate-in slide-in-from-top-4">
                <div className="flex items-center justify-between mb-4 border-b border-black/5 pb-2">
                  <span className="text-[10px] font-bold uppercase opacity-60 flex items-center gap-2">
                    <LayoutList size={12} /> Faiz Detayları
                  </span>
                  <X size={14} className="cursor-pointer opacity-40 hover:opacity-100" onClick={() => setExpandedBreakdown(null)} />
                </div>
                <div className="space-y-2 max-h-48 overflow-y-auto custom-scrollbar pr-2">
                  {bankProcessed.filter(a => a.netInterest > 0).map(acc => (
                    <div key={acc.id} className="flex justify-between items-center text-xs p-1">
                      <span className="font-medium">{acc.name}</span>
                      <span className="font-mono font-bold text-emerald-800">+{formatMoney(acc.netInterest)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Actionable Insights Grid */}
        <div className="lg:col-span-12 xl:col-span-7 grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bento-card flex flex-col justify-between min-h-[140px]">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${currentMonthNet >= 0 ? 'bg-emerald-500/10 text-emerald-500' : 'bg-red-500/10 text-red-500'}`}>
              {currentMonthNet >= 0 ? <TrendingUp size={24} /> : <TrendingDown size={24} />}
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-variant)] font-bold uppercase mb-1">Dönem Net</p>
              <p className={`font-mono text-2xl font-black ${currentMonthNet >= 0 ? 'text-[#4edeb3]' : 'text-red-400'}`}>
                {formatCompact(currentMonthNet)}
              </p>
            </div>
          </div>

          <div className="bento-card flex flex-col justify-between min-h-[140px]">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-500 flex items-center justify-center">
              <Zap size={24} />
            </div>
            <div>
              <p className="text-[10px] text-[var(--color-text-variant)] font-bold uppercase mb-1">Günlük Kar</p>
              <p className="font-mono text-2xl font-black text-purple-400">+{formatMoney(dailyDepositProfit)}</p>
            </div>
          </div>

          <div className="bento-card flex flex-col min-h-[140px] group transition-all">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-500 flex items-center justify-center"><CreditCard size={18}/></div>
              <p className="text-[9px] font-bold uppercase opacity-40">CC Borç</p>
            </div>
            <div className="space-y-1.5 overflow-hidden">
              <p className="font-mono text-lg font-black text-white">{formatCompact(creditCardSummary.totalDebt)}</p>
              <div className="space-y-1 transition-all">
                {creditCardSummary.cardsList.slice(0, 2).map((c, i) => (
                  <div key={i} className="flex justify-between text-[10px] opacity-40 leading-tight">
                    <span className="truncate max-w-[60px]">{c.name}</span>
                    <span className="font-mono">{formatCompact(c.current_debt || 0)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="bento-card flex flex-col min-h-[140px] group">
            <div className="flex items-center justify-between mb-4">
              <div className="w-8 h-8 rounded-lg bg-yellow-500/10 text-yellow-500 flex items-center justify-center"><Clock size={18}/></div>
              <p className="text-[9px] font-bold uppercase opacity-40">Bekleyen</p>
            </div>
            <div className="space-y-1.5">
              <p className="font-mono text-lg font-black text-yellow-400">
                {formatCompact(pendingTransactionsData.expenseSum - pendingTransactionsData.incomeSum)}
              </p>
              <div className="space-y-1">
                {pendingTransactionsData.expenseList.slice(0, 2).map((e, i) => (
                  <div key={i} className="flex justify-between text-[10px] opacity-40 leading-tight">
                    <span className="truncate max-w-[60px]">{e.category}</span>
                    <span className="font-mono text-red-500">-{formatCompact(e.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Main Analysis Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 md:gap-6">
        
        {/* Charts & Trends */}
        <div className="lg:col-span-8 flex flex-col gap-6">
          {/* AI Chat Card */}
          <div className="bento-card bg-gradient-to-br from-purple-500/10 to-indigo-500/5 border border-purple-500/20 overflow-hidden">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-10 h-10 rounded-2xl bg-purple-500/20 text-purple-400 flex items-center justify-center">
                <MessageSquare size={20} />
              </div>
              <div>
                <h3 className="text-sm font-black text-white uppercase tracking-widest font-mono">AI Finansal Asistan</h3>
                <p className="text-[10px] opacity-40 font-bold uppercase">Verilerini analiz edeyim</p>
              </div>
            </div>

            <div className="space-y-4">
              <AnimatePresence mode="wait">
                {chatResponse && (
                  <motion.div 
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="p-4 bg-white/5 rounded-2xl border border-white/10 text-sm text-purple-50 leading-relaxed whitespace-pre-wrap relative group"
                  >
                    <div className="flex items-center gap-2 mb-2 text-[10px] font-bold text-purple-400/60 uppercase">
                       <Bot size={12} /> Asistan Yanıtı
                    </div>
                    {chatResponse}
                    <button 
                      onClick={() => setChatResponse(null)}
                      className="absolute top-2 right-2 p-1 hover:bg-white/10 rounded-md opacity-0 group-hover:opacity-100 transition-opacity"
                    >
                      <X size={12} />
                    </button>
                  </motion.div>
                )}
              </AnimatePresence>

              <form onSubmit={handleAskChat} className="relative mt-2">
                <input
                  type="text"
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  placeholder="Altın yatırımı mantıklı mı? En çok nereye para gidiyor?"
                  className="w-full bg-black/20 border border-white/10 rounded-2xl px-5 py-4 text-sm text-white placeholder:text-white/20 focus:outline-none focus:border-purple-500/40 transition-all pr-12"
                  disabled={isChatLoading}
                />
                <button 
                  type="submit"
                  disabled={isChatLoading || !chatQuestion.trim()}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 bg-purple-500 text-black rounded-xl flex items-center justify-center hover:scale-105 transition-transform disabled:opacity-50 disabled:hover:scale-100"
                >
                  {isChatLoading ? <Loader2 size={18} className="animate-spin" /> : <ArrowRight size={18} />}
                </button>
              </form>
              
              <div className="flex flex-wrap gap-2 pt-2">
                {['En büyük giderim ne?', 'Tasarruf önerisi', 'Borç durumum nasıl?'].map(label => (
                  <button 
                    key={label}
                    onClick={() => {
                        setChatQuestion(label);
                        // Trigger submit somehow or let the user click arrow
                    }}
                    className="text-[10px] font-bold px-3 py-1.5 bg-white/5 border border-white/5 rounded-full text-white/40 hover:text-white/100 hover:border-white/20 transition-all"
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="bento-card">
            <h3 className="text-xs font-bold uppercase tracking-widest font-mono mb-8 flex items-center gap-2">
              <BarChart3 size={16} className="text-[#4edeb3]" /> Aylık Gelir & Gider Karşılaştırması
            </h3>
            <MonthlyBarChart data={monthlyBarData} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="bento-card">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono mb-6 text-[var(--color-text-variant)]">Nakit Akışı (15'inden Beri)</h3>
              <div className="space-y-4">
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center"><ArrowUpRight size={20}/></div>
                    <div>
                      <p className="text-xs font-bold">Girişler</p>
                      <p className="text-[10px] opacity-40">Toplam Gelir</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-emerald-400">{formatMoney(currentMonthIncome)}</span>
                </div>
                <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-xl bg-red-500/10 text-red-500 flex items-center justify-center"><ArrowDownRight size={20}/></div>
                    <div>
                      <p className="text-xs font-bold">Çıkışlar</p>
                      <p className="text-[10px] opacity-40">Toplam Gider</p>
                    </div>
                  </div>
                  <span className="font-mono font-bold text-red-400">{formatMoney(currentMonthExpense)}</span>
                </div>
                <div className="pt-4 border-t border-white/10 flex justify-between items-center">
                  <span className="text-[10px] font-bold uppercase opacity-50">Dönem Net Durumu</span>
                  <span className={`font-mono text-2xl font-black ${currentMonthNet >= 0 ? 'text-[#4edeb3]' : 'text-red-400'}`}>
                    {formatMoney(currentMonthNet)}
                  </span>
                </div>
              </div>
            </div>

            <div className="bento-card">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono mb-6 text-[var(--color-text-variant)]">Kategori Bazlı Harcamalar</h3>
              {expenseData.length > 0 ? (
                <ExpensePieChart data={expenseData} compact />
              ) : (
                <div className="h-44 flex flex-col items-center justify-center opacity-30 text-xs italic">
                  <Activity size={32} className="mb-2" /> Harcama verisi bulunamadı
                </div>
              )}
            </div>
          </div>

          <div className="bento-card">
            <h3 className="text-xs font-bold uppercase tracking-widest font-mono mb-6 text-[var(--color-text-variant)] flex items-center gap-2">
              <TrendingUp size={16} className="text-[#cda4ff]" /> Varlık Gelişim Grafiği
            </h3>
            {history && history.length > 1 ? (
              <NetWorthLineChart history={history} />
            ) : (
              <div className="h-44 flex items-center justify-center text-xs opacity-30 italic font-mono">Veri toplanmaya devam ediyor...</div>
            )}
          </div>
        </div>

        {/* Sidebar Cards */}
        <div className="lg:col-span-4 space-y-6">
          
          <div className="bento-card">
            <h3 className="text-xs font-bold uppercase tracking-widest font-mono mb-4 flex items-center gap-2">
              <Landmark size={14} className="text-blue-400" /> Hesaplar
            </h3>
            <div className="space-y-3">
              {bankProcessed.slice(0, 4).map(acc => (
                <div key={acc.id} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center justify-between hover:border-white/10 transition-colors">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{acc.name}</p>
                    <p className="text-[9px] opacity-40 font-mono">%{acc.interest_rate || 0}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold font-mono">{formatCompact(acc.currentValue)}</p>
                    {acc.netInterest > 0 && <p className="text-[9px] text-emerald-400 font-mono">+{formatCompact(acc.netInterest)}</p>}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {budgetStatus.length > 0 && (
            <div className="bento-card">
              <h3 className="text-xs font-bold uppercase tracking-widest font-mono mb-4">Bütçeler</h3>
              <div className="space-y-5">
                {budgetStatus.map(b => (
                  <div key={b.id}>
                    <div className="flex justify-between items-center mb-1.5 text-[10px] font-bold">
                      <span className="uppercase tracking-tighter">{b.category}</span>
                      <span className="opacity-40 font-mono">%{b.pct.toFixed(0)}</span>
                    </div>
                    <div className="w-full h-1.5 bg-white/5 rounded-full overflow-hidden">
                      <div 
                        className={`h-full transition-all duration-500 rounded-full ${b.pct > 100 ? 'bg-red-500' : b.pct > 80 ? 'bg-yellow-500' : 'bg-emerald-500'}`}
                        style={{ width: `${Math.min(100, b.pct)}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="bento-card">
            <h3 className="text-xs font-bold uppercase tracking-widest font-mono mb-4">Son İşlemler</h3>
            <div className="space-y-3">
              {recentTransactions.map(t => (
                <div key={t.id} className="flex items-center justify-between p-3 bg-white/5 rounded-xl border border-white/5">
                  <div className="min-w-0">
                    <p className="text-xs font-bold truncate">{t.category}</p>
                    <p className="text-[9px] opacity-30">{formatDistanceToNow(new Date(t.date), { addSuffix: true, locale: tr })}</p>
                  </div>
                  <span className={`text-xs font-bold font-mono ${t.type === 'income' ? 'text-emerald-400' : 'text-white'}`}>
                    {t.type === 'income' ? '+' : '-'}{formatCompact(t.amount)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="bento-card border border-[var(--color-brand-primary)]/20 bg-gradient-to-br from-[var(--color-brand-primary)]/10 to-transparent">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] flex items-center justify-center"><Sparkles size={20} /></div>
              <div>
                <h3 className="font-bold text-white text-sm">Finansal Danışman</h3>
                <p className="text-[10px] opacity-40 uppercase tracking-tighter">AI Destekli Rapor</p>
              </div>
            </div>
            <button 
              onClick={handleGetAdvice} 
              disabled={loadingAdvice}
              className="w-full py-3 bg-[var(--color-brand-primary)] text-black rounded-2xl font-black text-xs hover:scale-[1.02] active:scale-95 transition-all shadow-lg"
            >
              {loadingAdvice ? 'ANALİZ YAPILIYOR...' : 'RAPOR OLUŞTUR'}
            </button>
          </div>
        </div>
      </div>

      {isBankModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div 
            className="absolute inset-0 bg-black/40 backdrop-blur-md animate-in fade-in duration-300"
            onClick={() => setIsBankModalOpen(false)}
          />
          <div className="relative w-full max-w-[340px] bg-[#1a1c1e] border border-white/10 rounded-[2rem] shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-300">
            <div className="p-4 border-b border-white/5 flex items-center justify-between bg-black/10">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[var(--color-brand-primary)]/10 text-[var(--color-brand-primary)] flex items-center justify-center">
                  <Landmark size={16} />
                </div>
                <div>
                  <h3 className="text-xs font-black text-white font-display">Banka Hesapları</h3>
                  <p className="text-[8px] text-white/30 uppercase font-bold tracking-widest">Görüntülenecekleri Seçin</p>
                </div>
              </div>
              <button 
                onClick={() => setIsBankModalOpen(false)}
                className="w-8 h-8 rounded-xl bg-white/5 text-white/20 hover:text-white flex items-center justify-center transition-colors"
              >
                <X size={16} />
              </button>
            </div>

            <div className="p-4 space-y-2 max-h-[50vh] overflow-y-auto custom-scrollbar">
              <button 
                onClick={() => {
                  if (selectedBankIds.length === accounts.length) setSelectedBankIds([]);
                  else setSelectedBankIds(accounts.map(a => a.id));
                }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 rounded-xl text-[8px] font-black uppercase tracking-widest text-[#4edeb3] transition-all mb-1"
              >
                {selectedBankIds.length === accounts.length ? 'Tümünü Kaldır' : 'Tümünü Seç'}
              </button>

              {bankProcessed.map(acc => {
                const isSelected = selectedBankIds.includes(acc.id);
                return (
                  <button 
                    key={acc.id} 
                    onClick={() => toggleBankSelection(acc.id)}
                    className={`w-full flex justify-between items-center p-3 rounded-2xl transition-all border text-left group ${
                      isSelected 
                        ? 'bg-white/5 border-white/10 text-white' 
                        : 'bg-transparent border-white/[0.02] text-white/10 grayscale scale-[0.98]'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className={`w-5 h-5 rounded-lg flex items-center justify-center border transition-all ${
                        isSelected ? 'bg-[#4edeb3] border-[#4edeb3] text-black shadow-[0_0_10px_rgba(78,222,179,0.2)]' : 'bg-transparent border-white/10 text-transparent'
                      }`}>
                        <CheckCircle2 size={12} strokeWidth={3} />
                      </div>
                      <div>
                        <p className="text-xs font-bold group-hover:translate-x-0.5 transition-transform">{acc.name}</p>
                        <p className="text-[8px] opacity-30 font-bold uppercase">{acc.account_type === 'term_deposit' ? 'Vadeli' : 'Vadesiz'}</p>
                      </div>
                    </div>
                    <p className="text-xs font-black font-mono">{formatMoney(acc.currentValue)}</p>
                  </button>
                );
              })}
            </div>

            <div className="p-4 bg-black/10 border-t border-white/5">
              <button 
                onClick={() => setIsBankModalOpen(false)}
                className="w-full py-3 bg-white text-black rounded-xl font-bold text-xs hover:bg-[#4edeb3] transition-all shadow-lg uppercase tracking-tight"
              >
                Tamam
              </button>
            </div>
          </div>
        </div>
      )}

      {advice && (
        <div className="glass-panel p-8 rounded-[2rem] border border-[var(--color-brand-primary)]/30 shadow-2xl relative overflow-hidden animate-in fade-in zoom-in duration-500">
           <div className="absolute top-0 right-0 p-4">
            <X size={20} className="text-white/20 hover:text-white cursor-pointer" onClick={() => setAdvice(null)} />
          </div>
          <div className="flex items-center gap-3 mb-6">
             <Sparkles className="text-[var(--color-brand-primary)]" size={24} />
             <h3 className="text-xl font-black text-white font-display">AI Strateji Raporu</h3>
          </div>
          <div className="prose prose-sm prose-invert max-w-none text-[#bbcabf] font-sans leading-relaxed whitespace-pre-wrap">
            {advice}
          </div>
        </div>
      )}
    </div>
  );
};
