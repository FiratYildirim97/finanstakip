import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../hooks/useAuth';
import type {
  Transaction,
  Investment,
  NetWorthHistory,
  RecurringTransaction,
  BankAccount,
  CreditCard,
  CreditCardExpense,
  CardInstallment,
  GoldDay,
  BesPortfolio,
  LifeInsurance,
  Goal,
  Budget,
} from '../types';

// ─── Cache shape ───────────────────────────────────────────
interface DataState {
  transactions: Transaction[];
  investments: Investment[];
  netWorthHistory: NetWorthHistory[];
  recurring: RecurringTransaction[];
  accounts: BankAccount[];
  creditCards: CreditCard[];
  creditCardExpenses: CreditCardExpense[];
  cardInstallments: CardInstallment[];
  goldDays: GoldDay[];
  besPortfolios: BesPortfolio[];
  lifeInsurance: LifeInsurance[];
  goals: Goal[];
  budgets: Budget[];
  loading: boolean;
  /** individual loading flags for lazy consumers */
  loadingMap: Record<string, boolean>;
}

// ─── Setters returned by context ───────────────────────────
interface DataActions {
  // Transactions
  addTransaction: (t: Partial<Transaction>) => Promise<{ data: any; error: any }>;
  deleteTransaction: (id: string) => Promise<{ error: any }>;
  updateTransaction: (id: string, u: Partial<Transaction>) => Promise<{ data: any; error: any }>;

  // Investments
  addInvestment: (i: Partial<Investment>) => Promise<{ data: any; error: any }>;
  deleteInvestment: (id: string) => Promise<{ error: any }>;
  updateInvestment: (id: string, u: Partial<Investment>) => Promise<{ data: any; error: any }>;
  updateInvestmentPrices: (priceMap: Record<string, number>) => Promise<void>;

  // Recurring
  addRecurring: (t: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at'>) => Promise<{ data: any; error: any }>;
  deleteRecurring: (id: string) => Promise<{ error: any }>;
  updateRecurring: (id: string, u: Partial<RecurringTransaction>) => Promise<{ data: any; error: any }>;

  // Bank Accounts
  addAccount: (a: Partial<BankAccount>) => Promise<{ data: any; error: any }>;
  deleteAccount: (id: string) => Promise<{ error: any }>;
  updateAccount: (id: string, u: Partial<BankAccount>) => Promise<{ data: any; error: any }>;

  // Credit Cards
  addCard: (c: Partial<CreditCard>) => Promise<{ data: any; error: any }>;
  deleteCard: (id: string) => Promise<{ error: any }>;
  updateCard: (id: string, u: Partial<CreditCard>) => Promise<{ data: any; error: any }>;

  // Credit Card Expenses
  addExpense: (e: Partial<CreditCardExpense>) => Promise<{ data: any; error: any }>;
  deleteExpense: (id: string) => Promise<{ error: any }>;
  updateExpense: (id: string, updates: Partial<CreditCardExpense>) => Promise<{ data: any; error: any }>;
  uploadReceipt: (file: File) => Promise<string | null>;

  // Card Installments
  addCardInstallment: (i: Partial<CardInstallment>) => Promise<{ data: any; error: any }>;
  deleteCardInstallment: (id: string) => Promise<{ error: any }>;

  // Gold Days
  addGoldDay: (g: Partial<GoldDay>) => Promise<{ data: any; error: any }>;
  deleteGoldDay: (id: string) => Promise<{ error: any }>;

  // BES
  addBes: (b: Partial<BesPortfolio>) => Promise<{ data: any; error: any }>;
  deleteBes: (id: string) => Promise<{ error: any }>;
  updateBes: (id: string, u: Partial<BesPortfolio>) => Promise<{ data: any; error: any }>;

  // Life Insurance
  addLifeInsurance: (l: Partial<LifeInsurance>) => Promise<{ data: any; error: any }>;
  deleteLifeInsurance: (id: string) => Promise<{ error: any }>;
  updateLifeInsurance: (id: string, u: Partial<LifeInsurance>) => Promise<{ data: any; error: any }>;

  // Goals & Budgets
  addGoal: (g: Partial<Goal>) => Promise<any>;
  updateGoalProgress: (id: string, current_amount: number) => Promise<any>;
  addBudget: (b: Partial<Budget>) => Promise<any>;
  deleteGoal: (id: string) => Promise<any>;
  deleteBudget: (id: string) => Promise<any>;

  // Net Worth
  saveTodayNetWorth: (totalValue: number) => Promise<void>;

  // Re-fetch everything
  refetch: () => Promise<void>;
}

type DataContextType = DataState & DataActions;

const DataContext = createContext<DataContextType | null>(null);

export const useData = (): DataContextType => {
  const ctx = useContext(DataContext);
  if (!ctx) throw new Error('useData must be used within DataProvider');
  return ctx;
};

// ─── Provider ──────────────────────────────────────────────
export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { user } = useAuth();
  const mountedRef = useRef(true);

  const [state, setState] = useState<DataState>({
    transactions: [],
    investments: [],
    netWorthHistory: [],
    recurring: [],
    accounts: [],
    creditCards: [],
    creditCardExpenses: [],
    cardInstallments: [],
    goldDays: [],
    besPortfolios: [],
    lifeInsurance: [],
    goals: [],
    budgets: [],
    loading: true,
    loadingMap: {},
  });

  // ─── FETCH ALL ──────────────────────────────────────────
  const fetchAll = useCallback(async () => {
    if (!user) return;

    setState(prev => ({ ...prev, loading: true }));

    const uid = user.id;

    // Fire ALL queries in parallel — this is the core optimization
    const [
      txRes,
      invRes,
      nwRes,
      recRes,
      accRes,
      ccRes,
      cceRes,
      ciRes,
      gdRes,
      besRes,
      liRes,
      goalRes,
      budgetRes,
    ] = await Promise.all([
      supabase.from('transactions').select('*').eq('user_id', uid).order('date', { ascending: false }),
      supabase.from('investments').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('net_worth_history').select('*').eq('user_id', uid).order('date', { ascending: true }),
      supabase.from('recurring_transactions').select('*').eq('user_id', uid).order('next_date', { ascending: true }),
      supabase.from('bank_accounts').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('credit_cards').select('*').eq('user_id', uid).order('name', { ascending: true }),
      supabase.from('credit_card_expenses').select('*').eq('user_id', uid).order('date', { ascending: false }),
      supabase.from('card_installments').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('gold_days').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('bes_portfolios').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('life_insurance').select('*').eq('user_id', uid).order('created_at', { ascending: false }),
      supabase.from('goals').select('*').eq('user_id', uid),
      supabase.from('budgets').select('*').eq('user_id', uid),
    ]);

    if (!mountedRef.current) return;

    setState({
      transactions: (txRes.data as Transaction[]) || [],
      investments: (invRes.data as Investment[]) || [],
      netWorthHistory: (nwRes.data as NetWorthHistory[]) || [],
      recurring: (recRes.data as RecurringTransaction[]) || [],
      accounts: (accRes.data as BankAccount[]) || [],
      creditCards: (ccRes.data as CreditCard[]) || [],
      creditCardExpenses: (cceRes.data as CreditCardExpense[]) || [],
      cardInstallments: (ciRes.data as CardInstallment[]) || [],
      goldDays: (gdRes.data as GoldDay[]) || [],
      besPortfolios: (besRes.data as BesPortfolio[]) || [],
      lifeInsurance: (liRes.data as LifeInsurance[]) || [],
      goals: (goalRes.data as Goal[]) || [],
      budgets: (budgetRes.data as Budget[]) || [],
      loading: false,
      loadingMap: {},
    });
  }, [user]);

  // ─── INITIAL FETCH + REALTIME ───────────────────────────
  useEffect(() => {
    mountedRef.current = true;

    if (!user) {
      setState({
        transactions: [],
        investments: [],
        netWorthHistory: [],
        recurring: [],
        accounts: [],
        creditCards: [],
        creditCardExpenses: [],
        cardInstallments: [],
        goldDays: [],
        besPortfolios: [],
        lifeInsurance: [],
        goals: [],
        budgets: [],
        loading: false,
        loadingMap: {},
      });
      return;
    }

    fetchAll();

    // Single multiplexed realtime channel for ALL tables
    const channel = supabase
      .channel('global-data-sync')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') return { ...prev, transactions: [payload.new as Transaction, ...prev.transactions] };
          if (payload.eventType === 'DELETE') return { ...prev, transactions: prev.transactions.filter(t => t.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') return { ...prev, transactions: prev.transactions.map(t => t.id === payload.new.id ? payload.new as Transaction : t) };
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') return { ...prev, investments: [payload.new as Investment, ...prev.investments] };
          if (payload.eventType === 'DELETE') return { ...prev, investments: prev.investments.filter(i => i.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') return { ...prev, investments: prev.investments.map(i => i.id === payload.new.id ? payload.new as Investment : i) };
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_transactions', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') {
            const newArr = [payload.new as RecurringTransaction, ...prev.recurring];
            return { ...prev, recurring: newArr.sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime()) };
          }
          if (payload.eventType === 'DELETE') return { ...prev, recurring: prev.recurring.filter(r => r.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') {
            const newArr = prev.recurring.map(r => r.id === payload.new.id ? payload.new as RecurringTransaction : r);
            return { ...prev, recurring: newArr.sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime()) };
          }
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') return { ...prev, accounts: [payload.new as BankAccount, ...prev.accounts] };
          if (payload.eventType === 'DELETE') return { ...prev, accounts: prev.accounts.filter(a => a.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') return { ...prev, accounts: prev.accounts.map(a => a.id === payload.new.id ? payload.new as BankAccount : a) };
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_cards', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') return { ...prev, creditCards: [...prev.creditCards, payload.new as CreditCard].sort((a, b) => a.name.localeCompare(b.name)) };
          if (payload.eventType === 'DELETE') return { ...prev, creditCards: prev.creditCards.filter(c => c.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') return { ...prev, creditCards: prev.creditCards.map(c => c.id === payload.new.id ? payload.new as CreditCard : c) };
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_card_expenses', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') return { ...prev, creditCardExpenses: [payload.new as CreditCardExpense, ...prev.creditCardExpenses] };
          if (payload.eventType === 'DELETE') return { ...prev, creditCardExpenses: prev.creditCardExpenses.filter(e => e.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') return { ...prev, creditCardExpenses: prev.creditCardExpenses.map(e => e.id === payload.new.id ? payload.new as CreditCardExpense : e) };
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gold_days', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') return { ...prev, goldDays: [payload.new as GoldDay, ...prev.goldDays] };
          if (payload.eventType === 'DELETE') return { ...prev, goldDays: prev.goldDays.filter(g => g.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') return { ...prev, goldDays: prev.goldDays.map(g => g.id === payload.new.id ? payload.new as GoldDay : g) };
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bes_portfolios', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') return { ...prev, besPortfolios: [payload.new as BesPortfolio, ...prev.besPortfolios] };
          if (payload.eventType === 'DELETE') return { ...prev, besPortfolios: prev.besPortfolios.filter(b => b.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') return { ...prev, besPortfolios: prev.besPortfolios.map(b => b.id === payload.new.id ? payload.new as BesPortfolio : b) };
          return prev;
        });
      })
      .on('postgres_changes', { event: '*', schema: 'public', table: 'life_insurance', filter: `user_id=eq.${user.id}` }, (payload) => {
        setState(prev => {
          if (payload.eventType === 'INSERT') return { ...prev, lifeInsurance: [payload.new as LifeInsurance, ...prev.lifeInsurance] };
          if (payload.eventType === 'DELETE') return { ...prev, lifeInsurance: prev.lifeInsurance.filter(l => l.id !== payload.old.id) };
          if (payload.eventType === 'UPDATE') return { ...prev, lifeInsurance: prev.lifeInsurance.map(l => l.id === payload.new.id ? payload.new as LifeInsurance : l) };
          return prev;
        });
      })
      .subscribe();

    return () => {
      mountedRef.current = false;
      supabase.removeChannel(channel);
    };
  }, [user, fetchAll]);

  // ─── ACTIONS ────────────────────────────────────────────
  // Bank Accounts
  const addAccount = useCallback(async (a: Partial<BankAccount>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('bank_accounts').insert([{ ...a, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, accounts: [data[0] as BankAccount, ...prev.accounts] }));
    }
    return { data, error };
  }, [user]);

  const deleteAccount = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, accounts: prev.accounts.filter(a => a.id !== id) }));
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    return { error };
  }, []);

  const updateAccount = useCallback(async (id: string, updates: Partial<BankAccount>) => {
    const { data, error } = await supabase.from('bank_accounts').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, accounts: prev.accounts.map(a => a.id === id ? (data[0] as BankAccount) : a) }));
    }
    return { data, error };
  }, []);

  // Helper for balance updates
  const updateAccountBalance = useCallback(async (accountId: string, amount: number, type: 'income' | 'expense', reverse: boolean = false) => {
    const account = state.accounts.find(a => a.id === accountId);
    if (!account) return;

    let adjustment = amount;
    if (type === 'expense') adjustment = -amount;
    if (reverse) adjustment = -adjustment;

    const newBalance = (Number(account.balance) || 0) + adjustment;
    await updateAccount(accountId, { balance: newBalance });
  }, [state.accounts, updateAccount]);

  // Transactions
  const addTransaction = useCallback(async (t: Partial<Transaction>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('transactions').insert([{ ...t, user_id: user.id }]).select();
    if (data && data.length > 0) {
      const newTx = data[0] as Transaction;
      setState(prev => ({ ...prev, transactions: [newTx, ...prev.transactions] }));
      
      // Update account balance if linked
      if (newTx.linked_account_id) {
        await updateAccountBalance(newTx.linked_account_id, newTx.amount, newTx.type);
      }
    }
    return { data, error };
  }, [user, updateAccountBalance]);

  const deleteTransaction = useCallback(async (id: string) => {
    const tx = state.transactions.find(t => t.id === id);
    if (tx && tx.linked_account_id) {
      await updateAccountBalance(tx.linked_account_id, tx.amount, tx.type, true);
    }

    setState(prev => ({ ...prev, transactions: prev.transactions.filter(t => t.id !== id) }));
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    return { error };
  }, [state.transactions, updateAccountBalance]);

  const updateTransaction = useCallback(async (id: string, updates: Partial<Transaction>) => {
    const oldTx = state.transactions.find(t => t.id === id);
    
    const { data, error } = await supabase.from('transactions').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      const newTx = data[0] as Transaction;
      
      // Reverse old impact
      if (oldTx && oldTx.linked_account_id) {
        await updateAccountBalance(oldTx.linked_account_id, oldTx.amount, oldTx.type, true);
      }

      // Apply new impact
      if (newTx.linked_account_id) {
        await updateAccountBalance(newTx.linked_account_id, newTx.amount, newTx.type);
      }

      setState(prev => ({ ...prev, transactions: prev.transactions.map(t => t.id === id ? newTx : t) }));
    }
    return { data, error };
  }, [state.transactions, updateAccountBalance]);

  // Investments
  const addInvestment = useCallback(async (i: Partial<Investment>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('investments').insert([{ ...i, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, investments: [data[0] as Investment, ...prev.investments] }));
    }
    return { data, error };
  }, [user]);

  const deleteInvestment = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, investments: prev.investments.filter(i => i.id !== id) }));
    const { error } = await supabase.from('investments').delete().eq('id', id);
    return { error };
  }, []);

  const updateInvestment = useCallback(async (id: string, updates: Partial<Investment>) => {
    const { data, error } = await supabase.from('investments').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, investments: prev.investments.map(i => i.id === id ? (data[0] as Investment) : i) }));
    }
    return { data, error };
  }, []);

  const updateInvestmentPrices = useCallback(async (priceMap: Record<string, number>) => {
    if (!user) return;
    // Batch update — parallel instead of serial
    await Promise.all(
      Object.entries(priceMap).map(([id, newPrice]) =>
        supabase.from('investments').update({ current_price: newPrice }).eq('id', id)
      )
    );
    // Optimistic local update
    setState(prev => ({
      ...prev,
      investments: prev.investments.map(inv => {
        const newPrice = priceMap[inv.id];
        return newPrice !== undefined ? { ...inv, current_price: newPrice } : inv;
      })
    }));
  }, [user]);

  // Recurring Transactions
  const addRecurring = useCallback(async (t: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('recurring_transactions').insert([{ ...t, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setState(prev => {
        const newArr = [data[0] as RecurringTransaction, ...prev.recurring];
        return { ...prev, recurring: newArr.sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime()) };
      });
    }
    return { data, error };
  }, [user]);

  const deleteRecurring = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, recurring: prev.recurring.filter(r => r.id !== id) }));
    const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
    return { error };
  }, []);

  const updateRecurring = useCallback(async (id: string, updates: Partial<RecurringTransaction>) => {
    const { data, error } = await supabase.from('recurring_transactions').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setState(prev => {
        const newArr = prev.recurring.map(r => r.id === id ? (data[0] as RecurringTransaction) : r);
        return { ...prev, recurring: newArr.sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime()) };
      });
    }
    return { data, error };
  }, []);

  // Credit Cards
  const addCard = useCallback(async (c: Partial<CreditCard>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('credit_cards').insert([{ ...c, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, creditCards: [...prev.creditCards, data[0] as CreditCard].sort((a, b) => a.name.localeCompare(b.name)) }));
    }
    return { data, error };
  }, [user]);

  const deleteCard = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, creditCards: prev.creditCards.filter(c => c.id !== id) }));
    const { error } = await supabase.from('credit_cards').delete().eq('id', id);
    return { error };
  }, []);

  const updateCard = useCallback(async (id: string, updates: Partial<CreditCard>) => {
    const { data, error } = await supabase.from('credit_cards').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, creditCards: prev.creditCards.map(c => c.id === id ? (data[0] as CreditCard) : c) }));
    }
    return { data, error };
  }, []);

  const updateCardDebt = useCallback(async (cardId: string, amount: number, isAddition: boolean = true) => {
    const card = state.creditCards.find(c => c.id === cardId);
    if (!card) return;

    const currentDebt = Number(card.current_debt) || 0;
    const newDebt = isAddition ? currentDebt + amount : currentDebt - amount;
    
    await updateCard(cardId, { current_debt: newDebt });
  }, [state.creditCards, updateCard]);

  // Credit Card Expenses
  const addExpense = useCallback(async (e: Partial<CreditCardExpense>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('credit_card_expenses').insert([{ ...e, user_id: user.id }]).select();
    if (data && data.length > 0) {
      const newExpense = data[0] as CreditCardExpense;
      setState(prev => ({ ...prev, creditCardExpenses: [newExpense, ...prev.creditCardExpenses] }));
      
      // Update card balance
      if (newExpense.card_id) {
        await updateCardDebt(newExpense.card_id, newExpense.amount, true);
      }
    }
    return { data, error };
  }, [user, updateCardDebt]);

  const deleteExpense = useCallback(async (id: string) => {
    const expense = state.creditCardExpenses.find(e => e.id === id);
    if (expense && expense.card_id) {
      await updateCardDebt(expense.card_id, expense.amount, false);
    }

    setState(prev => ({ ...prev, creditCardExpenses: prev.creditCardExpenses.filter(e => e.id !== id) }));
    const { error } = await supabase.from('credit_card_expenses').delete().eq('id', id);
    return { error };
  }, [state.creditCardExpenses, updateCardDebt]);

  const updateExpense = useCallback(async (id: string, updates: Partial<CreditCardExpense>) => {
    const { data, error } = await supabase.from('credit_card_expenses').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, creditCardExpenses: prev.creditCardExpenses.map(e => e.id === id ? (data[0] as CreditCardExpense) : e) }));
    }
    return { data, error };
  }, []);

  const uploadReceipt = useCallback(async (file: File): Promise<string | null> => {
    if (!user) return null;
    const fileExt = file.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;
    const { data, error } = await supabase.storage.from('receipts').upload(fileName, file, { cacheControl: '3600', upsert: false });
    if (error) { console.error('Receipt upload error:', error); return null; }
    const { data: urlData } = supabase.storage.from('receipts').getPublicUrl(data.path);
    return urlData.publicUrl;
  }, [user]);

  // Card Installments (standalone tracker — does NOT sync to recurring)
  const addCardInstallment = useCallback(async (i: Partial<CardInstallment>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('card_installments').insert([{ ...i, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, cardInstallments: [data[0] as CardInstallment, ...prev.cardInstallments] }));
    }
    return { data, error };
  }, [user]);

  const deleteCardInstallment = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, cardInstallments: prev.cardInstallments.filter(ci => ci.id !== id) }));
    const { error } = await supabase.from('card_installments').delete().eq('id', id);
    return { error };
  }, []);

  // Gold Days
  const addGoldDay = useCallback(async (g: Partial<GoldDay>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data: goldData, error: goldError } = await supabase.from('gold_days').insert([{ ...g, user_id: user.id }]).select();
    if (goldData && goldData.length > 0) {
      const newGD = goldData[0] as GoldDay;
      setState(prev => ({ ...prev, goldDays: [newGD, ...prev.goldDays] }));
      // Auto-add recurring expense
      await supabase.from('recurring_transactions').insert([{
        user_id: user.id,
        type: 'expense',
        category: `Altın Günü: ${newGD.name}`,
        amount: newGD.quantity_per_month,
        currency: newGD.gold_type,
        is_investment: false,
        linked_gold_day_id: newGD.id
      }]);
    }
    return { data: goldData, error: goldError };
  }, [user]);

  const deleteGoldDay = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, goldDays: prev.goldDays.filter(g => g.id !== id) }));
    const { error } = await supabase.from('gold_days').delete().eq('id', id);
    return { error };
  }, []);

  // BES Portfolios
  const addBes = useCallback(async (b: Partial<BesPortfolio>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data: besData, error: besError } = await supabase.from('bes_portfolios').insert([{ ...b, user_id: user.id }]).select();
    if (besData && besData.length > 0) {
      const newBes = besData[0] as BesPortfolio;
      setState(prev => ({ ...prev, besPortfolios: [newBes, ...prev.besPortfolios] }));
      // Auto-add recurring expense
      await supabase.from('recurring_transactions').insert([{
        user_id: user.id,
        type: 'expense',
        category: `BES: ${newBes.name}`,
        amount: newBes.monthly_payment,
        currency: 'TRY',
        is_investment: false,
        linked_bes_id: newBes.id
      }]);
    }
    return { data: besData, error: besError };
  }, [user]);

  const deleteBes = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, besPortfolios: prev.besPortfolios.filter(b => b.id !== id) }));
    const { error } = await supabase.from('bes_portfolios').delete().eq('id', id);
    return { error };
  }, []);

  const updateBes = useCallback(async (id: string, updates: Partial<BesPortfolio>) => {
    const { data, error } = await supabase.from('bes_portfolios').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, besPortfolios: prev.besPortfolios.map(b => b.id === id ? (data[0] as BesPortfolio) : b) }));
    }
    return { data, error };
  }, []);

  // Life Insurance
  const addLifeInsurance = useCallback(async (l: Partial<LifeInsurance>) => {
    if (!user) return { data: null, error: 'Oturum açık değil' };
    const { data: liData, error: liError } = await supabase.from('life_insurance').insert([{ ...l, user_id: user.id }]).select();
    if (liData && liData.length > 0) {
      const newLI = liData[0] as LifeInsurance;
      setState(prev => ({ ...prev, lifeInsurance: [newLI, ...prev.lifeInsurance] }));
    }
    return { data: liData, error: liError };
  }, [user]);

  const deleteLifeInsurance = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, lifeInsurance: prev.lifeInsurance.filter(l => l.id !== id) }));
    const { error } = await supabase.from('life_insurance').delete().eq('id', id);
    return { error };
  }, []);

  const updateLifeInsurance = useCallback(async (id: string, updates: Partial<LifeInsurance>) => {
    const { data, error } = await supabase.from('life_insurance').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setState(prev => ({ ...prev, lifeInsurance: prev.lifeInsurance.map(l => l.id === id ? (data[0] as LifeInsurance) : l) }));
    }
    return { data, error };
  }, []);

  // Goals & Budgets
  const addGoal = useCallback(async (g: Partial<Goal>) => {
    const res = await supabase.from('goals').insert([{ ...g, user_id: user?.id }]).select();
    if (res.data && res.data.length > 0) {
      setState(prev => ({ ...prev, goals: [...prev.goals, res.data![0] as Goal] }));
    }
    return res;
  }, [user]);

  const updateGoalProgress = useCallback(async (id: string, current_amount: number) => {
    const res = await supabase.from('goals').update({ current_amount }).eq('id', id).select();
    if (res.data && res.data.length > 0) {
      setState(prev => ({ ...prev, goals: prev.goals.map(g => g.id === id ? (res.data![0] as Goal) : g) }));
    }
    return res;
  }, []);

  const addBudget = useCallback(async (b: Partial<Budget>) => {
    const res = await supabase.from('budgets').insert([{ ...b, user_id: user?.id }]).select();
    if (res.data && res.data.length > 0) {
      setState(prev => ({ ...prev, budgets: [...prev.budgets, res.data![0] as Budget] }));
    }
    return res;
  }, [user]);

  const deleteGoal = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, goals: prev.goals.filter(g => g.id !== id) }));
    return await supabase.from('goals').delete().eq('id', id);
  }, []);

  const deleteBudget = useCallback(async (id: string) => {
    setState(prev => ({ ...prev, budgets: prev.budgets.filter(b => b.id !== id) }));
    return await supabase.from('budgets').delete().eq('id', id);
  }, []);

  // Net Worth
  const saveTodayNetWorth = useCallback(async (totalValue: number) => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('net_worth_history')
      .upsert({ user_id: user.id, date: today, total_value: totalValue })
      .select();
    if (!error && data) {
      setState(prev => {
        const filtered = prev.netWorthHistory.filter(h => h.date !== today);
        return {
          ...prev,
          netWorthHistory: [...filtered, data[0] as NetWorthHistory].sort(
            (a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()
          ),
        };
      });
    }
  }, [user]);

  // ─── CONTEXT VALUE ──────────────────────────────────────
  const value: DataContextType = {
    ...state,
    addTransaction, deleteTransaction, updateTransaction,
    addInvestment, deleteInvestment, updateInvestment, updateInvestmentPrices,
    addRecurring, deleteRecurring, updateRecurring,
    addAccount, deleteAccount, updateAccount,
    addCard, deleteCard, updateCard,
    addExpense, deleteExpense, updateExpense, uploadReceipt,
    addCardInstallment, deleteCardInstallment,
    addGoldDay, deleteGoldDay,
    addBes, deleteBes, updateBes,
    addLifeInsurance, deleteLifeInsurance, updateLifeInsurance,
    addGoal, updateGoalProgress, addBudget, deleteGoal, deleteBudget,
    saveTodayNetWorth,
    refetch: fetchAll,
  };

  return <DataContext.Provider value={value}>{children}</DataContext.Provider>;
};
