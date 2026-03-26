import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { CreditCard } from '../types';
import { useAuth } from './useAuth';

export const useCreditCards = () => {
  const { user } = useAuth();
  const [cards, setCards] = useState<CreditCard[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!user) {
      setCards([]);
      setLoading(false);
      return;
    }

    const fetchCards = async () => {
      setLoading(true);
      const { data, error } = await supabase
        .from('credit_cards')
        .select('*')
        .eq('user_id', user.id)
        .order('name', { ascending: true });
      
      if (!error && data) {
        setCards(data as CreditCard[]);
      }
      setLoading(false);
    };

    fetchCards();

    const subscription = supabase
      .channel('public:credit_cards')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'credit_cards', filter: `user_id=eq.${user.id}` }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setCards((prev) => [...prev, payload.new as CreditCard].sort((a, b) => a.name.localeCompare(b.name)));
        } else if (payload.eventType === 'DELETE') {
          setCards((prev) => prev.filter((c) => c.id !== payload.old.id));
        } else if (payload.eventType === 'UPDATE') {
          setCards((prev) => prev.map((c) => c.id === payload.new.id ? payload.new as CreditCard : c));
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }, [user]);

  const addCard = async (card: Partial<CreditCard>) => {
    if (!user) return { error: 'Oturum açık değil' };
    const { data, error } = await supabase.from('credit_cards').insert([{ ...card, user_id: user.id }]).select();
    if (data && data.length > 0) {
      setCards(prev => [...prev, data[0] as CreditCard].sort((a, b) => a.name.localeCompare(b.name)));
    }
    return { data, error };
  };

  const deleteCard = async (id: string) => {
    setCards(prev => prev.filter(c => c.id !== id));
    const { error } = await supabase.from('credit_cards').delete().eq('id', id);
    return { error };
  };

  const updateCard = async (id: string, updates: Partial<CreditCard>) => {
    const { data, error } = await supabase.from('credit_cards').update(updates).eq('id', id).select();
    if (data && data.length > 0) {
      setCards(prev => prev.map(c => c.id === id ? (data[0] as CreditCard) : c));
    }
    return { data, error };
  };

  /**
   * Bir kartın bu ayki toplam harcamasını hesapla
   * (kesim günü - son ödeme günü dönemine göre)
   */
  const getCardMonthlyTotal = (cardId: string, expenses: { card_id: string | null; amount: number; date: string }[]) => {
    return expenses
      .filter(e => e.card_id === cardId)
      .reduce((sum, e) => sum + e.amount, 0);
  };

  /**
   * Her kartın aylık toplamını recurring_transactions'a senkronize et
   * Son ödeme gününde otomatik gider olarak eklenir
   */
  const syncCardToRecurring = async (cardId: string, monthlyTotal: number, cardName: string, paymentDay: number) => {
    if (!user || monthlyTotal <= 0) return;

    // Bu kart için mevcut recurring var mı kontrol et
    const { data: existing } = await supabase
      .from('recurring_transactions')
      .select('id, amount')
      .eq('user_id', user.id)
      .eq('category', `Kredi Kartı: ${cardName}`)
      .eq('frequency', 'monthly')
      .limit(1);

    const nextPaymentDate = getNextPaymentDate(paymentDay);

    if (existing && existing.length > 0) {
      // Mevcut kaydı güncelle
      await supabase
        .from('recurring_transactions')
        .update({ 
          amount: monthlyTotal, 
          next_date: nextPaymentDate,
          description: `${cardName} kredi kartı aylık ekstre toplamı`
        })
        .eq('id', existing[0].id);
    } else {
      // Yeni kayıt oluştur
      await supabase
        .from('recurring_transactions')
        .insert([{
          user_id: user.id,
          type: 'expense',
          category: `Kredi Kartı: ${cardName}`,
          amount: monthlyTotal,
          currency: 'TRY',
          description: `${cardName} kredi kartı aylık ekstre toplamı`,
          frequency: 'monthly',
          next_date: nextPaymentDate,
          is_investment: false
        }]);
    }
  };

  return { cards, loading, addCard, deleteCard, updateCard, getCardMonthlyTotal, syncCardToRecurring };
};

/**
 * Bir sonraki son ödeme tarihini hesapla
 */
function getNextPaymentDate(paymentDay: number): string {
  const now = new Date();
  const currentDay = now.getDate();
  let year = now.getFullYear();
  let month = now.getMonth();

  // Eğer bu ayın ödeme günü geçtiyse, bir sonraki aya al
  if (currentDay >= paymentDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  // Ayın son gününü kontrol et (ör: 31 Şubat yok)
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(paymentDay, daysInMonth);

  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
