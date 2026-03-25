import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { BesPortfolio } from '../types';
import { useAuth } from './useAuth';

export const useBesPortfolios = () => {
  const { user } = useAuth();
  const [bes, setBes] = useState<BesPortfolio[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setBes([]);
      setLoading(false);
      return;
    }

    const fetchBes = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('bes_portfolios')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setBes(data as BesPortfolio[]);
      }
      setLoading(false);
    };

    fetchBes();

    const subscription = supabase
      .channel('public:bes_portfolios')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'bes_portfolios', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setBes((prev) => [payload.new as BesPortfolio, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setBes((prev) => prev.filter((i) => i.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setBes((prev) => prev.map((i) => i.id === payload.new.id ? payload.new as BesPortfolio : i));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addBes = async (portfolio: Partial<BesPortfolio>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { data: besData, error: besError } = await supabase.from('bes_portfolios').insert([{ ...portfolio, user_id: user.id }]).select();
    
    if (besData && besData.length > 0) {
       const newBes = besData[0] as BesPortfolio;
       setBes(prev => [newBes, ...prev]);

       // Otomatik Gider Ekle
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
  };

  const deleteBes = async (id: string) => {
    setBes(prev => prev.filter(b => b.id !== id));
    const { error } = await supabase.from('bes_portfolios').delete().eq('id', id);
    return { error };
  };

  const updateBes = async (id: string, updates: Partial<BesPortfolio>) => {
    const { data, error } = await supabase.from('bes_portfolios').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
       setBes(prev => prev.map(b => b.id === id ? (data[0] as BesPortfolio) : b));
    }
    return { data, error };
  };

  return { bes, loading, addBes, deleteBes, updateBes };
};
