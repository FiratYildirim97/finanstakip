import { useData } from '../context/DataContext';
import { supabase } from '../lib/supabase';
import { useAuth } from './useAuth';

export const useCreditCards = () => {
  const { user } = useAuth();
  const { creditCards: cards, loading, addCard, deleteCard, updateCard } = useData();

  /**
   * Bir kartın bu ayki toplam harcamasını hesapla
   */
  const getCardMonthlyTotal = (cardId: string, expenses: { card_id: string | null; amount: number; date: string }[]) => {
    return expenses
      .filter(e => e.card_id === cardId)
      .reduce((sum, e) => sum + e.amount, 0);
  };

  /**
   * Her kartın aylık toplamını recurring_transactions'a senkronize et
   */
  const syncCardToRecurring = async (cardId: string, monthlyTotal: number, cardName: string, paymentDay: number) => {
    if (!user || monthlyTotal <= 0) return;

    const { data: existing } = await supabase
      .from('recurring_transactions')
      .select('id, amount')
      .eq('user_id', user.id)
      .eq('category', `Kredi Kartı: ${cardName}`)
      .eq('frequency', 'monthly')
      .limit(1);

    const nextPaymentDate = getNextPaymentDate(paymentDay);

    if (existing && existing.length > 0) {
      await supabase
        .from('recurring_transactions')
        .update({
          amount: monthlyTotal,
          next_date: nextPaymentDate,
          description: `${cardName} kredi kartı aylık ekstre toplamı`
        })
        .eq('id', existing[0].id);
    } else {
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

function getNextPaymentDate(paymentDay: number): string {
  const now = new Date();
  const currentDay = now.getDate();
  let year = now.getFullYear();
  let month = now.getMonth();

  if (currentDay >= paymentDay) {
    month += 1;
    if (month > 11) {
      month = 0;
      year += 1;
    }
  }

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const day = Math.min(paymentDay, daysInMonth);

  return `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
