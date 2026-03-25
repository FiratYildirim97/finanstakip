import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BankAccount } from '../types';
import { useAuth } from './useAuth';

export const useBankAccounts = () => {
  const { user } = useAuth();
  const [accounts, setAccounts] = useState<BankAccount[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setAccounts([]);
      setLoading(false);
      return;
    }

    const fetchAccounts = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bank_accounts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setAccounts(data as BankAccount[]);
      }
      setLoading(false);
    };

    fetchAccounts();

    const subscription = supabase
      .channel('public:bank_accounts')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bank_accounts', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setAccounts((prev) => [payload.new as BankAccount, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setAccounts((prev) => prev.filter((i) => i.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setAccounts((prev) => prev.map((i) => i.id === payload.new.id ? payload.new as BankAccount : i));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addAccount = async (account: Partial<BankAccount>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('bank_accounts').insert([{ ...account, user_id: user.id }]).select();
    if (data && data.length > 0) {
       setAccounts(prev => [data[0] as BankAccount, ...prev]);
    }
    return { data, error };
  };

  const deleteAccount = async (id: string) => {
    setAccounts(prev => prev.filter(acc => acc.id !== id));
    const { error } = await supabase.from('bank_accounts').delete().eq('id', id);
    return { error };
  };

  const updateAccount = async (id: string, updates: Partial<BankAccount>) => {
    const { data, error } = await supabase.from('bank_accounts').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
       setAccounts(prev => prev.map(acc => acc.id === id ? (data[0] as BankAccount) : acc));
    }
    return { data, error };
  };

  return { accounts, loading, addAccount, deleteAccount, updateAccount };
};
