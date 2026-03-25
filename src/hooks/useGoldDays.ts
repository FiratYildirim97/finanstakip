import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { GoldDay } from '../types';
import { useAuth } from './useAuth';

export const useGoldDays = () => {
  const { user } = useAuth();
  const [goldDays, setGoldDays] = useState<GoldDay[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setGoldDays([]);
      setLoading(false);
      return;
    }

    const fetchGoldDays = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('gold_days')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (!error && data) {
        setGoldDays(data as GoldDay[]);
      }
      setLoading(false);
    };

    fetchGoldDays();

    const subscription = supabase
      .channel('public:gold_days')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'gold_days', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setGoldDays((prev) => [payload.new as GoldDay, ...prev]);
        } else if (payload.eventType === 'DELETE') {
          setGoldDays((prev) => prev.filter((i) => i.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setGoldDays((prev) => prev.map((i) => i.id === payload.new.id ? payload.new as GoldDay : i));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addGoldDay = async (goldDay: Partial<GoldDay>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { data: goldData, error: goldError } = await supabase.from('gold_days').insert([{ ...goldDay, user_id: user.id }]).select();
    
    if (goldData && goldData.length > 0) {
       const newGoldDay = goldData[0] as GoldDay;
       setGoldDays(prev => [newGoldDay, ...prev]);

       // Otomatik Gider Ekle (Miktarı gram/çeyrek tutarı olarak kaydediyoruz, kullanıcı Aylık sekmesinden düzenleyebilir)
       await supabase.from('recurring_transactions').insert([{
          user_id: user.id,
          type: 'expense',
          category: `Altın Günü: ${newGoldDay.name}`,
          amount: newGoldDay.quantity_per_month, // 1 çeyrek vs.
          currency: newGoldDay.gold_type,
          is_investment: false,
          linked_gold_day_id: newGoldDay.id
       }]);
    }
    return { data: goldData, error: goldError };
  };

  const deleteGoldDay = async (id: string) => {
    setGoldDays(prev => prev.filter(g => g.id !== id));
    const { error } = await supabase.from('gold_days').delete().eq('id', id);
    return { error };
  };

  return { goldDays, loading, addGoldDay, deleteGoldDay };
};
