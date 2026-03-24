import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Transaction } from '../types';
import { useAuth } from './useAuth';

export const useTransactions = () => {
  const { user } = useAuth();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setTransactions([]);
      setLoading(false);
      return;
    }

    const fetchTransactions = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('date', { ascending: false });
      
      if (!error && data) {
        setTransactions(data as Transaction[]);
      }
      setLoading(false);
    };

    fetchTransactions();

    // Realtime Subscription
    const subscription = supabase
      .channel('public:transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'transactions', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setTransactions((prev) => [payload.new as Transaction, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setTransactions((prev) => prev.filter((t) => t.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setTransactions((prev) => prev.map((t) => t.id === payload.new.id ? payload.new as Transaction : t));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addTransaction = async (transaction: Partial<Transaction>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('transactions').insert([{ ...transaction, user_id: user.id }]).select();
    return { data, error };
  };

  const deleteTransaction = async (id: string) => {
    const { error } = await supabase.from('transactions').delete().eq('id', id);
    return { error };
  };

  return { transactions, loading, addTransaction, deleteTransaction };
};
