import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { NetWorthHistory } from '../types';
import { useAuth } from './useAuth';
import { useTransactions } from './useTransactions';
import { useInvestments } from './useInvestments';
import { useVirtualSavings } from './useVirtualSavings';
import { useBankAccounts } from './useBankAccounts';

export const useNetWorth = () => {
  const { user } = useAuth();
  const { transactions } = useTransactions();
  const { investments } = useInvestments();
  const { totalVirtualValue } = useVirtualSavings();
  const { accounts } = useBankAccounts();
  const [history, setHistory] = useState<NetWorthHistory[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Dynamic Calculation of Current Net Worth
  const currentNetWorth = (() => {
    const cashFlow = transactions.reduce((acc, curr) => {
      return curr.type === 'income' ? acc + curr.amount : acc - curr.amount;
    }, 0);
    
    const bankCash = accounts.reduce((acc, a) => acc + a.balance, 0);
    const cash = cashFlow + bankCash;

    const portfolioValue = investments.reduce((acc, curr) => {
      return acc + (curr.quantity * curr.current_price);
    }, 0);

    return cash + portfolioValue + totalVirtualValue;
  })();

  useEffect(() => {
    if (!user) {
      setHistory([]);
      setLoading(false);
      return;
    }

    const fetchHistory = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('net_worth_history')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: true });
      
      if (!error && data) {
        setHistory(data as NetWorthHistory[]);
      }
      setLoading(false);
    };

    fetchHistory();
  }, [user]);

  const saveTodayNetWorth = async () => {
    if (!user) return;
    const today = new Date().toISOString().split('T')[0];
    const { data, error } = await supabase
      .from('net_worth_history')
      .upsert({ user_id: user.id, date: today, total_value: currentNetWorth })
      .select();
    
    if (!error && data) {
      setHistory((prev) => {
        const filtered = prev.filter(h => h.date !== today);
        return [...filtered, data[0] as NetWorthHistory].sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
      });
    }
  };

  return { currentNetWorth, history, loading, saveTodayNetWorth };
};
