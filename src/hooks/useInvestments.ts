import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { Investment } from '../types';
import { useAuth } from './useAuth';

export const useInvestments = () => {
  const { user } = useAuth();
  const [investments, setInvestments] = useState<Investment[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setInvestments([]);
      setLoading(false);
      return;
    }

    const fetchInvestments = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('investments')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      
      if (!error && data) {
        setInvestments(data as Investment[]);
      }
      setLoading(false);
    };

    fetchInvestments();

    const subscription = supabase
      .channel('public:investments')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'investments', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setInvestments((prev) => [payload.new as Investment, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setInvestments((prev) => prev.filter((i) => i.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setInvestments((prev) => prev.map((i) => i.id === payload.new.id ? payload.new as Investment : i));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addInvestment = async (investment: Partial<Investment>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('investments').insert([{ ...investment, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setInvestments(prev => [data[0] as Investment, ...prev]);
    }
    return { data, error };
  };

  const deleteInvestment = async (id: string) => {
    setInvestments(prev => prev.filter(inv => inv.id !== id));
    const { error } = await supabase.from('investments').delete().eq('id', id);
    return { error };
  };

  const updateInvestment = async (id: string, updates: Partial<Investment>) => {
    const { data, error } = await supabase.from('investments').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setInvestments(prev => prev.map(inv => inv.id === id ? (data[0] as Investment) : inv));
    }
    return { data, error };
  };

  const updateInvestmentPrices = async (priceMap: Record<string, number>) => {
    if (!user) return;
    for (const [id, newPrice] of Object.entries(priceMap)) {
      await supabase.from('investments').update({ current_price: newPrice }).eq('id', id);
    }
  };

  return { investments, loading, addInvestment, deleteInvestment, updateInvestmentPrices, updateInvestment };
};
