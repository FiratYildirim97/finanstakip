import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { RecurringTransaction } from '../types';
import { useAuth } from './useAuth';

export const useRecurringTransactions = () => {
  const { user } = useAuth();
  const [recurring, setRecurring] = useState<RecurringTransaction[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setRecurring([]);
      setLoading(false);
      return;
    }

    const fetchRecurring = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('recurring_transactions')
        .select('*')
        .eq('user_id', user.id)
        .order('next_date', { ascending: true });
      
      if (!error && data) {
        setRecurring(data as RecurringTransaction[]);
      }
      setLoading(false);
    };

    fetchRecurring();

    const subscription = supabase
      .channel('public:recurring_transactions')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'recurring_transactions', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setRecurring((prev) => {
            const newArr = [payload.new as RecurringTransaction, ...prev];
            return newArr.sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime());
          });
        } else if (payload.eventType === 'DELETE') {
          setRecurring((prev) => prev.filter((t) => t.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setRecurring((prev) => {
            const newArr = prev.map((t) => t.id === payload.new.id ? payload.new as RecurringTransaction : t);
            return newArr.sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime());
          });
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addRecurring = async (transaction: Omit<RecurringTransaction, 'id' | 'user_id' | 'created_at'>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('recurring_transactions').insert([{ ...transaction, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setRecurring(prev => {
        const newArr = [data[0] as RecurringTransaction, ...prev];
        return newArr.sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime());
      });
    }
    return { data, error };
  };

  const deleteRecurring = async (id: string) => {
    setRecurring(prev => prev.filter(r => r.id !== id));
    const { error } = await supabase.from('recurring_transactions').delete().eq('id', id);
    return { error };
  };

  const updateRecurring = async (id: string, updates: Partial<RecurringTransaction>) => {
    const { data, error } = await supabase.from('recurring_transactions').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setRecurring(prev => {
        const newArr = prev.map(r => r.id === id ? (data[0] as RecurringTransaction) : r);
        return newArr.sort((a, b) => new Date(a.next_date).getTime() - new Date(b.next_date).getTime());
      });
    }
    return { data, error };
  };

  return { recurring, loading, addRecurring, deleteRecurring, updateRecurring };
};
